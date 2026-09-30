import Connection, { type Database } from 'better-sqlite3';
import * as path from 'path';
import { loadEnvFile } from "process";

loadEnvFile();

const dbPath = path.join(process.cwd(), 'thebit.sqlite');

const db: Database = new Connection(dbPath);
db.pragma('journal_mode = WAL');

db.prepare("CREATE TABLE IF NOT EXISTS listeners (id INTEGER PRIMARY KEY, name TEXT, kind TEXT, options TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS listener_rules(id INTEGER PRIMARY KEY, listener_id INTEGER, message TEXT, rule TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS controllers(id INTEGER PRIMARY KEY, name TEXT, kind TEXT, options TEXT)").run();

db.prepare("CREATE TABLE IF NOT EXISTS listener_history(id INTEGER PRIMARY KEY, listener_id INTEGER, key TEXT)").run();

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
  // Subscription metadata for listeners like Twitch EventSub, where a rule's
  // "message" alone isn't enough to create a subscription: `version` selects
  // the subscription schema version and `condition` (JSON text) carries the
  // extra scoping fields a given subscription type requires beyond what the
  // listener already knows (e.g. moderator_user_id, to_broadcaster_user_id).
  db.prepare("ALTER TABLE listener_rules ADD COLUMN version TEXT").run();
  db.prepare("ALTER TABLE listener_rules ADD COLUMN condition TEXT").run();
  db.pragma("user_version = 2");
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
    options: {
      auth: {
        token: `Bearer ${process.env.DN_ACCESS_TOKEN}`
      }
    }
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
    address: process.env.OBS_WEBSOCKET_ADDRESS,
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
