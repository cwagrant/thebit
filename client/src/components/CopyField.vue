<script setup lang="ts">
  import CopyButton from '@/components/CopyButton.vue';

  defineProps<{
    value: string;
    monospace?: boolean;
  }>();
</script>

<template>
  <div class="field has-addons">
    <div class="control is-expanded">
      <input
        class="input"
        :class="{ 'is-family-monospace': monospace }"
        type="text"
        readonly
        :value="value"
        @focus="($event.target as HTMLInputElement).select()"
      >
    </div>
    <div class="control">
      <CopyButton
        class="is-primary"
        :text="value"
      />
    </div>
  </div>
</template>
