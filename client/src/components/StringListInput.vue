<script setup lang="ts">
  defineProps<{
    label: string;
    placeholder?: string;
  }>();

  const values = defineModel<string[]>({ required: true });

  const setValue = (index: number, value: string) => {
    values.value = values.value.map((existing, i) => i === index ? value : existing);
  };

  const removeValue = (index: number) => {
    values.value = values.value.filter((_, i) => i !== index);
  };

  const addValue = () => {
    values.value = [...values.value, ""];
  };
</script>

<template>
  <div class="field">
    <label class="label">{{ label }}</label>
    <div
      v-for="(value, index) in values"
      :key="index"
      class="field has-addons"
    >
      <div class="control is-expanded">
        <input
          class="input"
          type="text"
          :value="value"
          :placeholder="placeholder"
          :aria-label="`${label} ${index + 1}`"
          @input="setValue(index, ($event.target as HTMLInputElement).value)"
        >
      </div>
      <div class="control">
        <button
          class="button is-danger is-outlined"
          type="button"
          :aria-label="`Remove ${value || 'this entry'} from ${label}`"
          title="Remove"
          @click="removeValue(index)"
        >
          <svg
            class="trash-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
    <button
      class="button is-small"
      type="button"
      :aria-label="`Add to ${label}`"
      :title="`Add to ${label}`"
      @click="addValue"
    >
      +
    </button>
  </div>
</template>

<style scoped>
  .trash-icon {
    width: 1.1em;
    height: 1.1em;
  }
</style>
