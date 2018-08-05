import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Comments } from '/imports/api/collections'

Meteor.publish('commentsMy', () => {
  let comments = Comments.find({author: Meteor.userId()}, {fields: {author: 1, createdAt: 1}})
  return comments
})

Meteor.publish('commentsRecent', () => {
  let comments = Comments.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 10})
  return comments
})

Meteor.publish('commentsToday', () => {
  let today = new Date()
  today.setHours(0, 0, 0, 0)
  let comments = Comments.find({author: Meteor.userId(), createdAt: {$gte: today}}, {fields: {author: 1, createdAt: 1}})
  return comments
})

Meteor.methods({
  'comment.save'(comment) {
    check(comment, {
      message: String,
      url: String,
      author: String,
      userName: String,
      userUrl: String,
      tag: String
    })

    comment.createdAt = new Date()

    Meteor.users.update(comment.author, {$inc: {'instaStats.totalComments': 1}})

    return Comments.insert(comment)
  }
})