<template>
  <div v-if="!userId" class="sign-up">
    <form v-on:submit.prevent="register">
      <input type="text" name="username" placeholder="User name">
      <input type="text" name="email" placeholder="Email">
      <input type="password" name="password" placeholder="Password">
      <input type="submit" value="Sign up" class="btn">
    </form>
  </div>
  <div v-else>
    Already logged in
  </div>
</template>

<script>
  import { Accounts } from 'meteor/accounts-base'

  export default {
    name: 'sign-up',
    meteor: {
      userId () {
        return Meteor.userId()
      }
    },
    methods: {
      register(event) {
        let self = this
        Accounts.createUser({
          username: event.target.username.value,
          email: event.target.email.value,
          password: event.target.password.value
        }, (e) => {
          if (e) {
            self.toast(e.reason)
          } else {
            this.$router.push({name: 'home'})
            self.toast('Signed up successfully')
          }
        })
      }
    }
  }
</script>

<style scoped>
  .sign-up {max-width: 400px; margin: 0 auto;}
  input {width: 100%; margin-bottom: 10px;}
</style>