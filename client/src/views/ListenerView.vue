<script setup lang="ts">
  import { ref, inject, computed, watch, onMounted} from "vue";
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

  const listener = ref<Listener>({name: "", kind: "", options: "", active: 1});
  const { toggleEditor, setContent, onContentUpdate, setLanguage} = inject("editor");
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
    onContentUpdate((newContent) => {
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

  const fetchListener = () => {
    const { id } = route.params;

    if(id === 0)
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
