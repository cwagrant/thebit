import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';

// Live controller and listener statuses, pushed by the server over one
// shared WebSocket (see server/src/status_feed.ts) instead of each page
// polling for them. The socket is opened when the first component using it
// mounts and closed when the last one unmounts; if it drops, it reconnects
// and the server sends the whole picture again.

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

// Keeps `status` on each of a page's items up to date from the feed. If the
// feed's set of ids stops matching the page's (something was added or
// removed elsewhere), `refetch` is called to bring the list itself up to
// date.
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

  // On a new picture from the server, and on the page's own list being
  // (re)loaded - whichever arrives second still gets the statuses applied.
  watch(feeds[kind], apply);
  watch(() => items.value.map((item) => item.id).join(), apply);

  onMounted(acquire);
  onUnmounted(release);
}
