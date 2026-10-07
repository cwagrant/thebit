import crypto from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import db from "./db.js";

const KEY_FILE = path.join(process.cwd(), "thebit.key");
const FORMAT_VERSION = "v1";

let cachedMasterKey: Buffer | undefined;

function parseKey(raw: string, source: string): Buffer {
  const trimmed = raw.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");

  if (key.length !== 32)
    throw new Error(`${source} must be a 32 byte key, hex or base64 encoded (e.g. from 'openssl rand -base64 32').`);

  return key;
}

function masterKey(): Buffer {
  if (cachedMasterKey)
    return cachedMasterKey;

  if (process.env.THEBIT_SECRET_KEY) {
    cachedMasterKey = parseKey(process.env.THEBIT_SECRET_KEY, "THEBIT_SECRET_KEY");
  } else if (existsSync(KEY_FILE)) {
    cachedMasterKey = parseKey(readFileSync(KEY_FILE, "utf-8"), KEY_FILE);
  } else {
    cachedMasterKey = crypto.randomBytes(32);
    writeFileSync(KEY_FILE, cachedMasterKey.toString("base64") + "\n", { mode: 0o600, flag: "wx" });
    console.log(`Generated a new secrets key at ${KEY_FILE} - back it up, stored secrets can't be read without it.`);
  }

  return cachedMasterKey;
}

export function deriveKey(purpose: string, salt: string = ""): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", masterKey(), salt, purpose, 32));
}

function encrypt(key: string, plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(key, "utf-8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);

  return [FORMAT_VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => typeof part === "string" ? part : part.toString("base64"))
    .join(":");
}

function decrypt(key: string, stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split(":");

  if (version !== FORMAT_VERSION || iv === undefined || tag === undefined || ciphertext === undefined)
    throw new Error(`Secret '${key}' is stored in an unrecognised format.`);

  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(key, "utf-8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final()
  ]).toString("utf-8");
}

export function setSecret(key: string, value: string): void {
  db.prepare(`
    INSERT INTO secrets (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, encrypt(key, value));
}

export function getSecret(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM secrets WHERE key = ?").get(key) as { value: string } | undefined;

  if (!row)
    return undefined;

  try {
    return decrypt(key, row.value);
  } catch (err: any) {
    console.error(`Unable to decrypt secret '${key}' - was the secrets key changed?`, err?.message || err);
    return undefined;
  }
}

export function hasSecret(key: string): boolean {
  return db.prepare("SELECT 1 FROM secrets WHERE key = ?").get(key) !== undefined;
}

export function deleteSecret(key: string): void {
  db.prepare("DELETE FROM secrets WHERE key = ?").run(key);
}
