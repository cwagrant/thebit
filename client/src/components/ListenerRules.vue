<script setup lang="ts">
  const props = defineProps({
    listener: {
    type: Object,
    required: true
    },
  });

  import { watch, ref, onMounted } from 'vue';
  import api from '@/api';
  import ListenerRule from '@/components/ListenerRule.vue';

  type Rule = {
    id: number;
    listener_id: number;
    message: string;
    rule: string;
    active: number;
  }

  const rules = ref<Record<number, Rule>>({});
  const fetchListenerRules = async () => {
    if(!props.listener.id)
      return

    const { data } = await api.get<Rule[]>(`/listeners/${props.listener.id}/rules`);

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


  const updateRule = (rule: Rule) => {
    rules.value[rule.id] = rule;
  }

  const deleteRule = (ruleId: number) => {
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

  watch(() => props.listener.id, (id) => {
    newRule.value.listener_id = id;
  }, { immediate: true })

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
