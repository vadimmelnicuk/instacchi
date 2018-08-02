<template>
  <transition-group name="snackbar" class="snackbar">
    <div class="toast" v-for="message in messages" v-bind:key="message.key">{{message.message}}</div>
  </transition-group>
</template>

<script>
  export default {
    name: 'snackbar',
    data: function () {
      return {
        messages: this.$snackbarMessages
      }
    }
  }
</script>

<style scoped>
  .snackbar {position: fixed; top: 75px; right: 25px;}
  .snackbar-enter-active, .snackbar-leave-active {transition: opacity 0.4s;}
  .snackbar-enter, .snackbar-leave-to {opacity: 0;}
  .toast {width: 125px; padding: 15px 25px; margin-bottom: 15px; display: block; background: #212121; border-radius: 3px; color: white; font-size: 1rem; text-align: center;}
</style>