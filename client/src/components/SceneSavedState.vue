<script setup lang="ts">
  import { computed } from "vue";
  import type { SceneState } from '@/settings';

  const props = defineProps<{
    state?: SceneState;
  }>();

  const round = (value: number) => Math.round(value * 1000) / 1000;
  const pair = (a: number, b: number, joiner: string) => a === b && joiner === " × " ? `${round(a)}` : `${round(a)}${joiner}${round(b)}`;

  const rows = computed<[string, string][] | undefined>(() => {
    const item = props.state?.sceneItem;

    if (!item)
      return undefined;

    const limit = (value: number | null | undefined) => typeof value === "number" ? `${round(value)}` : "none";
    const rows: [string, string][] = [
      ["Minimum scale", limit(item.minScale)],
      ["Maximum scale", limit(item.maxScale)]
    ];

    if (item.currentScale)
      rows.push(["Current scale", pair(item.currentScale.x, item.currentScale.y, " × ")]);

    if (item.defaultScale)
      rows.push(["Default scale", pair(item.defaultScale.x, item.defaultScale.y, " × ")]);

    if (item.currentSize)
      rows.push(["Current size", `${round(item.currentSize.width)} × ${round(item.currentSize.height)}`]);

    if (item.defaultSize)
      rows.push(["Default size", `${round(item.defaultSize.width)} × ${round(item.defaultSize.height)}`]);

    if (item.currentPosition)
      rows.push(["Position", pair(item.currentPosition.x, item.currentPosition.y, ", ")]);

    if (typeof item.rotation === "number")
      rows.push(["Rotation", `${round(item.rotation)}°`]);

    return rows;
  });
</script>

<template>
  <h3 class="has-text-weight-semibold mb-2">
    Saved state
  </h3>
  <table
    v-if="rows"
    class="table is-narrow is-size-7 mb-0"
  >
    <tbody>
      <tr
        v-for="[label, value] in rows"
        :key="label"
      >
        <th>{{ label }}</th>
        <td>{{ value }}</td>
      </tr>
    </tbody>
  </table>
  <p
    v-else
    class="help"
  >
    Nothing is saved for this scene yet. That happens once the
    controller is connected and finds the scene and its game source in
    OBS.
  </p>
</template>
