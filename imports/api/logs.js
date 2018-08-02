import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Logs } from '/imports/api/collections'

Meteor.publish('logsMy', () => {
  let logs = Logs.find({author: Meteor.userId()}, {sort: {createdAt: -1}, limit: 100})
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
    return Logs.remove({author: Meteor.userId()})
  }
})