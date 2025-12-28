interface IController {
  id: string;
  active: boolean;

  action: Function;
}

type ListenerRule = {
  on: string,
  function: Function
}

interface ListenerConfig {
  name: string,
  listener: string,
  address: string,
  options: any,
  rules: ListenerRule[]
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
  [key: string]: any
}[]

interface Config {
  controllers: Map<string, any>,
  listeners: Array<ListenerConfig>
}
