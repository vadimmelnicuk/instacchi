import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Likes } from '/imports/api/collections'

Meteor.publish('likesMy', () => {
  let likes = Likes.find({author: Meteor.userId()}, {fields: {author: 1, createdAt: 1}})
  return likes
})

Meteor.publish('likesRecent', () => {
  let likes = Likes.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 10})
  return likes
})

Meteor.publish('likesToday', () => {
  let today = new Date()
  today.setHours(0, 0, 0, 0)
  let likes = Likes.find({author: Meteor.userId(), createdAt: {$gte: today}}, {fields: {author: 1, createdAt: 1}})
  return likes
})

Meteor.methods({
  likeSave(like) {
    check(like.url, String)
    check(like.photo, String)
    check(like.author, String)
    check(like.userId, Number)
    check(like.userName, String)
    check(like.userUrl, String)
    check(like.tag, String)

    like.createdAt = new Date()

    Meteor.users.update(like.author, {$inc: {'instaStats.totalLikes': 1}})

    return Likes.insert(like)
  },
  likeRemove(like) {
    return Likes.remove(like)
  },
  likesClear() {
    return Likes.remove({author: Meteor.userId()})
  }
})
