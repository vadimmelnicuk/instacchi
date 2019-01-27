import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import {instaStats, Logs} from '/imports/api/collections'

Meteor.publish('logsMy', () => {
  let logs = Logs.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 50})
  return logs
})

Meteor.methods({
  logSaveUser(log) {
    check(log.message, String)
    check(log.author, String)

    log.createdAt = new Date()

    return Logs.insert(log)
  },
  logSave(log) {
    check(log.message, String)

    log.author = Meteor.userId()
    log.createdAt = new Date()

    return Logs.insert(log)
  },
  logsClear() {
    if(!Meteor.userId() && !Meteor.users.findOne(Meteor.userId()).roles.includes('admin')) {
      throw new Meteor.Error(404, "You are not authorised to do it")
    }

    return Logs.remove({})
  },
  logsClearOld(userId) {
    let logs = Logs.find({author: userId}, {sort: {createdAt: -1}, limit: 50})
    let logIds = logs.map(function(log) {
      return log._id
    })

    return Logs.remove({_id: {$nin: logIds}, author: userId})
  }
})