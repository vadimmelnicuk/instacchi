import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'

if (Meteor.users.find().count() === 0) {
  Accounts.createUser(Meteor.settings.private.firstUser)
}

if (Meteor.users.find().count() < 2) {
  Accounts.createUser(Meteor.settings.private.testUser)
}