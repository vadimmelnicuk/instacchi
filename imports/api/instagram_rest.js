import { Meteor } from 'meteor/meteor'
import { Random } from "meteor/random"
import { IgApiClient } from 'instagram-private-api'
import aes256 from 'aes256'

import { Sessions, Likes, Follows, Comments, instaStats } from '/imports/api/collections'

let timers = []

Meteor.methods({
  async runInstaRest() {
    const userId = Meteor.userId()
    if(!userId) {
      throw new Meteor.Error(404, "Please log in first")
    }

    Meteor.call('logSave', {message: '--- START --- Scheduler'})

    // Check if a session exists
    const session = Sessions.findOne({author: userId})
    if(!session) {
      Meteor.call('logSave', {message: '--- ERROR --- Session does not exist. Please create one first.'})
      return false
    }

    Meteor.call('sessionSetRunning', true)

    // Setup the timer
    let timer = {}
    timer.author = userId
    timer.createdAt = new Date()
    timer.ig = new IgApiClient()
    timer.handle = Meteor.setInterval(async function () {
      await instaRestLoop(userId).catch(e => {
        console.log(e)
      })
    }, 5000)

    // Store the timer
    timers.push(timer)

    return true
  },
  async stopInstaRest() {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Please log in first")
    }

    Meteor.call('sessionSetRunning', false)
    const timer = timers.filter(timer => timer.author === Meteor.userId())

    if(timer.length > 0) {
      // Remove a timer from array
      let index = await getTimerIndex(Meteor.userId())
      timers.splice(index, 1)

      delete timer[0].ig.instance
      Meteor.clearInterval(timer[0].handle)
      Meteor.call('logSave', {message: '--- STOP --- Scheduler'})
    }

    Meteor.call('sessionSetProcessing', Meteor.userId(), false)

    return true
  }
})

