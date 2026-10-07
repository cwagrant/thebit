<script setup lang="ts">
  import { ref, onMounted, provide } from "vue";
  import { useRoute } from 'vue-router';
  import api, { errorMessage } from '@/api';
  import ActionsView from '@/components/ActionsView.vue';
  import { sendActionKey, type Actions, type ActionRequest } from '@/action';

  type Rule = {
    id: number;
    listener_id: number;
    message: string;
    active: number;
  }

  type ControllerActions = {
    name: string;
    kind: string;
    actions: Actions;
  }

  const rules = ref<Rule[]>([]);
  const controllers = ref<ControllerActions[]>([]);
  const triggeringId = ref<number | null>(null);
  const route = useRoute();

  type Toast = {
    id: number;
    ok: boolean;
    message: string;
  }

  const TOAST_DURATION_MS = { ok: 3000, error: 8000 };

  const toasts = ref<Toast[]>([]);
  let nextToastId = 1;

  const dismissToast = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  const showToast = (ok: boolean, message: string) => {
    const id = nextToastId++;

    toasts.value.push({ id, ok, message });
    setTimeout(() => dismissToast(id), ok ? TOAST_DURATION_MS.ok : TOAST_DURATION_MS.error);
  }

  const fetchRules = () => {
    const { id } = route.params;

    api.get<Rule[]>(`/listeners/${id}/rules`)
      .then(({ data }) => {
        rules.value = data.filter((rule) => rule.active === 1);
      });
  }

  const fetchActions = () => {
    const { id } = route.params;

    api.get<ControllerActions[]>(`/listeners/${id}/actions`)
      .then(({ data }) => {
        controllers.value = data;
      })
      .catch((err) => {
        showToast(false, `Couldn't load controller actions: ${errorMessage(err, "")}`);
      });
  }

  const trigger = (rule: Rule) => {
    triggeringId.value = rule.id;

    api.post(`/rules/${rule.id}/trigger`)
      .then(() => {
        showToast(true, `Triggered ${rule.message}`);
      })
      .catch((err) => {
        showToast(false, `${rule.message} failed: ${errorMessage(err, "")}`);
      })
      .finally(() => {
        triggeringId.value = null;
      });
  }

  const sendAction = async (request: ActionRequest) => {
    const { id } = route.params;
    const label = [request.controller, ...request.path, request.action].join(" > ");

    try {
      await api.post(`/listeners/${id}/actions`, request);
      showToast(true, `Sent ${label}`);
    } catch (err) {
      showToast(false, `${label} failed: ${errorMessage(err, "")}`);
    }
  }

  provide(sendActionKey, sendAction);

  onMounted(() => {
    fetchRules();
    fetchActions();
  });
</script>

<template>
  <div class="block">
    <div class="buttons">
      <RouterLink
        :to="{ name: 'ListenerView', params: { id: route.params.id } }"
        class="button is-info"
      >
        Back
      </RouterLink>
    </div>
  </div>

  <h1 class="is-size-2">
    Remote Control
  </h1>

  <h2 class="is-size-4 mt-4">
    Rules
  </h2>

  <p v-if="rules.length === 0">
    No active rules on this listener yet.
  </p>

  <div class="buttons">
    <button
      v-for="rule in rules"
      :key="rule.id"
      class="button is-large is-primary"
      :class="{ 'is-loading': triggeringId === rule.id }"
      @click="trigger(rule)"
    >
      {{ rule.message }}
    </button>
  </div>

  <h2 class="is-size-4 mt-5">
    Controllers
  </h2>

  <p v-if="controllers.length === 0">
    No controllers available to this listener.
  </p>

  <div
    v-for="controller in controllers"
    :key="controller.name"
    class="box"
  >
    <ActionsView
      :title="`${controller.name} (${controller.kind})`"
      :actions="controller.actions"
      :path="[]"
      :controller="controller.name"
    />
  </div>

  <Teleport to="body">
    <TransitionGroup
      name="toast"
      tag="div"
      class="toasts"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="notification toast"
        :class="toast.ok ? 'is-success' : 'is-danger'"
        role="status"
      >
        <button
          class="delete"
          aria-label="Dismiss"
          @click="dismissToast(toast.id)"
        />
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
  .toasts {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 900;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: min(24rem, calc(100vw - 2rem));
    pointer-events: none;
  }

  .toast {
    margin: 0;
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.25);
    pointer-events: auto;
  }

  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .toast-enter-from,
  .toast-leave-to {
    opacity: 0;
    transform: translateX(1rem);
  }
</style>
