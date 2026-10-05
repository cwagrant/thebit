<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from "vue";
  import { STATUS_TAGS, type SettingField, type ControllerStatus, type SecretChanges } from '@/settings';
  import SettingFields from '@/components/SettingFields.vue';

  // The page behind a controller's invite link: whoever holds the link can
  // fill in that one controller's connection details here, and nothing else.
  // Public - it authenticates with the token from the URL fragment instead
  // of an admin session.
  type Invite = {
    controller: { name: string; kind: string };
    fields: SettingField[];
    options: Record<string, unknown>;
    secrets: Record<string, boolean>;
    status: ControllerStatus | null;
    // Set when the server has a tunnel available for this controller: the
    // ssh command that publishes the device, and the address it ends up at.
    tunnel: { field: string; url: string; command: string } | null;
    expiresAt: number;
  }

  const STATUS_POLL_INTERVAL_MS = 2000;
  const STATUS_POLL_ATTEMPTS = 8;

  const token = window.location.hash.slice(1);
  const invite = ref<Invite>();
  const loading = ref(true);
  const options = ref<Record<string, unknown>>({});
  const secrets = ref<SecretChanges>({});
  const error = ref("");
  const saving = ref(false);
  const saved = ref(false);
  let pollTimer: ReturnType<typeof setTimeout> | undefined;

  const request = (init: RequestInit = {}) => {
    return fetch("/api/invite", {
      ...init,
      headers: { ...init.headers, "Authorization": `Bearer ${token}` }
    });
  };

  const applyInvite = (data: Invite, { resetForm }: { resetForm: boolean }) => {
    invite.value = data;

    if (resetForm) {
      options.value = { ...data.options };
      secrets.value = {};

      // Nothing entered yet - assume they'll use the tunnel.
      if (data.tunnel && !options.value[data.tunnel.field])
        useTunnel();
    }
  };

  const copied = ref("");

  const copy = async (what: string, text: string) => {
    await navigator.clipboard.writeText(text);
    copied.value = what;
  };

  const useTunnel = () => {
    const tunnel = invite.value?.tunnel;

    if (tunnel)
      options.value[tunnel.field] = tunnel.url;
  };

  const fetchInvite = async () => {
    if (token) {
      const response = await request();

      if (response.ok)
        applyInvite(await response.json(), { resetForm: true });
    }

    loading.value = false;
  };

  // After a save the controller reconnects with the new details - follow
  // along until that settles one way or the other.
  const pollStatus = (attemptsLeft: number) => {
    clearTimeout(pollTimer);

    if (attemptsLeft <= 0 || invite.value?.status?.state === "connected")
      return;

    pollTimer = setTimeout(async () => {
      const response = await request();

      if (response.ok)
        applyInvite(await response.json(), { resetForm: false });

      pollStatus(attemptsLeft - 1);
    }, STATUS_POLL_INTERVAL_MS);
  };

  const save = async () => {
    error.value = "";
    saved.value = false;
    saving.value = true;

    try {
      const response = await request({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: options.value, secrets: secrets.value })
      });

      if (!response.ok) {
        error.value = await response.text() || "Something went wrong saving your details.";
        return;
      }

      applyInvite(await response.json(), { resetForm: true });
      saved.value = true;
      pollStatus(STATUS_POLL_ATTEMPTS);
    } finally {
      saving.value = false;
    }
  };

  onMounted(fetchInvite);
  onUnmounted(() => clearTimeout(pollTimer));
</script>

<template>
  <div class="connect">
    <p v-if="loading">
      Loading...
    </p>
    <div
      v-else-if="!invite"
      class="notification is-danger"
    >
      This invite link is invalid or has expired. Ask whoever sent it to you
      for a new one.
    </div>
    <template v-else>
      <h1 class="is-size-2">
        Connect {{ invite.controller.name }}
      </h1>
      <p class="block">
        Enter the details below to let this app control your
        {{ invite.controller.kind.toUpperCase() }}. The address has to be
        reachable from the internet - an address on your home network won't
        work. Passwords are stored encrypted and can't be read back from
        this page.
      </p>

      <div
        v-if="invite.tunnel"
        class="box"
      >
        <h2 class="is-size-4">
          Connect through a tunnel
        </h2>
        <p class="block">
          No need to change anything on your router. Open a terminal
          (PowerShell on Windows) on the computer running
          {{ invite.controller.kind.toUpperCase() }}, run this command, and
          leave it running for as long as you want to stay connected:
        </p>
        <div class="field has-addons">
          <div class="control is-expanded">
            <input
              class="input is-family-monospace"
              type="text"
              readonly
              :value="invite.tunnel.command"
              @focus="($event.target as HTMLInputElement).select()"
            >
          </div>
          <div class="control">
            <button
              class="button is-primary"
              @click="copy('command', invite.tunnel.command)"
            >
              {{ copied === 'command' ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>
        <p class="block">
          The first time, it asks whether to trust the server - answer
          <code>yes</code>. Then it asks for a password: paste the one below
          (nothing shows up as you paste) and press Enter.
        </p>
        <div class="buttons">
          <button
            class="button"
            @click="copy('password', token)"
          >
            {{ copied === 'password' ? 'Copied' : 'Copy tunnel password' }}
          </button>
          <button
            v-if="options[invite.tunnel.field] !== invite.tunnel.url"
            class="button"
            @click="useTunnel"
          >
            Use the tunnel's address below
          </button>
        </div>
      </div>

      <div
        v-if="invite.status && invite.status.state !== 'unknown'"
        class="block"
      >
        <span
          class="tag"
          :class="STATUS_TAGS[invite.status.state]"
        >
          {{ invite.status.state }}
        </span>
        <p
          v-if="invite.status.error"
          class="help is-danger"
        >
          {{ invite.status.error }}
        </p>
      </div>

      <form
        class="block"
        @submit.prevent="save"
      >
        <SettingFields
          v-model:options="options"
          v-model:secrets="secrets"
          :fields="invite.fields"
          :secrets-set="invite.secrets"
        />

        <p
          v-if="error"
          class="help is-danger"
        >
          {{ error }}
        </p>
        <p
          v-else-if="saved"
          class="help is-success"
        >
          Saved - connecting with your new details.
        </p>
        <button
          type="submit"
          class="button mt-2 is-primary"
          :class="{ 'is-loading': saving }"
        >
          Save
        </button>
      </form>

      <p class="help">
        This link works until {{ new Date(invite.expiresAt).toLocaleString() }}.
      </p>
    </template>
  </div>
</template>

<style scoped>
  .connect {
    max-width: 40rem;
    margin: 0 auto;
  }
</style>
