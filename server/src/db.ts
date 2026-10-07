import Connection, { type Database } from 'better-sqlite3';
import * as path from 'path';
import { loadEnvFile } from "process";

loadEnvFile();

const dbPath = path.join(process.cwd(), 'thebit.sqlite');

const db: Database = new Connection(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('wal_checkpoint(TRUNCATE)');

db.prepare("CREATE TABLE IF NOT EXISTS listeners (id INTEGER PRIMARY KEY, name TEXT, kind TEXT, options TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS listener_rules(id INTEGER PRIMARY KEY, listener_id INTEGER, message TEXT, rule TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS controllers(id INTEGER PRIMARY KEY, name TEXT, kind TEXT, options TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS listener_history(id INTEGER PRIMARY KEY, listener_id INTEGER, key TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS secrets(id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL)").run();

db.prepare("CREATE TABLE IF NOT EXISTS controller_invites(id INTEGER PRIMARY KEY, controller_id INTEGER NOT NULL UNIQUE, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run();

db.prepare("CREATE TABLE IF NOT EXISTS controller_state(controller_id INTEGER PRIMARY KEY, state TEXT NOT NULL)").run();

db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_listeners_name ON listeners (name)").run();

db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_controllers_name ON controllers (name)").run();

db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_listener_history ON listener_history (listener_id, key)").run();

interface PragmaUserVersion {
  user_version: number;
}
const pragVersion = db.pragma("user_version") as Array<PragmaUserVersion>;
const dbVersion = pragVersion[0].user_version;

console.log('dbVersion', dbVersion);

if (dbVersion < 1) {
  db.prepare("ALTER TABLE listeners ADD COLUMN active INTEGER DEFAULT 1").run();
  db.prepare("ALTER TABLE controllers ADD COLUMN active INTEGER DEFAULT 1").run();
  db.prepare("ALTER TABLE listener_rules ADD COLUMN active INTEGER DEFAULT 1").run();
  db.pragma("user_version = 1");
}

if (dbVersion < 2) {
  db.prepare("ALTER TABLE listener_rules ADD COLUMN version TEXT").run();
  db.prepare("ALTER TABLE listener_rules ADD COLUMN condition TEXT").run();
  db.pragma("user_version = 2");
}

if (dbVersion < 3) {
  const rows = db.prepare("SELECT id, options FROM controllers WHERE kind = 'obs'").all() as Array<{ id: number, options: string }>;

  for (const row of rows) {
    const options = JSON.parse(row.options || "{}") || {};

    if (typeof options.address !== "string" || options.url)
      continue;

    options.url = /^wss?:\/\//.test(options.address) ? options.address : `ws://${options.address}`;
    delete options.address;

    db.prepare("UPDATE controllers SET options = ? WHERE id = ?").run(JSON.stringify(options), row.id);
  }

  db.pragma("user_version = 3");
}

if (dbVersion < 4) {
  const rows = db.prepare("SELECT id, options FROM listeners WHERE kind = 'socketio'").all() as Array<{ id: number, options: string }>;

  for (const row of rows) {
    const options = JSON.parse(row.options || "{}") || {};
    const auth = options.options?.auth;

    if (typeof auth?.token !== "string")
      continue;

    if (!options.token && auth.token !== "Bearer undefined")
      options.token = auth.token;

    delete auth.token;

    if (Object.keys(auth).length === 0)
      delete options.options.auth;

    db.prepare("UPDATE listeners SET options = ? WHERE id = ?").run(JSON.stringify(options), row.id);
  }

  db.pragma("user_version = 4");
}

db.prepare(`
INSERT INTO listeners (name, kind, options)
VALUES (?, ?, ?)
ON CONFLICT(name) DO NOTHING;
`).run(
  'DonationFaker',
  'socketio',
  JSON.stringify({
    address: process.env.DN_ADDRESS,
    token: process.env.DN_ACCESS_TOKEN ? `Bearer ${process.env.DN_ACCESS_TOKEN}` : undefined
  })
);

db.prepare(`
INSERT INTO controllers (name, kind, options)
VALUES (?, ?, ?)
ON CONFLICT(name) DO NOTHING;
`).run(
  'MainTech',
  'obs',
  JSON.stringify({
    url: process.env.OBS_WEBSOCKET_ADDRESS ? `ws://${process.env.OBS_WEBSOCKET_ADDRESS}` : undefined,
    password: process.env.OBS_WEBSOCKET_PASSWORD,
    scenes: [
      {
        name: "TransformGame1",
        gameSource: "game1",
        moveTransitionFilterName: "transform",
        filters: ["spin", "invert", "delay"],
        sources: ["spotlight", "dvd"],
        minScale: 0.1,
        maxScale: 2.0
      }
    ]
  })
);

db.prepare(`
INSERT INTO listener_rules(id, listener_id, message, rule)
VALUES(?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING;
`).run(
  1,
  1,
  "donation:show",
  'const z = {"uid": event.donationid, "controller": "obs", "action": "shrink", "path": "TransformGame1", "magnitude": 0.1}; log(z, event); z'
);

export default db;
