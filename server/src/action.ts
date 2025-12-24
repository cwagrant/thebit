export interface PropAction {
  action: string;
  props: any;
};

export interface OptionsAction {
  action: string;
  options: any;
}

export type Action = PropAction | OptionsAction;

export type Actions = {[key: string]: Actions} | Action[];
