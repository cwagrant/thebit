<script setup lang="ts">
  import { ref, onUnmounted } from "vue";

  const props = withDefaults(defineProps<{
    text: string;
    label?: string;
  }>(), {
    label: "Copy"
  });

  const COPIED_LABEL_MS = 2000;

  const copied = ref(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const copy = async () => {
    await navigator.clipboard.writeText(props.text);
    copied.value = true;

    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { copied.value = false; }, COPIED_LABEL_MS);
  };

  onUnmounted(() => {
    clearTimeout(copiedTimer);
  });
</script>

<template>
  <button
    type="button"
    class="button"
    @click="copy"
  >
    {{ copied ? 'Copied' : label }}
  </button>
</template>
