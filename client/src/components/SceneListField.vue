<script setup lang="ts">
  import StringListInput from '@/components/StringListInput.vue';

  // The scenes an OBS controller manages, edited as one form per scene.
  // Mirrors what ObsController reads from its `scenes` option.
  type SceneConfig = {
    name: string;
    gameSource: string;
    moveTransitionFilterName: string;
    filters: string[];
    sources: string[];
    minScale?: number;
    maxScale?: number;
    [key: string]: unknown;
  }

  const scenes = defineModel<SceneConfig[]>({ required: true });

  const updateScene = (index: number, changes: Partial<SceneConfig>) => {
    scenes.value = scenes.value.map((scene, i) => i === index ? { ...scene, ...changes } : scene);
  };

  const addScene = () => {
    scenes.value = [
      ...scenes.value,
      { name: "", gameSource: "", moveTransitionFilterName: "", filters: [], sources: [] }
    ];
  };

  const removeScene = (index: number) => {
    scenes.value = scenes.value.filter((_, i) => i !== index);
  };

  const inputValue = (event: Event) => (event.target as HTMLInputElement).value;

  // A cleared scale box means "no limit set", not zero.
  const scaleValue = (event: Event) => {
    const value = inputValue(event);

    return value === "" ? undefined : Number(value);
  };
</script>

<template>
  <div
    v-for="(scene, index) in scenes"
    :key="index"
    class="box"
  >
    <div class="field">
      <label
        class="label"
        :for="`scene-${index}-name`"
      >Name</label>
      <div class="control">
        <input
          :id="`scene-${index}-name`"
          class="input"
          type="text"
          required
          :value="scene.name"
          @input="updateScene(index, { name: inputValue($event) })"
        >
      </div>
      <p class="help">
        The scene's name in OBS.
      </p>
    </div>

    <div class="field">
      <label
        class="label"
        :for="`scene-${index}-game-source`"
      >Game Source</label>
      <div class="control">
        <input
          :id="`scene-${index}-game-source`"
          class="input"
          type="text"
          :value="scene.gameSource"
          @input="updateScene(index, { gameSource: inputValue($event) })"
        >
      </div>
      <p class="help">
        The source in that scene that gets moved and resized.
      </p>
    </div>

    <div class="field">
      <label
        class="label"
        :for="`scene-${index}-move-filter`"
      >Move Transition Filter Name</label>
      <div class="control">
        <input
          :id="`scene-${index}-move-filter`"
          class="input"
          type="text"
          :value="scene.moveTransitionFilterName"
          @input="updateScene(index, { moveTransitionFilterName: inputValue($event) })"
        >
      </div>
      <p class="help">
        The Move Source filter on the scene that animates the game source.
      </p>
    </div>

    <div class="columns">
      <div class="column">
        <StringListInput
          label="Filters"
          :model-value="scene.filters ?? []"
          @update:model-value="updateScene(index, { filters: $event })"
        />
      </div>
      <div class="column">
        <StringListInput
          label="Sources"
          :model-value="scene.sources ?? []"
          @update:model-value="updateScene(index, { sources: $event })"
        />
      </div>
    </div>

    <div class="columns">
      <div class="column">
        <div class="field">
          <label
            class="label"
            :for="`scene-${index}-min-scale`"
          >Minimum Scale</label>
          <div class="control">
            <input
              :id="`scene-${index}-min-scale`"
              class="input"
              type="number"
              min="0"
              step="any"
              :value="scene.minScale ?? ''"
              @input="updateScene(index, { minScale: scaleValue($event) })"
            >
          </div>
        </div>
      </div>
      <div class="column">
        <div class="field">
          <label
            class="label"
            :for="`scene-${index}-max-scale`"
          >Maximum Scale</label>
          <div class="control">
            <input
              :id="`scene-${index}-max-scale`"
              class="input"
              type="number"
              min="0"
              step="any"
              :value="scene.maxScale ?? ''"
              @input="updateScene(index, { maxScale: scaleValue($event) })"
            >
          </div>
        </div>
      </div>
    </div>

    <button
      class="button is-danger is-outlined"
      type="button"
      @click="removeScene(index)"
    >
      Remove Scene
    </button>
  </div>

  <button
    class="button"
    type="button"
    @click="addScene"
  >
    Add Scene
  </button>
</template>
