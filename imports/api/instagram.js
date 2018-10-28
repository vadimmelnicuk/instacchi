import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import puppeteer from 'puppeteer'
import aes256 from 'aes256'

import {Browsers, Likes, Follows, Comments, instaStats} from "/imports/api/collections"

let timers = []

Meteor.methods({
  async runLoop() {
    const userId = Meteor.userId()
    if(!userId) {
      throw new Meteor.Error(404, "Please log in first")
    }

    Meteor.call('logSave', {message: '--- START --- Scheduler'})
    Meteor.call('browserInstaRun', true)

    // Check if the physical browser exists
    const browser = await Browsers.findOne({author: Meteor.userId()})
    if(!browser) {
      Meteor.call('logSave', {message: '--- ERROR --- Browser does not exist. Please add one.'})
      Meteor.call('browserInstaRun', false)
      return false
    }

    // Setup the timer
    let timer = {}
    timer.author = userId
    timer.createdAt = new Date()
    timer.handle = Meteor.setInterval(function () {
      try {
        Meteor.call('mainLoop', userId)
      }catch (e) {
        console.log("Timeout: main loop time: "+new Date())
        console.log(e)
      }
    }, 5000)

    // Store the timer
    timers.push(timer)

    return true
  },
  async stopLoop() {
    if(!Meteor.userId()) {
      throw new Meteor.Error(404, "Please log in first")
    }

    Meteor.call('browserInstaRun', false)
    const timer = timers.filter(timer => timer.author === Meteor.userId())

    if(timer.length > 0) {
      // Remove a timer from array
      let index = timers.map(function(timer) {
        return timer.author
      }).indexOf(Meteor.userId())
      timers.splice(index, 1)

      Meteor.clearInterval(timer[0].handle)
      Meteor.call('logSave', {message: '--- STOP --- Scheduler'})
    }

    Meteor.call('browserProcessing', Meteor.userId(), false)

    return true
  },
  async reviveLoop(userId) {
    // Setup the timer
    let timer = {}
    timer.author = userId
    timer.createdAt = new Date()
    timer.handle = Meteor.setInterval(function () {
      try {
        Meteor.call('mainLoop', userId)
      }catch (e) {
        console.log("Timeout: main loop"+" time: "+new Date())
        console.log(e)
      }
    }, 5000)

    // Store the timer
    timers.push(timer)

    return true
  },
  async stopAllTimers() {
    if(!Meteor.userId() && !Meteor.users.findOne(Meteor.userId()).roles.includes('admin')) {
      throw new Meteor.Error(404, "You are not allowed to do it")
    }

    if(timers.length > 0) {
      // Remove a timer from array
      timers.map(function(timer) {
        Meteor.clearInterval(timer.handle)
        Meteor.call('logSaveUser', {message: '--- STOP --- Scheduler', author: timer.author})
      })
      timers = []
    } else {
      throw new Meteor.Error(404, "There are no timers to stop")
    }

    return true
  },
  async mainLoop(userId) {
    const browser = await Browsers.findOne({author: userId})
    if(browser.processing) {
      return false
    }
    if(browser.verify && !browser.code) {
      return false
    }

    // START
    Meteor.call('browserProcessing', userId, true)

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
      Meteor.call('browserProcessing', userId, false)
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
    if((!user.settings.likesEnabled || likes >= user.settings.likesPerHour) && (!user.settings.followsEnabled || follows >= user.settings.followsPerHour) && (!user.settings.commentsEnabled || comments >= user.settings.commentsPerHour) && (!user.settings.unfollowsEnabled || unfollows > user.settings.unfollowsPerDay || followElapsedTime < timeToFollow)) {
      Meteor.call('browserProcessing', userId, false)
      return false
    }

    // Launch a browser
    Meteor.call('logSaveUser', {message: '--- Running insta main loop', author: userId})
    const endpoint = Meteor.call('launchBrowser', userId)

    // Go to user's page
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    // Go to the user's page
    let url = "https://instagram.com/" + user.instaCredentials.username + "/"
    try{
      await page.goto(url)
    }catch(e){
      console.log("Timeout: "+url+" time: "+new Date())
      Meteor.call('closeBrowsers', userId)
      Meteor.call('browserProcessing', userId, false)
      return false
    }

    // Check the user is logged in and log in if not
    const loginStatus = await Meteor.call('instaCheckLoginStatus', userId, endpoint)
    if(!loginStatus) {
      Meteor.call('closeBrowsers', userId)
      Meteor.call('browserProcessing', userId, false)
      return false
    }

    // Get my stats routine
    const statsMy = instaStats.findOne({author: userId, createdAt: {$gte: thisHour}})
    if(!statsMy) {
      Meteor.call('logSaveUser', {message: '--- Running insta get my stats', author: userId})
      const statsHandle = Meteor.call('instaGetUserStats', userId, endpoint, user.instaCredentials.username)
      if(statsHandle) {
        Meteor.call('statsSave', userId, statsHandle)
      }
    }

    // Unfollow routine
    if(user.settings.unfollowsEnabled && unfollows < user.settings.unfollowsPerDay) {
      let unfollow = Meteor.call('instaUnfollow', userId, endpoint)
    }

    // Check if all other actions are disabled or over the limit
    if((!user.settings.likesEnabled || likes >= user.settings.likesPerHour) && (!user.settings.followsEnabled || follows >= user.settings.followsPerHour) && (!user.settings.commentsEnabled || comments >= user.settings.commentsPerHour)) {
      Meteor.call('closeBrowsers', userId)
      Meteor.call('browserProcessing', userId, false)
      return false
    }

    // Pick a photo from a tag list
    const tags = user.settings.tags.split(',')
    const tag = Random.choice(tags)

    // Go to the tag and get user's name
    const userName = Meteor.call('instaPickFromTag', userId, endpoint, tag)
    if(!userName) {
      Meteor.call('closeBrowsers', userId)
      Meteor.call('browserProcessing', userId, false)
      return false
    }

    // Get user's stats
    const stats = Meteor.call('instaGetUserStats', userId, endpoint, userName)

    // Check if within limits
    // Fix - do not interact with your own account!
    // 14/08/2018 added minimum stats limit
    if(!stats || stats.followers <= user.settings.minFollowers || stats.followers >= user.settings.maxFollowers || stats.following <= user.settings.minFollowing || stats.following >= user.settings.maxFollowing || stats.posts < user.settings.minPosts || stats.username === user.instaCredentials.username) {
      Meteor.call('logSaveUser', {message: 'User is FILTERED. posts: ' + stats.posts + ', followers: ' + stats.followers + ', following: ' + stats.following + ', url: ' + stats.url, author: userId})
      Meteor.call('closeBrowsers', userId)
      Meteor.call('browserProcessing', userId, false)
      return false
    }

    Meteor.call('logSaveUser', {message: 'User is OK. posts: ' + stats.posts + ', followers: ' + stats.followers + ', following: ' + stats.following + ', url: ' + stats.url, author: userId})

    // Do not perform any other routines if like was not properly recorded
    let likeRecorded = true

    // Like routine
    if(user.settings.likesEnabled && likes < user.settings.likesPerHour) {
      likeRecorded = Meteor.call('instaLike', userId, endpoint, stats.username, stats.url, tag)
    }

    // Follow routine
    if(user.settings.followsEnabled && follows < user.settings.followsPerHour && likeRecorded) {
      Meteor.call('instaFollow', userId, endpoint, stats.username, stats.url, tag)
    }

    // Comment routine
    if(user.settings.commentsEnabled && comments < user.settings.commentsPerHour && likeRecorded) {
      Meteor.call('instaComment', userId, endpoint, stats.username, stats.url, tag)
    }

    // END
    Meteor.call('closeBrowsers', userId)
    Meteor.call('browserProcessing', userId, false)
    return true
  },
  async launchBrowser(userId) {
    const browser = Browsers.findOne({author: userId})
    const user = Meteor.users.findOne(userId, {fields: {settings: 1}})
    const config = {
      headless: !user.settings.browserShow,
      // Possible fix of chromium not running in docker linux. However, it could potentially affect overall safety.
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // slowMo: 100,
      defaultView: {
        width: 1440,
        height: 2560,
        isMobile: true,
        hasTouch: true,
      }
    }

    if(browser) {
      const browserNew = await puppeteer.launch(config)
      const endpoint = await browserNew.wsEndpoint()
      const pages = await browserNew.pages()
      const page = pages[0]

      // Navigation timeout of 10s
      await page.setDefaultNavigationTimeout(10000)

      // Block image display if enabled
      if(!user.settings.imagesShow) {
        await page.setRequestInterception(true)
        page.on('request', request => {
          if(request.url().endsWith('.png') || request.url().endsWith('.jpg') || request.url().endsWith('.gif')) {
            request.abort()
          }else{
            request.continue()
          }
        })
      }

      // Set cookies
      if(browser.cookies.length > 0) {
        browser.cookies.forEach(async function(cookie) {
          await page.setCookie(cookie)
        })
        Meteor.call('logSaveUser', {message: '--- Cookies set', author: userId})
      } else {
        Meteor.call('logSaveUser', {message: '--- No cookies were found', author: userId})
      }

      Meteor.call('browserSetEndpoint', browser._id, endpoint)

      return endpoint
    }else{
      return false
    }
  },
  async connectToBrowser(endpoint) {
    try {
      await puppeteer.connect({browserWSEndpoint: endpoint})
      return true
    } catch (e) {
      return false
    }
  },
  async closeBrowsers(userId = false) {
    let browsers = []
    if(userId) {
      browsers = await Browsers.find({author: userId}).fetch()
    }else{
      browsers = await Browsers.find({}).fetch()
    }

    if(browsers.length > 0) {
      browsers.forEach(async function(browser) {
        const browserExists = await Meteor.call('connectToBrowser', browser.endpoint)
        if(browserExists) {
          const browserHandle = await puppeteer.connect({browserWSEndpoint: browser.endpoint})
          await browserHandle.close()
        }
      })
    }

    return true
  },
  async instaLogin(userId, endpoint) {
    // Log in routine
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = await pages[0]

    const url = "https://instagram.com/accounts/login/"
    try{
      await page.goto(url)
    }catch (e) {
      console.log("Timeout: "+url+" time: "+new Date())
      return false
    }

    await sleepLong()

    // Check if username input filed is present
    let query = "//input[@name='username']"
    const inputUsername = await page.$x(query)
    if(inputUsername.length > 0) {
      Meteor.call('logSaveUser', {message: '--- Running log in', author: userId})

      const user = Meteor.users.findOne(userId, {fields: {settings: 1, instaCredentials: 1}})
      const cipher = aes256.createCipher(Meteor.settings.private.instagram.secret)

      // Type in log in details
      const username = user.instaCredentials.username
      const password = cipher.decrypt(user.instaCredentials.password)

      await inputUsername[0].type(username, {delay: 25})

      query = "//input[@name='password']"
      const inputPassword = await page.$x(query)
      await inputPassword[0].type(password, {delay: 25})

      // Submit log in details
      query = "//button[text()='Log in']"
      const submitButton = await page.$x(query)
      let nav = page.waitForNavigation()
      await submitButton[0].click()
      await nav;

      const cookies = await page.cookies()

      Meteor.call('browserSaveCookies', endpoint, cookies)
    }

    // Check for suspicious login messages
    // Try to type in security code first
    query = "//input[@id='security_code']"
    const securityCodeField = await page.$x(query)
    if(securityCodeField.length > 0) {
      Meteor.call('logSaveUser', {message: 'Suspicious login detected. Security code landing page.', author: userId})
      await sleepMedium()
      const browser = await Browsers.findOne({endpoint: endpoint})
      if(browser.code) {
        await securityCodeField[0].type(browser.code, {delay: 750})
        await sleepMedium()
        query = "//button[text()='Submit']"
        const securityCodeSubmit = await page.$x(query)
        securityCodeSubmit[0].click()
        Meteor.call('browserVerify', endpoint, false)
      }
      return false
    }

    // Click on "This was me" button if challenge page was called
    query = "//button[@name='choice'][text()='This Was Me']"
    const thisWasMeButton = await page.$x(query)
    if(thisWasMeButton.length > 0) {
      Meteor.call('logSaveUser', {message: 'Suspicious login detected. Asked to prove this was me.', author: userId})
      await sleepMedium()
      await thisWasMeButton[0].click()
      return false
    }

    // Click "Send security code" button if asked
    query = "//button[text()='Send Security Code']"
    const sendSecurityCodeButton = await page.$x(query)
    if(sendSecurityCodeButton.length > 0) {
      Meteor.call('logSaveUser', {message: 'Suspicious login detected. Asked to send security code.', author: userId})
      await sleepMedium()
      await sendSecurityCodeButton[0].click()
      Meteor.call('browserVerify', endpoint, true)
      return false
    }

    // User is already logged in
    return true
  },
  async instaCheckLoginStatus(userId, endpoint) {
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = await pages[0]

    Meteor.call('logSaveUser', {message: '--- Running check log in status', author: userId})

    await sleepMedium()

    // Check if login button is present
    let query = "//button[text()='Log In']"
    const loginButton = await page.$x(query)
    if(loginButton.length > 0) {
      const login = await Meteor.call('instaLogin', userId, endpoint)
      if(!login) {
        return false
      }else{
        return true
      }
    }else{
      return true
    }
  },
  async instaPickFromTag(userId, endpoint, tag) {
    // Init browser and page
    Meteor.call('logSaveUser', {message: '--- Running insta pick from tag #' + tag, author: userId})

    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    await sleepMedium()

    // Go to the tag
    let url = "https://instagram.com/explore/tags/" + tag + "/"
    try{
      await page.goto(url)
    }catch (e) {
      console.log("Timeout: "+url+" time: "+new Date())
      return false
    }
    Meteor.call('logSaveUser', {message: 'Loading page: ' + url, author: userId})

    // Check if user deleted the page
    let query = "//a[text()='Go back to Instagram.']"
    const pageRemoved = await page.$x(query)
    if(pageRemoved.length > 0) {
      return false
    }

    // Get images array
    query = "//div[contains(@class, 'eLAPa')]"
    let images = await page.$x(query)
    if(images.length == 0) {
      return false
    }

    // Scroll down to get more images
    try {
      await images[images.length-1].hover()
    }catch (e) {
      console.log("Timeout: hover image, time: "+new Date())
      return false
    }

    await sleepShort()

    images = await page.$x(query)
    if(images.length == 0) {
      return false
    }

    // Click a random image
    const imageNumber = getRandomIntInclusive(9, images.length-1)
    const navigationPromise = page.waitForNavigation()
    try {
      await images[imageNumber].click()
    }catch (e) {
      console.log("Timeout: click image, time: "+new Date())
      return false
    }
    await navigationPromise

    await sleepLong()

    // Get user's name
    query = "//a[contains(@class, 'FPmhX') and contains(@class, 'nJAzx')]"
    const userNameHandle = await page.$x(query)
    if(userNameHandle.length == 0) {
      return false
    }
    const userName = await userNameHandle[0].getProperty('textContent')

    return userName._remoteObject.value
  },
  async instaGetUserStats(userId, endpoint, userName) {
    // Init browser and page
    Meteor.call('logSaveUser', {message: '--- Running insta get user stats', author: userId})
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    // Go to the user's page
    let url = "https://instagram.com/" + userName + "/"
    try{
      await page.goto(url)
    }catch(e){
      console.log("Timeout: "+url+" time: "+new Date())
      return false
    }
    Meteor.call('logSaveUser', {message: 'Loading page: ' + url, author: userId})

    let query = "//span[contains(@class, 'g47SY')]"
    const statsHandle = await page.$x(query)
    if(statsHandle.length == 0) {
      return false
    }
    let stats = {}
    const posts = await statsHandle[0].getProperty('textContent')
    const followers = await statsHandle[1].getProperty('textContent')
    const following = await statsHandle[2].getProperty('textContent')
    stats.url = await page.url()
    stats.posts = await parseStat(posts._remoteObject.value)
    stats.followers = await parseStat(followers._remoteObject.value)
    stats.following = await parseStat(following._remoteObject.value)
    stats.username = userName

    try{
      await page.goBack()
    }catch(e){
      console.log("Timeout: go back"+" time: "+new Date())
      return false
    }

    return stats
  },
  async instaGetNewUsername(userId, endpoint, username) {
    Meteor.call('logSaveUser', {message: '--- Running get new username', author: userId})
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    const like = Likes.findOne({userName: username})
    let url = like.url

    try{
      await page.goto(url)
    }catch(e){
      console.log("Timeout: "+url+" time: "+new Date())
      return false
    }
    Meteor.call('logSaveUser', {message: 'Loading page: ' + url, author: userId})

    // Get new username
    let query = "//a[contains(@class, 'FPmhX') and contains(@class, 'nJAzx')]"
    const userNameHandle = await page.$x(query)
    if(userNameHandle.length == 0) {
      return false
    }
    const userName = await userNameHandle[0].getProperty('textContent')

    return userName._remoteObject.value
  },
  async instaLike(userId, endpoint, userName, userUrl, tag) {
    // Only interact once
    // Disable this - likes can be attributed to the same people now
    // const likes = await Likes.find({author: userId, userName: userName}).fetch()
    // if(likes.length > 0) {
    //   return false
    // }

    Meteor.call('logSaveUser', {message: '--- Running insta like', author: userId})

    // Init browser and page
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    // Get like button
    // 03/07/2018 fix applied
    let query = "//button[contains(@class, 'coreSpriteHeartOpen')]"
    const likeButton = await page.$x(query)
    if(likeButton.length == 0) {
      console.log("Like: Could not get like button time: " + new Date())
      return false
    }

    // Check whether it was liked previously
    query = "//span[@aria-label='Like']"
    let type = await page.$x(query)
    if(type.length == 0) {
      console.log("Like: Could not get like state time: " + new Date())
      return false
    }

    // Get post url
    const url = await page.url()

    // Get media url
    query = "//div[contains(@class, 'eLAPa')]//img[contains(@class, 'FFVAD')]"
    let img = await page.$x(query)
    if(img.length == 0) {
      console.log("Like: Could not get like image: " + new Date())
    }

    let photo
    if(img.length > 0) {
      // In case it is a photo
      photo = await img[0].getProperty('src')
    }else{
      // In case it is a video
      query = "//div[contains(@class, 'OAXCp')]//img[contains(@class, '_8jZFn')]"
      img = await page.$x(query)
      photo = await img[0].getProperty('src')
    }

    // Click for a like
    await likeButton[0].click()

    // Check whether like was actually recorded
    try{
      await page.goto(url)
    }catch (e) {
      console.log("Timeout: " + url + " time: " + new Date())
      return false
    }

    query = "//span[@aria-label='Unlike']"
    type = await page.$x(query)
    if(type.length == 0) {
      console.log("Like: was not actually applied image: " + new Date())
      return false
    }

    Meteor.call('likeSave', {url: url, photo: photo._remoteObject.value, userName: userName, userUrl: userUrl, author: userId, tag: tag})

    return true
  },
  async instaFollow(userId, endpoint, userName, userUrl, tag) {
    //Only follow once
    const follows = Follows.find({author: userId, userName: userName}).fetch()
    if(follows.length > 0) {
      return false
    }

    // Check whether we are over follow rate threshold
    const user = Meteor.users.findOne(userId, {fields: {settings: 1}})
    const follow = Follows.findOne({author: userId, following: true}, {sort: {createdAt: -1}})
    if(follow) {
      const currentTime = new Date()
      const elapsedTime = currentTime - follow.createdAt
      // Less than a followRate since the last follow
      if(elapsedTime < user.settings.followRate * 1000) {
        return false
      }
    }

    Meteor.call('logSaveUser', {message: '--- Running insta follow', author: userId})

    // Init browser and page
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    // Check whether is already followed
    let query = "//button[text()='Following']"
    const followingButton = await page.$x(query)
    if(followingButton.length > 0) {
      return false
    }

    // Get follow button
    query = "//button[text()='Follow']"
    const followButton = await page.$x(query)
    if(followButton.length == 0) {
      return false
    }
    await sleepShort()

    // Click follow
    await followButton[0].click()
    Meteor.call('follow.save', {author: userId, userName: userName, userUrl: userUrl, tag: tag})

    return true
  },
  async instaUnfollow(userId, endpoint) {
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

    Meteor.call('logSaveUser', {message: '--- Running insta unfollow', author: userId})

    // Init browser and page
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    // Go to user
    Meteor.call('logSaveUser', {message: 'Loading page: ' + follow.userUrl, author: userId})
    try{
      await page.goto(follow.userUrl)
    }catch (e) {
      console.log("Timeout: "+follow.userUrl+" time: "+new Date())
      return false
    }

    // Check is user deleted the page
    let query = "//a[text()='Go back to Instagram.']"
    const pageRemoved = await page.$x(query)
    if(pageRemoved.length > 0) {
      // 25/10/2018 Username change fix
      Meteor.call('logSaveUser', {message: 'User changed the username', author: userId})
      let username = Meteor.call('instaGetNewUsername', userId, endpoint, follow.userName)
      if(!username) {
        // Meteor.call('follow.unfollowRemoved', follow._id)
        return false
      }

      // Go to the user's page
      let url = "https://instagram.com/" + username + "/"
      try{
        await page.goto(url)
      }catch(e){
        console.log("Timeout: "+url+" time: "+new Date())
        return false
      }
      Meteor.call('logSaveUser', {message: 'Loading page: ' + url, author: userId})
    }

    // Check whether is already followed
    query = "//button[text()='Following']"
    const followingButton = await page.$x(query)

    // Click unfollow if still following
    if(followingButton.length > 0) {
      try{
        followingButton[0].click()
      }catch (e) {
        console.log(e)
        return false
      }
      await sleepMedium()
    }else{
      // Fix - account for 'Follow Back' and 'Unblock' case when checking whether a user was unfollowed manually
      query = "//button[text()='Follow' or text()='Follow Back' or text()='Unblock']"
      const followButton = await page.$x(query)
      if(followButton.length > 0) {
        Meteor.call('follow.unfollow', follow._id)
      }
      return false
    }

    // 03/07/2018 Unfollow dialog fix
    query = "//button[text()='Unfollow']"
    const unfollowButton = await page.$x(query)

    if(unfollowButton.length > 0) {
      await unfollowButton[0].click()
    }else{
      return false
    }

    await sleepMedium()

    // Double check whether user was actually unfollowed
    try{
      await page.goto(follow.userUrl)
    }catch (e) {
      console.log("Timeout: "+follow.userUrl+" time: "+new Date())
      return false
    }

    await sleepMedium()

    query = "//button[text()='Follow' or text()='Follow Back' or text()='Unblock']"
    const followButton = await page.$x(query)
    if(followButton.length > 0) {
      Meteor.call('follow.unfollow', follow._id)
    }else{
      return false
    }

    return true
  },
  async instaComment(userId, endpoint, userName, userUrl, tag) {
    //Only comment once
    const comments = Comments.find({author: userId, userName: userName}).fetch()
    if(comments.length > 0) {
      return false
    }

    // Check whether we are over comment rate threshold
    const user = Meteor.users.findOne(userId, {fields: {settings: 1}})
    const comment = Comments.findOne({author: userId}, {sort: {createdAt: -1}})
    if(comment) {
      const currentTime = new Date()
      const elapsedTime = currentTime - comment.createdAt
      if(elapsedTime < user.settings.commentRate * 1000) {
        return false
      }
    }

    Meteor.call('logSaveUser', {message: '--- Running insta comment', author: userId})

    // Init browser and page
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]

    // Get post url
    const url = await page.url()

    // Get the comment textarea
    let query = "//textarea[@class='Ypffh']"
    const commentTextarea = await page.$x(query)
    if(commentTextarea.length == 0) {
      return false
    }

    // Generate a comment
    let generatedComment = ''
    const commentSeed = user.settings.commentSeed.split('|')
    commentSeed.forEach(function(part) {
      let partArray = part.split(',')
      generatedComment = generatedComment.concat(Random.choice(partArray))
    })

    // Type in a generated comment and submit it
    await commentTextarea[0].type(generatedComment, {delay: 25})
    await sleepShort()
    await commentTextarea[0].press('Enter')
    Meteor.call('comment.save', {message: generatedComment, url: url, author: userId, userName: userName, userUrl: userUrl, tag: tag})

    return true
  },
  async somethingWentWrong(userId, endpoint) {
    // Init browser and page
    const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
    const pages = await browserHandle.pages()
    const page = pages[0]


  }
})

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

async function parseStat(number) {
  number = number.replace(",", "")
  let multiplier = number.substr(-1).toLowerCase()

  if (multiplier === "k") {
    return parseFloat(number) * 1000
  }
  else if (multiplier === "m") {
    return parseFloat(number) * 1000000
  }
  else {
    return parseFloat(number)
  }
}
