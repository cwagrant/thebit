import crypto from "node:crypto";
import db from "./db.js";

export interface Invite {
  controllerId: number;
  createdAt: number;
  expiresAt: number;
}

interface InviteRow {
  controller_id: number;
  created_at: number;
  expires_at: number;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toInvite(row: InviteRow | undefined): Invite | undefined {
  if (!row || row.expires_at <= Date.now())
    return undefined;

  return { controllerId: row.controller_id, createdAt: row.created_at, expiresAt: row.expires_at };
}

export function createInvite(controllerId: number, ttlMs: number): { token: string, invite: Invite } {
  const token = crypto.randomBytes(32).toString("base64url");
  const createdAt = Date.now();
  const expiresAt = createdAt + ttlMs;

  db.prepare(`
    INSERT INTO controller_invites (controller_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(controller_id) DO UPDATE SET
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `).run(controllerId, hashToken(token), createdAt, expiresAt);

  return { token, invite: { controllerId, createdAt, expiresAt } };
}

export function findInviteByToken(token: string): Invite | undefined {
  return toInvite(
    db.prepare("SELECT * FROM controller_invites WHERE token_hash = ?").get(hashToken(token)) as InviteRow | undefined
  );
}

export function findInviteForController(controllerId: number): Invite | undefined {
  return toInvite(
    db.prepare("SELECT * FROM controller_invites WHERE controller_id = ?").get(controllerId) as InviteRow | undefined
  );
}

export function revokeInvite(controllerId: number): void {
  db.prepare("DELETE FROM controller_invites WHERE controller_id = ?").run(controllerId);
}
