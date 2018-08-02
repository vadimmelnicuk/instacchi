import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

Meteor.publish('profileId', (id) => {
  check(id, String);

  return Meteor.users.find(id, {fields: {username: 1, profile: 1, createdAt: 1, settings: 1, stats: 1}})
})

Meteor.methods({
  profileSaveSettings(settings) {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Log in first")
    }

    check(settings, {
      username: String,
      likesEnabled: Boolean,
      followsEnabled: Boolean,
      unfollowsEnabled: Boolean,
      commentsEnabled: Boolean,
      activitiesFrom: String,
      activitiesUntil: String,
      minPosts: Number,
      maxFollowers: Number,
      maxFollowing: Number,
      daysToFollow: Number,
      likesPerHour: Number,
      followsPerHour: Number,
      commentsPerHour: Number,
      followRate: Number,
      unfollowRate: Number,
      commentRate: Number,
      unfollowsPerDay: Number,
      tags: String,
      commentSeed: String,
      browserShow: Boolean,
      imagesShow: Boolean
    })

    return Meteor.users.update(Meteor.userId(), {$set: {settings: settings}})
  }
})