interface IController {
  id: number;
  name: string;
  kind: string;
  options: any;
  active: boolean;
  action: Function;
}

interface IListener {
  id: number;
  name: string;
  kind: string;
  options: any;
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
