import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { instaStats } from '/imports/api/collections'

Meteor.publish('statsMy', () => {
  let stats = instaStats.find({author: Meteor.userId()})
  return stats
})

Meteor.publish('statsLatest', () => {
  let stats = instaStats.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 1})
  return stats
})

Meteor.methods({
  statsSave(userId, stats) {
    check(userId, String)
    check(stats, {
      url: String,
      username: String,
      posts: Number,
      followers: Number,
      following: Number
    })

    stats.author = userId
    stats.createdAt = new Date()

    return instaStats.insert(stats)
  }
})