import { addSuccessHandler } from 'ember-service-worker/service-worker-registration'

function hasServiceWorkerUpdate(resolve) {
  addSuccessHandler(function (reg) {
    reg.onupdatefound = function () {
      console.log('>>> onupdatefound')
      const { installing } = reg

      installing.onstatechange = function () {
        if (installing.state === 'activated') {
          if (localStorage.getItem('sw_registered') === 'ok') {
            console.log('>>> installing.onstatechange activated second time')
            resolve(navigator.serviceWorker.controller !== null)
          } else {
            console.log('>>> installing.onstatechange activated first time')
            localStorage.setItem('sw_registered', 'ok')
            resolve(false)
          }
        }
      }
    }
  })
}

// https://caniuse.com/#search=Promise
// IE11 (2.5%) and Opera Mini (2.3%) do not support Promises
const arePromisesSupported = 'Promise' in window
const disablePolyfill = {
  then: function () {
    return false
  },
}

window.hasServiceWorkerUpdate = arePromisesSupported
  ? new Promise(hasServiceWorkerUpdate)
  : disablePolyfill
