<template>
  <div class="profile" v-if="$subReady.profileId">
    <div class="settings">
      <h3>Settings</h3>
      <form v-on:submit.prevent="saveInstaUsername">
        <label for="username">Instagram username</label>
        <input type="text" id="username" name="username" v-bind:value="profile.instaCredentials.username">
        <input type="submit" value="Save" class="btn">
      </form>

      <form v-on:submit.prevent="saveInstaPassword">
        <label for="password">Instagram password</label>
        <input type="password" id="password" name="password">
        <input type="submit" value="Save" class="btn">
      </form><br>
      
      <form v-on:submit.prevent="saveSettings">
        <div class="devPannel" v-if="isDevelopment">
          <label for="browserShow">Show browser</label>
          <input type="checkbox" id="browserShow" name="browserShow" v-model="profile.settings.browserShow">
          <label for="imagesShow">Show images</label>
          <input type="checkbox" id="imagesShow" name="imagesShow" v-model="profile.settings.imagesShow"><br><br>
        </div>
        <label for="likesEnabled">Liking</label>
        <input type="checkbox" id="likesEnabled" name="likesEnabled" v-model="profile.settings.likesEnabled">
        <label for="followsEnabled">Following</label>
        <input type="checkbox" id="followsEnabled" name="followsEnabled" v-model="profile.settings.followsEnabled">
        <label for="unfollowsEnabled">Unfollowing</label>
        <input type="checkbox" id="unfollowsEnabled" name="unfollowsEnabled" v-model="profile.settings.unfollowsEnabled">
        <label for="commentsEnabled">Commenting</label>
        <input type="checkbox" id="commentsEnabled" name="commentsEnabled" v-model="profile.settings.commentsEnabled"><br><br>
        <label for="activitiesFrom">Run activities from</label>
        <input type="time" id="activitiesFrom" name="activitiesFrom" v-bind:value="profile.settings.activitiesFrom"> until
        <input type="time" id="activitiesUntil" name="activitiesUntil" v-bind:value="profile.settings.activitiesUntil"> (set time in UTC)<br>
        <label for="minPosts">Minimum posts</label>
        <input type="number" id="minPosts" name="minPosts" v-bind:value="profile.settings.minPosts"><br>
        <label for="maxFollowers">Maximum followers</label>
        <input type="number" id="maxFollowers" name="maxFollowers" v-bind:value="profile.settings.maxFollowers"><br>
        <label for="maxFollowing">Maximum following</label>
        <input type="number" id="maxFollowing" name="maxFollowing" v-bind:value="profile.settings.maxFollowing"><br>
        <label for="daysToFollow">Days to follow</label>
        <input type="number" id="daysToFollow" name="daysToFollow" v-bind:value="profile.settings.daysToFollow"><br>
        <label for="likesPerHour">Likes per hour</label>
        <input type="number" id="likesPerHour" name="likesPerHour" v-bind:value="profile.settings.likesPerHour"><br>
        <label for="followsPerHour">Follows per hour</label>
        <input type="number" id="followsPerHour" name="followsPerHour" v-bind:value="profile.settings.followsPerHour"><br>
        <label for="commentsPerHour">Comments per hour</label>
        <input type="number" id="commentsPerHour" name="commentsPerHour" v-bind:value="profile.settings.commentsPerHour"><br>
        <label for="followRate">Follow rate in seconds</label>
        <input type="number" id="followRate" name="followRate" v-bind:value="profile.settings.followRate"><br>
        <label for="unfollowRate">Unfollow rate in seconds</label>
        <input type="number" id="unfollowRate" name="unfollowRate" v-bind:value="profile.settings.unfollowRate"><br>
        <label for="commentRate">Comment rate in seconds</label>
        <input type="number" id="commentRate" name="commentRate" v-bind:value="profile.settings.commentRate"><br>
        <label for="unfollowsPerDay">Unfollows per day</label>
        <input type="number" id="unfollowsPerDay" name="unfollowsPerDay" v-bind:value="profile.settings.unfollowsPerDay"><br><br>
        <label for="tags">Tags</label>
        <input type="text" id="tags" name="tags" v-bind:value="profile.settings.tags"><br><br>
        <label for="tags">Comment seed</label>
        <input type="text" id="commentSeed" name="commentSeed" v-bind:value="profile.settings.commentSeed"><br><br>
        <input type="submit" value="Save" class="btn">
      </form>
    </div>
  </div>
</template>

<script>
  import { Meteor } from 'meteor/meteor'

  export default {
    name: 'profile',
    data () {
      return {
        isDevelopment: Meteor.isDevelopment
      }
    },
    mounted () {
      this.$subscribe('profileId', [this.$route.params.id])
    },
    meteor: {
      profile() {
        return Meteor.users.findOne(this.$route.params.id)
      }
    },
    methods: {
      saveSettings(event) {
        let self = this
        let settings = {
          likesEnabled: event.target.likesEnabled.checked,
          followsEnabled: event.target.followsEnabled.checked,
          unfollowsEnabled: event.target.unfollowsEnabled.checked,
          commentsEnabled: event.target.commentsEnabled.checked,
          activitiesFrom: event.target.activitiesFrom.value,
          activitiesUntil: event.target.activitiesUntil.value,
          minPosts: parseInt(event.target.minPosts.value),
          maxFollowers: parseInt(event.target.maxFollowers.value),
          maxFollowing: parseInt(event.target.maxFollowing.value),
          daysToFollow: parseInt(event.target.daysToFollow.value),
          likesPerHour: parseInt(event.target.likesPerHour.value),
          followsPerHour: parseInt(event.target.followsPerHour.value),
          commentsPerHour: parseInt(event.target.commentsPerHour.value),
          followRate: parseInt(event.target.followRate.value),
          unfollowRate: parseInt(event.target.unfollowRate.value),
          commentRate: parseInt(event.target.commentRate.value),
          unfollowsPerDay: parseInt(event.target.unfollowsPerDay.value),
          tags: event.target.tags.value,
          commentSeed: event.target.commentSeed.value
        }

        // Production fix
        if(Meteor.isDevelopment) {
          settings.browserShow = event.target.browserShow.checked
          settings.imagesShow = event.target.imagesShow.checked
        }

        Meteor.call('profileSaveSettings', settings, function (e) {
          if(e) {
            self.toast(e.reason)
          }else{
            self.toast("Settings were saved")
          }
        })
      },
      saveInstaUsername(event) {
        let self = this

        Meteor.call('profileSaveInstaUsername', event.target.username.value, function (e) {
          if(e) {
            self.toast(e.reason)
          }else{
            self.toast("Instagram username was saved")
          }
        })
      },
      saveInstaPassword(event) {
        let self = this

        Meteor.call('profileSaveInstaPassword', event.target.password.value, function (e) {
          if(e) {
            self.toast(e.reason)
          }else{
            self.toast("Instagram password was saved")
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
  .settings {margin: 25px 0;}
  .settings input[type="checkbox"] {margin-right: 10px;}
  input {margin-bottom: 5px;}
  #tags {width: 100%;}
  #commentSeed {width: 100%;}
</style>