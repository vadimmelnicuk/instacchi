import { Mongo } from 'meteor/mongo'

export const Browsers = new Mongo.Collection('browsers')
export const Logs = new Mongo.Collection('logs')
export const Likes = new Mongo.Collection('likes')
export const Follows = new Mongo.Collection('follows')
export const Comments = new Mongo.Collection('comments')
export const instaStats = new Mongo.Collection('instaStats')