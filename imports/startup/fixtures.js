import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'

if (Meteor.users.find().count() === 0) {
  Accounts.createUser(Meteor.settings.private.users.firstUser)
  Accounts.createUser(Meteor.settings.private.users.testUser)
  Accounts.createUser(Meteor.settings.private.users.testUser2)
}