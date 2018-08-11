<template>
  <div v-if="isAdmin" class="admin-panel">

    <div v-if="$subReady.browsersAll" class="controls">
      <button v-on:click="instaAllStop()" class="btn small">Stop all browsers</button>
      <button v-on:click="instaAllStart()" class="btn small">Start all browsers</button>
      <button v-on:click="clearLogs()" class="btn small">Clear logs</button>
    </div>

    <h3 >Browsers</h3>
    <div class="browsers" v-if="$subReady.browsersAll && browsers.length > 0">
      <div class="browser" v-for="browserItem in browsers" v-bind:key="browserItem._id">
        <b>{{browserItem.createdAt | readableDate}}</b>
        <router-link :to="{name: 'profile', params: {id: browserItem.author._id}}">{{ browserItem.author.username }}</router-link>
        <a v-bind:title="browserItem.endpoint">Socket</a>
        <span class="active" v-if="browserItem.running">Running</span>
        <span class="inactive" v-else>Stopped</span>
        <span class="active" v-if="browserItem.processing">Processing</span>
      </div>
    </div>
    <div class="browsers" v-else>
      No browsers
    </div>



  </div>
  <div class="admin-panel" v-else>
    Not authorised
  </div>
</template>

<script>
  import { Meteor } from 'meteor/meteor'

  import { Browsers } from '/imports/api/collections'

  export default {
    name: 'admin-panel',
    mounted () {
      this.$subscribe('profileMy', [])
      this.$subscribe('browsersAll', [])
    },
    meteor: {
      profile() {
        return Meteor.users.findOne(Meteor.userId())
      },
      isAdmin() {
        if(Meteor.userId() && this.$subReady.profileMy) {
          return Meteor.users.findOne(Meteor.userId()).roles.includes('admin')
        }else{
          return false
        }
      },
      browsers() {
        let browsers = Browsers.find({}, {sort: {createdAt: -1}}).map(function(browser) {
          browser.author = Meteor.users.findOne(browser.author)
          return browser
        })

        return browsers
      }
    },
    methods: {
      instaAllStop() {
        let self = this
        Meteor.call('stopAllTimers', function (e, r) {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('All timers were stopped')
          }
        })

        Meteor.call('browsersStop', function (e, r) {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('All browsers were stopped')
          }
        })
      },
      instaAllStart() {
        Browsers.find({running: true}).map(function(browser) {
          Meteor.call('logSaveUser', {message: '--- START --- Scheduler', author: browser.author})
          Meteor.call('reviveLoop', browser.author)
        })
      },
      clearLogs() {
        let self = this
        Meteor.call('logsClear', function (e, r) {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('All logs were removed')
          }
        })
      }
    },
    beforeRouteEnter(to, from, next) {
      Meteor.userId() ? next() : next({name: 'login'})
    },
    beforeRouteUpdate(to, from, next) {
      Meteor.userId() ? next() : next({name: 'login'})
    }
  }
</script>

<style scoped>
  .active {color: green;}
  .inactive {color: firebrick;}
  .browsers {margin: 10px 0; padding: 5px; border: 1px solid gainsboro;}
</style>