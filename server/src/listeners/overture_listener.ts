import WebSocket from "ws";
import axios from "axios";
import { Listener } from "./listener.js";
import type Matrix from "../matrix.js";
import { probeWebSocket } from "./connection_test.js";

const DEFAULT_AUTH_ENDPOINT = "https://overture.overproduced.live/api/broadcasting/auth";
const DEFAULT_PORT = 443;
const DEFAULT_ACTIVITY_TIMEOUT_SECONDS = 30;
const PONG_TIMEOUT_MS = 10 * 1000;
const RECONNECT_MAX_DELAY_MS = 30 * 1000;
const HANDSHAKE_TIMEOUT_MS = 10 * 1000;
const QUIET_EVENTS = new Set(["TimerSync"]);

class OvertureListener extends Listener {
  private _ws?: WebSocket;
  private _stopped: boolean = false;
  private _subscribed: boolean = false;
  private _lastError?: string;
  private _reconnectAttempts: number = 0;
  private _reconnectTimer?: NodeJS.Timeout;
  private _activityTimeoutSeconds: number = DEFAULT_ACTIVITY_TIMEOUT_SECONDS;
  private _activityTimer?: NodeJS.Timeout;
  private _pongTimer?: NodeJS.Timeout;

  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.start();
  }

  static get fields(): SettingField[] {
    return [
      {
        key: "reverbHost",
        label: "Reverb host",
        type: "text",
        required: true,
        placeholder: "reverb.example.com",
        help: "The Reverb server's hostname. Connects over TLS unless this starts with ws://."
      },
      {
        key: "reverbPort",
        label: "Reverb port",
        type: "text",
        placeholder: String(DEFAULT_PORT)
      },
      {
        key: "reverbKey",
        label: "Reverb app key",
        type: "text",
        required: true
      },
      {
        key: "campaignId",
        label: "Campaign ID",
        type: "text",
        required: true,
        help: "Events are read from this campaign's channel."
      },
      {
        key: "apiToken",
        label: "API token",
        type: "password",
        secret: true,
        help: "Your Overture API token - it's what authorizes listening to the campaign's private channel."
      },
      {
        key: "authEndpoint",
        label: "Auth endpoint",
        type: "text",
        placeholder: DEFAULT_AUTH_ENDPOINT,
        help: "Leave blank for Overture's own."
      }
    ];
  }

  start(): void {
    if (!this.active)
      return;

    for (const [option, label] of [["reverbHost", "Reverb host"], ["reverbKey", "Reverb app key"], ["campaignId", "campaign ID"]]) {
      if (!this.options[option])
        throw new Error(`Overture listener '${this.name}' requires a ${label}`);
    }

    if (!this.secret("apiToken"))
      throw new Error(`Overture listener '${this.name}' requires an API token`);

    this.connect();
    this.loadRules();
  }

  stop(): void {
    this._stopped = true;

    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = undefined;
    this.clearActivityTimers();
    this.discardSocket();
  }

  private discardSocket(): void {
    const socket = this._ws;

    this._ws = undefined;
    this._subscribed = false;

    if (!socket)
      return;

    socket.removeAllListeners();
    socket.on("error", () => { });
    socket.terminate();
  }

  get status(): ListenerStatus {
    if (!this.active)
      return { state: "disabled" };

    if (this._subscribed && this._ws?.readyState === WebSocket.OPEN)
      return { state: "connected" };

    if (this._ws || this._reconnectTimer)
      return { state: "connecting", error: this._lastError };

    return { state: "disconnected", error: this._lastError };
  }

  parseRules(): void {
  }

  private static channelFor(options: any): string {
    return `private-campaign.${options.campaignId}`;
  }

  private get channelName(): string {
    return OvertureListener.channelFor(this.options);
  }

  private static socketUrl(options: any): string {
    const host = String(options.reverbHost);
    const insecure = host.startsWith("ws://");
    const hostname = host.replace(/^wss?:\/\//, "").replace(/\/+$/, "");
    const port = Number(options.reverbPort) || DEFAULT_PORT;

    return `${insecure ? "ws" : "wss"}://${hostname}:${port}/app/${encodeURIComponent(options.reverbKey)}?protocol=7&client=thebit&version=1.0`;
  }

  private static async authorize(options: any, apiToken: string | undefined, socketId: string): Promise<object> {
    const channel = OvertureListener.channelFor(options);

    try {
      const response = await axios.post(
        options.authEndpoint || DEFAULT_AUTH_ENDPOINT,
        new URLSearchParams({ socket_id: socketId, channel_name: channel }).toString(),
        {
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
          }
        }
      );

      if (!response.data?.auth)
        throw new Error("the auth endpoint's reply had no signature in it");

      return { channel, auth: response.data.auth, channel_data: response.data.channel_data };
    } catch (err: any) {
      const status = err?.response?.status;

      throw new Error(status === 401 || status === 403
        ? `Overture refused access to campaign '${options.campaignId}' (HTTP ${status}) - check the API token and campaign ID`
        : `Couldn't authorize the campaign channel: ${status ? `HTTP ${status}` : err?.message || err}`);
    }
  }

  static testConnection = async (config: ListenerConfig): Promise<ToolResult> => {
    const options = config.options as any;

    for (const [option, label] of [["reverbHost", "Reverb host"], ["reverbKey", "Reverb app key"], ["campaignId", "campaign ID"]]) {
      if (!options[option])
        return { ok: false, message: `No ${label} is set.` };
    }

    if (!config.secrets?.apiToken)
      return { ok: false, message: "No API token is set." };

    return probeWebSocket(OvertureListener.socketUrl(options), {
      onMessage: async (message, socket, finish) => {
        const data = OvertureListener.parseData(message?.data);

        if (message?.event === "pusher:connection_established") {
          try {
            const subscription = await OvertureListener.authorize(options, config.secrets?.apiToken, data?.socket_id);

            socket.send(JSON.stringify({ event: "pusher:subscribe", data: subscription }));
          } catch (err: any) {
            finish({ ok: false, message: `${err.message}.` });
          }
        } else if (message?.event === "pusher:error") {
          finish({ ok: false, message: data?.message || `Reverb error ${data?.code}` });
        } else if (message?.event === "pusher_internal:subscription_succeeded") {
          finish({ ok: true, message: `Connected, and subscribed to campaign '${options.campaignId}'.` });
        }
      }
    });
  };

  private connect(): void {
    if (this._stopped)
      return;

    console.debug(`Overture listener '${this.name}' connecting to`, this.options.reverbHost);

    const socket = new WebSocket(OvertureListener.socketUrl(this.options), { handshakeTimeout: HANDSHAKE_TIMEOUT_MS });
    this._ws = socket;
    this._subscribed = false;

    socket.on("message", (data: WebSocket.RawData) => {
      this.handleMessage(socket, data);
    });

    socket.on("close", () => {
      if (this._stopped || socket !== this._ws)
        return;

      this.clearActivityTimers();
      this._ws = undefined;
      this._subscribed = false;
      this._lastError ??= "Disconnected";
      console.debug(`Overture listener '${this.name}' disconnected, reconnecting...`);
      this.scheduleReconnect();
    });

    socket.on("error", (err: Error) => {
      this._lastError = err.message || String(err);
      console.error(`Overture listener '${this.name}' socket error:`, err.message || err);
    });
  }

  private scheduleReconnect(): void {
    if (this._stopped || this._reconnectTimer)
      return;

    const delay = Math.min(1000 * 2 ** this._reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    this._reconnectAttempts++;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = undefined;
      this.connect();
    }, delay);
  }

  private send(socket: WebSocket, event: string, data: object): void {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ event, data }));
  }

  private handleMessage(socket: WebSocket, raw: WebSocket.RawData): void {
    if (this._stopped || socket !== this._ws)
      return;

    this.resetActivityTimer(socket);

    let message: any;

    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      console.error(`Overture listener '${this.name}' failed to parse message:`, err);
      return;
    }

    switch (message?.event) {
      case "pusher:connection_established":
        this.handleConnected(socket, OvertureListener.parseData(message.data));
        break;
      case "pusher:ping":
        this.send(socket, "pusher:pong", {});
        break;
      case "pusher:pong":
        break;
      case "pusher:error":
        this.handleError(OvertureListener.parseData(message.data));
        break;
      case "pusher_internal:subscription_succeeded":
        if (message.channel === this.channelName) {
          this._subscribed = true;
          this._reconnectAttempts = 0;
          this._lastError = undefined;
          console.debug(`Overture listener '${this.name}' subscribed to '${this.channelName}'`);
        }
        break;
      default:
        if (message?.channel === this.channelName && typeof message.event === "string")
          this.handleEvent(message.event, OvertureListener.parseData(message.data));
    }
  }

  private static parseData(data: unknown): any {
    if (typeof data !== "string")
      return data;

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private async handleConnected(socket: WebSocket, data: any): Promise<void> {
    if (typeof data?.activity_timeout === "number")
      this._activityTimeoutSeconds = data.activity_timeout;

    this.resetActivityTimer(socket);

    try {
      const subscription = await OvertureListener.authorize(this.options, this.secret("apiToken"), data?.socket_id);

      if (this._stopped || socket !== this._ws)
        return;

      this.send(socket, "pusher:subscribe", subscription);
    } catch (err: any) {
      if (this._stopped || socket !== this._ws)
        return;

      this._lastError = err.message;
      console.error(`Overture listener '${this.name}':`, this._lastError);

      socket.close();
    }
  }

  private handleError(data: any): void {
    const code = Number(data?.code);

    this._lastError = data?.message || `Reverb error ${code}`;
    console.error(`Overture listener '${this.name}' error from Reverb:`, data);

    if (code >= 4000 && code < 4100) {
      this._stopped = true;
      this.clearActivityTimers();
      this.discardSocket();
    }
  }

  private handleEvent(eventName: string, event: any): void {
    const shortName = eventName.replace(/^.*\\/, "");

    if (shortName.startsWith("pusher"))
      return;

    if (!QUIET_EVENTS.has(shortName))
      console.debug(`Overture listener '${this.name}' received '${shortName}'`);

    for (const rule of this.rules.values()) {
      if (rule.active !== 1 || rule.message !== shortName)
        continue;

      try {
        const executionResult: ListenerAction | ListenerAction[] = this.execRule(rule, event);
        const listenerActions = (Array.isArray(executionResult) ? executionResult : [executionResult]).filter(Boolean);

        this.callActions(listenerActions);
      } catch (err: any) {
        console.error('Error executing rule', rule.id, err);
      }
    }
  }

  private resetActivityTimer(socket: WebSocket): void {
    this.clearActivityTimers();

    this._activityTimer = setTimeout(() => {
      this.send(socket, "pusher:ping", {});

      this._pongTimer = setTimeout(() => {
        console.warn(`Overture listener '${this.name}' got no reply to its ping, reconnecting...`);
        this._lastError = "Connection timed out";
        socket.terminate();
      }, PONG_TIMEOUT_MS);
    }, this._activityTimeoutSeconds * 1000);
  }

  private clearActivityTimers(): void {
    clearTimeout(this._activityTimer);
    clearTimeout(this._pongTimer);
    this._activityTimer = undefined;
    this._pongTimer = undefined;
  }
}

export default OvertureListener;
export { OvertureListener };
