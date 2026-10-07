<script setup lang="ts">
  defineProps<{
    status?: { state: string; error?: string } | null;
  }>();

  const TAG_CLASSES: Record<string, string> = {
    connected: "is-success",
    running: "is-success",
    connecting: "is-warning",
    disconnected: "is-danger",
    stopped: "is-danger",
    unknown: "",
    disabled: ""
  };
</script>

<template>
  <span
    class="tag"
    :class="TAG_CLASSES[status?.state ?? 'unknown']"
  >
    {{ status?.state ?? 'unknown' }}
  </span>
  <p
    v-if="status?.error"
    class="help is-danger"
  >
    {{ status.error }}
  </p>
</template>
