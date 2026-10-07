<script setup lang="ts">
  import {ref, onMounted} from "vue";
  import { useLiveStatuses } from '@/statusFeed';

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

  const STATUS_TAGS: Record<ListenerStatus["state"], string> = {
    connected: "is-success",
    running: "is-success",
    connecting: "is-warning",
    disconnected: "is-danger",
    stopped: "is-danger",
    // Plain .tag - Bulma 1's "is-light" is the light color, not a muted
    // variant, and renders white-on-white.
    disabled: ""
  };

  const listeners = ref<Listener[]>([]);
  const reconnecting = ref<Set<number>>(new Set());

  const fetchListeners = async () => {
    const response = await fetch("/api/listeners")
    const data = await response.json();
    listeners.value = data;
  }

  const reconnect = async (listener: Listener) => {
    reconnecting.value.add(listener.id);

    try {
      const response = await fetch(`/api/listeners/${listener.id}/reconnect`, { method: "POST" });

      if (response.ok)
        listener.status = await response.json();
    } finally {
      reconnecting.value.delete(listener.id);
    }
  }

  onMounted(() => {
    fetchListeners();
  })

  // Statuses arrive from the server as they change.
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
            <span
              class="tag"
              :class="STATUS_TAGS[listener.status?.state]"
            >
              {{ listener.status?.state }}
            </span>
            <p
              v-if="listener.status?.error"
              class="help is-danger"
            >
              {{ listener.status.error }}
            </p>
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

