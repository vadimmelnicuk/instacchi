import { Meteor } from 'meteor/meteor'
import { check } from "meteor/check"
import {Sessions, instaStats, Browsers} from '/imports/api/collections'

Meteor.publish('sessionsAll', () => {
  if(!Meteor.userId() && !Meteor.users.findOne(Meteor.userId()) && !Meteor.users.findOne(Meteor.userId()).roles.includes('admin')) {
    return false
  }

  let sessions = Sessions.find({}, {fields: {cookies: 0}})
  let userIds = sessions.map(function(session) {
    return session.author
  })

  let users = Meteor.users.find({_id: {$in: userIds}}, {fields: {username: 1}})
  let instaStatsIds = userIds.map(function(id) {
    let instaStat = instaStats.findOne({author: id}, {sort: {createdAt: -1}})
    return instaStat._id
  })
  let stats = instaStats.find({_id: {$in: instaStatsIds}})

  return [sessions, users, stats]
})

Meteor.publish('sessionMy', () => {
  return Sessions.find({author: Meteor.userId()}, {fields: {cookies: 0}})
})

Meteor.methods({
  sessionAdd() {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Please log in first")
    }
    if(Sessions.findOne({author: Meteor.userId()})) {
      throw new Meteor.Error(404, "You already have an active session")
    }

    let session = {
      author: Meteor.userId(),
      createdAt: new Date(),
      running: false,
      processing: false,
      processingDate: new Date(),
      verify: false,
      code: '',
      cookies: ''
    }

    return Sessions.insert(session)
  },
  sessionRemoveMy() {
    return Sessions.remove({author: Meteor.userId()})
  },
  sessionSetRunning(state) {
    check(state, Boolean)

    return Sessions.update({author: Meteor.userId()}, {$set: {running: state}})
  },
  sessionSetProcessing(userId, state) {
    check(userId, String)
    check(state, Boolean)

    return Sessions.update({author: userId}, {$set: {processing: state, processingDate: new Date()}})
  },
  sessionSetVerify(state) {
    check(state, Boolean)

    return Sessions.update({author: Meteor.userId()}, {$set: {verify: state}})
  },
  sessionSetCode(code) {
    check(code, String)

    return Sessions.update({author: Meteor.userId()}, {$set: {code: code}})
  },
  sessionSetCookies(userId, cookies) {
    check(userId, String)
    check(cookies, String)

    return Sessions.update({author: userId}, {$set: {cookies: cookies}})
  },
  sessionsStopAll() {
    if(!Meteor.userId() && !Meteor.users.findOne(Meteor.userId()) && !Meteor.users.findOne(Meteor.userId()).roles.includes('admin')) {
      throw new Meteor.Error(404, "You are not authorised to do it")
    }

    return Sessions.update({}, {$set: {processing: false, processingDate: new Date()}}, {multi: true})
  }
})
