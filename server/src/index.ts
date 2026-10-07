import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import Matrix from "./matrix.js";
import knex from "./knex.js";
import morgan from "morgan";
import { exchangeCodeForToken } from "./twitch_oauth.js";
import { ManualListener } from "./listeners/manual_listener.js";
import { authRequired, isAuthenticated, login, logout, requireAdmin } from "./auth.js";
import { loadSecrets, normalizeFields, saveSecrets, secretsPresent, splitSecrets, validateFields, type SecretChanges } from "./settings.js";
import { tunnelDetails, tunnelLoginAllowed } from "./tunnel.js";
import { attachStatusFeed } from "./status_feed.js";
import { createInvite, findInviteByToken, findInviteForController, revokeInvite, type Invite } from "./invites.js";

const app = express();
const PORT = Number(process.env.PORT) || 3131;

const TWITCH_OAUTH_REDIRECT_URI = process.env.TWITCH_OAUTH_REDIRECT_URI || `http://localhost:${PORT}/oauth/twitch/callback`;
const TWITCH_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

const pendingTwitchAuthorizations = new Map<string, { listenerId: number, createdAt: number }>();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SENSITIVE_KEY = /pass|secret|token|authorization/i;

function redact(value: any): any {
  if (Array.isArray(value))
    return value.map(redact);

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => {
      return [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redact(inner)];
    }));
  }

  return value;
}

morgan.token('body', (req: Request) => {
  return JSON.stringify(redact(req.body));
});

app.use(morgan('common'));
app.use(morgan(':body'));

const matrix = new Matrix();
await matrix.start();

function normalizeJSON(value: unknown): string | null {
  if (value === undefined || value === null || value === '')
    return null;

  return typeof value === "string" ? value : JSON.stringify(value);
}

function nullIfUndefined<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function parseOptions(value: unknown): any {
  if (value === undefined || value === null || value === '')
    return null;

  return typeof value === "string" ? JSON.parse(value) : value;
}

function liveController(id: number) {
  return matrix.controllers.values().find((controller) => controller.id === id);
}

app.get("/api/session", (req: Request, res: Response) => {
  res.json({ authRequired: authRequired(), authenticated: isAuthenticated(req) });
});

app.post("/api/session", async (req: Request, res: Response) => {
  res.sendStatus(await login(req, res) ? 204 : 401);
});

app.delete("/api/session", (req: Request, res: Response) => {
  logout(req, res);
  res.sendStatus(204);
});

async function inviteContext(req: Request) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  const invite = scheme === "Bearer" && token ? findInviteByToken(token) : undefined;

  if (!invite)
    return undefined;

  const row = await knex("controllers").where("id", "=", invite.controllerId).first();

  if (!row)
    return undefined;

  const fields = matrix.controllerFields(row.kind);

  return {
    invite,
    row,
    options: splitSecrets(fields, JSON.parse(row.options || "{}") || {}).options,
    fields,
    inviteFields: fields.filter((field) => field.invite)
  };
}

function inviteResponse(context: NonNullable<Awaited<ReturnType<typeof inviteContext>>>) {
  const { invite, row, options, fields, inviteFields } = context;
  const present = secretsPresent("controller", row.id, fields);

  return {
    controller: { name: row.name, kind: row.kind },
    fields: inviteFields,
    options: Object.fromEntries(inviteFields.filter((field) => !field.secret).map((field) => [field.key, options[field.key]])),
    secrets: Object.fromEntries(inviteFields.filter((field) => field.secret).map((field) => [field.key, present[field.key]])),
    status: controllerStatus(row),
    tunnel: tunnelDetails(row.id, matrix.controllerTunnel(row.kind)) || null,
    expiresAt: invite.expiresAt
  };
}

app.get("/api/invite", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = await inviteContext(req);

    if (!context)
      return res.status(404).send("This invite link is invalid or has expired.");

    res.json(inviteResponse(context));
  } catch (err) {
    next(err);
  }
});

