import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'

Accounts.config({
  forbidClientAccountCreation: Meteor.settings.private.forbidRegistration
})

Accounts.onCreateUser((options, user) => {
  if(options.profile) {
    user.profile = options.profile
  }

  user.settings = {
    likesEnabled: true,
    followsEnabled: true,
    unfollowsEnabled: true,
    commentsEnabled: true,
    proxyEnabled: false,
    activitiesFrom: '09:00',
    activitiesUntil: '22:00',
    minPosts: 10,
    minFollowers: 100,
    minFollowing: 100,
    maxFollowers: 2500,
    maxFollowing: 1000,
    daysToFollow: 3,
    likesPerHour: 80,
    followsPerHour: 30,
    commentsPerHour: 15,
    likeRate: 45,
    followRate: 60,
    unfollowRate: 60,
    commentRate: 180,
    unfollowsPerDay: 450,
    tags: 'travel',
    commentSeed: 'Great photo!',
    browserShow: false,
    imagesShow: false
  }

  user.instaStats = {
    totalLikes: 0,
    totalFollows: 0,
    totalUnfollows: 0,
    totalComments: 0
  }

  user.instaCredentials = {
    username: '',
    password: ''
  }

  user.roles = ['user']

  // First user to register becomes an admin
  if(Meteor.users.find().count() == 0) {
    user.roles.push('admin');
  }

  return user
})

Accounts.validateNewUser((user) => {
  if(user.username == ''){
    throw new Meteor.Error(400, "User name is required")
  }
  if(user.username.length <= 3){
    throw new Meteor.Error(400, "User name must be over three characters")
  }
  return true
})