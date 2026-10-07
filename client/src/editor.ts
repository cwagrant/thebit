import type { InjectionKey } from 'vue';

// The shared slide-up code editor that App.vue owns and provides to any view
// that needs to edit a JSON options blob or a rule script.
export interface Editor {
  toggleEditor: (state?: boolean) => void;
  onContentUpdate: (callback: (content: string) => void) => void;
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
}

export const editorKey: InjectionKey<Editor> = Symbol('editor');
