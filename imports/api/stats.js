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

Meteor.publish('statsHistory', (from) => {
  let date = new Date()
  date.setDate(date.getDate() - from)
  let stats = instaStats.find({author: Meteor.userId(), createdAt: {$gt: date}}, {sort: {createdAt: -1}})
  return stats
})

Meteor.publish('statsMonth', () => {
  let dates = []
  for(let x = 0; x <= 30; x++) {
    let date = new Date()
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

  let stats = instaStats.find({_id: {$in: statIds}}, {sort: {createdAt: -1}})
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