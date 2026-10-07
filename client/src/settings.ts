import type { InjectionKey, Ref } from 'vue';

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

export type SecretChanges = Record<string, string | null>;

export const controllerFieldsKey: InjectionKey<Ref<Record<string, SettingField[]>>> = Symbol('controllerFields');
export const listenerFieldsKey: InjectionKey<Ref<Record<string, SettingField[]>>> = Symbol('listenerFields');

export interface SceneState {
  sceneItem?: {
    minScale?: number | null;
    maxScale?: number | null;
    rotation?: number;
    currentScale?: { x: number, y: number };
    defaultScale?: { x: number, y: number };
    currentSize?: { width: number, height: number };
    defaultSize?: { width: number, height: number };
    currentPosition?: { x: number, y: number };
  };
}

export const sceneStateKey: InjectionKey<Ref<Record<string, SceneState> | undefined>> = Symbol('sceneState');

export const authRequiredKey: InjectionKey<Ref<boolean>> = Symbol('authRequired');
