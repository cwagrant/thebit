<script setup lang="ts">
  import ObsAction from "./ObsAction.vue";
  const props = defineProps(['sceneName', 'actions']);
</script>

<template>
  <h1 class="title">{{ sceneName }}</h1>
  <h3 class="title is-5">Actions</h3>
  <template v-for="action in actions">
    <ObsAction :sceneName="sceneName" :action="action"/>
  </template>

</template>
