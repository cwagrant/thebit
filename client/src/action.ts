export interface PropAction {
  action: string;
  props: { [key: string]: any };
};

export interface OptionsAction {
  action: string;
  options: { [key: string]: any[] };
}

export function isPropAction(action: Action): action is PropAction {
  return (action as PropAction).props !== undefined;
}

export function isOptionsAction(action: Action): action is OptionsAction {
  return (action as OptionsAction).options !== undefined;
}

export type Action = PropAction | OptionsAction;

export type ActionList = Action[];
export type ActionMapping = { [key: string]: Actions };
export type Actions = ActionMapping | ActionList;
