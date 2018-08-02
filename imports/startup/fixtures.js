import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'

if (Meteor.users.find().count() === 0) {
  Accounts.createUser({
    username: Meteor.settings.private.firstUser.username,
    email: Meteor.settings.private.firstUser.email,
    password: Meteor.settings.private.firstUser.password
  })
}