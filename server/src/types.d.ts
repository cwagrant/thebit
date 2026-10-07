interface IController {
  id: number;
  name: string;
  kind: string;
  options: any;
  // Decrypted values for the controller kind's `secret` fields, keyed by
  // field key. Kept apart from `options` so they never get serialized back
  // out through the API.
  secrets?: { [key: string]: string };
  active: boolean;
  action: Function;
}

// One setting a controller or listener kind needs, as declared by its
// class's static `fields` - the settings forms (and a controller's invite
// page, for fields marked `invite`) are built from these.
interface SettingField {
  key: string;
  label: string;
  // "ws-url" is a text field validated as a ws:// or wss:// URL; "json" is
  // edited as a JSON document; "scenes" is an OBS controller's list of
  // scenes, edited with a form per scene.
  type: "text" | "ws-url" | "password" | "json" | "scenes";
  // Stored encrypted in the secrets table rather than in `options`, and
  // never sent back to a browser.
  secret?: boolean;
  required?: boolean;
  // May be filled in by whoever holds the controller's invite link.
  invite?: boolean;
  placeholder?: string;
  help?: string;
}

// Something a controller kind can do on request to the thing it's connected
// to - verify it (e.g. that a plugin it relies on is installed) or set it up
// - as declared by its class's static `tools` and run through
// Controller.runTool.
interface ControllerTool {
  key: string;
  label: string;
  help?: string;
}

interface ToolResult {
  ok: boolean;
  message: string;
  // What was done or found, item by item, for tools that do several things.
  details?: string[];
}

// How a controller kind's device can be reached through a tunnel (see
// tunnel.ts): the local port to publish, the name to publish it under, and
// which option the resulting address goes in.
interface ControllerTunnel {
  field: string;
  name: string;
  localPort: number;
}

interface ControllerStatus {
  // "disabled": switched off, so not loaded at all. "stopped": enabled but
  // not running, e.g. its constructor threw (see Matrix.controllerErrors).
  state: "connected" | "connecting" | "disconnected" | "unknown" | "disabled" | "stopped";
  error?: string;
}

interface IListener {
  id: number;
  name: string;
  kind: string;
  options: any;
  secrets?: { [key: string]: string };
  vm: Isolate;
  active: number;
}

interface IHistory {
  id: number;
  listener_id: number;
  key: string;
}

interface IListenerRule {
  id: number,
  listener_id: number,
  message: string,
  rule: string | Script,
  active: number;
  script?: string;
  version?: string | null;
  condition?: string | { [key: string]: any } | null;
}

// "stopped": the listener is enabled but isn't running at all, e.g. its
// constructor threw on missing options (see Matrix.listenerErrors).
type ListenerState = "connected" | "connecting" | "disconnected" | "running" | "disabled" | "stopped";

interface ListenerStatus {
  state: ListenerState;
  error?: string;
}

interface ListenerConfig {
  id: number,
  name: string,
  kind: string,
  options: { [key: string]: string | number | undefined },
  // Decrypted values for the listener kind's `secret` fields - see
  // IController.secrets.
  secrets?: { [key: string]: string },
}

interface PropAction {
  action: string;
  props: { [key: string]: any };
};

interface OptionsAction {
  action: string;
  options: { [key: string]: any[] };
}

type Action = PropAction | OptionsAction;

type Actions = { [key: string]: Actions } | Action[];

interface ListenerAction {
  uid?: string,
  path?: string,
  action: string,
  controller: string,
  [key: string]: any
}
