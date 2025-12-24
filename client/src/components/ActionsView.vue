<script setup lang="ts">
  import type { Actions } from '../action.js';
  import ActionsView from './ActionsView.vue';
  import ActionView from './ActionView.vue';
  
  const { pathComponent, path } = defineProps<{
    path: string[],
    pathComponent?: string,
    title: string,
    actions: Actions,
    controller: "obs" | "atem";
  }>();

  let fullPath = path;
  if (pathComponent) {
    path.push(pathComponent);
  }
</script>
<template>
  <div>
    <p>{{ title }}</p>
    <div v-if="Array.isArray(actions)">
      <div v-for="action in actions">
        <ActionView :action="action" :path-component="title" :path="fullPath" :controller="controller" />
      </div>
    </div>
    <div v-else-if="typeof actions === 'object'">
      <div v-for="(mapping, title) in actions">
        <ActionsView :title="title" :path-component="title" :actions="mapping" :path="fullPath" :controller="controller" />
      </div>
    </div>        
  </div>
</template>