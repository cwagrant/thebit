import type { InjectionKey } from 'vue';

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

// One controller action fired from the remote control. `path` locates the
// action in the controller's tree (e.g. [sceneName] for OBS) and `props` are
// the form values the action's inputs produced.
export interface ActionRequest {
  controller: string;
  path: string[];
  action: string;
  props: Record<string, string>;
}

// Provided by whichever view hosts an ActionsView tree, so the action
// components don't need to know which endpoint they're firing through.
export const sendActionKey: InjectionKey<(request: ActionRequest) => Promise<void>> = Symbol('sendAction');
