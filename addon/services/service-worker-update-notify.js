import Ember from 'ember'
import Service from '@ember/service'
import Evented from '@ember/object/evented'
import { getOwner } from '@ember/application'
import { computed } from '@ember/object'
import serviceWorkerHasUpdate from '../utils/service-worker-has-update'

const configKey = 'ember-service-worker-update-notify'
const supportsServiceWorker =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator

async function update() {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register(
      '{{ROOT_URL}}{{SERVICE_WORKER_FILENAME}}',
      { scope: '{{ROOT_URL}}' },
    )

    return reg.update()
  }
}

export default Service.extend(Evented, {
  hasUpdate: false,

  pollingInterval: computed(function () {
    let config = getOwner(this).resolveRegistration('config:environment')[
      configKey
    ]
    return (config && config.pollingInterval) || 120000
  }),

  _pollTimer: null,

  // Seam for tests: `update` is module-private, so the polling loop would
  // otherwise be unstubbable.
  _update() {
    return update()
  },

  // Was an ember-concurrency task (`while (true) { yield update(); yield
  // timeout(...) }`). Plain timers do the same job without the dependency —
  // which matters because ember-concurrency v5 removed the generator task form
  // and, as a v1 addon, this one cannot register the Babel transform the
  // modern async-arrow form needs.
  //
  // Returns the promise for the current cycle so tests can await it; nothing
  // in the app does.
  _poll() {
    return this._update()
      .catch(() => {
        // Keep polling after a failed registration check. The task version
        // aborted the loop for good on the first rejection, so a single
        // transient failure meant the app never noticed a later release.
      })
      .then(() => {
        if (this.isDestroying || this.isDestroyed) {
          return
        }

        this._pollTimer = setTimeout(() => this._poll(), this.pollingInterval)
      })
  },

  willDestroy() {
    this._super(...arguments)

    if (this._pollTimer) {
      clearTimeout(this._pollTimer)
      this._pollTimer = null
    }
  },

  _attachUpdateHandler() {
    serviceWorkerHasUpdate().then((hasUpdate) => {
      if (hasUpdate) {
        this.set('hasUpdate', true)
        this.trigger('update')
      }
    })
  },

  init() {
    this._super(...arguments)
    if (typeof FastBoot === 'undefined') {
      this._attachUpdateHandler()
      if (!Ember.testing && supportsServiceWorker) {
        this._poll()
      }
    }
  },
})
