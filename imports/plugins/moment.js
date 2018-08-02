import moment from 'moment'

export default {
  install(Vue, options) {
    Vue.mixin({
      filters: {
        readableDate: function (date) {
          return moment(date).format("DD/MM/YYYY HH:mm:ss")
        },
        fromNow: function (date) {
          return moment(date).fromNow()
        }
      }
    })
  }
}