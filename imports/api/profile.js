import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import aes256 from 'aes256'

Meteor.publish('profileId', (id) => {
  check(id, String);

  return Meteor.users.find(id, {fields: {username: 1, profile: 1, createdAt: 1}})
})

Meteor.publish('profileMy', () => {
  return Meteor.users.find(Meteor.userId(), {fields: {username: 1, profile: 1, roles: 1, createdAt: 1, settings: 1, 'instaCredentials.username': 1}})
})

Meteor.publish('profileInstaStatsMy', () => {
  return Meteor.users.find(Meteor.userId(), {fields: {instaStats: 1}})
})

Meteor.methods({
  profileSaveSettings(settings) {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Log in first")
    }

    // Fix for production
    if(Meteor.isProduction) {
      settings.browserShow = false
      settings.imagesShow = false
    }

    check(settings, {
      likesEnabled: Boolean,
      followsEnabled: Boolean,
      unfollowsEnabled: Boolean,
      commentsEnabled: Boolean,
      proxyEnabled: Boolean,
      activitiesFrom: String,
      activitiesUntil: String,
      minPosts: Number,
      minFollowers: Number,
      minFollowing: Number,
      maxFollowers: Number,
      maxFollowing: Number,
      daysToFollow: Number,
      likesPerHour: Number,
      followsPerHour: Number,
      commentsPerHour: Number,
      likeRate: Number,
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
  },
  profileSaveInstaUsername(username) {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Log in first")
    }

    check(username, String)

    return Meteor.users.update(Meteor.userId(), {$set: {'instaCredentials.username': username}})
  },
  profileSaveInstaPassword(password) {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Log in first")
    }

    check(password, String)

    if(password == '') {
      throw new Meteor.Error(404, "Instagram password is empty")
    }

    // Using bcrypt, which is not usable as password string needs to be retrievable from the hash
    // const salt = bcrypt.genSaltSync(Meteor.settings.private.instagram.saltRounds)
    // const hash = bcrypt.hashSync(password, salt)

    // Instead, AES 256 will be used with a secret stored in the app private settings
    const cipher = aes256.createCipher(Meteor.settings.private.instagram.secret)
    const hash = cipher.encrypt(password)

    return Meteor.users.update(Meteor.userId(), {$set: {'instaCredentials.password': hash}})
  }
})