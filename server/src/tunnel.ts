import crypto from "node:crypto";
import { deriveKey } from "./secrets.js";
import { findInviteByToken } from "./invites.js";

interface TunnelConfig {
  domain: string;
  sshHost: string;
  sshPort: number;
}

export interface TunnelDetails {
  field: string;
  url: string;
  command: string;
}

function tunnelConfig(): TunnelConfig | undefined {
  const domain = process.env.TUNNEL_DOMAIN;

  if (!domain)
    return undefined;

  return {
    domain,
    sshHost: process.env.TUNNEL_SSH_HOST || domain,
    sshPort: Number(process.env.TUNNEL_SSH_PORT) || 2222
  };
}

export function tunnelUser(controllerId: number): string {
  const digest = crypto.createHmac("sha256", deriveKey("tunnel-user")).update(String(controllerId)).digest();

  return "t" + digest.toString("base64url").toLowerCase().replace(/[^a-z2-7]/g, "").slice(0, 15);
}

export function tunnelDetails(controllerId: number, tunnel: ControllerTunnel | undefined): TunnelDetails | undefined {
  const config = tunnelConfig();

  if (!config || !tunnel)
    return undefined;

  const user = tunnelUser(controllerId);

  return {
    field: tunnel.field,
    url: `wss://${tunnel.name}-${user}.${config.domain}`,
    command: `ssh -p ${config.sshPort} -o ServerAliveInterval=30 -R ${tunnel.name}:80:localhost:${tunnel.localPort} ${user}@${config.sshHost}`
  };
}

export function tunnelLoginAllowed(user: unknown, password: unknown): boolean {
  if (!tunnelConfig() || typeof user !== "string" || typeof password !== "string" || !password)
    return false;

  const invite = findInviteByToken(password);

  if (!invite)
    return false;

  const expected = Buffer.from(tunnelUser(invite.controllerId));
  const given = Buffer.from(user);

  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
