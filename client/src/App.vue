<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import 'bulma/css/bulma.min.css'
</script>

<template>
  <nav class="container navbar is-fixed-top">
    <div class="buttons">
      <RouterLink class="button is-primary" to="/">Home</RouterLink>
      <RouterLink class="button is-primary" to="/about">About</RouterLink>
    </div>
  </nav>

  <div class="container" >
    <RouterView />
  </div>
</template>
