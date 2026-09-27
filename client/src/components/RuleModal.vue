<script setup lang="ts">
  const props = defineProps({
    showModal: {
      type: Boolean,
      required: true
    },
    rule: {
      type: Object,
      required: false,
      default: () => {
        return {
          id: 0,
          active: 1,
          rule: '',
          message: '',
          listener_id: 0
        }
      }
    }
  });

</script>
<template>
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
</template>