async function instaRestLoop(userId) {
  const session = Sessions.findOne({author: userId})

  if(session.processing) {
    return false
  }
  if(session.verify && !session.code) {
    return false
  }

  // START
  Meteor.call('sessionSetProcessing', userId, true)

  // Check login status and log in if needed
  const login = await instaLogin(userId)

  await sleepShort()

  if(login) {
    // Check if within like/follow/unfollow limits
    const user = Meteor.users.findOne(userId, {fields: {settings: 1, instaCredentials: 1}})
    const activitiesFrom = Date.parse('01/01/2001 '+user.settings.activitiesFrom+':00')
    const activitiesUntil = Date.parse('01/01/2001 '+user.settings.activitiesUntil+':00')
    const currentTime = new Date()
    let today = new Date()
    let time = new Date()
    let thisHour = new Date()
    time.setFullYear(2001, 0, 1)
    today.setHours(0, 0, 0, 0)
    thisHour.setMinutes(0, 0, 0)
    // Check whether we are inside a time window to do actions
    if(time < activitiesFrom || time > activitiesUntil) {
      Meteor.call('sessionSetProcessing', userId, false)
      return false
    }

    const likes = Likes.find({author: userId, createdAt: {$gte: thisHour}}).count()
    const follows = Follows.find({author: userId, following: true, createdAt: {$gte: thisHour}}).count()
    const unfollows = Follows.find({author: userId, following: false, createdAt: {$gte: today}}).count()
    const comments = Comments.find({author: userId, createdAt: {$gte: thisHour}}).count()
    const follow = Follows.findOne({author: userId, following: true}, {sort: {createdAt: 1}})
    const timeToFollow = 1000 * 60 * 60 * 24 * user.settings.daysToFollow
    let followElapsedTime = 0
    if(follow) {
      followElapsedTime = currentTime - follow.createdAt
    }

    // Fix - account for cases when some functionality is disabled
    if((!user.settings.likesEnabled || likes >= user.settings.likesPerHour) &&
      (!user.settings.followsEnabled || follows >= user.settings.followsPerHour) &&
      (!user.settings.commentsEnabled || comments >= user.settings.commentsPerHour) &&
      (!user.settings.unfollowsEnabled || unfollows > user.settings.unfollowsPerDay || followElapsedTime < timeToFollow)) {
      Meteor.call('sessionSetProcessing', userId, false)
      return false
    }

    // Run the main loop
    Meteor.call('logSaveUser', {
      message: 'Running insta main loop',
      author: userId
    })

    // Get my stats routine
    const statsMy = instaStats.findOne({author: userId, createdAt: {$gte: thisHour}})
    if(!statsMy) {
      Meteor.call('logSaveUser', {
        message: 'Running insta get my stats',
        author: userId
      })
      const statsHandle = await instaGetUserStats(userId, user.instaCredentials.username)
      if(statsHandle) {
        Meteor.call('statsSave', userId, statsHandle)
      }
    }

    await sleepShort()

    // // Unfollow routine
    // if(user.settings.unfollowsEnabled && unfollows < user.settings.unfollowsPerDay) {
    //   let unfollow = await instaUnfollow(userId)
    // }

    // Fix: added like rate to try to avoid Action Blocked message
    // Check whether we are over like rate threshold
    const like = Likes.findOne({author: userId}, {sort: {createdAt: -1}})
    if(like) {
      const currentTime = new Date()
      const likeElapsedTime = currentTime - like.createdAt
      // Less than a likeRate since the last like

      if(likeElapsedTime < user.settings.likeRate * 1000) {
        Meteor.call('sessionSetProcessing', userId, false)
        return false
      }
    }

    // Check if all remaining actions are disabled or over the limit
    if((!user.settings.likesEnabled || likes >= user.settings.likesPerHour) &&
      (!user.settings.followsEnabled || follows >= user.settings.followsPerHour) &&
      (!user.settings.commentsEnabled || comments >= user.settings.commentsPerHour)) {
      Meteor.call('sessionSetProcessing', userId, false)
      return false
    }

    // Go to the tag and get user's name
    const tag = Random.choice(user.settings.tags.split(','))
    const randomUsername = await instaPickFromTag(userId, tag)
    if(!randomUsername) {
      Meteor.call('sessionSetProcessing', userId, false)
      return false
    }

    const stats = await instaGetUserStats(userId, randomUsername)

    // Check if within limits
    // Fix - do not interact with your own account!
    // 14/08/2018 added minimum stats limit
    if(!stats || stats.followers <= user.settings.minFollowers ||
      stats.followers >= user.settings.maxFollowers ||
      stats.following <= user.settings.minFollowing ||
      stats.following >= user.settings.maxFollowing ||
      stats.posts < user.settings.minPosts ||
      stats.username === user.instaCredentials.username
    ) {
      Meteor.call('logSaveUser', {
        message: 'User @' + stats.username + ' is FILTERED. posts: ' + stats.posts + ', followers: ' + stats.followers + ', following: ' + stats.following + ', url: ' + stats.url,
        author: userId
      })
      Meteor.call('sessionSetProcessing', userId, false)
      return false
    }else{
      Meteor.call('logSaveUser', {
        message: 'User @' + stats.username + ' is OK. posts: ' + stats.posts + ', followers: ' + stats.followers + ', following: ' + stats.following + ', url: ' + stats.url,
        author: userId
      })
    }

    // Like routine
    if(user.settings.likesEnabled && likes < user.settings.likesPerHour) {
      const like = await instaLike(userId, stats.username, tag)
      if(!like) {
        Meteor.call('sessionSetProcessing', userId, false)
        return false
      }
    }
  }

  Meteor.call('sessionSetProcessing', userId, false)
  return true
}

async function instaLogin(userId) {
  const timerIndex = await getTimerIndex(userId)
  const session = Sessions.findOne({author: userId})
  const user = Meteor.users.findOne(userId, {fields: {settings: 1, instaCredentials: 1}})

  if (Number.isInteger(timerIndex)) {
    if (session.cookies === '') {
      const cipher = aes256.createCipher(Meteor.settings.private.instagram.secret)
      timers[timerIndex].ig.state.generateDevice(user.instaCredentials.username)
      await timers[timerIndex].ig.simulate.preLoginFlow()

      // timers[timerIndex].ig.request.end$.subscribe(async () => {
      //   const cookies = await timers[timerIndex].ig.state.serializeCookieJar()
      //   Meteor.call('sessionSetCookies', JSON.stringify(cookies))
      // })

      const loggedInUser = await timers[timerIndex].ig.account.login(user.instaCredentials.username, cipher.decrypt(user.instaCredentials.password))

      process.nextTick(async () => await timers[timerIndex].ig.simulate.postLoginFlow())

      const cookies = await timers[timerIndex].ig.state.serializeCookieJar()

      Meteor.call('sessionSetCookies', userId, JSON.stringify(cookies))
      // const userFeed = timers[timerIndex].ig.feed.user(loggedInUser.pk)
    } else {
      await timers[timerIndex].ig.state.deserializeCookieJar(session.cookies)
    }

    return true
  }

  return false
}

async function instaGetUserInfo(userId, username) {
  const timerIndex = await getTimerIndex(userId)
  const id = await timers[timerIndex].ig.user.getIdByUsername(username)
  const info = await timers[timerIndex].ig.user.info(id)

  return info
}

