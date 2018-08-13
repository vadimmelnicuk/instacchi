import { Meteor } from 'meteor/meteor'
import Vue from 'vue'
import VueMeteorTracker from 'vue-meteor-tracker'
import VueRouter from 'vue-router'
import Snackbar from '/imports/plugins/snackbar'
import Helpers from '/imports/plugins/helpers'
import Routes from '/imports/startup/routes'
import App from '/imports/components/layout/App.vue'

Vue.use(VueMeteorTracker)
Vue.use(VueRouter)
Vue.use(Snackbar)
Vue.use(Helpers)

Vue.config.productionTip = false

Meteor.startup(() => {
  const router = new VueRouter({
    mode: 'history',
    routes: Routes
  })

  new Vue({
    router,
    render: h => h(App)
  }).$mount('#app')
})