<script setup lang="ts">
  import { ref, inject, computed } from "vue";
  import { useRouter } from 'vue-router';

  type Listener = {
    id: number;
    name: string;
    active: number;
    kind: string;
    options: object;
  }

  const listener = ref<Listener>({name: "", kind: "", options: {address: "", options:""}, active: 1});
  const { toggleEditor, setContent, onContentUpdate, setLanguage} = inject("editor");
  const listenerKinds = inject("listenerKinds");
  const router = useRouter();

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

  const saveListener = () => {
    const { name, kind, active } = listener.value
    console.log('newValue', listener.value)

    fetch(`/api/listeners`, {
      method: "POST",
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
      } else {
        router.push('/listeners');
      }
    })
  }
</script>

<template>
  <h1 class="is-size-2">
    New Listener
  </h1>
  <form
    class="block"
    @submit.prevent="saveListener"
  >
    <label
      class="label"
      for="name"
    >Name</label>
    <input
      id="name"
      v-model="listener.name"
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
          v-model="listener.kind"
          class="input"
          required
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