app.put("/api/invite", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = await inviteContext(req);

    if (!context)
      return res.status(404).send("This invite link is invalid or has expired.");

    const { row, fields, inviteFields } = context;
    const submittedOptions = req.body?.options || {};
    const submittedSecrets = req.body?.secrets || {};
    const options = { ...context.options };
    const secrets: SecretChanges = {};

    for (const field of inviteFields) {
      if (field.secret)
        secrets[field.key] = submittedSecrets[field.key];
      else if (field.key in submittedOptions)
        options[field.key] = submittedOptions[field.key];
    }

    normalizeFields(inviteFields, options);

    const problem = validateFields(inviteFields, options, secrets, {
      enforceRequired: true,
      secretsAlreadySet: secretsPresent("controller", row.id, fields)
    });

    if (problem)
      return res.status(400).send(problem);

    await knex("controllers").where("id", "=", row.id).update({ options: JSON.stringify(options) });
    saveSecrets("controller", row.id, inviteFields, secrets);

    try {
      await matrix.reloadController(row.id);
    } catch (err) {
      console.error('Error reloading controller after invite update', row.id, err);
    }

    res.json(inviteResponse({ ...context, options }));
  } catch (err) {
    next(err);
  }
});

app.post("/api/tunnel/auth", (req: Request, res: Response) => {
  res.sendStatus(tunnelLoginAllowed(req.body?.user, req.body?.password) ? 200 : 401);
});

app.use("/api", requireAdmin);

function controllerStatus(row: { id: number, active: number }): ControllerStatus {
  if (!row.active)
    return { state: "disabled" };

  return liveController(row.id)?.status
    || { state: "stopped", error: matrix.controllerErrors.get(row.id) };
}

app.get("/api/controllers", async (_: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await knex("controllers").select("*");

    rows.forEach((row) => {
      row.options = splitSecrets(matrix.controllerFields(row.kind), JSON.parse(row.options)).options;
      row.status = controllerStatus(row);
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get("/api/controllers/available", (_: Request, res: Response) => {
  const available = Array.from(matrix.availableControllers.keys());

  res.json(available);
});

app.get("/api/controllers/fields", (_: Request, res: Response) => {
  res.json(Object.fromEntries(
    Array.from(matrix.availableControllers.keys()).map((kind) => [kind, matrix.controllerFields(kind)])
  ));
});

function describeInvite(invite: Invite | undefined) {
  return invite ? { createdAt: invite.createdAt, expiresAt: invite.expiresAt } : null;
}

app.get("/api/controllers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id)
      return res.sendStatus(400);

    const row = await knex("controllers").where("id", "=", id).first();

    if (!row)
      return res.sendStatus(404);

    const fields = matrix.controllerFields(row.kind);

    row.options = splitSecrets(fields, JSON.parse(row.options)).options;
    row.secrets = secretsPresent("controller", id, fields);
    row.status = controllerStatus(row);
    row.tools = matrix.controllerTools(row.kind);
    row.tunnelUrl = tunnelDetails(id, matrix.controllerTunnel(row.kind))?.url || null;
    row.invite = describeInvite(findInviteForController(id));

    res.json(row);
  } catch (err) {
    next(err);
  }
});

function settingsSubmission(fields: SettingField[], body: any): { options: any, secrets: SecretChanges, fields: SettingField[] } | string {
  let parsed: any;

  try {
    parsed = parseOptions(body.options);
  } catch {
    return "'options' is not valid JSON.";
  }

  const split = splitSecrets(fields, parsed);
  const secrets = { ...split.secrets, ...(body.secrets || {}) };

  normalizeFields(fields, split.options);

  const problem = validateFields(fields, split.options, secrets);

  return problem || { options: split.options, secrets, fields };
}

function controllerIncomplete(
  fields: SettingField[],
  options: any,
  secrets: SecretChanges,
  secretsAlreadySet: { [key: string]: boolean } = {}
): string | undefined {
  return validateFields(fields, options, secrets, { enforceRequired: true, secretsAlreadySet });
}

app.post("/api/controllers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active, name, kind } = req.body;
    const submission = settingsSubmission(matrix.controllerFields(req.body.kind), req.body);

    if (typeof submission === "string")
      return res.status(400).send(submission);

    const incomplete = controllerIncomplete(submission.fields, submission.options, submission.secrets);

    const inserted = await knex("controllers").insert({
      name, kind, options: normalizeJSON(submission.options),
      active: incomplete ? 0 : active === undefined ? 1 : Number(Boolean(Number(active)))
    }).returning('*');

    if (inserted.length <= 0)
      return res.sendStatus(500);

    const row = inserted[0];

    saveSecrets("controller", row.id, submission.fields, submission.secrets);

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
    const { active, name, kind } = req.body;

    if (!id)
      return res.sendStatus(400);

    const submission = settingsSubmission(matrix.controllerFields(req.body.kind), req.body);

    if (typeof submission === "string")
      return res.status(400).send(submission);

    const incomplete = controllerIncomplete(
      submission.fields, submission.options, submission.secrets,
      secretsPresent("controller", id, submission.fields)
    );

    const changedRows = await knex("controllers").where('id', '=', id)
      .update({
        name: name,
        kind: kind,
        options: normalizeJSON(submission.options),
        active: incomplete ? 0 : active === undefined ? undefined : Number(Boolean(Number(active)))
      });

    if (changedRows <= 0)
      return res.sendStatus(500);

    saveSecrets("controller", id, submission.fields, submission.secrets);

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

app.get("/api/controllers/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await knex("controllers").where("id", "=", parseInt(req.params.id) || 0).first();

    if (!row)
      return res.sendStatus(404);

    res.json(controllerStatus(row));
  } catch (err) {
    next(err);
  }
});

app.put("/api/controllers/:id/active", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id || typeof req.body?.active !== "boolean")
      return res.status(400).send("'active' must be true or false.");

    if (req.body.active) {
      const row = await knex("controllers").where("id", "=", id).first();

      if (!row)
        return res.sendStatus(404);

      const fields = matrix.controllerFields(row.kind);
      const incomplete = controllerIncomplete(
        fields, splitSecrets(fields, JSON.parse(row.options)).options, {},
        secretsPresent("controller", id, fields)
      );

      if (incomplete)
        return res.status(400).send(`${incomplete} Fill that in before turning this controller on.`);
    }

    const changedRows = await knex("controllers").where("id", "=", id).update({ active: req.body.active ? 1 : 0 });

    if (changedRows <= 0)
      return res.sendStatus(404);

    try {
      await matrix.reloadController(id);
    } catch (err) {
      console.error('Error reloading controller', id, err);
    }

    res.json(controllerStatus({ id, active: req.body.active ? 1 : 0 }));
  } catch (err) {
    next(err);
  }
});

