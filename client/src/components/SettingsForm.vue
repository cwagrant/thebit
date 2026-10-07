<script setup lang="ts">
  import { inject, computed } from "vue";
  import { editorKey } from '@/editor';
  import type { SecretChanges, SettingField } from '@/settings';
  import SettingFields from '@/components/SettingFields.vue';

  // Name, kind, and the settings that kind needs - shared by the controller
  // and listener views. Kinds that don't declare any fields fall back to
  // editing their options as one JSON document. The default slot sits
  // between the kind and its settings.
  const props = defineProps<{
    kinds: string[];
    fieldsByKind: Record<string, SettingField[]>;
    secretsSet?: Record<string, boolean>;
  }>();

  const name = defineModel<string>("name", { required: true });
  const kind = defineModel<string>("kind", { required: true });
  const options = defineModel<Record<string, unknown>>("options", { required: true });
  const secrets = defineModel<SecretChanges>("secrets", { required: true });

  const { toggleEditor, setContent, onContentUpdate, setLanguage } = inject(editorKey)!;

  const fields = computed(() => props.fieldsByKind[kind.value] ?? []);
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

  <slot />

  <SettingFields
    v-if="fields.length > 0"
    v-model:options="options"
    v-model:secrets="secrets"
    :fields="fields"
    :secrets-set="secretsSet"
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
