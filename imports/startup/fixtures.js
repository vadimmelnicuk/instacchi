import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'

if (Meteor.users.find().count() === 0) {
  Accounts.createUser(Meteor.settings.private.users.firstUser)
}

if (Meteor.users.find().count() === 1) {
  Accounts.createUser(Meteor.settings.private.users.testUser)
}

if (Meteor.users.find().count() === 2) {
  Accounts.createUser(Meteor.settings.private.users.testUser2)
}