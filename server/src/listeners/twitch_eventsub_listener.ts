import WebSocket from "ws";
import axios from "axios";
import { Listener } from "./listener.js";
import type { ListenerRule } from "./listener_rule.js";
import type Matrix from "../matrix.js";
import { refreshAccessToken as refreshTwitchAccessToken } from "../twitch_oauth.js";

const DEFAULT_EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const SUBSCRIPTIONS_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";
const DEFAULT_KEEPALIVE_TIMEOUT_SECONDS = 10;
// Refresh this far ahead of the token's actual expiry, so a slightly slow
// refresh call (or an inaccurate clock) doesn't leave a gap where Helix
// calls start failing with an expired token.
const TOKEN_REFRESH_LEAD_TIME_MS = 5 * 60 * 1000;
// Backoff before retrying a failed refresh. Deliberately not computed from
// accessTokenExpiresAt - that's already in the past by the time a refresh
// fails, which would otherwise mean retrying immediately in a tight loop.
const TOKEN_REFRESH_RETRY_DELAY_MS = 5 * 60 * 1000;
// Reconnect backoff: 1s, 2s, 4s, ... capped here, so an extended outage
// (Twitch down, no network at startup) keeps retrying without hammering.
const RECONNECT_MAX_DELAY_MS = 30 * 1000;
// How long a connection attempt may sit in the WebSocket handshake before
// it's abandoned and retried.
const HANDSHAKE_TIMEOUT_MS = 10 * 1000;