app.post("/api/controllers/:id/tools/:key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const controller = liveController(parseInt(req.params.id));

    if (!controller)
      return res.status(404).send("This controller isn't running.");

    res.json(await controller.runTool(req.params.key));
  } catch (err) {
    next(err);
  }
});

const DEFAULT_INVITE_DAYS = 7;
const MAX_INVITE_DAYS = 90;

app.post("/api/controllers/:id/invite", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id || !await knex("controllers").where("id", "=", id).first())
      return res.sendStatus(404);

    const days = Number(req.body?.expiresInDays) || DEFAULT_INVITE_DAYS;

    if (days <= 0 || days > MAX_INVITE_DAYS)
      return res.status(400).send(`'expiresInDays' must be between 1 and ${MAX_INVITE_DAYS}.`);

    const { token, invite } = createInvite(id, days * 24 * 60 * 60 * 1000);

    res.status(201).json({
      ...describeInvite(invite),
      token,
      publicUrl: process.env.PUBLIC_URL || null
    });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/controllers/:id/invite", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (!id)
    return res.sendStatus(400);

  revokeInvite(id);
  res.sendStatus(204);
});

app.get("/api/listeners", async (_: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await knex("listeners").select("*");

    rows.forEach((row) => {
      row.options = splitSecrets(matrix.listenerFields(row.kind), JSON.parse(row.options)).options;
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

app.post("/api/listeners/:id/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id || !await knex("listeners").where("id", "=", id).first())
      return res.sendStatus(404);

    res.json(await matrix.testListener(id));
  } catch (err) {
    next(err);
  }
});

app.get("/api/listeners/available", (_: Request, res: Response) => {
  const available = Array.from(matrix.availableListeners.keys());

  res.json(available);
});

app.get("/api/listeners/fields", (_: Request, res: Response) => {
  res.json(Object.fromEntries(
    Array.from(matrix.availableListeners.keys()).map((kind) => [kind, matrix.listenerFields(kind)])
  ));
});

app.get("/api/listeners/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    if (!id)
      return res.sendStatus(400);

    const row = await knex("listeners").where("id", "=", id).first();

    if (!row)
      return res.sendStatus(404);

    const fields = matrix.listenerFields(row.kind);

    row.options = splitSecrets(fields, JSON.parse(row.options)).options;
    row.secrets = secretsPresent("listener", id, fields);
    row.testable = matrix.listenerTestable(row.kind);

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
    const { name, kind } = req.body;
    const submission = settingsSubmission(matrix.listenerFields(kind), req.body);

    if (typeof submission === "string")
      return res.status(400).send(submission);

    const inserted = await knex("listeners").insert({
      name, kind, options: normalizeJSON(submission.options)
    }).returning('*');

    if (inserted.length <= 0)
      return res.sendStatus(500);

    const row = inserted[0];

    saveSecrets("listener", row.id, submission.fields, submission.secrets);

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
    const { active, name, kind } = req.body;

    if (!id)
      return res.sendStatus(400);

    const submission = settingsSubmission(matrix.listenerFields(kind), req.body);

    if (typeof submission === "string")
      return res.status(400).send(submission);

    const changedRows = await knex("listeners").where('id', '=', id)
      .update({
        name: name,
        kind: kind,
        options: normalizeJSON(submission.options),
        active: active === undefined ? 1 : active
      });

    if (changedRows <= 0)
      return res.sendStatus(500);

    saveSecrets("listener", id, submission.fields, submission.secrets);

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

async function listenerExists(id: unknown): Promise<boolean> {
  return Number.isInteger(id) && Boolean(await knex("listeners").where("id", "=", id as number).first());
}

app.post("/api/rules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active, listener_id, message, rule, version, condition } = req.body;

    if (!await listenerExists(listener_id))
      return res.status(400).send("'listener_id' must be the id of an existing listener.");

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

    if (!await listenerExists(listener_id))
      return res.status(400).send("'listener_id' must be the id of an existing listener.");

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

    const fields = matrix.listenerFields(row.kind);
    const options = JSON.parse(row.options);
    const { clientSecret } = loadSecrets("listener", row.id, fields);

    if (!options.clientId || !clientSecret) {
      return res.status(400).send(`Listener '${row.name}' is missing its client ID or client secret.`);
    }

    const tokenResponse = await exchangeCodeForToken({
      clientId: options.clientId,
      clientSecret,
      code,
      redirectUri: TWITCH_OAUTH_REDIRECT_URI
    });

    saveSecrets("listener", row.id, fields, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token
    });

    const updatedOptions = {
      ...options,
      accessTokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000
    };

    await knex("listeners").where("id", "=", pending.listenerId)
      .update({ options: JSON.stringify(updatedOptions) });

    try {
      await matrix.reloadListener(pending.listenerId);
    } catch (err) {
      console.error('Error reloading listener after Twitch authorization:', pending.listenerId, err);
    }

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

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled request error:', err);
  res.sendStatus(500);
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  if (!authRequired())
    console.warn("THEBIT_ADMIN_PASSWORD is not set - the app and its API are open to anyone who can reach this port. Set it before exposing this server beyond a network you trust.");
});

attachStatusFeed(
  server,
  async () => {
    const [controllers, listeners, states] = await Promise.all([
      knex("controllers").select("id", "active"),
      knex("listeners").select("id", "active"),
      knex("controller_state").select("controller_id", "state")
    ]);

    return {
      controllers: Object.fromEntries(controllers.map((row) => [row.id, controllerStatus(row)])),
      listeners: Object.fromEntries(listeners.map((row) => [row.id, listenerStatus(row)])),
      states: Object.fromEntries(states.map((row) => [row.controller_id, JSON.parse(row.state)]))
    };
  },
  (req) => isAuthenticated(req as Request)
);
