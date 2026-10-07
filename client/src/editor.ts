import type { InjectionKey } from 'vue';

export interface Editor {
  toggleEditor: (state?: boolean) => void;
  onContentUpdate: (callback: (content: string) => void) => void;
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
}

export const editorKey: InjectionKey<Editor> = Symbol('editor');
