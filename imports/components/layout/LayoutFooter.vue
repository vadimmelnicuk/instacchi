<template>
  <footer>
    <div class="wrapper">
      ©2018 <router-link :to="{name: 'home'}">instacchi</router-link>
    </div>
  </footer>
</template>

<script>
  export default {
    name: 'layout-footer'
  }
</script>

<style scoped>
  footer {flex-shrink: 0;}
  footer .wrapper {padding: 40px; background-color: #222; color: white;}
  footer a {color: white;}
  footer a:hover {border: 0;}
</style>