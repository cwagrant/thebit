<script setup lang="ts">
  import type { Action } from '@/action';
  import { isOptionsAction, isPropAction } from '@/action';

  const props = defineProps<{
    action: Action
  }>();
  console.log('propAction', props)
  const hasOptions = "options" in props.action;


  const decamelize = (str: string, separator = '_') => {
    return str
    .replace(/([a-z\d])([A-Z])/g, '$1' + separator + '$2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + separator + '$2')
    .toLowerCase();
  }

  const titleize = (str: string) => {
    return str
      .split("_") // Split the string into an array of words
      .map(word => { // Capitalize the first letter of each word
        // Handle potential extra underscores resulting in empty strings from the split
        if (word.length > 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return "";
      })
      .join(" "); // Join the words back together with spaces
  }

  const prettyPrintAction = (str: string) => titleize(decamelize(str))

  const sendAction = async (event: any) => {
//     const target = event.currentTarget;
//     let formData = Object.fromEntries(new FormData(target));
//     formData.sceneName = props.sceneName;
//     console.log('formData', formData)
//     const response = await fetch(`/api/obs/action`, {
//       method: "POST",
//       body: JSON.stringify(formData),
//       headers: {
//         "Content-Type": "application/json"
//       }
//     });
//     console.log('toggle source', event);
//     console.log('response', response)
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
    <template v-for="(values, opt) in props.action.options">
      <form @submit.prevent="sendAction" v-for="val in values" class="py-2 column">
        <input type="hidden" :name="opt" :value="getValue(val)"/>
        <input type="hidden" name="action" :value="props.action.action"/>
        <button type="submit" class="column is-fullwidth button is-info">{{prettyPrintAction(action.action)}}: {{getValue(val)}}</button>
      </form>
    </template>
    </div>
  </template>
  <template v-else-if="isPropAction(props.action)">
    <form class="mx-0 my-2 columns is-vcentered py-2" @submit.prevent="sendAction">
      <input type="hidden" name="action" :value="action.action"/>
      <button type="submit" class="column button" :class="{'is-primary': hasProps(props.action.props), 'is-warning': !hasProps(props.action.props)}">{{prettyPrintAction(action.action)}}</button>

      <template v-for="(propType, name) in props.action.props">
        <input type="text" :name="name" class="column input ml-2 is-medium" v-if="propType=='string'" required>
        <input type="text" :name="name" class="column input ml-2 is-medium" pattern="\d+(\.\d+)?" v-else-if="propType=='number'" required>
      </template>
    </form>
  </template>

</template>
