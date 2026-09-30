<script setup lang="ts">
  import { inject } from 'vue';
  import type { Action } from '@/action';
  import { isOptionsAction, isPropAction, sendActionKey } from '@/action';

  const props = defineProps<{
    action: Action,
    path: string[],
    controller: string;
  }>();

  const send = inject(sendActionKey)!;

  const decamelize = (str: string, separator = '_') => {
    return str
    .replace(/([a-z\d])([A-Z])/g, '$1' + separator + '$2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + separator + '$2')
    .toLowerCase();
  }

  const titleize = (str: string) => {
    return str
      .split("_")
      .map(word => {
        if (word.length > 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return "";
      })
      .join(" ");
  }

  const prettyPrintAction = (str: string) => titleize(decamelize(str))

  const sendAction = (event: Event) => {
    const form = event.currentTarget as HTMLFormElement;
    const formProps = Object.fromEntries(new FormData(form)) as Record<string, string>;

    send({
      controller: props.controller,
      path: props.path,
      action: props.action.action,
      props: formProps
    });
  }

  const getValue = (obj: any) => {
    if(typeof obj === "object") {
      return obj.name
    } else {
      return obj
    }
  }

  const hasProps = (props: object) => {
    return Object.entries(props).length
  }
</script>

<template>
  <template v-if="isOptionsAction(props.action)">
    <div class="columns my-2">
    <template v-for="(values, opt) in props.action.options" :key="opt">
      <form @submit.prevent="sendAction" v-for="val in values" :key="getValue(val)" class="py-2 column">
        <input type="hidden" :name="opt" :value="getValue(val)"/>
        <button type="submit" class="column is-fullwidth button is-info">{{prettyPrintAction(action.action)}}: {{getValue(val)}}</button>
      </form>
    </template>
    </div>
  </template>
  <template v-else-if="isPropAction(props.action)">
    <form class="mx-0 my-2 columns is-vcentered py-2" @submit.prevent="sendAction">
      <button type="submit" class="column button" :class="{'is-primary': hasProps(props.action.props), 'is-warning': !hasProps(props.action.props)}">{{prettyPrintAction(action.action)}}</button>

      <template v-for="(propType, name) in props.action.props" :key="name">
        <input type="text" :name="name" class="column input ml-2 is-medium" v-if="propType=='string'" required>
        <input type="text" :name="name" class="column input ml-2 is-medium" pattern="-?\d+(\.\d+)?" v-else-if="propType=='number'" required>
      </template>
    </form>
  </template>

</template>
