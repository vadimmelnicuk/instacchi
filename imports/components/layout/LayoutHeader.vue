<template>
  <header>
    <div class="wrapper">
      <div class="auth">
        <div v-if="$subReady.profileMy && profile">
          <router-link :to="{name: 'profile', params: {id: profile._id}}" class="profile">{{ profile.username }}</router-link>
          <button  v-on:click="logout" class="btn small">Log out</button>
        </div>
        <div v-else>
          <router-link :to="{name: 'login'}" class="btn small mr10">Login</router-link>
          <router-link :to="{name: 'signup'}" class="btn small">Sign up</router-link>
        </div>
      </div>

      <div class="logo">
        <table>
          <tr>
            <td>
              <router-link :to="{name: 'home'}">instacchi</router-link>
            </td>
            <td>
              alpha
            </td>
          </tr>
        </table>
      </div>

      <div class="nav">
        <router-link v-if="$subReady.profileMy && profile" :to="{name: 'dashboard'}" class="mr25" >Dashboard</router-link>
        <router-link :to="{name: 'about'}" class="mr25">About</router-link>
        <router-link v-if="isAdmin" :to="{name: 'admin-panel'}" class="mr25">Admin</router-link>
      </div>
    </div>
  </header>
</template>

<script>
  import { Meteor } from 'meteor/meteor'

  export default {
    name: 'layout-header',
    mounted () {
      this.$subscribe('profileMy', [])
    },
    meteor: {
      profile () {
        return Meteor.users.findOne(Meteor.userId())
      },
      isAdmin () {
        if(Meteor.userId() && this.$subReady.profileMy) {
          return Meteor.users.findOne(Meteor.userId()).roles.includes('admin')
        }else{
          return false
        }
      }
    },
    methods: {
      logout () {
        Meteor.logout()
        this.$router.push({name: "home"})
      }
    }
  }
</script>

<style scoped>
  header {}
  header .wrapper {position: relative; padding: 0 40px; background-color: white;}
  .logo {padding-top: 15px;}
  .logo table td {vertical-align: top;}
  .logo a {font-size: 4rem; transition: .2s ease;}
  .logo a:hover {border: 0; text-decoration: none; text-shadow: 0px 2px 0px #fff, 0px 5px 0px rgba(0,0,0,0.25);}
  .auth {position: absolute; top: 42px; right: 40px;}
  .auth .profile {margin-right: 10px; font-size: 1.25rem;}
  .nav {width: 100%; margin-top: 25px; padding-top: 25px; font-size: 1.5rem; border-top: 1px solid gainsboro;}
</style>