<script setup lang="ts">
  import { ref, inject, computed, watch, onMounted, onUnmounted, type Ref } from "vue";
  import { useRoute } from 'vue-router';
  import {
    authRequiredKey, controllerFieldsKey, STATUS_TAGS,
    type ToolResult, type ControllerTool, type ControllerStatus, type SecretChanges
  } from '@/settings';
  import SettingsForm from '@/components/SettingsForm.vue';

  type Invite = {
    createdAt: number;
    expiresAt: number;
  }

  type Controller = {
    id: number;
    name: string;
    kind: string;
    active: number;
    options: Record<string, unknown>;
    // Which secret fields have a saved value - the values themselves never
    // come back from the server.
    secrets: Record<string, boolean>;
    status: ControllerStatus | null;
    tools: ControllerTool[];
    // The address this controller's device gets when published through the
    // tunnel server, if one is configured.
    tunnelUrl: string | null;
    invite: Invite | null;
  }

  const STATUS_POLL_INTERVAL_MS = 3000;

  const controller = ref<Controller>({ id: 0, name: "", kind: "", active: 1, options: {}, secrets: {}, status: null, tools: [], tunnelUrl: null, invite: null });
  const toolResults = ref<Record<string, ToolResult>>({});
  const runningTools = ref<Set<string>>(new Set());
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  const secretChanges = ref<SecretChanges>({});
  const error = ref("");
  const saved = ref(false);
  // Only held from the moment a link is created until the page is left -
  // the server keeps a hash of the token, not the token.
  const inviteLink = ref("");
  const inviteCopied = ref(false);

  const controllerKinds = inject<Ref<string[]>>("controllerKinds");
  const controllerFields = inject(controllerFieldsKey);
  const authRequired = inject(authRequiredKey);
  const route = useRoute();

  const invitable = computed(() => {
    return (controllerFields?.value[controller.value.kind] ?? []).some((field) => field.invite);
  });

  watch(
    () => route.params.id,
    () => {
      inviteLink.value = "";
      toolResults.value = {};
      fetchController();
    }
  );

  const fetchController = async () => {
    const { id } = route.params;

    if (!id)
      return;

    const response = await fetch(`/api/controllers/${id}`);

    if (!response.ok)
      return;

    const data = await response.json();

    controller.value = { ...data, options: data.options ?? {}, tools: data.tools ?? [] };
    secretChanges.value = {};
  };

  // Polled on its own rather than by refetching the controller, which would
  // overwrite whatever is being typed into the form.
  const fetchStatus = async () => {
    const id = controller.value.id;

    if (!id)
      return;

    const response = await fetch(`/api/controllers/${id}/status`);

    if (response.ok && controller.value.id === id)
      controller.value.status = await response.json();
  };

  const runTool = async (tool: ControllerTool) => {
    runningTools.value.add(tool.key);

    try {
      const response = await fetch(`/api/controllers/${controller.value.id}/tools/${tool.key}`, { method: "POST" });

      toolResults.value[tool.key] = response.ok
        ? await response.json()
        : { ok: false, message: await response.text() || "That couldn't be run." };
    } finally {
      runningTools.value.delete(tool.key);
    }
  };

  const updateController = async () => {
    const { id, name, kind, active, options } = controller.value;

    error.value = "";
    saved.value = false;

    const response = await fetch(`/api/controllers/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, kind, active, options, secrets: secretChanges.value })
    });

    if (!response.ok) {
      error.value = await response.text() || "Failed to update controller.";
      return;
    }

    saved.value = true;
    // The controller reconnects with its new settings after a save - the
    // status poll picks up how that went.
    await fetchController();
  };

  const createInvite = async () => {
    const response = await fetch(`/api/controllers/${controller.value.id}/invite`, { method: "POST" });

    if (!response.ok) {
      error.value = await response.text() || "Failed to create an invite link.";
      return;
    }

    const { token, publicUrl, ...invite } = await response.json();

    // The token goes in the fragment, which browsers never send to a server,
    // so it stays out of access logs along the way.
    inviteLink.value = `${(publicUrl || window.location.origin).replace(/\/$/, "")}/connect#${token}`;
    inviteCopied.value = false;
    controller.value.invite = invite;
  };

  const revokeInvite = async () => {
    const response = await fetch(`/api/controllers/${controller.value.id}/invite`, { method: "DELETE" });

    if (response.ok) {
      inviteLink.value = "";
      controller.value.invite = null;
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteLink.value);
    inviteCopied.value = true;
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();

  onMounted(() => {
    fetchController();
    pollTimer = setInterval(fetchStatus, STATUS_POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    clearInterval(pollTimer);
  });
</script>

<template>
  <div class="block">
    <div class="buttons">
      <RouterLink
        to="/"
        class="button is-info"
      >
        Back
      </RouterLink>
    </div>
  </div>
  <form
    class="block"
    @submit.prevent="updateController"
  >
    <div class="field">
      <label class="label">Connection</label>
      <span
        class="tag"
        :class="controller.status ? STATUS_TAGS[controller.status.state] : ''"
      >
        {{ controller.status?.state ?? 'unknown' }}
      </span>
      <p
        v-if="controller.status?.error"
        class="help is-danger"
      >
        {{ controller.status.error }}
      </p>
    </div>

    <SettingsForm
      v-model:name="controller.name"
      v-model:kind="controller.kind"
      v-model:options="controller.options"
      v-model:secrets="secretChanges"
      :kinds="controllerKinds ?? []"
      :fields-by-kind="controllerFields ?? {}"
      :secrets-set="controller.secrets"
    >
      <div class="field">
        <label
          class="label mt-2"
          for="active"
        >Active</label>
        <div class="control">
          <input
            id="active"
            v-model="controller.active"
            type="checkbox"
            :true-value="1"
            :false-value="0"
          >
        </div>
        <p class="help">
          Switched off, the controller holds no connection and ignores
          actions sent to it.
        </p>
      </div>
    </SettingsForm>

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
      Saved.
    </p>
    <button
      type="submit"
      class="button mt-2 is-primary"
    >
      Save
    </button>
  </form>

  <div
    v-if="controller.tools.length > 0"
    class="box"
  >
    <h2 class="is-size-4">
      Tools
    </h2>
    <p class="block">
      Run against the controller as it's currently saved and connected.
    </p>
    <div
      v-for="tool in controller.tools"
      :key="tool.key"
      class="block"
    >
      <button
        class="button"
        :class="{ 'is-loading': runningTools.has(tool.key) }"
        @click="runTool(tool)"
      >
        {{ tool.label }}
      </button>
      <p
        v-if="toolResults[tool.key]"
        class="help"
        :class="toolResults[tool.key]?.ok ? 'is-success' : 'is-danger'"
      >
        {{ toolResults[tool.key]?.message }}
      </p>
      <ul
        v-if="toolResults[tool.key]?.details?.length"
        class="help"
      >
        <li
          v-for="detail in toolResults[tool.key]?.details"
          :key="detail"
        >
          {{ detail }}
        </li>
      </ul>
      <p
        v-if="!toolResults[tool.key] && tool.help"
        class="help"
      >
        {{ tool.help }}
      </p>
    </div>
  </div>

  <div
    v-if="invitable"
    class="box"
  >
    <h2 class="is-size-4">
      Invite link
    </h2>
    <p class="block">
      Lets someone else fill in this controller's connection details
      themselves, without access to anything else here.
    </p>

    <div
      v-if="!authRequired"
      class="notification is-warning"
    >
      Admin login isn't enabled, so anyone who can reach the address in an
      invite link can also open the rest of this app. Set
      <code>THEBIT_ADMIN_PASSWORD</code> before sharing one outside your own
      network.
    </div>

    <div
      v-if="inviteLink"
      class="block"
    >
      <div class="field has-addons">
        <div class="control is-expanded">
          <input
            class="input"
            type="text"
            readonly
            :value="inviteLink"
            @focus="($event.target as HTMLInputElement).select()"
          >
        </div>
        <div class="control">
          <button
            class="button is-primary"
            @click="copyInvite"
          >
            {{ inviteCopied ? 'Copied' : 'Copy' }}
          </button>
        </div>
      </div>
      <p class="help">
        Copy this now - it can't be shown again, only replaced.
      </p>
    </div>

    <p
      v-if="controller.tunnelUrl"
      class="block"
    >
      The invite page also offers a tunnel, which publishes their device at
      <code>{{ controller.tunnelUrl }}</code>.
    </p>

    <p
      v-if="controller.invite"
      class="block"
    >
      A link is active until {{ formatDate(controller.invite.expiresAt) }}.
    </p>
    <p
      v-else
      class="block"
    >
      No link is active.
    </p>

    <div class="buttons">
      <button
        class="button"
        @click="createInvite"
      >
        {{ controller.invite ? 'Replace link' : 'Create link' }}
      </button>
      <button
        v-if="controller.invite"
        class="button is-danger"
        @click="revokeInvite"
      >
        Revoke link
      </button>
    </div>
  </div>
</template>
