import express, { Request, Response, NextFunction } from "express";
import path from "path";
import Matrix from "./matrix.js";
import db from "./db.js";
import knex from "./knex.js";
import morgan from "morgan";

const app = express();
const PORT = 3131;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
morgan.token('body', (req: Request) => {
  return JSON.stringify(req.body);
});

app.use(morgan('common'));
app.use(morgan(':body'));

const matrix = new Matrix();
await matrix.start();

app.get("/api/controllers", (_: Request, res: Response) => {
  res.json([...matrix.controllers.values()]);
});

app.get("/api/listeners", async (_: Request, res: Response) => {

  const rows = await knex("listeners").select("*");

  rows.forEach((row) => {
    row.options = JSON.parse(row.options);
  });

  res.json(rows);
});

app.get("/api/listeners/available", (_: Request, res: Response) => {
  const available = Array.from(matrix.availableListeners.keys());

  res.json(available);
});

app.get("/api/listeners/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (!id)
    return res.sendStatus(500);

  const rows = await knex("listeners").where("id", "=", id).limit(1).select("*");
  const row = rows[0];
  row.options = JSON.parse(row.options);

  res.json(row);
});

app.get("/api/listeners/:id/rules", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (!id)
    return res.sendStatus(500);

  const rows = await knex("listener_rules").where("listener_id", "=", id).select("*");
  res.json(rows);
});

app.post("/api/listeners", async (req: Request, res: Response) => {
  const { name, kind, options } = req.body;

  const newListener = await knex("listeners").insert({
    name, kind, options
  }).returning('*');

  console.log('newListener', newListener);

  if (newListener.length > 0) {
    res.status(201).json(newListener[0]);
  } else
    res.sendStatus(500);

  // const stmt = db.prepare(`
  //   INSERT INTO listeners (id, name, kind, options)
  //   VALUES(?,?,?,?)
  //   ON CONFLICT(id)
  //   DO UPDATE SET
  //     name=excluded.name,
  //     kind=excluded.kind,
  //     options=excluded.options
  //   `);

  // const result = stmt.run(id, name, kind, options);
  //
  // if (result.changes === 0) {
  //   res.sendStatus(500);
  // } else if (result.changes > 0 && result.lastInsertRowid > 0) {
  //   res.sendStatus(201);
  // } else {
  //   res.sendStatus(200);
  // }
});

app.put("/api/listeners/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { active, name, kind, options } = req.body;

  if (!id)
    return res.sendStatus(400);

  knex("listeners").where('id', '=', id)
    .update({
      name: name,
      kind: kind,
      options: options,
      active: active
    }).then((changedRows) => {
      matrix.stopListener(id);
      matrix.startListener(id);
      if (changedRows <= 0) {
        res.sendStatus(500);
      } else {
        res.sendStatus(200);
      }
    });
});

app.post("/api/rules", (req: Request, res: Response) => {
  const { active, listener_id, message, rule } = req.body;

  knex("listener_rules").insert({
    listener_id,
    message,
    rule,
    active
  }, 'id').then((ids) => {
    if (ids.length > 0) {
      matrix.stopListener(listener_id);
      matrix.startListener(listener_id);

      knex("listener_rules")
        .where(ids[0])
        .select("*")
        .limit(1)
        .then((rows) => res.json(rows[0]));
    } else {
      res.sendStatus(500);
    }
  });
});

app.put("/api/rules/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { active, listener_id, message, rule } = req.body;

  knex("listener_rules").where('id', '=', id)
    .update({
      listener_id,
      message,
      rule,
      active
    }).then((changedRows) => {
      if (changedRows <= 0)
        res.sendStatus(500);
      else {
        knex("listener_rules")
          .where("id", "=", id)
          .select("*")
          .limit(1)
          .then((rows) => res.json(rows[0]));
      }

      matrix.stopListener(listener_id);
      matrix.startListener(listener_id);
    });
});

app.delete("/api/rules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);

    const rule = await knex("listener_rules").where('id', '=', id).limit(1).select('*');
    const listener_id = rule[0].listener_id;

    knex("listener_rules")
      .where('id', '=', id)
      .delete()
      .then((deletedRows) => {
        if (deletedRows <= 0)
          res.sendStatus(500);
        else
          res.sendStatus(200);

        matrix.stopListener(listener_id);
        matrix.startListener(listener_id);
      });
  } catch (err) {
    next(err);
  }
});

app.use(express.static(path.join(import.meta.dirname, '..', 'client')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


