<template>
  <div>
    <div v-if="$subReady.statsLatest && statsLatest" class="stats stats-my">
      <div class="stat">
        Updated {{statsLatest.createdAt | fromNow}}
        <div class="number">
          <a v-bind:href="'https://www.instagram.com/'+statsLatest.username+'/'" target="_blank">{{statsLatest.username}}</a>
        </div>
        <div v-if="showChangeInfo" class="change-info">
          <div class="controls">
            <button v-on:click="showStatsThreeDays()" class="btn small">Last 3 days</button>
            <button v-on:click="showStatsMonth()" class="btn small">Last 30 days</button>
          </div>
          <table v-if="showStatsType === 1 && $subReady.statsHistory" class="change-info-stats">
            <tr>
              <th>Date</th>
              <th>Followers</th>
              <th>Following</th>
            </tr>
            <tr v-for="statistic in statsHistory" v-bind:key="statistic._id">
              <td>{{statistic.createdAt | readableDate}}</td>
              <td>
                <span class="change-info-stat">{{statistic.followers}}</span>
                <span v-bind:class="statistic.followersChange | numberPositivity">{{statistic.followersChange | numberSign}}</span>
              </td>
              <td>
                <span class="change-info-stat">{{statistic.following}}</span>
                <span v-bind:class="statistic.followingChange | numberPositivity">{{statistic.followingChange | numberSign}}</span>
              </td>
            </tr>
          </table>
          <table v-if="showStatsType === 2 && $subReady.statsMonth" class="change-info-stats">
            <tr>
              <th>Date</th>
              <th>Followers</th>
              <th>Following</th>
            </tr>
            <tr v-for="statistic in statsMonth" v-bind:key="statistic._id">
              <td>{{statistic.createdAt | readableDate}}</td>
              <td>
                <span class="change-info-stat">{{statistic.followers}}</span>
                <span v-bind:class="statistic.followersChange | numberPositivity">{{statistic.followersChange | numberSign}}</span>
              </td>
              <td>
                <span class="change-info-stat">{{statistic.following}}</span>
                <span v-bind:class="statistic.followingChange | numberPositivity">{{statistic.followingChange | numberSign}}</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
      <div class="stat">
        Posts
        <div class="number">
          {{statsLatest.posts}}
        </div>
      </div>
      <div class="stat">
        Followers
        <div class="number">
          {{statsLatest.followers}}
        </div>
      </div>
      <div class="stat">
        Following
        <div class="number">
          {{statsLatest.following}}
        </div>
      </div>
      <div class="stat">
        <button v-on:click="toggleShowChangeInfo()" class="btn small">Details</button>
      </div>
    </div>

    <table class="stats">
      <tr>
        <td class="likes">
          <div class="stat">
            Total likes
            <div v-if="$subReady.profileInstaStatsMy" class="number">{{profile.instaStats.totalLikes}}</div><div v-else class="number">0</div>
          </div>
          <div class="stat">
            Today's likes
            <div class="number">{{likesToday}}</div>
          </div>
          <div class="stat">
            This hour likes / limit
            <div class="number">
              {{likesThisHour}} <span v-if="$subReady.profileMy" class="limit"> / {{profile.settings.likesPerHour}}</span>
            </div>
          </div>
        </td>
        <td class="follows">
          <div class="stat">
            Total follows / active
            <div class="number">
              <span v-if="$subReady.profileInstaStatsMy">{{profile.instaStats.totalFollows}}</span>
              <span v-if="$subReady.followsMy" class="limit"> / {{followsActive}}</span>
              <span v-else class="limit"> / 0</span>
            </div>
          </div>
          <div class="stat">
            Today's follows
            <div class="number">{{followsToday}}</div>
          </div>
          <div class="stat">
            This hour follows / limit
            <div class="number">
              {{followsThisHour}} <span v-if="$subReady.profileMy" class="limit"> / {{profile.settings.followsPerHour}}</span>
            </div>
          </div>
        </td>
        <td class="unfollows">
          <div class="stat">
            Total unfollows
            <div v-if="$subReady.profileInstaStatsMy" class="number">{{profile.instaStats.totalUnfollows}}</div><div v-else class="number">0</div>
          </div>
          <div class="stat">
            Today's unfollows / limit
            <div class="number">
              {{unfollowsToday}} <span v-if="$subReady.profileMy" class="limit"> / {{profile.settings.unfollowsPerDay}}</span>
            </div>
          </div>
        </td>
        <td class="comments">
          <div class="stat">
            Total comments
            <div v-if="$subReady.profileInstaStatsMy" class="number">{{profile.instaStats.totalComments}}</div><div v-else class="number">0</div>
          </div>
          <div class="stat">
            Today's comments
            <div class="number">{{commentsToday}}</div>
          </div>
          <div class="stat">
            This hour comments / limit
            <div class="number">
              {{commentsThisHour}} <span v-if="$subReady.profileMy" class="limit"> / {{profile.settings.commentsPerHour}}</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <table class="dashboard">
      <tr>
        <td>
          <b>Browser</b>
          <div class="browser" v-if="$subReady.browserMy && browser">
            <span>{{browser.createdAt | readableDate}}</span>
            <a v-bind:title="browser.endpoint">socket</a>
            <span v-if="browser.running" class="label green">running</span>
            <span v-else class="label red">stopped</span>
            <span v-if="browser.processing" class="label green">processing</span>
            <span v-else class="label grey">paused</span>
            <div v-if="browser.verify" class="code">
              <form v-on:submit.prevent="saveCode()">
                <input type="text" name="code" placeholder="Code">
                <input type="submit" value="Save" class="btn">
              </form>
            </div>
          </div>
          <div v-else class="browser">
            None
          </div>
        </td>
        <td>
          <b>Controls</b>
          <div class="controls">
            <button v-if="browser && browser.running" v-on:click="instaStop()" class="btn small">Stop</button>
            <button v-else v-on:click="instaRun()" class="btn small">Run</button>
            <button v-if="browser" v-on:click="closeMyBrowser()" class="btn small">Close my browser</button>
            <button v-else v-on:click="launchBrowser()" class="btn small">Launch browser</button>
            <button v-on:click="clearLogs()" class="btn small" v-if="isDevelopment">Clear logs</button>
            <button v-on:click="clearLikes()" class="btn small" v-if="isDevelopment">Clear likes</button>
          </div>
        </td>
      </tr>
    </table>

    <table class="activity">
      <tr>
        <td>
          <div class="title">Recent likes</div>
          <div v-if="$subReady.likesRecent && likesRecent.length > 0" class="likes">
            <div class="like" v-for="like in likesRecent" v-bind:key="like._id">
              <a v-bind:href="like.url" target="_blank"><img v-bind:src="like.photo"></a> {{like.createdAt | fromNow}} by <a class="user" v-bind:href="like.userUrl" target="_blank">{{like.userName}}</a> from <a class="tag" v-bind:href="'https://instagram.com/explore/tags/'+like.tag" target="_blank">{{like.tag}}</a>
            </div>
          </div>
          <div class="likes" v-else>
            No likes
          </div>
        </td>
        <td>
          <div class="title">Recent follows</div>
          <div v-if="$subReady.followsRecent && followsRecent.length > 0" class="follows">
            <div v-for="follow in followsRecent" v-bind:key="follow._id" class="follow">
              <a v-bind:href="follow.userUrl" target="_blank">{{follow.userName}}</a> {{follow.createdAt | fromNow}} from <a class="tag" v-bind:href="'https://instagram.com/explore/tags/'+follow.tag" target="_blank">{{follow.tag}}</a>
            </div>
          </div>
          <div v-else class="follows">
            No follows
          </div>
          <div class="title">Recent unfollows</div>
          <div v-if="$subReady.unfollowsRecent && unfollowsRecent.length > 0" class="unfollows">
            <div v-for="unfollow in unfollowsRecent" v-bind:key="unfollow._id" class="unfollow">
              <a v-bind:href="unfollow.userUrl" target="_blank">{{unfollow.userName}}</a> {{unfollow.createdAt | fromNow}}
            </div>
          </div>
          <div v-else class="unfollows">
            No unfollows
          </div>
        </td>
        <td>
          <div class="title">Recent comments</div>
          <div v-if="$subReady.commentsRecent && commentsRecent.length > 0" class="comments">
            <div v-for="comment in commentsRecent" v-bind:key="comment._id" class="comment">
              <a v-bind:href="comment.url" target="_blank">{{comment.userName}}</a> {{comment.createdAt | fromNow}} "{{comment.message}}"
            </div>
          </div>
          <div v-else>
            No comments
          </div>
        </td>
      </tr>
    </table>

    <h3>Logs</h3>
    <div class="logs" v-if="$subReady.logsMy && logs.length > 0">
      <div class="log" v-for="log in logs" v-bind:key="log._id">
        <b>{{log.createdAt | readableDate}}</b> : {{log.message}}
      </div>
    </div>
    <div class="logs" v-else>
      No logs
    </div>

  </div>
