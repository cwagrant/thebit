<script setup lang="ts">
  const props = defineProps({
    listener: {
    type: Object,
    required: true
    },
  });

  import { watch, ref, onMounted } from 'vue';
  import ListenerRule from '@/components/ListenerRule.vue';

  const rules = ref({});
  const fetchListenerRules = async () => {
    if(!props.listener.id)
      return

    const response = await fetch(`/api/listeners/${props.listener.id}/rules`)
    const data = await response.json();

    for (const rule of data) {
      rules.value[rule.id] = rule;
    }
  }

  const truncateText = (text: string, length: number) => {
    if (text.length <= length) {
      return text;
    }
    return text.substring(0, length) + '...';
  };


  const updateRule = (rule) => {
    rules.value[rule.id] = rule;
  }

  const deleteRule = (ruleId) => {
    delete rules.value[ruleId]
  }

  const newRule = ref({
    active: 1,
    rule: '',
    message: '',
    listener_id: props.listener.id
  })

  watch(() => props.listener, () => {
    fetchListenerRules();
  })

  onMounted(() => {
    console.log("show rules", props.listener)
    fetchListenerRules();
  })

</script>

<template>
  <div class="block">
    <ListenerRule
      :rule="newRule"
      @rule:updated="updateRule"
    />
  </div>
  <table class="table is-fullwidth">
    <thead>
      <tr>
        <th>ID</th>
        <th>Active</th>
        <th>Message</th>
        <th>Script</th>
        <th />
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(rule, id) in rules"
        :key="id"
      >
        <td class="is-vcentered">
          {{ rule.id }}
        </td>
        <td
          :class="rule.active === 1 ? 'has-text-success' : 'has-text-danger'"
          class="is-vcentered"
        >
          {{ rule.active ? 'Yes' : 'No' }}
        </td>
        <td class="is-vcentered">
          {{ rule.message }}
        </td>
        <td class="is-vcentered">
          {{ truncateText(rule.rule, 100) }}
        </td>
        <td class="has-text-right is-vcentered">
          <ListenerRule
            :rule="rule"
            @rule:updated="updateRule"
            @rule:deleted="deleteRule"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>
