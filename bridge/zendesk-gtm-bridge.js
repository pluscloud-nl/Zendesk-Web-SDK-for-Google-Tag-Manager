/*! zendesk-gtm-bridge v0.1.0 | Apache-2.0 | pluscloud
 *
 * Hands Zendesk Messaging Web Widget events to the "Zendesk Messaging – Web SDK"
 * Google Tag Manager template as plain objects.
 *
 * Zendesk passes its event objects as class instances. GTM's sandbox turns
 * those into `undefined`, so a template only sees that an event happened. This
 * script registers the listener outside the sandbox and passes a plain copy.
 * It does nothing else: no network requests, no storage, no other globals.
 */
(function (w) {
  'use strict';
  if (w.zendeskGtmBridge && w.zendeskGtmBridge.version) return;

  function plain(value) {
    if (value === null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return { id: value.id, createdAt: value.createdAt, type: value.type };
    }
  }

  w.zendeskGtmBridge = {
    version: '0.1.0',
    // Same contract as zE('messenger:on', name, callback); works before and
    // after the widget has loaded because zE queues commands until then.
    on: function (name, callback) {
      if (typeof w.zE !== 'function' || typeof callback !== 'function') return undefined;
      return w.zE('messenger:on', name, function (event) {
        callback(plain(event));
      });
    }
  };
})(window);
