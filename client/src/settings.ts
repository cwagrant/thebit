import type { InjectionKey, Ref } from 'vue';

// Mirrors the server's SettingField (server/src/types.d.ts): one setting a
// controller or listener kind needs, which the settings forms are built
// from.
export interface SettingField {
  key: string;
  label: string;
  type: "text" | "ws-url" | "password" | "json" | "scenes";
  secret?: boolean;
  required?: boolean;
  invite?: boolean;
  placeholder?: string;
  help?: string;
}

export interface ControllerStatus {
  state: "connected" | "connecting" | "disconnected" | "unknown" | "disabled" | "stopped";
  error?: string;
}

export interface ControllerTool {
  key: string;
  label: string;
  help?: string;
}

export interface ToolResult {
  ok: boolean;
  message: string;
  details?: string[];
}

// Secrets are write-only from the browser: a string replaces the stored
// value, null removes it, and a key that's absent leaves it alone.
export type SecretChanges = Record<string, string | null>;

export const STATUS_TAGS: Record<ControllerStatus["state"], string> = {
  connected: "is-success",
  connecting: "is-warning",
  disconnected: "is-danger",
  stopped: "is-danger",
  unknown: "",
  disabled: ""
};

// Field definitions for every available controller/listener kind, keyed by
// kind.
export const controllerFieldsKey: InjectionKey<Ref<Record<string, SettingField[]>>> = Symbol('controllerFields');
export const listenerFieldsKey: InjectionKey<Ref<Record<string, SettingField[]>>> = Symbol('listenerFields');

// Whether the server has an admin password set.
export const authRequiredKey: InjectionKey<Ref<boolean>> = Symbol('authRequired');
