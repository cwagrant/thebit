<script setup lang="ts">
  const props = defineProps({
    content: {
      type: String,
      required: true
    },
    language: {
      type: String,
      required: true
    }
  })

  const emit = defineEmits(['editor:update', 'editor:close']);

  import { ref, onMounted } from 'vue';
  import { CodeEditor } from 'monaco-editor-vue3';

  const editor = ref(null);
  const localContent = ref("");
  const isActive = ref(false);
  const editorOptions = {
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true
  }

  const lifecycleHooks = {
    onCreated: (editor) => {
      editor.value = editor
    }
  }

  const sendUpdate = () => {
    emit('editor:update', localContent.value);
    sendClose();
  }

  const sendClose = () => {
    isActive.value = false;
    setTimeout(() =>  {
      emit("editor:close");
    }, 300)
  }

  onMounted(() => {
    localContent.value = props.content
    setTimeout(() => {
      isActive.value = true;
    }, 100)
  })

</script>
<template>
  <div
    :class="{'editor-open': isActive}"
    class="editor has-background-dark"
  >
    <nav
      class="navbar has-background-dark mr-2"
    >
      <div class="navbar-menu">
        <div class="navbar-end">
          <div class="navbar-item">
            <div class="buttons">
              <a
                class="button is-primary"
                @click.prevent="sendUpdate"
              >
                Update
              </a>
              <a
                class="button is-danger"
                @click.prevent="sendClose"
              >
                X
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <CodeEditor
      ref="editor"
      v-model:value="localContent"
      theme="vs-dark"
      :language="language"
      class="mt-2"
      :options="editorOptions"
      :lifecycle="lifecycleHooks"
    />
  </div>
</template>

<style scoped>
  .editor {
    position: fixed;
    width: 100%;
    transform: translateY(100%);
    transition: transform 0.3s ease-out;
    z-index: 1000;
    overflow-y: auto;
    top: 0;
    left: 0;
    height: 100%;
  }

  .editor-open {
    transform: translateY(0);
  }
</style>
