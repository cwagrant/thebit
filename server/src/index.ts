import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import Matrix from "./matrix.js";
import knex from "./knex.js";
import morgan from "morgan";
import { exchangeCodeForToken } from "./twitch_oauth.js";
import { ManualListener } from "./listeners/manual_listener.js";

const app = express();
// .env has already been loaded by this point - db.ts calls loadEnvFile() and
// is pulled in through the matrix/knex imports above, which run first.
const PORT = Number(process.env.PORT) || 3131;

// Must exactly match a Redirect URL registered on the Twitch application
// being used, and must be reachable from whichever browser completes the
// authorization (localhost only works when that's the same machine running
// this server - a remote friend authorizing needs this server reachable
// from their network, e.g. via a tunnel).
const TWITCH_OAUTH_REDIRECT_URI = process.env.TWITCH_OAUTH_REDIRECT_URI || `http://localhost:${PORT}/oauth/twitch/callback`;
const TWITCH_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

// Tracks in-flight /oauth/twitch/authorize -> /oauth/twitch/callback round
// trips (keyed by the OAuth `state` param) so the callback knows which
// listener a given authorization was for. Deliberately in-memory only: this
// is a short-lived, single-use handshake, not data worth persisting.
const pendingTwitchAuthorizations = new Map<string, { listenerId: number, createdAt: number }>();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
morgan.token('body', (req: Request) => {
  return JSON.stringify(req.body);
});

app.use(morgan('common'));
app.use(morgan(':body'));

const matrix = new Matrix();
await matrix.start();

// Columns like `options`/`condition` are stored as JSON text; accept them
// either as an object (native API callers) or an already-stringified value
// (e.g. a JSON editor field).
function normalizeJSON(value: unknown): string | null {
  if (value === undefined || value === null || value === '')
    return null;

  return typeof value === "string" ? value : JSON.stringify(value);
}

// better-sqlite3 can only bind numbers, strings, bigints, buffers, and null -
// an omitted (undefined) field passed straight through to knex throws.
function nullIfUndefined<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

app.get("/api/controllers", (_: Request, res: Response) => {
  res.json([...matrix.controllers.values()]);
});

app.get("/api/controllers/available", (_: Request, res: Response) => {
  const available = Array.from(matrix.availableControllers.keys());

  res.json(available);
});

app.get("/api/controllers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id)
      return res.sendStatus(400);

    const row = await knex("controllers").where("id", "=", id).first();

    if (!row)
      return res.sendStatus(404);

    row.options = JSON.parse(row.options);

    res.json(row);
  } catch (err) {
    next(err);
  }
});

app.post("/api/controllers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, kind, options } = req.body;

    const inserted = await knex("controllers").insert({
      name, kind, options: normalizeJSON(options)
    }).returning('*');

    if (inserted.length <= 0)
      return res.sendStatus(500);

    const row = inserted[0];

    try {
      await matrix.reloadController(row.id);
    } catch (err) {
      console.error('Error starting new controller', row.name, err);
    }

    row.options = JSON.parse(row.options);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

app.put("/api/controllers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { name, kind, options } = req.body;

    if (!id)
      return res.sendStatus(400);

    const changedRows = await knex("controllers").where('id', '=', id)
      .update({
        name: name,
        kind: kind,
        options: normalizeJSON(options)
      });

    if (changedRows <= 0)
      return res.sendStatus(500);

    try {
      await matrix.reloadController(id);
      res.sendStatus(200);
    } catch (err) {
      console.error('Error reloading controller', id, err);
      res.sendStatus(500);
    }
  } catch (err) {
    next(err);
  }
});

app.get("/api/listeners", async (_: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await knex("listeners").select("*");

    rows.forEach((row) => {
      row.options = JSON.parse(row.options);
      row.status = listenerStatus(row);
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

function listenerStatus(row: { id: number, active: number }): ListenerStatus {
  if (!row.active)
    return { state: "disabled" };

  const listener = matrix.listeners.values().find((listener) => listener.id === row.id);

  if (!listener)
    return { state: "stopped", error: matrix.listenerErrors.get(row.id) };

  return listener.status;
}

// Tears down and recreates the listener from its DB row - the same thing
// saving it does - for kicking a listener that's stuck or failed to start.
app.post("/api/listeners/:id/reconnect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id)
      return res.sendStatus(400);

    try {
      await matrix.reloadListener(id);
    } catch (err) {
      console.error('Error reconnecting listener', id, err);
    }

    const row = await knex("listeners").where("id", "=", id).first();

    if (!row)
      return res.sendStatus(404);

    res.json(listenerStatus(row));
  } catch (err) {
    next(err);
  }
});

app.get("/api/listeners/available", (_: Request, res: Response) => {
  const available = Array.from(matrix.availableListeners.keys());

  res.json(available);
});

app.get("/api/listeners/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id)
      return res.sendStatus(400);

    const row = await knex("listeners").where("id", "=", id).first();

    if (!row)
      return res.sendStatus(404);

    row.options = JSON.parse(row.options);

    res.json(row);
  } catch (err) {
    next(err);
  }
});

