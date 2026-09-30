<script setup lang="ts">
  import { ref, inject, computed, watch, onMounted } from "vue";
  import { editorKey } from '@/editor';
  import { useRoute } from 'vue-router';

  type Controller = {
    id: number;
    name: string;
    kind: string;
    options: object;
  }

  const controller = ref<Controller>({ id: 0, name: "", kind: "", options: {} });
  const { toggleEditor, setContent, onContentUpdate, setLanguage } = inject(editorKey)!;
  const controllerKinds = inject("controllerKinds");

  const route = useRoute();

  watch(
    () => route.params.id,
    () => {
      fetchController();
    }
  )

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
      updateController();
    });
  }

  const updateController = () => {
    const { id, name, kind } = controller.value;

    fetch(`/api/controllers/${id}`, {
      method: "PUT",
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
        console.error("Failed to update controller");
      }
    })
  }

  const fetchController = () => {
    const { id } = route.params;

    if (!id)
      return;

    fetch(`/api/controllers/${id}`)
      .then((response) => response.json())
      .then((data) => {
        controller.value = data;
      });
  }

  onMounted(() => {
    fetchController();
  });
</script>

<template>
  <div class="block">
    <div class="buttons">
      <RouterLink
        to="/"
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
      v-model="controller.name"
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
          :value="controller.kind"
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
      class="button mt-2 is-primary"
      @click.prevent="updateController"
    >
      Save
    </button>
  </form>
</template>
