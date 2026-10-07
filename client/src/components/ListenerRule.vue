<script setup lang="ts">
  const props = defineProps({
    rule: {
      type: Object,
      required: true,
    }
  });

  const emit = defineEmits(['rule:updated', 'rule:deleted']);

  import { inject, ref } from 'vue';
  import { editorKey } from '@/editor';

  const { toggleEditor, setContent, onContentUpdate, setLanguage} = inject(editorKey)!;
  const showModal = ref(false);
  const ruleProp = ref(props.rule);
  const exists = ref(!!props.rule.id)

  const editRule = (() => {
    toggleEditor(true);
    setLanguage("javascript");
    setContent(ruleProp.value.rule);
    onContentUpdate((newContent: string) => {
      ruleProp.value.rule = newContent
    })
  })

  const updateRule = () => {
    console.log("ruleprop", ruleProp.value)
    console.log('isNew', exists)
    const url = exists.value ? `/api/rules/${ruleProp.value.id}` : "/api/rules";
    const action = exists.value ? "PUT" : "POST";

    fetch(url, {
      method: action,
      headers: {
      "Content-Type": "application/json"
      },
      body: JSON.stringify(ruleProp.value)
    }).then(async (response) => {
      if(!response.ok) {
        console.error("Failed to update rule");
      } else {
        const data = await response.json();
        ruleProp.value = data
        console.log('updated', ruleProp.value);
        emit('rule:updated', ruleProp.value);
        toggleModal();
      }
    })
  }

  const deleteRule = () => {
  fetch(`/api/rules/${ruleProp.value.id}`, {
    method: "DELETE"
  }).then(async (response) => {
    if(!response.ok) {
      console.error("Failed to delete rule");
    } else {
      console.log('deleted');
      emit('rule:deleted', ruleProp.value.id);
    }
  })
  }

  const toggleModal = () => {
    showModal.value = !showModal.value;
    console.log("modal", showModal.value)
  }
</script>

<template>
  <div class="buttons is-vcentered">
    <button
      class="button is-success"
      @click.prevent="toggleModal"
    >
      {{ exists ? 'Edit Rule' : 'Add Rule' }}
    </button>
    <button
      v-if="exists"
      class="button is-danger"
      @click.prevent="deleteRule"
    >
      Delete
    </button>
  </div>
  <Teleport to="body">
    <div
      :class="{ 'is-active': showModal }"
      class="modal"
    >
      <div class="modal-background" />
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">
            Edit Rule
          </p>
        </header>
        <section class="modal-card-body">
          <form class="block has-text-left">
            <div class="field">
              <label
                class="label"
                for="message"
              >
                Message
              </label>
              <div class="control">
                <input
                  id="message"
                  v-model="ruleProp.message"
                  class="input"
                  type="text"
                >
              </div>
            </div>
            <div class="field">
              <label class="label">Active</label>
              <div class="control">
                <input
                  v-model.number="ruleProp.active"
                  type="checkbox"
                  true-value="1"
                  false-value="0"
                >
              </div>
            </div>
            <div class="field">
              <label class="label">Script</label>
              <pre><code>{{ ruleProp.rule }}</code></pre>
              <button
                class="button mt-2"
                @click.prevent="editRule"
              >
                Edit Script
              </button>
            </div>
          </form>
        </section>
        <footer class="modal-card-foot">
          <div class="buttons">
            <button
              class="button is-success"
              @click.prevent="updateRule"
            >
              Save Changes
            </button>
            <button
              class="button is-danger"
              @click.prevent="toggleModal"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
  .modal-card {
    width: 75%;
  }
  .js-editor {
    height: 18rem;
  }
</style>
