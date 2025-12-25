interface IController {
  id: string;
  active: boolean;

  action: Function;
}

type ListenerRule = {
  on: string,
  uid: string,
  function: string | VMScript,
}

interface ListenerConfig {
  name: string,
  listener: string,
  address: string,
  options: any,
  rules: ListenerRule
}

