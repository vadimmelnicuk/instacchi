<template>
  <div id="app">
    <layout-header/>
    <main>
      <div class="wrapper">
        <router-view/>
      </div>
    </main>
    <layout-footer/>
    <snackbar></snackbar>
  </div>
</template>

<script>
  import LayoutHeader from '/imports/components/layout/LayoutHeader.vue'
  import LayoutFooter from '/imports/components/layout/LayoutFooter.vue'

  export default {
    name: 'app',
    components: { LayoutHeader, LayoutFooter }
  }
</script>

<style scoped>
  #app {display: flex; width: 100%; height: 100%; min-width: 600px; flex-direction: column;}
  main {flex: 1 0 auto; background-color: white;}
  main .wrapper {padding: 40px; margin-bottom: 100px;}
</style>