// Twitch's EventSub WebSocket transport speaks its own message envelope
// (metadata.message_type / payload) rather than the {event, data} shape
// client.ts assumes, and creating a subscription is an out-of-band Helix
// API call tied to the connection's session_id rather than something a
// sandboxed rule script could ever do - so this listener owns its socket
// directly instead of going through Client/WSListener.
//
// Flow: connect -> "session_welcome" gives us a session_id -> create one
// Helix subscription per rule against that session -> "notification"
// messages carry the event payload, matched back to a rule by the Twitch
// subscription id (not the event type alone, since two rules can share a
// type with different `condition` scoping, e.g. two reward redemption
// rules for two different reward_ids). Twitch also sends
// "session_keepalive" on an interval and can ask us to migrate to a new
// socket via "session_reconnect".
//
// When `options.address` points somewhere other than Twitch's own host
// (e.g. the Twitch CLI's local EventSub WebSocket mock server, for testing),
// subscription creation is skipped and notifications are matched by event
// type instead - see handleWelcome/handleNotification.
class TwitchEventSubListener extends Listener {
  private _ws?: WebSocket;
  // The socket currently being opened that hasn't received its
  // session_welcome yet. Tracked separately from _ws (which is only set on
  // welcome) so a connection that fails before the welcome - e.g. no
  // network when the server starts - still schedules a retry.
  private _connectingSocket?: WebSocket;
  private _reconnectAttempts: number = 0;
  private _lastError?: string;
  private _failedSubscriptions: number = 0;
  private _sessionId?: string;
  private _keepaliveTimeoutSeconds: number = DEFAULT_KEEPALIVE_TIMEOUT_SECONDS;
  private _keepaliveTimer?: NodeJS.Timeout;
  private _reconnecting: boolean = false;
  // Twitch subscription id -> the ids of every rule it feeds. One
  // subscription can serve several rules, since Twitch refuses a second
  // subscription with the same type/version/condition on one session.
  private _subscriptionRuleIds: Map<string, number[]> = new Map();
  private _isRealTwitch: boolean = true;
  private _stopped: boolean = false;
  private _reconnectTimer?: NodeJS.Timeout;
  private _tokenRefreshTimer?: NodeJS.Timeout;

  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.start();
  }

  start(): void {
    if (!this.active)
      return;

    if (!this.options.clientId) {
      throw new Error(`Twitch EventSub listener '${this.name}' requires a 'clientId' option`);
    }

    if (!this.options.accessToken) {
      throw new Error(`Twitch EventSub listener '${this.name}' requires an 'accessToken' option`);
    }

    if (!this.options.broadcasterUserId) {
      throw new Error(`Twitch EventSub listener '${this.name}' requires a 'broadcasterUserId' option`);
    }

    this.connect(this.options.address || DEFAULT_EVENTSUB_URL);
    this.loadRules();
    this.scheduleTokenRefresh();
  }

  stop(): void {
    // Set before anything else - both connect() and the "close" handler's
    // reconnect scheduling check this, so nothing started here can result in
    // a new connection attempt after stop() returns.
    this._stopped = true;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }

    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer);
      this._tokenRefreshTimer = undefined;
    }

    this.clearKeepaliveTimer();
    this.revokeSubscriptions();
    this._ws?.removeAllListeners();
    this._ws?.close();
    this._connectingSocket?.removeAllListeners();
    this._connectingSocket?.terminate();
    this._connectingSocket = undefined;
  }

  get status(): ListenerStatus {
    if (!this.active) {
      return { state: "disabled" };
    }

    if (this._ws?.readyState === WebSocket.OPEN && this._sessionId && !this._reconnectTimer) {
      return this._failedSubscriptions > 0
        ? { state: "connected", error: `${this._failedSubscriptions} subscription(s) failed - check the server logs` }
        : { state: "connected" };
    }

    if (this._connectingSocket || this._reconnectTimer) {
      return { state: "connecting", error: this._lastError };
    }

    return { state: "disconnected", error: this._lastError };
  }

  parseRules(): void {
    // Rules are already loaded into `this.rules` by the time this runs.
    // Actual subscriptions can't be created here - Helix requires a live
    // session_id, which only exists once the socket handshake completes
    // (see handleWelcome).
  }

  private connect(url: string): void {
    if (this._stopped) {
      return;
    }

    console.debug(`Twitch EventSub listener '${this.name}' connecting to`, url);

    const socket = new WebSocket(url, { handshakeTimeout: HANDSHAKE_TIMEOUT_MS });
    this._connectingSocket = socket;

    socket.on("message", (data: WebSocket.RawData) => {
      this.handleMessage(socket, data);
    });

    socket.on("close", () => {
      if (this._stopped) {
        return;
      }

      if (socket === this._connectingSocket) {
        // Never got a session_welcome. If this was a Twitch-requested
        // migration, the old session is about to go away anyway, so give up
        // on migrating and start a fresh session instead.
        this._connectingSocket = undefined;
        this._reconnecting = false;
        this._lastError ??= "Connection closed before session was established";
        console.warn(`Twitch EventSub listener '${this.name}' failed to connect, retrying...`);
        this.scheduleReconnect();
      } else if (socket === this._ws && !this._reconnecting) {
        this.clearKeepaliveTimer();
        this._lastError = "Disconnected";
        console.debug(`Twitch EventSub listener '${this.name}' disconnected, reconnecting...`);
        this.scheduleReconnect();
      }
    });

    socket.on("error", (err: Error) => {
      this._lastError = err.message || String(err);
      console.error(`Twitch EventSub listener '${this.name}' socket error:`, err);
    });
  }

  private scheduleReconnect(): void {
    if (this._stopped || this._reconnectTimer) {
      return;
    }

    const delay = Math.min(1000 * 2 ** this._reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    this._reconnectAttempts++;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = undefined;
      this.connect(this.options.address || DEFAULT_EVENTSUB_URL);
    }, delay);
  }

  private handleMessage(socket: WebSocket, raw: WebSocket.RawData): void {
    if (this._stopped) {
      return;
    }

    let message: any;

    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      console.error(`Twitch EventSub listener '${this.name}' failed to parse message:`, err);
      return;
    }

    switch (message?.metadata?.message_type) {
      case "session_welcome":
        this.handleWelcome(socket, message);
        break;
      case "session_keepalive":
        this.resetKeepaliveTimer();
        break;
      case "notification":
        this.resetKeepaliveTimer();
        this.handleNotification(message);
        break;
      case "session_reconnect":
        this.handleReconnect(message);
        break;
      case "revocation":
        this.handleRevocation(message);
        break;
      default:
        console.debug(`Twitch EventSub listener '${this.name}' received unhandled message type:`, message?.metadata?.message_type);
    }
  }

  private handleWelcome(socket: WebSocket, message: any): void {
    const previousSocket = this._reconnecting ? this._ws : undefined;

    this._sessionId = message.payload?.session?.id;
    this._keepaliveTimeoutSeconds = message.payload?.session?.keepalive_timeout_seconds || DEFAULT_KEEPALIVE_TIMEOUT_SECONDS;
    this._ws = socket;
    this._reconnecting = false;
    this._connectingSocket = undefined;
    this._reconnectAttempts = 0;
    this._lastError = undefined;
    this._isRealTwitch = TwitchEventSubListener.isRealTwitchHost(socket.url);

    console.debug(`Twitch EventSub listener '${this.name}' session established:`, this._sessionId);

    this.resetKeepaliveTimer();

    if (previousSocket) {
      previousSocket.removeAllListeners();
      previousSocket.close();
    }

    if (this._isRealTwitch && previousSocket) {
      // This welcome completes a Twitch-requested migration
      // (session_reconnect). Twitch carries every subscription over to the
      // new session on its own and asks clients not to recreate them -
      // doing so only gets 409 "subscription already exists" back.
      // Notifications keep arriving under the same subscription ids, so the
      // existing subscription -> rule mapping stays as it is.
      console.debug(`Twitch EventSub listener '${this.name}' migrated to a new session, keeping existing subscriptions`);
    } else if (this._isRealTwitch) {
      // A brand new session - either the first connect, or reconnecting
      // after the old socket dropped, in which case Twitch has already
      // deleted that session's subscriptions along with it.
      this.createSubscriptions();
    } else {
      // Talking to something other than Twitch's own EventSub host - almost
      // certainly the Twitch CLI's local mock WebSocket server, used to test
      // this listener without registering real subscriptions. A real Helix
      // POST would fail anyway (the mock's session_id means nothing to
      // Twitch), so skip it and match incoming notifications by event type
      // instead of subscription id (see handleNotification).
      console.debug(`Twitch EventSub listener '${this.name}' connected to a non-Twitch host, skipping Helix subscription creation`);
    }
  }

  private handleReconnect(message: any): void {
    const reconnectUrl = message.payload?.session?.reconnect_url;

    if (!reconnectUrl) {
      return;
    }

    console.debug(`Twitch EventSub listener '${this.name}' received reconnect request`);
    this._reconnecting = true;
    this.connect(reconnectUrl);
  }

  private handleRevocation(message: any): void {
    const subscriptionId = message.payload?.subscription?.id;
    const status = message.payload?.subscription?.status;

    console.warn(`Twitch EventSub listener '${this.name}' subscription '${subscriptionId}' revoked: ${status}`);

    if (subscriptionId) {
      this._subscriptionRuleIds.delete(subscriptionId);
    }
  }

  private async handleNotification(message: any): Promise<void> {
    try {
      // Twitch's EventSub delivery is "at least once" - the same
      // message_id can arrive more than once, and their docs say to
      // dedupe on it. This runs before the rule executes at all, and
      // doesn't depend on the rule script itself producing a stable id -
      // several event types (channel.cheer among them) have no natural
      // unique field in their payload to key a `uid` off of.
      const messageId = message.metadata?.message_id;

      if (await this.checkHistory(messageId)) {
        console.debug(`Twitch EventSub listener '${this.name}' received duplicate notification '${messageId}', ignoring.`);
        return;
      }

      const subscriptionId = message.payload?.subscription?.id;
      const subscriptionType = message.payload?.subscription?.type;

      // Real Twitch traffic is matched by subscription id, since two rules can
      // share an event type with different `condition` scoping. Mock traffic
      // never went through a real Helix subscribe call (see handleWelcome), so
      // there's no id to match against - fall back to matching by event type.
      const rules = this._isRealTwitch
        ? this.findRulesBySubscriptionId(subscriptionId)
        : [...this.rules.values().filter((r) => r.active === 1 && r.message === subscriptionType)];

      if (rules.length === 0) {
        console.debug(`Twitch EventSub listener '${this.name}' received notification for unknown subscription '${subscriptionId}'`);
        return;
      }

      const event = message.payload?.event;

      for (const rule of rules) {
        const executionResult: ListenerAction | ListenerAction[] = this.execRule(rule, event);
        const listenerActions = (Array.isArray(executionResult) ? executionResult : [executionResult]).filter(Boolean);

        this.callActions(listenerActions);
      }
    } catch (err) {
      console.error(`Twitch EventSub listener '${this.name}' failed to handle notification:`, err);
    }
  }

  private findRulesBySubscriptionId(subscriptionId: string | undefined): ListenerRule[] {
    const ruleIds = subscriptionId ? this._subscriptionRuleIds.get(subscriptionId) || [] : [];

    return ruleIds
      .map((ruleId) => this.rules.get(ruleId))
      .filter((rule): rule is ListenerRule => rule !== undefined);
  }

  private static isRealTwitchHost(url: string | undefined): boolean {
    if (!url) {
      return false;
    }

    try {
      const hostname = new URL(url).hostname;

      return hostname === "twitch.tv" || hostname.endsWith(".twitch.tv");
    } catch {
      return false;
    }
  }

  private resetKeepaliveTimer(): void {
    this.clearKeepaliveTimer();

    // Grace period beyond Twitch's advertised keepalive window before we
    // give up on the connection and reconnect.
    const timeoutMs = (this._keepaliveTimeoutSeconds + 5) * 1000;

    this._keepaliveTimer = setTimeout(() => {
      console.warn(`Twitch EventSub listener '${this.name}' keepalive timed out, reconnecting...`);
      this._ws?.terminate();
    }, timeoutMs);
  }

  private clearKeepaliveTimer(): void {
    if (this._keepaliveTimer) {
      clearTimeout(this._keepaliveTimer);
      this._keepaliveTimer = undefined;
    }
  }

  private async createSubscriptions(): Promise<void> {
    this._subscriptionRuleIds.clear();
    this._failedSubscriptions = 0;

    // Rules that would produce an identical subscription share one - Twitch
    // rejects the second as a duplicate, which previously left that rule
    // silently never firing.
    const groups = new Map<string, ListenerRule[]>();

    for (const rule of this.rules.values()) {
      if (rule.active !== 1) {
        continue;
      }

      const key = this.subscriptionKey(rule);
      groups.set(key, [...(groups.get(key) || []), rule]);
    }

    for (const rules of groups.values()) {
      await this.createSubscription(rules);
    }
  }

  private subscriptionCondition(rule: ListenerRule): { [key: string]: any } {
    return {
      broadcaster_user_id: this.options.broadcasterUserId,
      // Chat subscription types (channel.chat.message, channel.chat.notification)
      // need a `user_id` identifying whose user:read:chat authorization is
      // being used to read the chat - distinct from broadcaster_user_id, and
      // not needed at all by most other subscription types.
      ...(this.options.chatUserId ? { user_id: this.options.chatUserId } : {}),
      ...rule.condition
    };
  }

  // Identifies what Twitch considers the same subscription: type, version,
  // and condition (with keys sorted, so field order in a rule's stored
  // condition JSON doesn't matter).
  private subscriptionKey(rule: ListenerRule): string {
    const condition = this.subscriptionCondition(rule);
    const sortedCondition = Object.keys(condition).sort().map((key) => [key, condition[key]]);

    return JSON.stringify([rule.message, rule.version, sortedCondition]);
  }

  // All `rules` share the same type/version/condition (see createSubscriptions).
  private async createSubscription(rules: ListenerRule[]): Promise<void> {
    const [rule] = rules;
    const ruleIds = rules.map((r) => r.id);
    const condition = this.subscriptionCondition(rule);

    try {
      const response = await axios.post(SUBSCRIPTIONS_URL, {
        type: rule.message,
        version: rule.version,
        condition,
        transport: {
          method: "websocket",
          session_id: this._sessionId
        }
      }, {
        headers: {
          "Client-Id": this.options.clientId,
          "Authorization": `Bearer ${this.options.accessToken}`,
          "Content-Type": "application/json"
        }
      });

      const subscriptionId = response.data?.data?.[0]?.id;

      if (subscriptionId) {
        this._subscriptionRuleIds.set(subscriptionId, ruleIds);
      }

      console.debug(`Twitch EventSub listener '${this.name}' subscribed to '${rule.message}' (rules ${ruleIds.join(", ")})`);
    } catch (err: any) {
      this._failedSubscriptions++;
      console.error(`Twitch EventSub listener '${this.name}' failed to subscribe to '${rule.message}':`, err?.response?.data || err.message || err);
    }
  }

  private async revokeSubscriptions(): Promise<void> {
    const subscriptionIds = [...this._subscriptionRuleIds.keys()];
    this._subscriptionRuleIds.clear();

    for (const subscriptionId of subscriptionIds) {
      try {
        await axios.delete(SUBSCRIPTIONS_URL, {
          params: { id: subscriptionId },
          headers: {
            "Client-Id": this.options.clientId,
            "Authorization": `Bearer ${this.options.accessToken}`
          }
        });
      } catch (err: any) {
        console.error(`Twitch EventSub listener '${this.name}' failed to revoke subscription '${subscriptionId}':`, err?.response?.data || err.message || err);
      }
    }
  }

  // Only meaningful once a refresh token exists (set by the /oauth/twitch
  // callback after the user completes authorization) and we know when the
  // current access token expires (accessTokenExpiresAt, set at the same
  // time). Without both, there's nothing to schedule - the configured
  // accessToken is treated as a long-lived value, e.g. an app access token
  // maintained outside this process.
  private scheduleTokenRefresh(): void {
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer);
      this._tokenRefreshTimer = undefined;
    }

    const expiresAt = this.options.accessTokenExpiresAt;

    if (!expiresAt || !this.options.refreshToken || !this.options.clientSecret) {
      return;
    }

    const delay = Math.max(expiresAt - TOKEN_REFRESH_LEAD_TIME_MS - Date.now(), 0);

    this._tokenRefreshTimer = setTimeout(() => {
      this._tokenRefreshTimer = undefined;
      this.refreshAccessToken();
    }, delay);
  }

  private async refreshAccessToken(): Promise<void> {
    if (this._stopped) {
      return;
    }

    if (!this.options.refreshToken || !this.options.clientId || !this.options.clientSecret) {
      console.warn(`Twitch EventSub listener '${this.name}' cannot refresh its access token: missing 'refreshToken', 'clientId', or 'clientSecret'`);
      return;
    }

    try {
      const tokenResponse = await refreshTwitchAccessToken({
        clientId: this.options.clientId,
        clientSecret: this.options.clientSecret,
        refreshToken: this.options.refreshToken
      });

      // update() persists to the listeners table and swaps this.options in
      // place, so createSubscription/revokeSubscriptions (which always read
      // this.options.accessToken fresh) pick up the new token immediately.
      this.update({
        name: this.name,
        kind: this.kind,
        options: {
          ...this.options,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          accessTokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000
        }
      });

      console.debug(`Twitch EventSub listener '${this.name}' refreshed its Twitch access token`);
      this.scheduleTokenRefresh();
    } catch (err: any) {
      console.error(`Twitch EventSub listener '${this.name}' failed to refresh its access token:`, err?.response?.data || err.message || err);

      if (this._stopped) {
        return;
      }

      this._tokenRefreshTimer = setTimeout(() => {
        this._tokenRefreshTimer = undefined;
        this.refreshAccessToken();
      }, TOKEN_REFRESH_RETRY_DELAY_MS);
    }
  }
}

export default TwitchEventSubListener;
export { TwitchEventSubListener };
