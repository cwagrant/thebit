<script setup lang="ts">
  import { ref, inject, type Ref } from "vue";
  import { useRouter } from 'vue-router';
  import { listenerFieldsKey, type SecretChanges } from '@/settings';
  import SettingsForm from '@/components/SettingsForm.vue';

  const name = ref("");
  const kind = ref("");
  const active = ref(1);
  const options = ref<Record<string, unknown>>({});
  const secrets = ref<SecretChanges>({});
  const error = ref("");
  const listenerKinds = inject<Ref<string[]>>("listenerKinds");
  const listenerFields = inject(listenerFieldsKey);
  const router = useRouter();

  const saveListener = async () => {
    error.value = "";

    const response = await fetch(`/api/listeners`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name.value,
        kind: kind.value,
        options: options.value,
        secrets: secrets.value,
        active: active.value
      })
    });

    if (!response.ok) {
      error.value = await response.text() || "Failed to create listener.";
      return;
    }

    router.push('/listeners');
  };
</script>

<template>
  <h1 class="is-size-2">
    New Listener
  </h1>
  <form
    class="block"
    @submit.prevent="saveListener"
  >
    <SettingsForm
      v-model:name="name"
      v-model:kind="kind"
      v-model:options="options"
      v-model:secrets="secrets"
      :kinds="listenerKinds ?? []"
      :fields-by-kind="listenerFields ?? {}"
    >
      <div class="field">
        <label class="label mt-2">Active</label>
        <div class="control">
          <input
            v-model="active"
            type="checkbox"
            :true-value="1"
            :false-value="0"
          >
        </div>
      </div>
    </SettingsForm>

    <p
      v-if="error"
      class="help is-danger"
    >
      {{ error }}
    </p>
    <button
      type="submit"
      class="button mt-2 is-primary"
    >
      Save
    </button>
  </form>
</template>

<style scoped>
  .json-editor {
    height: 18rem;
  }
</style>
