<script setup lang="ts">
  import {ref, onMounted} from "vue";
  import api, { errorMessage } from '@/api';
  import { type ControllerStatus } from '@/settings';
  import { useLiveStatuses } from '@/statusFeed';
  import StatusTag from '@/components/StatusTag.vue';

  type Controller = {
    id: number;
    name: string;
    kind: string;
    active: number;
    options: object;
    status?: ControllerStatus;
  }

  type Listener = {
    id: number;
    name: string;
    kind: string;
    active: number;
    options: { controllers?: unknown } | null;
  }

  const controllers = ref<Controller[]>([]);
  const manualListeners = ref<Listener[]>([]);

  const fetchControllers = async() => {
    const { data } = await api.get<Controller[]>("/controllers");

    controllers.value = data;
  }

  const fetchManualListeners = async () => {
    const { data } = await api.get<Listener[]>("/listeners");

    manualListeners.value = data.filter((listener) => listener.kind === "manual" && listener.active !== 0);
  }

  const toggling = ref<Set<number>>(new Set());

  const setActive = async (controller: Controller, active: boolean) => {
    toggling.value.add(controller.id);

    try {
      const { data } = await api.put<ControllerStatus>(`/controllers/${controller.id}/active`, { active });

      controller.active = active ? 1 : 0;
      controller.status = data;
    } catch (err) {
      controller.status = { state: controller.status?.state ?? "unknown", error: errorMessage(err, "That couldn't be changed.") };
    } finally {
      toggling.value.delete(controller.id);
    }
  }

  const remoteControlsFor = (controller: Controller) => {
    if (!controller.active)
      return [];

    return manualListeners.value.filter((listener) => {
      const allowed = listener.options?.controllers;

      return !Array.isArray(allowed) || allowed.includes(controller.name);
    });
  }

  onMounted(() => {
   fetchControllers();
   fetchManualListeners();
  })

  useLiveStatuses("controllers", controllers, () => fetchControllers());
</script>

<template>
  <main>
    <div class="block has-text-end">
      <div class="buttons">
        <RouterLink
          class="button is-primary"
          to="/controllers/new"
        >
          New Controller
        </RouterLink>
      </div>
    </div>
    <table class="table is-fullwidth">
      <thead>
        <tr>
          <th>Controller</th>
          <th>Kind</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="controller in controllers"
          :key="controller.id"
        >
          <td>{{ controller.name }}</td>
          <td>{{ controller.kind }}</td>
          <td>
            <StatusTag
              v-if="controller.status"
              :status="controller.status"
            />
          </td>
          <td>
            <div class="buttons is-right">
              <RouterLink
                v-for="listener in remoteControlsFor(controller)"
                :key="listener.id"
                class="button is-primary"
                :to="{ name: 'RemoteControlView', params: { id: listener.id } }"
              >
                {{ manualListeners.length > 1 ? `Remote: ${listener.name}` : 'Remote Control' }}
              </RouterLink>
              <button
                class="button"
                :class="{ 'is-loading': toggling.has(controller.id) }"
                @click="setActive(controller, !controller.active)"
              >
                {{ controller.active ? 'Turn off' : 'Turn on' }}
              </button>
              <RouterLink
                class="button"
                :to="{ name: 'ControllerSettingsView', params: { id: controller.id } }"
              >
                Settings
              </RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
