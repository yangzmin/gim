import Vue from 'vue'
import Vuex from 'vuex'
import auth from './modules/auth'
import user from './modules/user'
import friend from './modules/friend'
import chat from './modules/chat'
import connection from './modules/connection'

Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    auth,
    user,
    friend,
    chat,
    connection
  },
  strict: process.env.NODE_ENV !== 'production'
})