<script setup lang="ts">
  import { ref, inject, type Ref } from "vue";
  import { useRouter } from 'vue-router';
  import { controllerFieldsKey, type SecretChanges } from '@/settings';
  import SettingsForm from '@/components/SettingsForm.vue';

  const name = ref("");
  const kind = ref("");
  const active = ref(1);
  const options = ref<Record<string, unknown>>({});
  const secrets = ref<SecretChanges>({});
  const error = ref("");
  const router = useRouter();
  const controllerKinds = inject<Ref<string[]>>("controllerKinds");
  const controllerFields = inject(controllerFieldsKey);

  const saveController = async () => {
    error.value = "";

    const response = await fetch(`/api/controllers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name.value,
        kind: kind.value,
        active: active.value,
        options: options.value,
        secrets: secrets.value
      })
    });

    if (!response.ok) {
      error.value = await response.text() || "Failed to create controller.";
      return;
    }

    router.push('/');
  };
</script>

<template>
  <h1 class="is-size-2">
    New Controller
  </h1>
  <form
    class="block"
    @submit.prevent="saveController"
  >
    <SettingsForm
      v-model:name="name"
      v-model:kind="kind"
      v-model:options="options"
      v-model:secrets="secrets"
      :kinds="controllerKinds ?? []"
      :fields-by-kind="controllerFields ?? {}"
    >
      <div class="field">
        <label
          class="label mt-2"
          for="active"
        >Active</label>
        <div class="control">
          <input
            id="active"
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
