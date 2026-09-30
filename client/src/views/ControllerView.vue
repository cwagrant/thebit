<script setup lang="ts">
  import {ref, onMounted} from "vue";

  type Controller = {
    id: number;
    name: string;
    kind: string;
    options: object;
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
    const response = await fetch("/api/controllers")
    const data = await response.json();

    console.log('Controllers', data)
    controllers.value = data;

  }

  // Remote controls live on active "manual" listeners.
  const fetchManualListeners = async () => {
    const response = await fetch("/api/listeners")
    const data: Listener[] = await response.json();

    manualListeners.value = data.filter((listener) => listener.kind === "manual" && listener.active !== 0);
  }

  // Mirrors ManualListener.controllers on the server: a manual listener can
  // fire every controller unless its options list specific ones.
  const remoteControlsFor = (controller: Controller) => {
    return manualListeners.value.filter((listener) => {
      const allowed = listener.options?.controllers;

      return !Array.isArray(allowed) || allowed.includes(controller.name);
    });
  }

  onMounted(() => {
   fetchControllers();
   fetchManualListeners();
  })
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
            <div class="buttons is-right">
              <RouterLink
                v-for="listener in remoteControlsFor(controller)"
                :key="listener.id"
                class="button is-primary"
                :to="{ name: 'RemoteControlView', params: { id: listener.id } }"
              >
                {{ manualListeners.length > 1 ? `Remote: ${listener.name}` : 'Remote Control' }}
              </RouterLink>
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
