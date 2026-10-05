<script setup lang="ts">
  import { ref, inject, computed, watch, onMounted, type Ref } from "vue";
  import { useRoute } from 'vue-router';
  import { listenerFieldsKey, type SecretChanges } from '@/settings';
  import SettingsForm from '@/components/SettingsForm.vue';
  import ListenerRules from '@/components/ListenerRules.vue';

  type Listener = {
    id: number;
    name: string;
    active: number;
    kind: string;
    options: Record<string, unknown>;
    // Which secret fields have a saved value - the values themselves never
    // come back from the server.
    secrets: Record<string, boolean>;
  }

  const listener = ref<Listener>({id: 0, name: "", kind: "", options: {}, secrets: {}, active: 1});
  const secretChanges = ref<SecretChanges>({});
  const error = ref("");
  const saved = ref(false);
  const listenerKinds = inject<Ref<string[]>>("listenerKinds");
  const listenerFields = inject(listenerFieldsKey);

  const route = useRoute();

  watch(
    () => route.params.id,
    () => {
      fetchListener();
    }
  )

  const updateListener = async () => {
    const {id, name, kind, options, active} = listener.value

    error.value = "";
    saved.value = false;

    const response = await fetch(`/api/listeners/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, kind, options, secrets: secretChanges.value, active })
    });

    if (!response.ok) {
      error.value = await response.text() || "Failed to update listener.";
      return;
    }

    saved.value = true;
    await fetchListener();
  }

  const twitchScope = ref("user:read:chat user:bot");

  const twitchAuthorizeUrl = computed(() => {
    return `/oauth/twitch/authorize?listenerId=${listener.value.id}&scope=${encodeURIComponent(twitchScope.value)}`;
  });

  const twitchTokenExpiresAt = computed(() => {
    const expiresAt = listener.value.options?.accessTokenExpiresAt;

    return typeof expiresAt === "number" ? new Date(expiresAt) : null;
  });

  const fetchListener = async () => {
    const { id } = route.params;

    if(!id)
      return

    const response = await fetch(`/api/listeners/${id}`);

    if (!response.ok)
      return;

    const data = await response.json();

    listener.value = { ...data, options: data.options ?? {} };
    secretChanges.value = {};
  }

  onMounted(() => {
    fetchListener();
  });
</script>

<template>
  <div class="block">
    <div class="buttons">
      <RouterLink
        to="/listeners"
        class="button is-info"
      >
        Back
      </RouterLink>
    </div>
  </div>
  <form
    class="block"
    @submit.prevent="updateListener"
  >
    <SettingsForm
      v-model:name="listener.name"
      v-model:kind="listener.kind"
      v-model:options="listener.options"
      v-model:secrets="secretChanges"
      :kinds="listenerKinds ?? []"
      :fields-by-kind="listenerFields ?? {}"
      :secrets-set="listener.secrets"
    >
      <div class="field">
        <label class="label mt-2">Active</label>
        <div class="control">
          <input
            v-model="listener.active"
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
    <p
      v-else-if="saved"
      class="help is-success"
    >
      Saved.
    </p>
    <button
      type="submit"
      class="button mt-2 is-primary"
    >
      Save
    </button>

    <div
      v-if="listener.kind === 'twitch-eventsub'"
      class="block mt-4"
    >
      <h2 class="is-size-4">
        Twitch Authorization
      </h2>
      <p v-if="twitchTokenExpiresAt">
        Current access token expires {{ twitchTokenExpiresAt.toLocaleString() }}.
      </p>
      <p v-else>
        Not yet authorized (or using a token with no known expiry, e.g. a manually-set app access token).
      </p>
      <div class="field">
        <label
          class="label"
          for="twitch-scope"
        >Scope</label>
        <div class="control">
          <input
            id="twitch-scope"
            v-model="twitchScope"
            class="input"
            type="text"
          >
        </div>
      </div>
      <a
        class="button is-link"
        :href="twitchAuthorizeUrl"
      >
        Authorize with Twitch
      </a>
    </div>

    <div
      v-if="listener.kind === 'manual'"
      class="block mt-4"
    >
      <RouterLink
        :to="{ name: 'RemoteControlView', params: { id: listener.id } }"
        class="button is-primary"
      >
        Open Remote Control
      </RouterLink>
    </div>

    <div class="mt-4">
      <ListenerRules
        :listener="listener"
      />
    </div>
  </form>
</template>

<style scoped>
  .json-editor {
    height: 18rem;
  }
</style>
