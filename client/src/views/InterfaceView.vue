<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import type { Actions } from '../action.js';

  interface Action {
    action: string;
    props: Array<string>;
  }

  const data = ref<Actions>({});
  const isLoading = ref(true);

  const fetchProtocol = async() => {
    try {
      const response = await fetch("/api/atem/actions")
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
  //const actions = await response.json();
</script>

<template>
  <main>
  <div> ATEM</div>
    <div v-if="isLoading === false">
      <div v-for="(value, key) in data">
        <div>
          <p>{{ key }}</p>
        </div>
      </div>
    </div>
  </main>
</template>
