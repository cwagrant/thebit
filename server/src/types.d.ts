interface IController {
  id: number;
  name: string;
  kind: string;
  options: any;
  secrets?: { [key: string]: string };
  active: boolean;
  action: Function;
}

interface SettingField {
  key: string;
  label: string;
  type: "text" | "ws-url" | "password" | "json" | "scenes";
  secret?: boolean;
  required?: boolean;
  invite?: boolean;
  placeholder?: string;
  help?: string;
}

interface ControllerTool {
  key: string;
  label: string;
  help?: string;
}

interface ToolResult {
  ok: boolean;
  message: string;
  details?: string[];
}

interface ControllerTunnel {
  field: string;
  name: string;
  localPort: number;
}

interface ControllerStatus {
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
