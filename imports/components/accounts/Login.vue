<template>
  <div v-if="!userId" class="login">
    <form v-on:submit.prevent="login">
      <input type="text" name="email" placeholder="Email">
      <input type="password" name="password" placeholder="Password">
      <input type="submit" value="Login" class="btn">
    </form>
  </div>
  <div v-else>
    Already logged in
  </div>
</template>

<script>
  import { Meteor } from 'meteor/meteor'

  export default {
    name: 'login',
    meteor: {
      userId () {
        return Meteor.userId()
      }
    },
    methods: {
      login(event) {
        let self = this
        Meteor.loginWithPassword(event.target.email.value, event.target.password.value, (e) => {
          if(e) {
            self.toast(e.reason)
          }else{
            this.$router.push({name: 'home'})
            self.toast('Logged in successfully')
          }
        })
      }
    }
  }
</script>

<style scoped>
  .login {max-width: 400px; margin: 0 auto;}
  input {width: 100%; margin-bottom: 10px;}
</style>