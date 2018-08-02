import Meteor from 'meteor/meteor'
import Snackbar from '/imports/components/Snackbar.vue'

export default {
  install(Vue, options) {
    Vue.component(Snackbar.name, Snackbar)
    Vue.prototype.$snackbarMessages = []
    Vue.mixin({
      methods: {
        toast: function (message) {
          let self = this
          const key = new Date().getTime()

          // Add new message to the buffer
          self.$snackbarMessages.push({
            message: message,
            key: key
          })

          // Remove after some time
          setTimeout(function () {
              self.$snackbarMessages.pop()
          }, 2250)
        }
      }
    })
  }
}