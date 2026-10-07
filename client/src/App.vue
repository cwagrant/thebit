<script setup lang="ts">
import { ref, provide, computed, onMounted} from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import 'bulma/css/bulma.min.css'
import EditorView from '@/components/EditorView.vue'
import { editorKey, type Editor } from '@/editor'
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
  const response = await fetch("/api/listeners/available")
  const data = await response.json();
  console.log(data);
  listenerKinds.value = data;
}

const fetchControllerKinds = async () => {
  const response = await fetch("/api/controllers/available")
  const data = await response.json();
  controllerKinds.value = data;
}

const controllerFields = ref<Record<string, SettingField[]>>({});

const fetchControllerFields = async () => {
  const response = await fetch("/api/controllers/fields")
  controllerFields.value = await response.json();
}

const listenerFields = ref<Record<string, SettingField[]>>({});

const fetchListenerFields = async () => {
  const response = await fetch("/api/listeners/fields")
  listenerFields.value = await response.json();
}

const fetchKinds = () => {
  fetchListenerKinds();
  fetchControllerKinds();
  fetchControllerFields();
  fetchListenerFields();
}

// Admin login, when the server has THEBIT_ADMIN_PASSWORD set. Routes marked
// `public` (the invite page) are shown without one - they never touch the
// admin API.
const route = useRoute();
const router = useRouter();
const sessionChecked = ref(false);
const authRequired = ref(false);
const authenticated = ref(false);
const password = ref("");
const loginError = ref("");

const isPublicRoute = computed(() => route.meta.public === true);

const fetchSession = async () => {
  const response = await fetch("/api/session");
  const session = await response.json();

  authRequired.value = session.authRequired;
  authenticated.value = session.authenticated;
  sessionChecked.value = true;

  if (authenticated.value)
    fetchKinds();
}

const login = async () => {
  loginError.value = "";

  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: password.value })
  });

  password.value = "";

  if (!response.ok) {
    loginError.value = "Wrong password.";
    return;
  }

  await fetchSession();
}

const logout = async () => {
  await fetch("/api/session", { method: "DELETE" });
  authenticated.value = false;
}

onMounted(async () => {
  // route.meta isn't populated until the initial navigation resolves.
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
