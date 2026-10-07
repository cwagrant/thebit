<script setup lang="ts">
  withDefaults(defineProps<{
    error?: string;
    saved?: boolean;
    savedMessage?: string;
    saving?: boolean;
  }>(), {
    error: "",
    savedMessage: "Saved."
  });
</script>

<template>
  <p
    v-if="error"
    class="help is-danger"
  >
    {{ error }}
  </p>
  <p
    v-else-if="saved"
    class="help is-success"
  >
    {{ savedMessage }}
  </p>
  <div class="buttons mt-2 mb-0">
    <button
      type="submit"
      class="button is-primary"
      :class="{ 'is-loading': saving }"
    >
      Save
    </button>
    <slot />
  </div>
</template>
