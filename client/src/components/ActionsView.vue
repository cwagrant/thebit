<script setup lang="ts">
  import type { Actions } from '../action.js';
  import ActionsView from './ActionsView.vue';
import ActionView from './ActionView.vue';
  
  const { name, actions } = defineProps<{
    name: string,
    actions: Actions
  }>();
</script>
<template>
  <div>
    <p>{{ name }}</p>
    <div v-if="Array.isArray(actions)">
      <div v-for="action in actions">
        <ActionView :action="action" />
      </div>
    </div>
    <div v-else-if="typeof actions === 'object'">
      <div v-for="(mapping, name) in actions">
        <ActionsView :name="name" :actions="mapping" />
      </div>
    </div>        
  </div>
</template>