</template>

<script>
  import { Meteor } from 'meteor/meteor'
  import { Session } from 'meteor/session'

  import { Browsers, Logs, Likes, Follows, Comments, instaStats } from '/imports/api/collections'

  // Time session
  Session.set("time", new Date())
  Meteor.setInterval(function() {
    Session.set("time", new Date())
  }, 60000)

  export default {
    name: 'dashboard',
    data () {
      return {
        isDevelopment: Meteor.isDevelopment,
        showChangeInfo: false,
        showStatsType: 1
      }
    },
    mounted () {
      this.$subscribe('profileMy', [])
      this.$subscribe('profileInstaStatsMy', [])
      this.$subscribe('statsLatest', [])
      this.$subscribe('statsHistory', [3])
      this.$subscribe('statsMonth', [])
      this.$subscribe('browserMy', [])
      this.$subscribe('logsMy', [])
      this.$subscribe('followsMy', [])
      this.$subscribe('likesToday', [])
      this.$subscribe('followsToday', [])
      this.$subscribe('unfollowsToday', [])
      this.$subscribe('commentsToday', [])
      this.$subscribe('likesRecent', [])
      this.$subscribe('followsRecent', [])
      this.$subscribe('unfollowsRecent', [])
      this.$subscribe('commentsRecent', [])
    },
    meteor: {
      profile() {
        return Meteor.users.findOne(Meteor.userId())
      },
      statsLatest() {
        return instaStats.findOne({author: Meteor.userId()}, {sort: {createdAt: -1}})
      },
      statsHistory() {
        // Get stats for the last three days
        let date = Session.get("time")
        date.setDate(date.getDate() - 3)

        let stats = instaStats.find({author: Meteor.userId(), createdAt: {$gt: date}}, {sort: {createdAt: -1}}).fetch()

        stats.map(function(statistic, index) {
          if(index < stats.length-1) {
            statistic.followersChange = stats[index].followers - stats[index+1].followers
            statistic.followingChange = stats[index].following - stats[index+1].following
          }else{
            statistic.followersChange = 0
            statistic.followingChange = 0
          }
        })

        return stats
      },
      statsMonth() {
        // Get daily stats for the last months
        let dates = []
        for(let x = 0; x <= 30; x++) {
          let date = Session.get("time")
          date.setHours(24, 59, 0, 0)
          date.setDate(date.getDate() - x)
          dates.push(date)
        }

        let statIds = []
        dates.map(function(day) {
          let stat = instaStats.findOne({author: Meteor.userId(), createdAt: {$lt: day}}, {sort: {createdAt: -1}})
          if(stat && !statIds.includes(stat._id)) {
            statIds.push(stat._id)
          }
        })

        let stats = instaStats.find({_id: {$in: statIds}}, {sort: {createdAt: -1}}).fetch()

        stats.map(function(statistic, index) {
          if(index < stats.length-1) {
            statistic.followersChange = stats[index].followers - stats[index+1].followers
            statistic.followingChange = stats[index].following - stats[index+1].following
          }else{
            statistic.followersChange = 0
            statistic.followingChange = 0
          }
        })

        return stats
      },
      browser() {
        let browser = Browsers.findOne({author: Meteor.userId()})
        return browser ? browser : false
      },
      logs() {
        return Logs.find({author: Meteor.userId()}, {sort: {createdAt: -1}})
      },
      followsActive() {
        return Follows.find({author: Meteor.userId(), following: true}).count()
      },
      likesRecent() {
        return Likes.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 10})
      },
      followsRecent() {
        return Follows.find({author: Meteor.userId(), following: true}, {sort: {createdAt: -1}, limit: 5})
      },
      unfollowsRecent() {
        return Follows.find({author: Meteor.userId(), following: false}, {sort: {createdAt: -1}, limit: 5})
      },
      commentsRecent() {
        return Comments.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 10})
      },
      likesToday() {
        let date = Session.get("time")
        date.setHours(0, 0, 0, 0)
        return Likes.find({author: Meteor.userId(), createdAt: {$gte: date}}).count()
      },
      likesThisHour() {
        let date = Session.get("time")
        date.setMinutes(0, 0, 0)
        return Likes.find({author: Meteor.userId(), createdAt: {$gte: date}}).count()
      },
      followsToday() {
        let date = Session.get("time")
        date.setHours(0, 0, 0, 0)
        return Follows.find({author: Meteor.userId(), following: true, createdAt: {$gte: date}}).count()
      },
      followsThisHour() {
        let date = Session.get("time")
        date.setMinutes(0, 0, 0)
        return Follows.find({author: Meteor.userId(), following: true, createdAt: {$gte: date}}).count()
      },
      unfollowsToday() {
        let date = Session.get("time")
        date.setHours(0, 0, 0, 0)
        return Follows.find({author: Meteor.userId(), following: false, createdAt: {$gte: date}}).count()
      },
      commentsToday() {
        let date = Session.get("time")
        date.setHours(0, 0, 0, 0)
        return Comments.find({author: Meteor.userId(), createdAt: {$gte: date}}).count()
      },
      commentsThisHour() {
        let date = Session.get("time")
        date.setMinutes(0, 0, 0)
        return Comments.find({author: Meteor.userId(), createdAt: {$gte: date}}).count()
      }
    },
    methods: {
      instaRun() {
        let self = this
        Meteor.call('runLoop', function (e, r) {
          if(e) {
            self.toast(e.reason)
          }
        })
      },
      instaStop() {
        let self = this
        Meteor.call('stopLoop', function (e, r) {
          if(e) {
            self.toast(e.reason)
          }
        })
      },
      launchBrowser() {
        let self = this
        Meteor.call('browserAdd', function (e, r) {
          if(e) {
            self.toast(e.reason)
          }
        })
      },
      closeMyBrowser() {
        let self = this
        Meteor.call('browserRemoveMy', function (e, r) {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('Your browser was closed')
          }
        })
      },
      clearLogs() {
        let self = this
        Meteor.call('logsClear', function (e, r) {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('Logs were cleared')
          }
        })
      },
      clearLikes() {
        let self = this
        Meteor.call('likesClear', function (e, r) {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('Likes were cleared')
          }
        })
      },
      saveCode(event) {
        let self = this
        Meteor.call('browserSaveCode', event.target.code.value, (e, r) => {
          if(e) {
            self.toast(e.reason)
          } else {
            self.toast('The code was saved')
          }
        })
      },
      toggleShowChangeInfo(event) {
        this.showChangeInfo = !this.showChangeInfo
      },
      showStatsThreeDays(event) {
        this.showStatsType = 1
      },
      showStatsMonth(event) {
        this.showStatsType = 2
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
  .stats {width: 100%; margin-bottom: 25px;}
  .stats td {width: 25%; vertical-align: top;}
  .stats .stat {margin-bottom: 10px; font-size: 0.85rem; color: dimgrey;}
  .stats .number {font-size: 1.5rem; color: black;}
  .stats .number .limit {font-size: 1rem;}

  .stats-my {border-bottom: 1px solid gainsboro;}
  .stats-my .stat {display: inline-block; margin-right: 25px; margin-bottom: 20px;}
  .stats-my .controls {margin-bottom: 5px;}
  .change-info {position: absolute; z-index: 1; margin-top: 10px; padding: 10px; font-size: 0.85rem; color: black; border: 1px solid gainsboro; background: white;}
  .change-info .change-info-stats th {text-align: left;}
  .change-info .change-info-stats td {padding-right: 25px;}
  .change-info .change-info-stats .change-info-stat {display: inline-block; min-width: 35px;}
  .dashboard {width: 100%; min-height: 85px; padding: 5px; border: 1px solid gainsboro;}
  .dashboard td {width: 50%; vertical-align: top;}
  .dashboard .browser .code {margin-top: 10px;}
  .dashboard .controls button {margin-bottom: 5px;}
  .activity {width: 100%; margin: 10px 0; font-size: 1rem;}
  .activity td {width: 33%; vertical-align: top; padding-right: 10px; font-size: 0.85rem;}
  .activity .title {margin-bottom: 5px; font-size: 1rem; font-weight: bold;}
  .likes .like {margin-bottom: 3px; color: dimgrey;}
  .likes .like img {width: 22px; height: 22px; vertical-align: middle;}
  .follows {margin-bottom: 10px;}
  .follows .follow {margin-bottom: 3px; color: dimgrey;}
  .unfollows .unfollow {margin-bottom: 3px; color: dimgrey;}
  .comments .comment {margin-bottom: 3px; color: dimgrey;}
  .logs {max-height: 300px; height: 300px; margin: 10px 0; padding: 5px; font-size: 0.85rem; overflow-y: scroll; border: 1px solid gainsboro;}
</style>
