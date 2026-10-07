<script setup lang="ts">
  import { inject } from "vue";
  import { editorKey } from '@/editor';
  import type { SettingField, SecretChanges } from '@/settings';
  import SceneListField from '@/components/SceneListField.vue';

  const props = defineProps<{
    fields: SettingField[];
    secretsSet?: Record<string, boolean>;
    allowIncomplete?: boolean;
  }>();

  const options = defineModel<Record<string, unknown>>("options", { required: true });
  const secrets = defineModel<SecretChanges>("secrets", { required: true });

  const { toggleEditor, setContent, onContentUpdate, setLanguage } = inject(editorKey)!;

  const inputValue = (event: Event) => (event.target as HTMLInputElement).value;

  const fieldValue = (field: SettingField, event: Event) => {
    const input = event.target as HTMLInputElement;

    if (field.type === "ws-url")
      input.value = input.value.replace(/^\s*http(s?):\/\//i, "ws$1://");

    return input.value;
  };

  const setSecret = (key: string, value: string) => {
    if (value === "")
      delete secrets.value[key];
    else
      secrets.value[key] = value;
  };

  const formatJSON = (value: unknown) => JSON.stringify(value ?? null, null, 2);

  const editJSON = (field: SettingField) => {
    toggleEditor(true);
    setLanguage("json");
    setContent(formatJSON(options.value[field.key]));
    onContentUpdate((newContent: string) => {
      try {
        options.value[field.key] = JSON.parse(newContent);
      } catch {
      }
    });
  };

  const secretPlaceholder = (field: SettingField) => {
    if (secrets.value[field.key] === null)
      return "Will be removed when you save";

    return props.secretsSet?.[field.key] ? "Saved - leave blank to keep it" : field.placeholder;
  };
</script>

<template>
  <div
    v-for="field in fields"
    :key="field.key"
    class="field"
  >
    <label
      class="label mt-2"
      :for="`field-${field.key}`"
    >{{ field.label }}</label>

    <div
      v-if="field.type === 'json'"
      class="control"
    >
      <pre><code>{{ formatJSON(options[field.key]) }}</code></pre>
      <button
        :id="`field-${field.key}`"
        class="button mt-2"
        @click.prevent="editJSON(field)"
      >
        Edit {{ field.label }}
      </button>
    </div>

    <div v-else-if="field.type === 'scenes'">
      <SceneListField
        :model-value="(options[field.key] as any) ?? []"
        @update:model-value="options[field.key] = $event"
      />
    </div>

    <div
      v-else-if="field.secret"
      class="field has-addons mb-0"
    >
      <div class="control is-expanded">
        <input
          :id="`field-${field.key}`"
          class="input"
          type="password"
          autocomplete="new-password"
          :value="secrets[field.key] ?? ''"
          :placeholder="secretPlaceholder(field)"
          :disabled="secrets[field.key] === null"
          :required="field.required && !allowIncomplete && !secretsSet?.[field.key]"
          @input="setSecret(field.key, inputValue($event))"
        >
      </div>
      <div
        v-if="secrets[field.key] === null"
        class="control"
      >
        <button
          class="button"
          @click.prevent="delete secrets[field.key]"
        >
          Keep saved value
        </button>
      </div>
      <div
        v-else-if="secretsSet?.[field.key]"
        class="control"
      >
        <button
          class="button"
          @click.prevent="secrets[field.key] = null"
        >
          Remove saved value
        </button>
      </div>
    </div>

    <div
      v-else
      class="control"
    >
      <input
        :id="`field-${field.key}`"
        class="input"
        type="text"
        :value="options[field.key] ?? ''"
        :placeholder="field.placeholder"
        :required="field.required && !allowIncomplete"
        @input="options[field.key] = fieldValue(field, $event)"
      >
    </div>

    <p
      v-if="field.help"
      class="help"
    >
      {{ field.help }}
    </p>
  </div>
</template>
