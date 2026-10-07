import { ref, computed, watch, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue';

export interface FeedStatus {
  state: string;
  error?: string;
}

type Statuses = Record<string, FeedStatus>;

const RECONNECT_MIN_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10 * 1000;

const feeds: Record<"controllers" | "listeners", Ref<Statuses | undefined>> = {
  controllers: ref(),
  listeners: ref()
};

const controllerStates = ref<Record<string, unknown>>({});

let socket: WebSocket | undefined;
let users = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let reconnectDelay = RECONNECT_MIN_DELAY_MS;

const connect = () => {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const current = new WebSocket(`${scheme}://${window.location.host}/api/events`);

  socket = current;

  current.addEventListener("open", () => {
    reconnectDelay = RECONNECT_MIN_DELAY_MS;
  });

  current.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === "statuses") {
        feeds.controllers.value = message.controllers;
        feeds.listeners.value = message.listeners;
        controllerStates.value = message.states ?? {};
      }
    } catch {
    }
  });

  current.addEventListener("close", () => {
    if (socket !== current)
      return;

    socket = undefined;

    if (users > 0) {
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
    }
  });
};

const acquire = () => {
  users++;

  if (!socket && !reconnectTimer)
    connect();
};

const release = () => {
  users--;

  if (users > 0)
    return;

  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;

  const current = socket;

  socket = undefined;
  current?.close();
};

export function useLiveStatuses<Item extends { id: number, status?: FeedStatus | null }>(
  kind: "controllers" | "listeners",
  items: Ref<Item[]>,
  refetch?: () => void
): void {
  const apply = () => {
    const statuses = feeds[kind].value;

    if (!statuses)
      return;

    for (const item of items.value) {
      const status = statuses[item.id];

      if (status)
        item.status = status;
    }

    const known = new Set(items.value.map((item) => String(item.id)));
    const live = Object.keys(statuses);

    if (refetch && items.value.length > 0 && (live.length !== known.size || live.some((id) => !known.has(id))))
      refetch();
  };

  watch(feeds[kind], apply);
  watch(() => items.value.map((item) => item.id).join(), apply);

  onMounted(acquire);
  onUnmounted(release);
}

export function useLiveControllerState<State>(id: Ref<number>): ComputedRef<State | undefined> {
  onMounted(acquire);
  onUnmounted(release);

  return computed(() => controllerStates.value[id.value] as State | undefined);
}
