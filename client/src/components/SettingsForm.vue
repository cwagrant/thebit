<script setup lang="ts">
  import { inject, computed } from "vue";
  import { editorKey } from '@/editor';
  import type { SecretChanges, SettingField } from '@/settings';
  import SettingFields from '@/components/SettingFields.vue';

  const props = defineProps<{
    kinds: string[];
    fieldsByKind: Record<string, SettingField[]>;
    secretsSet?: Record<string, boolean>;
    activeHelp?: string;
    allowIncomplete?: boolean;
  }>();

  const name = defineModel<string>("name", { required: true });
  const kind = defineModel<string>("kind", { required: true });
  const active = defineModel<number>("active", { required: true });
  const options = defineModel<Record<string, unknown>>("options", { required: true });
  const secrets = defineModel<SecretChanges>("secrets", { required: true });

  const { toggleEditor, setContent, onContentUpdate, setLanguage } = inject(editorKey)!;

  const fields = computed(() => props.fieldsByKind[kind.value] ?? []);

  const missing = computed(() => {
    return fields.value.filter((field) => {
      if (!field.required)
        return false;

      if (field.secret) {
        const change = secrets.value[field.key];

        return change === null || (!change && !props.secretsSet?.[field.key]);
      }

      const value = options.value[field.key];

      return value === undefined || value === null || value === "";
    });
  });

  const incomplete = computed(() => props.allowIncomplete === true && missing.value.length > 0);

  const formattedOptions = computed(() => JSON.stringify(options.value, null, 2));

  const editOptions = () => {
    toggleEditor(true);
    setLanguage("json");
    setContent(formattedOptions.value);
    onContentUpdate((newContent: string) => {
      try {
        options.value = JSON.parse(newContent);
      } catch {
      }
    });
  };
</script>

<template>
  <label
    class="label"
    for="name"
  >Name</label>
  <input
    id="name"
    v-model="name"
    class="input"
    type="text"
    required
  >

  <div class="field">
    <label
      class="label mt-2"
      for="kind"
    >Kind</label>
    <div class="control">
      <select
        id="kind"
        v-model="kind"
        class="input"
        required
      >
        <option
          v-for="available in kinds"
          :key="available"
          :value="available"
        >
          {{ available }}
        </option>
      </select>
    </div>
  </div>

  <div class="field">
    <label
      class="label mt-2"
      for="active"
    >Active</label>
    <div class="control">
      <input
        id="active"
        type="checkbox"
        :checked="active === 1 && !incomplete"
        :disabled="incomplete"
        @change="active = ($event.target as HTMLInputElement).checked ? 1 : 0"
      >
    </div>
    <p
      v-if="incomplete"
      class="help"
    >
      It can be saved as it is, but only switched off - it needs
      {{ missing.map((field) => `'${field.label}'`).join(" and ") }}
      before it can be switched on.
    </p>
    <p
      v-else-if="activeHelp"
      class="help"
    >
      {{ activeHelp }}
    </p>
  </div>

  <SettingFields
    v-if="fields.length > 0"
    v-model:options="options"
    v-model:secrets="secrets"
    :fields="fields"
    :secrets-set="secretsSet"
    :allow-incomplete="allowIncomplete"
  />
  <div
    v-else-if="kind"
    class="field"
  >
    <label
      class="label mt-2"
      for="options"
    >Options</label>
    <div class="control">
      <pre><code>{{ formattedOptions }}</code></pre>
      <button
        id="options"
        class="button mt-2"
        @click.prevent="editOptions"
      >
        Edit Options
      </button>
    </div>
  </div>
</template>
