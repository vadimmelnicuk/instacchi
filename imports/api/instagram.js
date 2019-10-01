import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import puppeteer from 'puppeteer'
import aes256 from 'aes256'

import {Browsers, Likes, Follows, Comments, instaStats} from "/imports/api/collections"

let timers = []
let startCpuUsage = null

Meteor.methods({
  async runLoop() {
    const userId = Meteor.userId()
    if(!userId) {
      throw new Meteor.Error(404, "Please log in first")
    }

    Meteor.call('logSave', {message: '--- START --- Scheduler'})
    Meteor.call('browserInstaRun', true)

    // Check if the physical browser exists
    const browser = Browsers.findOne({author: Meteor.userId()})
    if(!browser) {
      Meteor.call('logSave', {message: '--- ERROR --- Browser does not exist. Please add one.'})
      Meteor.call('browserInstaRun', false)
      return false
    }

    // Get browser endpoint
    const endpoint = await launchBrowser(userId)
    const loginStatus = await instaCheckLoginStatus(userId, endpoint)

    if(!loginStatus) {
      await closeBrowsers(userId)
      Meteor.call('browserProcessing', userId, false)
      Meteor.call('logSave', {message: '--- ERROR --- Failed to get login status'})
      Meteor.call('browserInstaRun', false)
      return false
    }else{
      // Just close browser
      await closeBrowsers(userId)
      Meteor.call('browserProcessing', userId, false)
    }

    // Setup the timer
    let timer = {}
    timer.author = userId
    timer.createdAt = new Date()
    timer.handle = Meteor.setInterval(async function () {
      await mainLoop(userId).catch(e => {
        console.log(e)
      })
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
    timer.handle = Meteor.setInterval(async function () {
      await mainLoop(userId).catch(e => {
        console.log(e)
      })
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
  }
})

async function mainLoop(userId) {
  const browser = Browsers.findOne({author: userId})
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
  if((!user.settings.likesEnabled || likes >= user.settings.likesPerHour) &&
    (!user.settings.followsEnabled || follows >= user.settings.followsPerHour) &&
    (!user.settings.commentsEnabled || comments >= user.settings.commentsPerHour) &&
    (!user.settings.unfollowsEnabled || unfollows > user.settings.unfollowsPerDay || followElapsedTime < timeToFollow)) {
    Meteor.call('browserProcessing', userId, false)
    return false
  }

  // Launch a browser
  Meteor.call('logSaveUser', {message: '--- Running insta main loop', author: userId})
  const endpoint = await launchBrowser(userId)

  // Get my stats routine
  const statsMy = instaStats.findOne({author: userId, createdAt: {$gte: thisHour}})
  if(!statsMy) {
    Meteor.call('logSaveUser', {message: '--- Running insta get my stats', author: userId})
    const statsHandle = await instaGetUserStats(userId, endpoint, user.instaCredentials.username)
    if(statsHandle) {
      Meteor.call('statsSave', userId, statsHandle)
    }
  }

  // Unfollow routine
  if(user.settings.unfollowsEnabled && unfollows < user.settings.unfollowsPerDay) {
    let unfollow = await instaUnfollow(userId, endpoint)
  }

  // Fix: added like rate to try to avoid Action Blocked message
  // Check whether we are over like rate threshold
  const like = Likes.findOne({author: userId}, {sort: {createdAt: -1}})
  if(like) {
    const currentTime = new Date()
    const likeElapsedTime = currentTime - like.createdAt
    // Less than a followRate since the last follow
    if(likeElapsedTime < user.settings.likeRate * 1000) {
      await closeBrowsers(userId)
      Meteor.call('browserProcessing', userId, false)
      return false
    }
  }

  // Check if all other actions are disabled or over the limit
  if((!user.settings.likesEnabled || likes >= user.settings.likesPerHour) &&
    (!user.settings.followsEnabled || follows >= user.settings.followsPerHour) &&
    (!user.settings.commentsEnabled || comments >= user.settings.commentsPerHour)) {
    await closeBrowsers(userId)
    Meteor.call('browserProcessing', userId, false)
    return false
  }

  // Pick a photo from a tag list
  const tags = user.settings.tags.split(',')
  const tag = Random.choice(tags)

  // Go to the tag and get user's name
  const userName = await instaPickFromTag(userId, endpoint, tag)
  if(!userName) {
    await closeBrowsers(userId)
    Meteor.call('browserProcessing', userId, false)
    return false
  }

  // Get user's stats
  const stats = await instaGetUserStats(userId, endpoint, userName)

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
    Meteor.call('logSaveUser', {message: 'User is FILTERED. posts: ' + stats.posts + ', followers: ' + stats.followers + ', following: ' + stats.following + ', url: ' + stats.url, author: userId})
    await closeBrowsers(userId)
    Meteor.call('browserProcessing', userId, false)
    return false
  }

  Meteor.call('logSaveUser', {message: 'User is OK. posts: ' + stats.posts + ', followers: ' + stats.followers + ', following: ' + stats.following + ', url: ' + stats.url, author: userId})

  // Do not perform any other routines if like was not properly recorded
  let likeRecorded = true

  // Like routine
  if(user.settings.likesEnabled && likes < user.settings.likesPerHour) {
    likeRecorded = await instaLike(userId, endpoint, stats.username, stats.url, tag)
  }

  // Follow routine
  if(user.settings.followsEnabled && follows < user.settings.followsPerHour && likeRecorded) {
    await instaFollow(userId, endpoint, stats.username, stats.url, tag)
  }

  // Comment routine
  if(user.settings.commentsEnabled && comments < user.settings.commentsPerHour && likeRecorded) {
    await instaComment(userId, endpoint, stats.username, stats.url, tag)
  }

  // Clear old logs
  Meteor.call('logsClearOld', userId)

  // END
  await closeBrowsers(userId)
  Meteor.call('browserProcessing', userId, false)

  return true
}

async function launchBrowser(userId) {
  const browser = Browsers.findOne({author: userId})
  const user = Meteor.users.findOne(userId, {fields: {settings: 1}})

  let configArgs = [
    '--disable-gpu',
    '--enable-logging',
    '--ignore-certificate-errors',
    // '--no-sandbox',
    // '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ]

  if (user.settings.proxyEnabled) {
    configArgs.push('--proxy-server=' + Meteor.settings.private.instagram.proxyHost + ':' + Meteor.settings.private.instagram.proxyPort)
  }

  const config = {
    headless: !user.settings.browserShow,
    // dumpio: true,
    // Possible fix of chromium not running in docker linux. However, it could potentially affect overall safety.
    // ignoreHTTPSErrors: true,
    args: configArgs,
    defaultView: {
      width: 1125,
      height: 2436,
      isMobile: true,
      hasTouch: true
    }
  }

  if(browser) {
    const browserHandle = await puppeteer.launch(config)
    const endpoint = await browserHandle.wsEndpoint()
    const pages = await browserHandle.pages()
    const page = pages[0]

    if (user.settings.proxyEnabled) {
      const proxyUsername = Meteor.settings.private.instagram.proxyUsername
      const proxyPassword = Meteor.settings.private.instagram.proxyPassword
      await page.authenticate({username: proxyUsername, password: proxyPassword})
    }

    // Set user agent to iOS v12
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/16B5089b'
    await page.setUserAgent(userAgent)

    // Navigation timeout of 10s
    await page.setDefaultNavigationTimeout(10000)

    // Block image display if enabled
    if(!user.settings.imagesShow) {
      await page.setRequestInterception(true)
      page.on('request', requestListener)
    }

    page.on('error', (error) => {
      console.log('error: ', error)
    })

    page.on('pageerror', (error) => {
      console.log('pageerror: ', error)
    })

    // Set cookies
    if(browser.cookies.length > 0) {
      await page.setCookie(...browser.cookies)
      Meteor.call('logSaveUser', {message: '--- Cookies set', author: userId})
    } else {
      Meteor.call('logSaveUser', {message: '--- No cookies were found', author: userId})
    }

    Meteor.call('browserSetEndpoint', browser._id, endpoint)

    return endpoint
  }else{
    return false
  }
}

function requestListener(request) {
  if(request.resourceType() === 'image' || request.resourceType() === "media" || request.resourceType() === "stylesheet") {
    request.abort()
  }else{
    request.continue()
  }
}

async function closeBrowsers(userId = false) {
  try {
    let browsers = []
    if(userId) {
      browsers = Browsers.find({author: userId}).fetch()
    }else{
      browsers = Browsers.find({}).fetch()
    }

    if(browsers.length > 0) {
      browsers.forEach(async browser => {
        try {
          const browserHandle = await puppeteer.connect({browserWSEndpoint: browser.endpoint})

          if(browserHandle) {
            await browserHandle.close()
          }
        } catch (error) {
          console.log(error.message)
        }
      })
    }
  } catch (error) {
    console.log(error.message)
  } finally {
    console.log(process)
    process.emit('SIGTERM')
    // process.removeAllListeners('exit')
    // process.removeAllListeners('SIGHUP')
    // process.removeAllListeners('SIGINT')
    // process.removeAllListeners('SIGTERM')
  }
}

async function instaLogin(userId, endpoint) {
  // Log in routine
  Meteor.call('logSaveUser', {message: '--- Running log in', author: userId})

  const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
  const pages = await browserHandle.pages()
  const page = await pages[0]

  // Check if username input filed is present
  let query = "//input[@name='username']"
  const inputUsername = await page.$x(query)
  if(inputUsername.length > 0) {
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
    query = "//button/div[text()='Log In']"
    const submitButton = await page.$x(query)
    let nav = page.waitForNavigation()
    try {
      await submitButton[0].click()
    }catch (e) {
      console.log("Timeout: click submit, time: "+new Date())
      return false
    }

    await nav

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
      try {
        await securityCodeSubmit[0].click()
      }catch (e) {
        console.log("Timeout: click security submit, time: "+new Date())
        return false
      }
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
    try {
      await thisWasMeButton[0].click()
    }catch (e) {
      console.log("Timeout: click this was me, time: "+new Date())
      return false
    }
    return false
  }

  // Click "Send security code" button if asked
  query = "//button[text()='Send Security Code']"
  const sendSecurityCodeButton = await page.$x(query)
  if(sendSecurityCodeButton.length > 0) {
    Meteor.call('logSaveUser', {message: 'Suspicious login detected. Asked to send security code.', author: userId})
    await sleepMedium()

    try {
      await sendSecurityCodeButton[0].click()
    }catch (e) {
      console.log("Timeout: click send security code, time: "+new Date())
      return false
    }

    Meteor.call('browserVerify', endpoint, true)
    return false
  }

  // User is already logged in
  return true
}

async function instaCheckLoginStatus(userId, endpoint) {
  // Check login status
  Meteor.call('logSaveUser', {message: '--- Running check log in status', author: userId})

  const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
  const pages = await browserHandle.pages()
  const page = await pages[0]

  // Go to the user's page
  let url = "https://www.instagram.com/accounts/login/"
  try{
    await page.goto(url)
  }catch(e){
    console.log("Timeout: "+url+" time: "+new Date())
    return false
  }

  await sleepLong()

  // Check if login button is present
  let query = "//input[@name='username']"
  const usernameInput = await page.$x(query)

  await sleepLong()

  if(usernameInput.length > 0) {
    const login = await instaLogin(userId, endpoint)

    if(!login) {
      return false
    }else{
      return true
    }
  }else{
    return true
  }
}

async function instaPickFromTag(userId, endpoint, tag) {
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
}

async function instaGetUserStats(userId, endpoint, userName) {
  // Get user stats
  Meteor.call('logSaveUser', {message: '--- Running insta get user stats', author: userId})

  const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
  const pages = await browserHandle.pages()
  const page = pages[0]

  // Go to the user's page
  let url = "https://instagram.com/" + userName + "/"
  Meteor.call('logSaveUser', {message: 'Loading page: ' + url, author: userId})
  try{
    await page.goto(url)
  }catch(e){
    console.log("Timeout: "+url+" time: "+new Date())
    return false
  }

  let query = "//span[contains(@class, 'g47SY')]"
  const statsHandle = await page.$x(query)
  if(statsHandle.length === 0) {
    return false
  }

  // Get all starts
  let stats = {}
  const posts = await statsHandle[0].getProperty('textContent')
  const followers = await statsHandle[1].getProperty('textContent')
  const following = await statsHandle[2].getProperty('textContent')
  stats.url = await page.url()
  stats.posts = await parseStat(posts._remoteObject.value)
  stats.followers = await parseStat(followers._remoteObject.value)
  stats.following = await parseStat(following._remoteObject.value)
  stats.username = userName

  await page.goBack()

  return stats
}

async function instaGetNewUsername(userId, endpoint, username) {
  // Get new user name in case it has changed
  Meteor.call('logSaveUser', {message: '--- Running get new username', author: userId})

  const browserHandle = await puppeteer.connect({browserWSEndpoint: endpoint})
  const pages = await browserHandle.pages()
  const page = pages[0]

  const like = Likes.findOne({userName: username})

  if (!like) {
    return 'newUserNameIsNotAvailable'
  }

  let url = like.url

  try{
    await page.goto(url)
  }catch(e){
    console.log("Timeout: "+url+" time: "+new Date())
    return false
  }
  Meteor.call('logSaveUser', {message: 'Loading page: ' + url, author: userId})

  // Check is user also deleted the photo/video
  let query = "//a[text()='Go back to Instagram.']"
  const pageRemoved = await page.$x(query)
  if(pageRemoved.length > 0) {
    return 'newUserNameIsNotAvailable'
  }

  // Get new username
  query = "//a[contains(@class, 'FPmhX') and contains(@class, 'nJAzx')]"
  const userNameHandle = await page.$x(query)
  if(userNameHandle.length == 0) {
    return false
  }
  const userName = await userNameHandle[0].getProperty('textContent')

  return userName._remoteObject.value
}

async function instaLike(userId, endpoint, userName, userUrl, tag) {
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

  // Get post url
  const url = await page.url()

  // // Check whether it was liked previously
  // let query = "//span[@aria-label='Like']"
  // let type = await page.$x(query)
  // if(type.length == 0) {
  //   console.log("Like: Could not get like state time: " + new Date())
  //   return false
  // }

  // Get media url
  let query = "//div[contains(@class, 'eLAPa')]//img[contains(@class, 'FFVAD')]"
  let img = await page.$x(query)

  let photo
  if(img.length > 0) {
    // In case it is a photo
    photo = await img[0].getProperty('src')
  }else{
    // In case it is a video
    query = "//div[contains(@class, 'OAXCp')]//img[contains(@class, '_8jZFn')]"
    img = await page.$x(query)
    // Fix 20/12/2018 sometimes img is not defined
    if(img.length > 0) {
      photo = await img[0].getProperty('src')
    }else {
      return false
    }
  }

  // Click for a like
  // Get like button
  // 03/07/2018 fix applied
  query = "//button[contains(@class, 'dCJp8')]"
  const likeButton = await page.$x(query)
  if(likeButton.length === 0) {
    console.log("Like: Could not get like button time: " + new Date())
    return false
  }

  await sleepLong()

  // await page.screenshot({path: '/home/screenshot.png', fullPage: true})

  await likeButton[0].click({delay: 255})

  // // Check whether like was actually recorded
  // try{
  //   await page.goto(url)
  // }catch (e) {
  //   console.log("Timeout: " + url + " time: " + new Date())
  //   return false
  // }
  //
  // await sleepMedium()
  //
  // query = "//span[@aria-label='Unlike']"
  // type = await page.$x(query)
  // if(type.length == 0) {
  //   console.log("Like: was not actually applied image: " + new Date())
  //   return false
  // }

  Meteor.call('likeSave', {url: url, photo: photo._remoteObject.value, userName: userName, userUrl: userUrl, author: userId, tag: tag})

  await sleepLong()

  return true
}

async function instaFollow(userId, endpoint, userName, userUrl, tag) {
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
  if(followButton.length === 0) {
    return false
  }
  await sleepShort()

  // Click follow
  try{
    await followButton[0].click()
  }catch (e) {
    console.log(e)
    return false
  }
  Meteor.call('follow.save', {author: userId, userName: userName, userUrl: userUrl, tag: tag})

  return true
}

async function instaUnfollow(userId, endpoint) {
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

  await sleepMedium()

  // Check is user deleted the page
  let query = "//a[text()='Go back to Instagram.']"
  const pageRemoved = await page.$x(query)
  if(pageRemoved.length > 0) {
    // 25/10/2018 Username change fix
    Meteor.call('logSaveUser', {message: 'User changed the username', author: userId})
    let username = await instaGetNewUsername(userId, endpoint, follow.userName)
    if(username === 'newUserNameIsNotAvailable') {
      Meteor.call('follow.unfollow', follow._id)
      return true
    }
    else if (!username) {
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
      await followingButton[0].click()
    }catch (e) {
      console.log(e)
      return false
    }
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
    try{
      await unfollowButton[0].click()
    }catch (e) {
      console.log(e)
      return false
    }
  }else{
    return false
  }

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
}

async function instaComment(userId, endpoint, userName, userUrl, tag) {
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

function parseStat(number) {
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
