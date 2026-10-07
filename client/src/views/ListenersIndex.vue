<script setup lang="ts">
  import {ref, onMounted} from "vue";
  import api from '@/api';
  import { useLiveStatuses } from '@/statusFeed';
  import StatusTag from '@/components/StatusTag.vue';

  type ListenerStatus = {
    state: "connected" | "connecting" | "disconnected" | "running" | "disabled" | "stopped";
    error?: string;
  }

  type Listener = {
    id: number;
    name: string;
    kind: string;
    status: ListenerStatus;
  }

  const listeners = ref<Listener[]>([]);
  const reconnecting = ref<Set<number>>(new Set());

  const fetchListeners = async () => {
    const { data } = await api.get<Listener[]>("/listeners");

    listeners.value = data;
  }

  const reconnect = async (listener: Listener) => {
    reconnecting.value.add(listener.id);

    try {
      const { data } = await api.post<ListenerStatus>(`/listeners/${listener.id}/reconnect`);

      listener.status = data;
    } catch {
    } finally {
      reconnecting.value.delete(listener.id);
    }
  }

  onMounted(() => {
    fetchListeners();
  })

  useLiveStatuses("listeners", listeners, () => fetchListeners());
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
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="listener in listeners"
          :key="listener.id"
        >
          <td class="shrink">
            {{ listener.name }}
          </td>
          <td> {{ listener.kind }} </td>
          <td>
            <StatusTag :status="listener.status" />
          </td>
          <td class="has-text-right">
            <button
              v-if="listener.status?.state !== 'disabled'"
              class="button mr-2"
              :class="{ 'is-loading': reconnecting.has(listener.id) }"
              @click="reconnect(listener)"
            >
              Reconnect
            </button>
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
  </main>
</template>

<style>
  .shrink {
    width: 1%;
    white-space: nowrap;
  }
</style>

