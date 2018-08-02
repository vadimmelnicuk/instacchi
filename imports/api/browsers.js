import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Browsers } from '/imports/api/collections'

Meteor.publish('browsersAll', () => {
  return Browsers.find({}, {fields: {cookies: 0}})
})

Meteor.publish('browserMy', () => {
  return Browsers.find({author: Meteor.userId()}, {fields: {cookies: 0}})
})

Meteor.methods({
  browserAdd() {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Please log in first")
    }
    if(Browsers.findOne({author: Meteor.userId()})) {
      throw new Meteor.Error(404, "You already launched a browser")
    }

    let browser = {
      author: Meteor.userId(),
      endpoint: '',
      createdAt: new Date(),
      cookies: [],
      running: false,
      processing: false,
      verify: false,
      code: ''
    }

    return Browsers.insert(browser)
  },
  browserSetEndpoint(id, endpoint) {
    check(id, String)
    check(endpoint, String)

    return Browsers.update(id, {$set: {endpoint: endpoint}})
  },
  browserRemoveMy() {
    return Browsers.remove({author: Meteor.userId()})
  },
  browserRemoveEndpoint(endpoint) {
    return Browsers.remove({endpoint: endpoint})
  },
  browsersRemove() {
    return Browsers.remove({})
  },
  browserInstaRun(state) {
    check(state, Boolean)

    return Browsers.update({author: Meteor.userId()}, {$set: {running: state}})
  },
  browserSaveCookies(endpoint, cookies) {
    check(cookies, Array)

    return Browsers.update({endpoint: endpoint}, {$set: {cookies: cookies}})
  },
  browserProcessing(userId, state) {
    check(userId, String)
    check(state, Boolean)

    return Browsers.update({author: userId}, {$set: {processing: state}})
  },
  browserVerify(endpoint, state) {
    check(endpoint, String)
    check(state, Boolean)

    return Browsers.update({endpoint: endpoint}, {$set: {verify: state}})
  },
  browserSaveCode(code) {
    check(code, String)

    return Browsers.update({author: Meteor.userId()}, {$set: {code: code}})
  }
})