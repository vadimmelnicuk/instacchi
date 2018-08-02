import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Follows } from '/imports/api/collections'
import {Likes} from "./collections";

Meteor.publish('followsMy', () => {
  let follows = Follows.find({author: Meteor.userId(), following: true}, {fields: {author: 1, following: 1, createdAt: 1}})
  return follows
})

Meteor.publish('followsRecent', () => {
  let follows = Follows.find({author: Meteor.userId(), following: true}, {sort: {createdAt: -1}, limit: 5})
  return follows
})

Meteor.publish('followsToday', () => {
  let today = new Date()
  today.setHours(0, 0, 0, 0)
  let follows = Follows.find({author: Meteor.userId(), following: true, createdAt: {$gte: today}}, {fields: {author: 1, following: 1, createdAt: 1}})
  return follows
})

Meteor.publish('unfollowsRecent', () => {
  let unfollows = Follows.find({author: Meteor.userId(), following: false}, {sort: {createdAt: -1}, limit: 5})
  return unfollows
})

Meteor.publish('unfollowsToday', () => {
  let today = new Date()
  today.setHours(0, 0, 0, 0)
  let follows = Follows.find({author: Meteor.userId(), following: false, createdAt: {$gte: today}}, {fields: {author: 1, following: 1, createdAt: 1}})
  return follows
})

Meteor.methods({
  'follow.save'(follow) {
    check(follow.author, String)
    check(follow.userName, String)
    check(follow.userUrl, String)
    check(follow.tag, String)

    follow.createdAt = new Date()
    follow.following = true

    Meteor.users.update(follow.author, {$inc: {'stats.totalFollows': 1}})

    return Follows.insert(follow)
  },
  'follow.unfollow'(id) {
    check(id, String)

    let follow = Follows.findOne(id)

    Meteor.users.update(follow.author, {$inc: {'stats.totalUnfollows': 1}})

    return Follows.update(id, {$set: {createdAt: new Date(), following: false}})
  },
  'follow.remove'(id) {
    check(id, String)

    return Follows.remove(id)
  },
  'follows.clear'() {
    return Follows.remove({author: Meteor.userId()})
  }
})