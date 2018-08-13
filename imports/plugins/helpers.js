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
        },
        numberSign: function (number) {
          if(number > 0) {
            return "+" + number
          }else{
            return number
          }
        },
        numberPositivity: function (number) {
          if(number > 0) {
            return 'green'
          }else if (number < 0){
            return 'red'
          }else{
            return 'grey'
          }
        }
      }
    })
  }
}