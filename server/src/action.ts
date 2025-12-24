export interface PropAction {
  action: string;
  props: {[key: string]: any};
};

export interface OptionsAction {
  action: string;
  options: {[key: string]: any[]};
}

export type Action = PropAction | OptionsAction;

export type Actions = {[key: string]: Actions} | Action[];
