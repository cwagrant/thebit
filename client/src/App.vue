<script setup lang="ts">
import { ref, provide, computed, onMounted} from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import 'bulma/css/bulma.min.css'
import EditorView from '@/components/EditorView.vue'
import { editorKey, type Editor } from '@/editor'
import api from '@/api'
import { authRequiredKey, controllerFieldsKey, listenerFieldsKey, type SettingField } from '@/settings'

const editorContent = ref("");
const editorLanguage = ref("json");
const editorVisible = ref(false);
const editorCallback = ref<(content: string) => void>();

const toggleEditor = (state: boolean | undefined = undefined) => {
  editorVisible.value = state ?? !editorVisible.value;
}

const editorUpdate = (newContent: string) => {
  if(editorCallback.value) {
    editorCallback.value(newContent)
  }

  editorContent.value = newContent;
}

const closeEditor = () => {
  editorVisible.value = false;
  editorCallback.value = undefined;
}

const editor: Editor = {
  toggleEditor,
  onContentUpdate: (callback) => {
    editorCallback.value = callback;
  },
  setContent: (content: string) => {
    editorContent.value = content;
  },
  setLanguage: (language: string) => {
    editorLanguage.value = language;
  },
}

const listenerKinds = ref<string[]>([]);
const controllerKinds = ref<string[]>([]);

const fetchListenerKinds = async () => {
  const { data } = await api.get<string[]>("/listeners/available");
  listenerKinds.value = data;
}

const fetchControllerKinds = async () => {
  const { data } = await api.get<string[]>("/controllers/available");
  controllerKinds.value = data;
}

const controllerFields = ref<Record<string, SettingField[]>>({});

const fetchControllerFields = async () => {
  const { data } = await api.get<Record<string, SettingField[]>>("/controllers/fields");
  controllerFields.value = data;
}

const listenerFields = ref<Record<string, SettingField[]>>({});

const fetchListenerFields = async () => {
  const { data } = await api.get<Record<string, SettingField[]>>("/listeners/fields");
  listenerFields.value = data;
}

const fetchKinds = () => {
  fetchListenerKinds();
  fetchControllerKinds();
  fetchControllerFields();
  fetchListenerFields();
}

const route = useRoute();
const router = useRouter();
const sessionChecked = ref(false);
const authRequired = ref(false);
const authenticated = ref(false);
const password = ref("");
const loginError = ref("");

const isPublicRoute = computed(() => route.meta.public === true);

const fetchSession = async () => {
  const { data: session } = await api.get<{ authRequired: boolean, authenticated: boolean }>("/session");

  authRequired.value = session.authRequired;
  authenticated.value = session.authenticated;
  sessionChecked.value = true;

  if (authenticated.value)
    fetchKinds();
}

const login = async () => {
  loginError.value = "";

  try {
    await api.post("/session", { password: password.value });
  } catch {
    loginError.value = "Wrong password.";
    return;
  } finally {
    password.value = "";
  }

  await fetchSession();
}

const logout = async () => {
  await api.delete("/session");
  authenticated.value = false;
}

onMounted(async () => {
  await router.isReady();

  if (!isPublicRoute.value)
    fetchSession();
})

provide(editorKey, editor)
provide("listenerKinds", listenerKinds);
provide("controllerKinds", controllerKinds);
provide(controllerFieldsKey, controllerFields);
provide(listenerFieldsKey, listenerFields);
provide(authRequiredKey, authRequired);
</script>

<template>
  <div
    v-if="isPublicRoute"
    class="container mt-3"
  >
    <RouterView />
  </div>
  <template v-else-if="sessionChecked && authenticated">
    <nav class="main-nav navbar is-fixed-top">
      <div class="container">
        <RouterLink
          class="navbar-item"
          to="/"
        >
          Home
        </RouterLink>
        <RouterLink
          class="navbar-item"
          to="/listeners"
        >
          Listeners
        </RouterLink>
        <a
          v-if="authRequired"
          class="navbar-item"
          @click.prevent="logout"
        >
          Log out
        </a>
      </div>
    </nav>

    <div class="container mt-3">
      <RouterView />
    </div>
  </template>
  <div
    v-else-if="sessionChecked"
    class="container mt-3"
  >
    <form
      class="login block"
      @submit.prevent="login"
    >
      <h1 class="is-size-2">
        Log in
      </h1>
      <label
        class="label mt-2"
        for="password"
      >Password</label>
      <input
        id="password"
        v-model="password"
        class="input"
        type="password"
        autocomplete="current-password"
        required
      >
      <p
        v-if="loginError"
        class="help is-danger"
      >
        {{ loginError }}
      </p>
      <button
        type="submit"
        class="button mt-2 is-primary"
      >
        Log in
      </button>
    </form>
  </div>
  <div class="editor">
    <EditorView
      v-if="editorVisible"
      :content="editorContent"
      :language="editorLanguage"
      @editor:update="editorUpdate"
      @editor:close="closeEditor"
    />
  </div>
</template>
<style>
  .main-nav {
    border-bottom: 1px solid #222;
  }

  .login {
    max-width: 24rem;
    margin: 0 auto;
  }
</style>
