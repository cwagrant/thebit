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
    defaultWidth?: number;
    defaultHeight?: number;
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

  // A cleared number box means "not set", not zero.
  const numberValue = (event: Event) => {
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
        The scene's name in OBS. Must differ from its game source.
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
        The source in that scene that gets moved and resized. "Set up scenes"
        creates it as a scene of its own, for your game capture to go inside.
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

    <div class="columns mb-0">
      <div class="column">
        <div class="field">
          <label
            class="label"
            :for="`scene-${index}-default-width`"
          >Default Width</label>
          <div class="control">
            <input
              :id="`scene-${index}-default-width`"
              class="input"
              type="number"
              min="1"
              step="any"
              :value="scene.defaultWidth ?? ''"
              @input="updateScene(index, { defaultWidth: numberValue($event) })"
            >
          </div>
        </div>
      </div>
      <div class="column">
        <div class="field">
          <label
            class="label"
            :for="`scene-${index}-default-height`"
          >Default Height</label>
          <div class="control">
            <input
              :id="`scene-${index}-default-height`"
              class="input"
              type="number"
              min="1"
              step="any"
              :value="scene.defaultHeight ?? ''"
              @input="updateScene(index, { defaultHeight: numberValue($event) })"
            >
          </div>
        </div>
      </div>
    </div>
    <p class="help mb-4">
      The game source's size when untouched, in canvas pixels. Setting
      either one resizes the source in OBS when you save and centre-aligns
      it where it already is, so it grows and shrinks around its middle.
      Leave both blank to keep its size and alignment as they are in OBS.
    </p>

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
              @input="updateScene(index, { minScale: numberValue($event) })"
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
              @input="updateScene(index, { maxScale: numberValue($event) })"
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
