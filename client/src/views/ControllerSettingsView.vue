<script setup lang="ts">
  import { ref, inject, provide, computed, watch, nextTick, onMounted, type Ref } from "vue";
  import { useLiveStatuses, useLiveControllerState } from '@/statusFeed';
  import { useRoute, useRouter } from 'vue-router';
  import api, { errorMessage } from '@/api';
  import {
    authRequiredKey, controllerFieldsKey, sceneStateKey,
    type SceneState, type ToolResult, type ControllerTool, type ControllerStatus, type SecretChanges
  } from '@/settings';
  import SettingsForm from '@/components/SettingsForm.vue';
  import SettingFields from '@/components/SettingFields.vue';
  import FormFooter from '@/components/FormFooter.vue';
  import StatusTag from '@/components/StatusTag.vue';
  import CopyField from '@/components/CopyField.vue';

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
    secrets: Record<string, boolean>;
    status: ControllerStatus | null;
    tools: ControllerTool[];
    tunnelUrl: string | null;
    invite: Invite | null;
  }

  const controller = ref<Controller>({ id: 0, name: "", kind: "", active: 1, options: {}, secrets: {}, status: null, tools: [], tunnelUrl: null, invite: null });
  const toolResults = ref<Record<string, ToolResult>>({});
  const runningTools = ref<Set<string>>(new Set());

  const secretChanges = ref<SecretChanges>({});
  const error = ref("");
  const saved = ref(false);
  const inviteLink = ref("");

  const controllerKinds = inject<Ref<string[]>>("controllerKinds");
  const controllerFields = inject(controllerFieldsKey);
  const authRequired = inject(authRequiredKey);
  const route = useRoute();
  const router = useRouter();

  const kindFields = computed(() => controllerFields?.value[controller.value.kind] ?? []);
  const invitable = computed(() => kindFields.value.some((field) => field.invite));

  const sceneFields = computed(() => kindFields.value.filter((field) => field.type === "scenes"));
  const controllerTabFields = computed(() => {
    return Object.fromEntries(
      Object.entries(controllerFields?.value ?? {})
        .map(([kind, fields]) => [kind, fields.filter((field) => field.type !== "scenes")])
    );
  });

  type Tab = "controller" | "scenes" | "tools";

  const tabs = computed(() => {
    const available: { key: Tab, label: string }[] = [{ key: "controller", label: "Controller" }];

    if (sceneFields.value.length > 0)
      available.push({ key: "scenes", label: "Scenes" });

    if (controller.value.tools.length > 0 || invitable.value)
      available.push({ key: "tools", label: "Tools" });

    return available;
  });

  const selectedTab = ref(route.query.tab as Tab | undefined);
  const activeTab = computed<Tab>(() => {
    return tabs.value.find((tab) => tab.key === selectedTab.value)?.key ?? "controller";
  });

  watch(selectedTab, (tab) => {
    router.replace({ query: { ...route.query, tab: tab === "controller" ? undefined : tab } });
  });

  const form = ref<HTMLFormElement>();
  let revealing = false;

  const revealInvalid = async (event: Event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-tab]")?.dataset.tab as Tab | undefined;

    if (revealing || !tab || tab === activeTab.value)
      return;

    revealing = true;
    selectedTab.value = tab;

    await nextTick();
    form.value?.reportValidity();
    revealing = false;
  };

  watch(
    () => route.params.id,
    () => {
      inviteLink.value = "";
      toolResults.value = {};
      fetchController();
    }
  );

  provide(sceneStateKey, useLiveControllerState<Record<string, SceneState>>(computed(() => controller.value.id)));

  const fetchController = async () => {
    const { id } = route.params;

    if (!id)
      return;

    try {
      const { data } = await api.get(`/controllers/${id}`);

      controller.value = { ...data, options: data.options ?? {}, tools: data.tools ?? [] };
      secretChanges.value = {};
    } catch {
    }
  };

  useLiveStatuses("controllers", computed(() => [controller.value]));

  const runTool = async (tool: ControllerTool) => {
    runningTools.value.add(tool.key);

    try {
      const { data } = await api.post<ToolResult>(`/controllers/${controller.value.id}/tools/${tool.key}`);

      toolResults.value[tool.key] = data;
    } catch (err) {
      toolResults.value[tool.key] = { ok: false, message: errorMessage(err, "That couldn't be run.") };
    } finally {
      runningTools.value.delete(tool.key);
    }
  };

  const updateController = async () => {
    const { id, name, kind, active, options } = controller.value;

    error.value = "";
    saved.value = false;

    try {
      await api.put(`/controllers/${id}`, { name, kind, active, options, secrets: secretChanges.value });
    } catch (err) {
      error.value = errorMessage(err, "Failed to update controller.");
      return;
    }

    saved.value = true;
    await fetchController();
  };

  const createInvite = async () => {
    try {
      const { data } = await api.post(`/controllers/${controller.value.id}/invite`);
      const { token, publicUrl, ...invite } = data;

      inviteLink.value = `${(publicUrl || window.location.origin).replace(/\/$/, "")}/connect#${token}`;
      controller.value.invite = invite;
    } catch (err) {
      error.value = errorMessage(err, "Failed to create an invite link.");
    }
  };

  const revokeInvite = async () => {
    try {
      await api.delete(`/controllers/${controller.value.id}/invite`);

      inviteLink.value = "";
      controller.value.invite = null;
    } catch (err) {
      error.value = errorMessage(err, "Failed to revoke the invite link.");
    }
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();

  onMounted(() => {
    fetchController();
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
  <div class="field">
    <label class="label">Connection</label>
    <StatusTag :status="controller.status" />
  </div>

  <div
    v-if="tabs.length > 1"
    class="tabs"
  >
    <ul>
      <li
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ 'is-active': tab.key === activeTab }"
      >
        <a @click.prevent="selectedTab = tab.key">{{ tab.label }}</a>
      </li>
    </ul>
  </div>

  <form
    v-show="activeTab !== 'tools'"
    ref="form"
    class="block"
    @submit.prevent="updateController"
    @invalid.capture="revealInvalid"
  >
    <div
      v-show="activeTab === 'controller'"
      data-tab="controller"
    >
      <SettingsForm
        v-model:name="controller.name"
        v-model:kind="controller.kind"
        v-model:active="controller.active"
        v-model:options="controller.options"
        v-model:secrets="secretChanges"
        :kinds="controllerKinds ?? []"
        :fields-by-kind="controllerTabFields"
        :secrets-set="controller.secrets"
        active-help="Switched off, the controller holds no connection and ignores actions sent to it."
        allow-incomplete
      />
    </div>

    <div
      v-if="sceneFields.length > 0"
      v-show="activeTab === 'scenes'"
      data-tab="scenes"
    >
      <SettingFields
        v-model:options="controller.options"
        v-model:secrets="secretChanges"
        :fields="sceneFields"
        :secrets-set="controller.secrets"
      />
    </div>

    <FormFooter
      :error="error"
      :saved="saved"
    />
  </form>

  <div
    v-if="controller.tools.length > 0"
    v-show="activeTab === 'tools'"
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
    v-show="activeTab === 'tools'"
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
      <CopyField
        :key="inviteLink"
        :value="inviteLink"
      />
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
