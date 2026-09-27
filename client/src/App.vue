<script setup lang="ts">
import { ref, provide, onMounted} from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import 'bulma/css/bulma.min.css'
import EditorView from '@/components/EditorView.vue'

const editorContent = ref("");
const editorLanguage = ref("json");
const editorVisible = ref(false);
const editorCallback = ref();

const toggleEditor = (state: boolean | undefined = undefined) => {
  editorVisible.value = state ?? !editorVisible.value;
}

const editorUpdate = (newContent: string) => {
  if(editorCallback.value) {
    editorCallback.value(newContent)
  }

  editorContent.value = newContent;
}

const closeEditor = () => {
  editorVisible.value = false;
  editorCallback.value = undefined;
}

const editor = {
  toggleEditor,
  onContentUpdate: (callback: typeof function) => {
    editorCallback.value = callback;
  },
  setContent: (content: string) => {
    editorContent.value = content;
  },
  setLanguage: (language: string) => {
    editorLanguage.value = language;
  },
}

const listenerKinds = ref<string[]>([]);

const fetchListenerKinds = async () => {
  const response = await fetch("/api/listeners/available")
  const data = await response.json();
  console.log(data);
  listenerKinds.value = data;
}

onMounted(() => {
 fetchListenerKinds();
})

provide("editor", editor)
provide("listenerKinds", listenerKinds);
</script>

<template>
  <nav class="main-nav navbar is-fixed-top">
    <div class="container">
      <RouterLink
        class="navbar-item"
        to="/"
      >
        Home
      </RouterLink>
      <RouterLink
        class="navbar-item"
        to="/about"
      >
        About
      </RouterLink>
      <RouterLink
        class="navbar-item"
        to="/listeners"
      >
        Listeners
      </RouterLink>
    </div>
  </nav>

  <div class="container mt-3">
    <RouterView />
  </div>
  <div class="editor">
    <EditorView
      v-if="editorVisible"
      :content="editorContent"
      :language="editorLanguage"
      @editor:update="editorUpdate"
      @editor:close="closeEditor"
    />
  </div>
</template>
<style>
  .main-nav {
    border-bottom: 1px solid #222;
  }
</style>
