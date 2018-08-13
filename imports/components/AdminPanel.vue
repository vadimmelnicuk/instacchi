<template>
  <div v-if="isAdmin" class="admin-panel">

    <div v-if="$subReady.browsersAll" class="controls">
      <button v-on:click="instaAllStop()" class="btn small">Stop all browsers</button>
      <button v-on:click="instaAllStart()" class="btn small">Start all browsers</button>
      <button v-on:click="clearLogs()" class="btn small">Clear logs</button>
    </div>

    <h3 >Browsers</h3>
    <div class="browsers" v-if="$subReady.browsersAll && browsers.length > 0">
      <table v-for="browser in browsers" v-bind:key="browser._id" class="browser">
        <tr>
          <td>
            <b>{{browser.createdAt | readableDate}}</b>
          </td>
          <td>
            <div>
              <router-link :to="{name: 'profile', params: {id: browser.author._id}}">{{ browser.author.username }}</router-link>
              <a v-bind:title="browser.endpoint">Socket</a>
              <span class="green" v-if="browser.running">Running</span>
              <span class="red" v-else>Stopped</span>
              <span class="green" v-if="browser.processing">Processing</span>
            </div>
            <div>
              <a v-bind:href="'https://www.instagram.com/'+browser.instaStats.username+'/'" target="_blank">{{browser.instaStats.username}}</a>
              <span>posts: {{browser.instaStats.posts}}</span>
              <span>followers: {{browser.instaStats.followers}}</span>
              <span>following: {{browser.instaStats.following}}</span>
            </div>
          </td>
        </tr>
      </table>
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

  import { Browsers, instaStats } from '/imports/api/collections'

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
          browser.instaStats = instaStats.findOne({author: browser.author._id})
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
  .browsers {margin: 10px 0; padding: 5px; border: 1px solid gainsboro;}
  .browsers .browser td {vertical-align: top;}
</style>