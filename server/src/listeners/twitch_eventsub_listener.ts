import WebSocket from "ws";
import axios from "axios";
import { Listener } from "./listener.js";
import type { ListenerRule } from "./listener_rule.js";
import type Matrix from "../matrix.js";
import { refreshAccessToken as refreshTwitchAccessToken } from "../twitch_oauth.js";
import { probeWebSocket } from "./connection_test.js";

const DEFAULT_EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const SUBSCRIPTIONS_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const DEFAULT_KEEPALIVE_TIMEOUT_SECONDS = 10;
const TOKEN_REFRESH_LEAD_TIME_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_RETRY_DELAY_MS = 5 * 60 * 1000;
const RECONNECT_MAX_DELAY_MS = 30 * 1000;
const HANDSHAKE_TIMEOUT_MS = 10 * 1000;

class TwitchEventSubListener extends Listener {
  private _ws?: WebSocket;
  private _connectingSocket?: WebSocket;
  private _reconnectAttempts: number = 0;
  private _lastError?: string;
  private _failedSubscriptions: number = 0;
  private _sessionId?: string;
  private _keepaliveTimeoutSeconds: number = DEFAULT_KEEPALIVE_TIMEOUT_SECONDS;
  private _keepaliveTimer?: NodeJS.Timeout;
  private _reconnecting: boolean = false;
  private _subscriptionRuleIds: Map<string, number[]> = new Map();
  private _isRealTwitch: boolean = true;
  private _stopped: boolean = false;
  private _reconnectTimer?: NodeJS.Timeout;
  private _tokenRefreshTimer?: NodeJS.Timeout;

  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.start();
  }

  static get fields(): SettingField[] {
    return [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        required: true,
        help: "From your application's registration at dev.twitch.tv/console/apps."
      },
      {
        key: "clientSecret",
        label: "Client secret",
        type: "password",
        secret: true,
        help: "Needed to authorize with Twitch and to refresh the access token."
      },
      {
        key: "broadcasterUserId",
        label: "Broadcaster user ID",
        type: "text",
        required: true,
        help: "The numeric user id of the channel to listen to."
      },
      {
        key: "chatUserId",
        label: "Chat user ID",
        type: "text",
        help: "Only for chat subscription types: the user id whose user:read:chat authorization is used."
      },
      {
        key: "accessToken",
        label: "Access token",
        type: "password",
        secret: true,
        help: "Set by 'Authorize with Twitch' below - only fill this in to use a token obtained some other way."
      },
      {
        key: "refreshToken",
        label: "Refresh token",
        type: "password",
        secret: true,
        help: "Set by 'Authorize with Twitch' below."
      },
      {
        key: "address",
        label: "EventSub WebSocket URL",
        type: "ws-url",
        placeholder: DEFAULT_EVENTSUB_URL,
        help: "Leave blank for Twitch itself. Point this at the Twitch CLI's mock server to test."
      }
    ];
  }

  static testConnection = async (config: ListenerConfig): Promise<ToolResult> => {
    const address = String(config.options.address || DEFAULT_EVENTSUB_URL);
    const accessToken = config.secrets?.accessToken;
    let tokenNote = "";

    if (!accessToken)
      return { ok: false, message: "There's no access token yet - use 'Authorize with Twitch' first." };

    if (TwitchEventSubListener.isRealTwitchHost(address)) {
      try {
        const { data } = await axios.get(VALIDATE_URL, { headers: { "Authorization": `OAuth ${accessToken}` } });

        if (data.client_id !== config.options.clientId)
          return { ok: false, message: "The access token belongs to a different Twitch application than the client ID set here." };

        tokenNote = data.login ? ` The access token is valid, for ${data.login}.` : " The access token is valid.";
      } catch (err: any) {
        return err?.response?.status === 401
          ? { ok: false, message: "Twitch rejected the access token - it has expired or been revoked. Use 'Authorize with Twitch' again." }
          : { ok: false, message: `Couldn't check the access token with Twitch: ${err?.message || err}` };
      }
    }

    return probeWebSocket(address, {
      onMessage: (message, _socket, finish) => {
        if (message?.metadata?.message_type === "session_welcome")
          finish({ ok: true, message: `Connected to ${TwitchEventSubListener.isRealTwitchHost(address) ? "Twitch EventSub" : address}.${tokenNote}` });
      }
    });
  };

  start(): void {
    if (!this.active)
      return;

    if (!this.options.clientId) {
      throw new Error(`Twitch EventSub listener '${this.name}' requires a 'clientId' option`);
    }

    if (!this.secret("accessToken")) {
      throw new Error(`Twitch EventSub listener '${this.name}' requires an access token`);
    }

    if (!this.options.broadcasterUserId) {
      throw new Error(`Twitch EventSub listener '${this.name}' requires a 'broadcasterUserId' option`);
    }

    this.connect(this.options.address || DEFAULT_EVENTSUB_URL);
    this.loadRules();
    this.scheduleTokenRefresh();
  }

  stop(): void {
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
    this._connectingSocket?.on("error", () => { });
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
      console.debug(`Twitch EventSub listener '${this.name}' migrated to a new session, keeping existing subscriptions`);
    } else if (this._isRealTwitch) {
      this.createSubscriptions();
    } else {
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
      const messageId = message.metadata?.message_id;

      if (await this.checkHistory(messageId)) {
        console.debug(`Twitch EventSub listener '${this.name}' received duplicate notification '${messageId}', ignoring.`);
        return;
      }

      const subscriptionId = message.payload?.subscription?.id;
      const subscriptionType = message.payload?.subscription?.type;

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
      ...(this.options.chatUserId ? { user_id: this.options.chatUserId } : {}),
      ...rule.condition
    };
  }

  private subscriptionKey(rule: ListenerRule): string {
    const condition = this.subscriptionCondition(rule);
    const sortedCondition = Object.keys(condition).sort().map((key) => [key, condition[key]]);

    return JSON.stringify([rule.message, rule.version, sortedCondition]);
  }

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
          "Authorization": `Bearer ${this.secret("accessToken")}`,
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
            "Authorization": `Bearer ${this.secret("accessToken")}`
          }
        });
      } catch (err: any) {
        console.error(`Twitch EventSub listener '${this.name}' failed to revoke subscription '${subscriptionId}':`, err?.response?.data || err.message || err);
      }
    }
  }

  private scheduleTokenRefresh(): void {
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer);
      this._tokenRefreshTimer = undefined;
    }

    const expiresAt = this.options.accessTokenExpiresAt;

    if (!expiresAt || !this.secret("refreshToken") || !this.secret("clientSecret")) {
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

    const refreshToken = this.secret("refreshToken");
    const clientSecret = this.secret("clientSecret");

    if (!refreshToken || !this.options.clientId || !clientSecret) {
      console.warn(`Twitch EventSub listener '${this.name}' cannot refresh its access token: missing 'refreshToken', 'clientId', or 'clientSecret'`);
      return;
    }

    try {
      const tokenResponse = await refreshTwitchAccessToken({
        clientId: this.options.clientId,
        clientSecret,
        refreshToken
      });

      this.storeSecrets({
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token
      });
      this.update({
        name: this.name,
        kind: this.kind,
        options: {
          ...this.options,
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
