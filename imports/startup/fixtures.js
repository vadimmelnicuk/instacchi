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
if (Meteor.users.find().count() === 3) {
  Accounts.createUser(Meteor.settings.private.users.testUser3)
}
if (Meteor.users.find().count() === 4) {
  Accounts.createUser(Meteor.settings.private.users.testUser4)
}
if (Meteor.users.find().count() === 5) {
  Accounts.createUser(Meteor.settings.private.users.testUser5)
}