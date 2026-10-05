import crypto from "node:crypto";
import { deriveKey } from "./secrets.js";
import { findInviteByToken } from "./invites.js";

// Support for reaching a remote user's device through a self-hosted sish
// server (https://github.com/antoniomika/sish) instead of asking them to
// forward a port: they run one ssh command, which publishes their local
// port at https://<name>-<user>.<TUNNEL_DOMAIN>.
//
// sish is expected to run with --append-user-to-subdomain, so the ssh
// username ends up in the subdomain, and with
// --authentication-password-request-url pointed at /api/tunnel/auth here.
// Each controller gets its own fixed ssh username, and the password is its
// invite token - so only the holder of a controller's live invite link can
// publish at that controller's address, and revoking the link ends that.
// See deploy/docker-compose.yml for a matching sish setup.

interface TunnelConfig {
  domain: string;
  sshHost: string;
  sshPort: number;
}

export interface TunnelDetails {
  // The option the tunnel's address belongs in.
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

// Stable per controller and not guessable without the secrets key. Starts
// with a letter and sticks to [a-z2-7] so it's valid both as an ssh
// username and inside a DNS label.
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
    // Port 80 asks sish for an HTTP(S) tunnel, which is what carries
    // WebSockets. ServerAliveInterval keeps the session from being dropped
    // by NAT while nothing is happening.
    command: `ssh -p ${config.sshPort} -o ServerAliveInterval=30 -R ${tunnel.name}:80:localhost:${tunnel.localPort} ${user}@${config.sshHost}`
  };
}

// What sish asks before letting an ssh client in: is this password the live
// invite token of the controller this username belongs to?
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
