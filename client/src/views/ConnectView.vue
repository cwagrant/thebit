<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from "vue";
  import { inviteApi, errorMessage } from '@/api';
  import { type SettingField, type ControllerStatus, type SecretChanges } from '@/settings';
  import SettingFields from '@/components/SettingFields.vue';
  import FormFooter from '@/components/FormFooter.vue';
  import StatusTag from '@/components/StatusTag.vue';
  import CopyButton from '@/components/CopyButton.vue';
  import CopyField from '@/components/CopyField.vue';

  type Invite = {
    controller: { name: string; kind: string };
    fields: SettingField[];
    options: Record<string, unknown>;
    secrets: Record<string, boolean>;
    status: ControllerStatus | null;
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

  const api = inviteApi(token);

  const otherSavedAddress = ref("");

  const applyInvite = (data: Invite, { resetForm, preferTunnel = false }: { resetForm: boolean, preferTunnel?: boolean }) => {
    invite.value = data;

    if (resetForm) {
      options.value = { ...data.options };
      secrets.value = {};

      const saved = data.tunnel ? data.options[data.tunnel.field] : undefined;

      otherSavedAddress.value = typeof saved === "string" && saved !== data.tunnel?.url ? saved : "";

      if (data.tunnel && (preferTunnel || !saved))
        useTunnel();
    }
  };

  const useSavedAddress = () => {
    const tunnel = invite.value?.tunnel;

    if (tunnel)
      options.value[tunnel.field] = otherSavedAddress.value;
  };

  const useTunnel = () => {
    const tunnel = invite.value?.tunnel;

    if (tunnel)
      options.value[tunnel.field] = tunnel.url;
  };

  const fetchInvite = async () => {
    if (token) {
      try {
        const { data } = await api.get<Invite>("/invite");

        applyInvite(data, { resetForm: true, preferTunnel: true });
      } catch {
      }
    }

    loading.value = false;
  };

  const pollStatus = (attemptsLeft: number) => {
    clearTimeout(pollTimer);

    if (attemptsLeft <= 0 || invite.value?.status?.state === "connected")
      return;

    pollTimer = setTimeout(async () => {
      try {
        const { data } = await api.get<Invite>("/invite");

        applyInvite(data, { resetForm: false });
      } catch {
      }

      pollStatus(attemptsLeft - 1);
    }, STATUS_POLL_INTERVAL_MS);
  };

  const save = async () => {
    error.value = "";
    saved.value = false;
    saving.value = true;

    try {
      const { data } = await api.put<Invite>("/invite", { options: options.value, secrets: secrets.value });

      applyInvite(data, { resetForm: true });
      saved.value = true;
      pollStatus(STATUS_POLL_ATTEMPTS);
    } catch (err) {
      error.value = errorMessage(err, "Something went wrong saving your details.");
    } finally {
      saving.value = false;
    }
  };

  onMounted(fetchInvite);
  onUnmounted(() => {
    clearTimeout(pollTimer);
  });
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
        <CopyField
          :value="invite.tunnel.command"
          monospace
        />
        <p class="block">
          The first time, it asks whether to trust the server - answer
          <code>yes</code>. Then it asks for a password: paste the one below
          (nothing shows up as you paste) and press Enter.
        </p>
        <div class="buttons">
          <CopyButton
            :text="token"
            label="Copy tunnel password"
          />
          <button
            v-if="options[invite.tunnel.field] !== invite.tunnel.url"
            class="button"
            @click="useTunnel"
          >
            Use the tunnel's address below
          </button>
        </div>
        <p
          v-if="otherSavedAddress && options[invite.tunnel.field] === invite.tunnel.url"
          class="help"
        >
          The tunnel's address is filled in below; press Save to use it. The
          address saved at the moment is <code>{{ otherSavedAddress }}</code> -
          <a @click.prevent="useSavedAddress">keep that one instead</a>.
        </p>
      </div>

      <div
        v-if="invite.status && invite.status.state !== 'unknown'"
        class="block"
      >
        <StatusTag :status="invite.status" />
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

        <FormFooter
          :error="error"
          :saved="saved"
          :saving="saving"
          saved-message="Saved - connecting with your new details."
        />
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
