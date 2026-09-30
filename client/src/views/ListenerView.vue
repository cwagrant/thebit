<script setup lang="ts">
  import { ref, inject, computed, watch, onMounted} from "vue";
  import { editorKey } from '@/editor';
  import { useRoute } from 'vue-router';
  import ListenerRules from '@/components/ListenerRules.vue';
  import ListenerRule from '@/components/ListenerRule.vue';

  type Listener = {
    id: number;
    name: string;
    active: number;
    kind: string;
    options: object;
  }

  const listener = ref<Listener>({id: 0, name: "", kind: "", options: {}, active: 1});
  const { toggleEditor, setContent, onContentUpdate, setLanguage} = inject(editorKey)!;
  const listenerKinds = inject("listenerKinds");

  const route = useRoute();

  watch(
    () => route.params.id,
    () => {
      fetchListener();
    }
  )

  const computedOptions = computed({
    get: () => JSON.stringify(listener.value.options, null, 2),
    set: (val: string) => {
      try {
        listener.value.options= JSON.parse(val);
      } catch {
      }
    }
  })

  const editOptions = () => {
    toggleEditor(true);
    setLanguage("json");
    setContent(computedOptions.value);
    onContentUpdate((newContent: string) => {
      computedOptions.value = newContent;
      updateListener();
    });
  }

  const updateListener = () => {
    const {id, name, kind, active} = listener.value
    console.log('newValue', listener.value)
    fetch(`/api/listeners/${id}`, {
      method: "PUT",
      headers: {
      "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        kind: kind,
        options: computedOptions.value,
        active: active
      })
    }).then((response) => {
      if(!response.ok) {
        console.error("Failed to update rule");
      }
    })
  }

  const twitchScope = ref("user:read:chat user:bot");

  const twitchAuthorizeUrl = computed(() => {
    return `/oauth/twitch/authorize?listenerId=${listener.value.id}&scope=${encodeURIComponent(twitchScope.value)}`;
  });

  const twitchTokenExpiresAt = computed(() => {
    const expiresAt = (listener.value.options as any)?.accessTokenExpiresAt;

    return expiresAt ? new Date(expiresAt) : null;
  });

  const fetchListener = () => {
    const { id } = route.params;

    if(!id)
      return

    fetch(`/api/listeners/${id}`)
      .then((response) => response.json())
      .then((data) => {
      listener.value = data;
      });
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
  <form class="block">
    <label
      class="label"
      for="name"
    >Name</label>
    <input
      id="name"
      v-model="listener.name"
      class="input"
      type="text"
    >

    <div class="field">
      <label
        class="label mt-2"
        for="kind"
      >Kind</label>
      <div class="control">
        <select
          id="kind"
          class="input"
          :value="listener.kind"
        >
          <option
            v-for="kind in listenerKinds"
            :key="kind"
            :value="kind"
          >
            {{ kind }}
          </option>
        </select>
      </div>
    </div>

    <div class="field">
      <label class="label">Active</label>
      <div class="control">
        <input
          v-model="listener.active"
          type="checkbox"
          true-value="1"
          false-value="0"
        >
      </div>
    </div>

    <div class="field">
      <label
        class="label mt-2"
        for="options"
      >Options</label>
      <div class="control">
        <pre><code>{{ computedOptions }}</code></pre>
        <button
          class="button mt-2"
          @click.prevent="editOptions"
        >
          Edit Options
        </button>
      </div>
    </div>
    <button
      class="button mt-2 is-primary"
      @click.prevent="updateListener"
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
