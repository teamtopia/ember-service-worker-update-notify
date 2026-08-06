import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  setupServiceWorkerUpdater,
  serviceWorkerUpdate,
} from 'ember-service-worker-update-notify/test-support/updater';

module('Unit | Service | service-worker-update-notify', function(hooks) {
  setupTest(hooks);
  setupServiceWorkerUpdater(hooks);

  test('hasUpdate property', async function(assert) {
    let service = this.owner.lookup('service:service-worker-update-notify');
    assert.notOk(service.hasUpdate);

    await serviceWorkerUpdate();
    assert.ok(service.hasUpdate);
  });

  test('update event', async function(assert) {
    assert.expect(1);

    let service = this.owner.lookup('service:service-worker-update-notify');
    service.one('update', () => assert.ok(true));

    await serviceWorkerUpdate();
  });

  // The polling loop is skipped at init when Ember.testing, so it had no
  // coverage at all. These drive `_poll` directly with `_update` stubbed, and
  // assert on the armed timer rather than waiting out pollingInterval.
  //
  // No manual teardown: owner teardown destroys the service, which clears any
  // timer these leave armed.
  module('polling', function() {
    test('checks for an update and arms the next poll', async function(assert) {
      let service = this.owner.lookup('service:service-worker-update-notify');
      let calls = 0;
      service._update = () => {
        calls++;
        return Promise.resolve();
      };

      await service._poll();

      assert.strictEqual(calls, 1, 'checked for an update');
      assert.ok(service._pollTimer, 'armed the next poll');
    });

    test('keeps polling after a failed check', async function(assert) {
      let service = this.owner.lookup('service:service-worker-update-notify');
      service._update = () => Promise.reject(new Error('register failed'));

      await service._poll();

      assert.ok(
        service._pollTimer,
        'a rejected check still arms the next poll',
      );
    });

    test('willDestroy cancels a pending poll', async function(assert) {
      let service = this.owner.lookup('service:service-worker-update-notify');
      service._update = () => Promise.resolve();

      await service._poll();
      assert.ok(service._pollTimer, 'poll armed');

      service.willDestroy();

      assert.strictEqual(service._pollTimer, null, 'timer cleared');
    });
  });
});
