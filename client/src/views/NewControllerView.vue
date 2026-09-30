<script setup lang="ts">
  import { ref, inject, computed } from "vue";
  import { editorKey } from '@/editor';
  import { useRouter } from 'vue-router';

  type Controller = {
    id: number;
    name: string;
    kind: string;
    options: object;
  }

  const controller = ref<Controller>({ id: 0, name: "", kind: "", options: {} });
  const { toggleEditor, setContent, onContentUpdate, setLanguage } = inject(editorKey)!;
  const controllerKinds = inject("controllerKinds");
  const router = useRouter();

  const computedOptions = computed({
    get: () => JSON.stringify(controller.value.options, null, 2),
    set: (val: string) => {
      try {
        controller.value.options = JSON.parse(val);
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
    });
  }

  const saveController = () => {
    const { name, kind } = controller.value;

    fetch(`/api/controllers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        kind: kind,
        options: computedOptions.value
      })
    }).then((response) => {
      if (!response.ok) {
        console.error("Failed to create controller");
      } else {
        router.push('/');
      }
    })
  }
</script>

<template>
  <h1 class="is-size-2">
    New Controller
  </h1>
  <form
    class="block"
    @submit.prevent="saveController"
  >
    <label
      class="label"
      for="name"
    >Name</label>
    <input
      id="name"
      v-model="controller.name"
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
          v-model="controller.kind"
          class="input"
          required
        >
          <option
            v-for="kind in controllerKinds"
            :key="kind"
            :value="kind"
          >
            {{ kind }}
          </option>
        </select>
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
