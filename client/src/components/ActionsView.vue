<script setup lang="ts">
  import { computed } from 'vue';
  import type { Actions } from '@/action';
  import ActionsView from './ActionsView.vue';
  import ActionView from './ActionView.vue';

  const props = defineProps<{
    path: string[],
    pathComponent?: string,
    title: string,
    actions: Actions,
    controller: string,
  }>();

  const fullPath = computed(() => props.pathComponent ? [...props.path, props.pathComponent] : props.path);
</script>

<template>
  <div>
    <p>{{ title }}</p>
    <div v-if="Array.isArray(actions)">
      <div
        v-for="(action, index) in actions"
        :key="index"
      >
        <ActionView
          :action="action"
          :path="fullPath"
          :controller="controller"
        />
      </div>
    </div>
    <div v-else-if="typeof actions === 'object'">
      <div
        v-for="(mapping, childTitle) in actions"
        :key="childTitle"
      >
        <ActionsView
          :title="String(childTitle)"
          :path-component="String(childTitle)"
          :actions="mapping"
          :path="fullPath"
          :controller="controller"
        />
      </div>
    </div>
  </div>
</template>
