<script setup lang="ts">
  import { ref, inject, computed, type Ref } from "vue";
  import { useRouter } from 'vue-router';
  import api, { errorMessage } from '@/api';
  import { controllerFieldsKey, listenerFieldsKey, type SecretChanges } from '@/settings';
  import SettingsForm from '@/components/SettingsForm.vue';
  import FormFooter from '@/components/FormFooter.vue';

  const props = defineProps<{
    resource: "controllers" | "listeners";
  }>();

  const RESOURCES = {
    controllers: { title: "New Controller", noun: "controller", list: "/" },
    listeners: { title: "New Listener", noun: "listener", list: "/listeners" }
  };

  const name = ref("");
  const kind = ref("");
  const active = ref(1);
  const options = ref<Record<string, unknown>>({});
  const secrets = ref<SecretChanges>({});
  const error = ref("");
  const router = useRouter();

  const kinds = {
    controllers: inject<Ref<string[]>>("controllerKinds"),
    listeners: inject<Ref<string[]>>("listenerKinds")
  };

  const fields = {
    controllers: inject(controllerFieldsKey),
    listeners: inject(listenerFieldsKey)
  };

  const resource = computed(() => RESOURCES[props.resource]);

  const save = async () => {
    error.value = "";

    try {
      await api.post(`/${props.resource}`, {
        name: name.value,
        kind: kind.value,
        active: active.value,
        options: options.value,
        secrets: secrets.value
      });
    } catch (err) {
      error.value = errorMessage(err, `Failed to create ${resource.value.noun}.`);
      return;
    }

    router.push(resource.value.list);
  };
</script>

<template>
  <h1 class="is-size-2">
    {{ resource.title }}
  </h1>
  <form
    class="block"
    @submit.prevent="save"
  >
    <SettingsForm
      v-model:name="name"
      v-model:kind="kind"
      v-model:active="active"
      v-model:options="options"
      v-model:secrets="secrets"
      :kinds="kinds[props.resource]?.value ?? []"
      :fields-by-kind="fields[props.resource]?.value ?? {}"
      :allow-incomplete="props.resource === 'controllers'"
    />

    <FormFooter :error="error" />
  </form>
</template>
