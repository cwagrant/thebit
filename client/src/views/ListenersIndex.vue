<script setup lang="ts">
  import {ref, onMounted} from "vue";

  const listeners = ref([]);
  const listener = ref(null);

  const fetchListeners = async () => {
    const response = await fetch("/api/listeners")
    const data = await response.json();
    listeners.value = data;
  }

  onMounted(() => {
   fetchListeners();
  })
</script>

<template>
  <main>
    <div class="block has-text-end">
      <div class="buttons">
        <RouterLink
          class="button is-primary"
          to="/listeners/new"
        >
          New Listener
        </RouterLink>
      </div>
    </div>
    <table class="table is-fullwidth">
      <thead>
        <tr>
          <th>Listener</th>
          <th>Kind</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="listener in listeners">
          <td class="shrink">
            {{ listener.name }}
          </td>
          <td> {{ listener.kind }} </td>
          <td class="has-text-right">
            <RouterLink
              class="button"
              :to="{ name: 'ListenerView', params: { id: listener.id } }"
            >
              Edit
            </RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
    <Listener
      v-if="listener"
      :listener="listener"
    />
  </main>
</template>

<style>
  .shrink {
    width: 1%;
    white-space: nowrap;
  }
</style>

