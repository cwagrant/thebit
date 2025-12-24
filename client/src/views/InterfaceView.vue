<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import type { Actions } from '../action.js';
  import ActionsView from "@/components/ActionsView.vue";

  const props = defineProps<{
    title: string;
    controller: "obs" | "atem";
  }>();

  const data = ref<Actions>({});
  const isLoading = ref(true);

  const fetchProtocol = async() => {
    try {
      const response = await fetch(`/api/${props.controller}/actions`)
      data.value = await response.json();

    } catch(error) {
      console.error(error);
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    fetchProtocol();
  })
</script>

<template>
  <main>
    <div v-if="isLoading === false">
      <ActionsView :title="title" :actions="data" :path="[]" :controller="controller" />
    </div>
  </main>
</template>