app.get("/api/listeners/:id/rules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id)
      return res.sendStatus(400);

    const rows = await knex("listener_rules").where("listener_id", "=", id).select("*");

    rows.forEach((row) => {
      if (row.condition)
        row.condition = JSON.parse(row.condition);
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.post("/api/listeners", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, kind, options } = req.body;

    const inserted = await knex("listeners").insert({
      name, kind, options: normalizeJSON(options)
    }).returning('*');

    if (inserted.length <= 0)
      return res.sendStatus(500);

    const row = inserted[0];

    try {
      await matrix.reloadListener(row.id);
    } catch (err) {
      console.error('Error starting new listener', row.name, err);
    }

    row.options = JSON.parse(row.options);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

app.put("/api/listeners/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { active, name, kind, options } = req.body;

    if (!id)
      return res.sendStatus(400);

    const changedRows = await knex("listeners").where('id', '=', id)
      .update({
        name: name,
        kind: kind,
        options: normalizeJSON(options),
        active: active === undefined ? 1 : active
      });

    if (changedRows <= 0)
      return res.sendStatus(500);

    try {
      await matrix.reloadListener(id);
    } catch (err) {
      console.error('Error reloading listener', id, err);
    }

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

app.post("/api/rules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active, listener_id, message, rule, version, condition } = req.body;

    const ids = await knex("listener_rules").insert({
      listener_id,
      message,
      rule,
      active: active === undefined ? 1 : active,
      version: nullIfUndefined(version),
      condition: normalizeJSON(condition)
    }, 'id');

    if (ids.length <= 0)
      return res.sendStatus(500);

    try {
      await matrix.reloadListener(listener_id);
    } catch (err) {
      console.error('Error reloading listener', listener_id, err);
    }

    const row = await knex("listener_rules").where(ids[0]).first();

    res.json(row);
  } catch (err) {
    next(err);
  }
});

app.put("/api/rules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { active, listener_id, message, rule, version, condition } = req.body;

    const changedRows = await knex("listener_rules").where('id', '=', id)
      .update({
        listener_id,
        message,
        rule,
        active: active === undefined ? 1 : active,
        version: nullIfUndefined(version),
        condition: normalizeJSON(condition)
      });

    if (changedRows <= 0)
      return res.sendStatus(500);

    try {
      await matrix.reloadListener(listener_id);
    } catch (err) {
      console.error('Error reloading listener', listener_id, err);
    }

    const row = await knex("listener_rules").where("id", "=", id).first();

    res.json(row);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/rules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    const rule = await knex("listener_rules").where('id', '=', id).first();

    if (!rule)
      return res.sendStatus(404);

    const deletedRows = await knex("listener_rules").where('id', '=', id).delete();

    if (deletedRows <= 0)
      return res.sendStatus(500);

    try {
      await matrix.reloadListener(rule.listener_id);
    } catch (err) {
      console.error('Error reloading listener', rule.listener_id, err);
    }

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

// Starts a Twitch OAuth authorization for a given listener: redirects the
// browser to Twitch's consent screen, then Twitch redirects back to
// /oauth/twitch/callback with a code we exchange for tokens. The listener
// must already exist with a `clientId` (and `clientSecret`, needed at the
// callback) in its options.
app.get("/oauth/twitch/authorize", async (req: Request, res: Response) => {
  try {
    const listenerId = parseInt(req.query.listenerId as string);
    const scope = req.query.scope as string;

    if (!listenerId || !scope) {
      return res.status(400).send("Query parameters 'listenerId' and 'scope' are required.");
    }

    const row = await knex("listeners").where("id", "=", listenerId).first();

    if (!row) {
      return res.status(404).send(`No listener found with id ${listenerId}.`);
    }

    const options = JSON.parse(row.options);

    if (!options.clientId) {
      return res.status(400).send(`Listener '${row.name}' has no 'clientId' set in its options.`);
    }

    const state = crypto.randomBytes(16).toString('hex');
    pendingTwitchAuthorizations.set(state, { listenerId, createdAt: Date.now() });

    const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", options.clientId);
    authorizeUrl.searchParams.set("redirect_uri", TWITCH_OAUTH_REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", scope);
    authorizeUrl.searchParams.set("state", state);

    res.redirect(authorizeUrl.toString());
  } catch (err) {
    console.error('Error starting Twitch authorization:', err);
    res.status(500).send("Something went wrong starting Twitch authorization. Check the server logs.");
  }
});

// Where Twitch redirects back to after the user grants (or denies) consent.
app.get("/oauth/twitch/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query as { [key: string]: string };

    if (error) {
      return res.status(400).send(`Twitch authorization failed: ${error_description || error}`);
    }

    if (!code || !state) {
      return res.status(400).send("Missing 'code' or 'state' in Twitch's callback.");
    }

    const pending = pendingTwitchAuthorizations.get(state);
    pendingTwitchAuthorizations.delete(state);

    if (!pending || (Date.now() - pending.createdAt) > TWITCH_AUTHORIZATION_TTL_MS) {
      return res.status(400).send("This authorization link has expired or was already used - start over from /oauth/twitch/authorize.");
    }

    const row = await knex("listeners").where("id", "=", pending.listenerId).first();

    if (!row) {
      return res.status(404).send(`Listener ${pending.listenerId} no longer exists.`);
    }

    const options = JSON.parse(row.options);

    if (!options.clientId || !options.clientSecret) {
      return res.status(400).send(`Listener '${row.name}' is missing 'clientId'/'clientSecret' in its options.`);
    }

    const tokenResponse = await exchangeCodeForToken({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      code,
      redirectUri: TWITCH_OAUTH_REDIRECT_URI
    });

    const updatedOptions = {
      ...options,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      accessTokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000
    };

    await knex("listeners").where("id", "=", pending.listenerId)
      .update({ options: JSON.stringify(updatedOptions) });

    try {
      await matrix.reloadListener(pending.listenerId);
    } catch (err) {
      console.error('Error reloading listener after Twitch authorization:', pending.listenerId, err);
    }

    // Relative, deliberately - resolves against whatever origin the browser
    // is actually on. If TWITCH_OAUTH_REDIRECT_URI points at the Vite dev
    // server (proxied through to this route), that's localhost:5173 and
    // this lands back in the live app. In production, where this server
    // also serves the built client, it's the same origin either way.
    res.redirect(`/listeners/${pending.listenerId}`);
  } catch (err: any) {
    console.error('Twitch OAuth callback error:', err?.response?.data || err);
    res.status(500).send("Something went wrong completing Twitch authorization. Check the server logs.");
  }
});

function findManualListener(id: number): ManualListener | undefined {
  const listener = matrix.listeners.values().find((listener) => listener.id === id);

  return listener instanceof ManualListener ? listener : undefined;
}

// The controller action trees a manual listener's remote control renders -
// the successor to the old per-controller /api/obs/actions and
// /api/atem/actions routes.
app.get("/api/listeners/:id/actions", (req: Request, res: Response) => {
  const listener = findManualListener(parseInt(req.params.id));

  if (!listener)
    return res.status(400).send("This is not a live 'manual' listener.");

  res.json(listener.controllers.map((controller) => ({
    name: controller.name,
    kind: controller.kind,
    actions: controller.getActions()
  })));
});

// Fires one controller action through a manual listener, bypassing rules.
// `path` is sent as an array of segments (a scene name can itself contain a
// dot), and only actions the controller currently advertises are accepted,
// since OBS/ATEM dispatch by looking the action name up as a method.
app.post("/api/listeners/:id/actions", (req: Request, res: Response) => {
  const listener = findManualListener(parseInt(req.params.id));

  if (!listener)
    return res.status(400).send("This is not a live 'manual' listener.");

  const { controller: controllerName, action, path, props = {} } = req.body;

  if (typeof controllerName !== "string" || typeof action !== "string")
    return res.status(400).send("'controller' and 'action' must be strings.");

  if (!Array.isArray(path) || !path.every((segment) => typeof segment === "string"))
    return res.status(400).send("'path' must be an array of strings.");

  if (typeof props !== "object" || props === null || Array.isArray(props))
    return res.status(400).send("'props' must be an object.");

  const controller = listener.controllers.find((controller) => controller.name === controllerName);

  if (!controller)
    return res.status(404).send(`No controller '${controllerName}' available to this listener.`);

  if (!controller.hasAction(action, path))
    return res.status(404).send(`Controller '${controllerName}' has no action '${action}' at '${path.join(" > ")}'.`);

  listener.callActions([{ ...props, controller: controllerName, action, path: path.join(".") }]);

  res.sendStatus(202);
});

// Fires a rule on demand - used by the remote control view against a
// "manual" listener, whose rules have no external trigger of their own.
app.post("/api/rules/:id/trigger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    const rule = await knex("listener_rules").where('id', '=', id).first();

    if (!rule)
      return res.sendStatus(404);

    const listener = findManualListener(rule.listener_id);

    if (!listener)
      return res.status(400).send("This rule does not belong to a live 'manual' listener.");

    const triggered = listener.trigger(id);

    res.sendStatus(triggered ? 200 : 404);
  } catch (err) {
    next(err);
  }
});

app.use(express.static(path.join(import.meta.dirname, '..', 'client')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, '..', 'client', 'index.html'));
});

// Final safety net: an uncaught error in a route (via next(err)) gets turned
// into a 500 response here instead of becoming an unhandled rejection that
// takes down the whole process.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled request error:', err);
  res.sendStatus(500);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