async function instaGetUserStats(userId, username) {
  // Get user stats
  Meteor.call('logSaveUser', {
    message: 'Running insta get user stats @' + username,
    author: userId
  })
  const userInfo = await instaGetUserInfo(userId, username)

  // Get all starts
  let stats = {}
  stats.url = 'https://www.instagram.com/' + username
  stats.posts = userInfo.media_count
  stats.followers = userInfo.follower_count
  stats.following = userInfo.following_count
  stats.username = username
  stats.avatar = ''
  if(userInfo.hd_profile_pic_versions) {
    stats.avatar = userInfo.hd_profile_pic_versions[0].url
  }

  return stats
}

async function instaPickFromTag(userId, tag) {
  Meteor.call('logSaveUser', {
    message: 'Running insta pick from tag #' + tag,
    author: userId
  })

  const timerIndex = await getTimerIndex(userId)
  const tagFeed = await timers[timerIndex].ig.feed.tag(tag)
  let items = []

  for (let i = 0; i < 3; i++) {
    let page = await tagFeed.items()
    Array.prototype.push.apply(items, page)
    await sleepShort()
  }

  const itemNumber = await getRandomIntInclusive(0, items.length-1)

  return items[itemNumber].user.username
}

async function instaUnfollow(userId) {
  // Check whether we followed this user long enough
  const user = Meteor.users.findOne(userId, {fields: {settings: 1}})
  const follow = Follows.findOne({author: userId, following: true}, {sort: {createdAt: 1}})
  if(follow) {
    const timeToFollow = 1000 * 60 * 60 * 24 * user.settings.daysToFollow
    const currentTime = new Date()
    const elapsedTime = currentTime - follow.createdAt
    // Less than specified time since the oldest follow
    if(elapsedTime < timeToFollow) {
      return false
    }
  }else{
    return false
  }

  // Check whether we are over unfollow rate threshold
  const unfollow = Follows.findOne({author: userId, following: false}, {sort: {createdAt: -1}})
  if(unfollow) {
    const currentTime = new Date()
    const elapsedTime = currentTime - unfollow.createdAt
    // Less than threshold
    if(elapsedTime < user.settings.unfollowRate * 1000) {
      return false
    }
  }

  Meteor.call('logSaveUser', {
    message: 'Running insta unfollow',
    author: userId
  })

  const timerIndex = await getTimerIndex(userId)
  const id = await timers[timerIndex].ig.user.getIdByUsername('justinbieber')
  const friendship = await timers[timerIndex].ig.friendship.show(id)

  console.log(friendship)

  // TODO - to finish unfollow sequence

  return true
}

async function instaLike(userId, username, tag) {
  Meteor.call('logSaveUser', {
    message: 'Running insta like for @' + username,
    author: userId
  })

  const timerIndex = await getTimerIndex(userId)
  const id = await timers[timerIndex].ig.user.getIdByUsername(username)
  const userFeed = await timers[timerIndex].ig.feed.user(id)
  const items = await userFeed.items()

  if(items.length > 0 && !items[0].has_liked) {
    // Get photo url
    let thumbnail = ''
    if(items[0].image_versions2) {
      thumbnail = items[0].image_versions2.candidates.filter(function(p) {
        return p.width === 150
      })
    }else if(items[0].carousel_media) {
      thumbnail = items[0].carousel_media[0].image_versions2.candidates.filter(function(p) {
        return p.width === 150
      })
    }

    if(thumbnail !== '') {
      thumbnail = thumbnail[0].url
    }

    const like = await timers[timerIndex].ig.media.like({mediaId: items[0].id, moduleInfo: {module_name: 'profile'}, d: 0})

    if(like && like.status === 'ok') {
      Meteor.call('likeSave', {
        url: 'https://www.instagram.com/p/' + items[0].code,
        photo: thumbnail,
        userName: username,
        userUrl: 'https://www.instagram.com/' + username,
        author: userId,
        tag: tag
      })
    }else{
      return false
    }
  }else{
    return false
  }

  return true
}

async function getTimerIndex(userId) {
  let index = timers.map(function(timer) {
    return timer.author
  }).indexOf(userId)

  return index
}

async function sleep(ms) {
  return new Promise(resolve => Meteor.setTimeout(resolve, ms))
}

async function sleepShort() {
  let time = getRandomIntInclusive(500, 800)
  return new Promise(resolve => Meteor.setTimeout(resolve, time))
}

async function sleepMedium() {
  let time = getRandomIntInclusive(1000, 2500)
  return new Promise(resolve => Meteor.setTimeout(resolve, time))
}

async function sleepLong() {
  let time = await getRandomIntInclusive(2500, 5000)
  return new Promise(resolve => Meteor.setTimeout(resolve, time))
}

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min
}

