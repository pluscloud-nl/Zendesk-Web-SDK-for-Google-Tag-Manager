import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, setup, command, tick, KEY, BRIDGE } from './helpers.mjs';

test('setup creates the snippet queue with key, zEmbed alias and injects the snippet', () => {
  const p = page();
  const result = p.run(setup());
  assert.equal(result.success, true);
  assert.equal(typeof p.win.zE, 'function');
  assert.equal(p.win.zE, p.win.zEmbed, 'zE and zEmbed must be the same function or the widget will not boot');
  assert.ok(Array.isArray(p.win.zE._));
  assert.equal(p.win.zE.s.src, 'https://static.zdassets.com/ekr/snippet.js?key=' + KEY);
  assert.equal(p.snippets().length, 1);
  assert.equal(p.snippets()[0].url, p.win.zE.s.src);
});

test('host-based keys keep their slash', () => {
  const p = page();
  p.run(setup({ snippetKey: 'web_widget/example.zendesk.com' }));
  assert.equal(p.snippets()[0].url, 'https://static.zdassets.com/ekr/snippet.js?key=web_widget/example.zendesk.com');
});

test('the fake widget boots from the queue and replays commands in order', async () => {
  const p = page();
  p.run(setup({ locale: 'nl', zIndex: '1234', cookieMode: 'functional', initialVisibility: 'close' }));
  const boot = p.widget.boot();
  assert.deepEqual(boot, { booted: true, key: KEY });
  const order = p.widget.calls.map((c) => c[0] + ' ' + c[1]);
  assert.ok(order.indexOf('messenger:set cookies') < order.indexOf('messenger:set locale'), 'cookies first');
  assert.deepEqual(p.widget.callsOf('messenger:set', 'locale')[0].slice(2), ['nl']);
  assert.deepEqual(p.widget.callsOf('messenger:set', 'zIndex')[0].slice(2), [1234]);
  assert.equal(p.widget.state.cookies, 'functional');
  assert.equal(p.widget.callsOf('messenger', 'close').length, 1);
  await tick(30); // ready hook and config callback are two separate timeouts
  assert.ok(p.eventNames().includes('zendesk_messaging.ready'));
  assert.equal(p.win.__gtmZendesk.ready, true);
  assert.equal(p.win.__gtmZendesk.version, 'fake123');
  assert.equal(p.win.__gtmZendesk.multiConvoEnabled, true);
});

test('firing the setup tag twice does not duplicate listeners or the snippet', async () => {
  const p = page();
  p.run(setup());
  p.run(setup());
  p.widget.boot();
  assert.equal(p.snippets().length, 1);
  assert.equal(p.widget.listeners.open.length, 1);
  p.widget.emit('open');
  await tick();
  assert.equal(p.eventNames().filter((n) => n === 'zendesk_messaging.open').length, 1);
});

test('plain event objects are normalized into the zendesk dataLayer object', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.widget.emit('messageReceived', {
    conversation: { id: 'c1' },
    message: { id: 'm1', receivedAt: 1700000000000, role: 'business', source: { type: 'zd:answerBot' } }
  });
  p.widget.emit('articleClicked', { articleId: 42, articleTitle: 'Returns' });
  await tick();
  const received = p.events().find((e) => e.event === 'zendesk_messaging.message_received');
  assert.equal(received.zendesk.conversation_id, 'c1');
  assert.equal(received.zendesk.message_role, 'business');
  assert.equal(received.zendesk.message_source_type, 'zd:answerBot');
  assert.equal(received.zendesk.event_name, 'messageReceived');
  const article = p.events().find((e) => e.event === 'zendesk_messaging.article_clicked');
  assert.equal(article.zendesk.article_id, 42);
  assert.ok('conversation_id' in article.zendesk, 'stale keys are reset explicitly');
  assert.equal(article.zendesk.conversation_id, undefined);
  assert.equal(p.win.__gtmZendesk.conversationId, 'c1');
});

test('unreadMessages is pushed only when the count changes', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  await tick();
  p.widget.emit('unreadMessages', 0);
  p.widget.emit('unreadMessages', 2);
  p.widget.emit('unreadMessages', 2);
  await tick();
  const counts = p.events().filter((e) => e.event === 'zendesk_messaging.unread_messages').map((e) => e.zendesk.unread_count);
  assert.deepEqual(counts, [0, 2]);
});

test('messagesShown is opt-in; custom selection works', async () => {
  const p = page();
  p.run(setup({ eventSelection: 'custom', eventList: [{ event: 'close' }, { event: 'messagesShown' }] }));
  p.widget.boot();
  p.widget.emit('open');
  p.widget.emit('close');
  p.widget.emit('messagesShown', { conversation: { id: 'c' }, messages: [{ id: 'a' }, { id: 'b' }] });
  await tick();
  const names = p.eventNames();
  assert.ok(!names.includes('zendesk_messaging.open'));
  assert.ok(names.includes('zendesk_messaging.close'));
  assert.equal(p.events().find((e) => e.event === 'zendesk_messaging.messages_shown').zendesk.messages_count, 2);
  assert.equal(p.win.__gtmZendesk.isOpen, false, 'state still tracked for unselected events');
});

test('custom event prefix', async () => {
  const p = page();
  p.run(setup({ eventPrefix: 'zendesk_' }));
  p.widget.boot();
  p.widget.emit('conversationStarted', { conversation: { id: 'x' } });
  await tick();
  assert.ok(p.events('zendesk_').some((e) => e.event === 'zendesk_conversation_started'));
});

test('load mode "existing" never injects but still queues', () => {
  const p = page();
  p.run(setup({ loadMode: 'existing', locale: 'de' }));
  assert.equal(p.snippets().length, 0);
  assert.equal(p.win.zE._.length > 0, true);
  assert.equal(p.win.zE.s, undefined, 'the site snippet supplies the key');
});

test('load mode "auto" skips injection when a snippet is already present', () => {
  const p = page();
  p.win.zE = function () { (p.win.zE._ = p.win.zE._ || []).push(arguments); };
  p.win.zEmbed = p.win.zE;
  p.run(setup());
  assert.equal(p.snippets().length, 0);
});

test('embedded render mode disables autorender and renders with targets', async () => {
  const p = page();
  p.run(setup({ renderMode: 'embedded', setupRenderWidgetTarget: '#zd', setupRenderSourcesTarget: '#src', setupRenderSourcesEventOnly: true }));
  assert.deepEqual(p.win.zEMessenger, { autorender: false });
  p.widget.boot();
  const render = p.widget.callsOf('messenger', 'render')[0];
  assert.deepEqual(render[2], { mode: 'embedded', widget: { targetElement: '#zd' }, sources: { targetElement: '#src', eventOnly: true } });
  await tick();
  assert.ok(p.eventNames().includes('zendesk_messaging.rendered'));
});

test('render errors (class instances) become error events', async () => {
  const p = page();
  p.run(setup({ renderMode: 'deferred', setupRenderWidgetTarget: '#missing' }));
  p.run(command('render'));
  p.widget.boot();
  await tick();
  const err = p.events().find((e) => e.event === 'zendesk_messaging.error');
  assert.equal(err.zendesk.api, 'render');
});

test('customization only sends filled, valid fields and merges extra JSON', () => {
  const p = page();
  p.run(setup({
    customizationEnabled: true,
    themeColors: [{ property: 'primary', color: '#FE5E41' }, { property: 'onPrimary', color: '' }],
    commonStylingPreset: 'minimalistic',
    posSide: 'left',
    customizationOptions: [
      { option: 'common.contentScale', value: '110' },
      { option: 'conversationList.hideTimestamp', value: 'true' },
      { option: 'messageLog.avatar.position', value: 'top' },
      { option: 'messageLog.citations.sources', value: 'bulletedList' },
      { option: 'position.offset.web.horizontal', value: '32' },
      { option: 'messageLog.avatar.size', value: '500' },
      { option: 'messageLog.avatar.position', value: 'middle' },
      { option: 'common.isHideButtonVisible', value: 'true' }
    ],
    customizationJson: '{"messageLog":{"avatar":{"size":24}}}'
  }));
  p.widget.boot();
  const c = p.widget.callsOf('messenger:set', 'customization')[0][2];
  assert.deepEqual(c, {
    theme: { primary: '#FE5E41' },
    common: { contentScale: 110, stylingPreset: 'minimalistic' },
    conversationList: { hideTimestamp: true },
    messageLog: { avatar: { position: 'top', size: 24 }, citations: { sources: 'bulletedList' } },
    position: { side: 'left', offset: { web: { horizontal: 32 } } }
  });
});

test('customization is not sent when disabled or empty', () => {
  const p = page();
  p.run(setup({ customizationEnabled: true }));
  p.widget.boot();
  assert.equal(p.widget.callsOf('messenger:set', 'customization').length, 0);
});

test('automatic position side follows the locale', () => {
  const p = page();
  p.run(setup({ customizationEnabled: true, posSide: 'auto', locale: 'ar' }));
  p.widget.boot();
  assert.equal(p.widget.callsOf('messenger:set', 'customization')[0][2].position.side, 'left');
});

test('behavior: empty logo alt text is sent on purpose', () => {
  const p = page();
  p.run(setup({ behSuppressAutoFocus: 'true', behLogoAltTextEnabled: true, behLogoAltText: '' }));
  p.widget.boot();
  assert.deepEqual(p.widget.callsOf('messenger:set', 'behavior')[0][2], {
    composer: { focus: { suppressAutoFocus: true } },
    header: { logo: { altText: '' } }
  });
});

test('conversation context: tags, typed fields, metadata, user metadata, updateUser', () => {
  const p = page();
  p.run(setup({
    conversationTags: [{ tag: 'sales' }, { tag: 'sales' }, { tag: 'vip' }],
    conversationFields: [{ id: '123', value: '100.5', type: 'number' }, { id: '456', value: 'true', type: 'boolean' }],
    conversationMetadata: [{ key: 'orderId', value: '9876', type: 'string' }],
    userMetadata: [{ key: 'plan', value: 'enterprise', type: 'auto' }],
    updateUser: [{ key: 'name', value: 'Jane', type: 'string' }, { key: 'age', value: '33', type: 'number' }]
  }));
  p.widget.boot();
  assert.deepEqual(p.widget.callsOf('messenger:set', 'conversationTags')[0][2], ['sales', 'vip']);
  assert.deepEqual(p.widget.callsOf('messenger:set', 'conversationFields')[0][2], [{ id: '123', value: 100.5 }, { id: '456', value: true }]);
  assert.deepEqual(p.widget.callsOf('messenger:set', 'conversationMetadata')[0][2], { orderId: '9876' });
  assert.deepEqual(p.widget.callsOf('messenger:set', 'userMetadata')[0][2], { plan: 'enterprise' });
  assert.deepEqual(p.widget.callsOf('messenger', 'updateUser')[0][2], { name: 'Jane', age: 33 });
});

test('consent mode: denied functional storage + skip waits and loads after grant', () => {
  const p = page({ consent: { functionality_storage: 'denied', analytics_storage: 'denied' } });
  p.run(setup({ cookieMode: 'consent', consentDeniedBehavior: 'skip', waitForConsent: true }));
  assert.equal(p.snippets().length, 0);
  assert.equal(p.win.zE, undefined);
  p.sandbox.updateConsent('functionality_storage', 'granted');
  assert.equal(p.snippets().length, 1);
  p.widget.boot();
  assert.equal(p.widget.state.cookies, 'functional');
  p.sandbox.updateConsent('analytics_storage', 'granted');
  assert.equal(p.widget.state.cookies, 'all');
});

test('consent mode: denied functional storage defaults to cookies none', () => {
  const p = page({ consent: { functionality_storage: 'denied' } });
  p.run(setup({ cookieMode: 'consent' }));
  p.widget.boot();
  assert.equal(p.widget.state.cookies, 'none');
});

test('beforeMessageSent adds static, dataLayer and page metadata at send time', async () => {
  const p = page();
  p.run(setup({
    beforeSentEnabled: true,
    beforeSentPageContext: true,
    beforeSentMetadata: [
      { key: 'source', source: 'static', value: 'gtm', type: 'string' },
      { key: 'cart', source: 'dataLayer', value: 'ecommerce.value', type: 'number' }
    ]
  }));
  p.widget.boot();
  p.win.dataLayer.push({ ecommerce: { value: '49.95' } });
  p.run(command('newConversation', { convMode: 'programmatic', convDisplayName: 'Help' }));
  await tick();
  p.run(command('sendMessage', { sendText: 'Hello', sendTarget: 'current' }));
  await tick();
  const sent = p.widget.calls.find((c) => c[0] === '__sent')[1];
  assert.deepEqual(sent.metadata, { source: 'gtm', cart: 49.95, page_url: 'https://shop.example/checkout?step=2', page_title: 'Checkout' });
  assert.ok(p.eventNames().includes('zendesk_messaging.message_sent'));
});

test('beforeMessageDisplay renames authors and hides flagged messages', () => {
  const p = page();
  p.run(setup({
    beforeDisplayEnabled: true,
    displayNameMap: [{ from: 'Support Agent', to: 'Customer Success' }],
    hideRules: [{ key: 'internal_only', value: 'true' }]
  }));
  p.widget.boot();
  assert.equal(p.widget.display({ id: '1', author: { displayName: 'Bot' }, metadata: { internal_only: true } }), null);
  assert.deepEqual(p.widget.display({ id: '2', author: { displayName: 'Support Agent' }, metadata: {} }).author, { displayName: 'Customer Success' });
  assert.equal(p.widget.display({ id: '3', author: { displayName: 'Other' } }), undefined);
});

test('re-firing setup replaces delegates instead of stacking them', () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(setup({ loadSnippet: false, beforeDisplayEnabled: true, hideRules: [{ key: 'a', value: '' }] }));
  p.run(setup({ loadSnippet: false, beforeDisplayEnabled: true, hideRules: [{ key: 'b', value: '' }] }));
  assert.equal(p.widget.display({ metadata: { a: 1 } }), undefined);
  assert.equal(p.widget.display({ metadata: { b: 1 } }), null);
});

test('commands before setup are queued and run after boot', () => {
  const p = page();
  p.run(command('open'));
  p.run(setup());
  p.widget.boot();
  const messengerCalls = p.widget.calls.filter((c) => c[0] === 'messenger').map((c) => c[1]);
  assert.deepEqual(messengerCalls.slice(0, 2), ['show', 'open']);
});

test('all simple commands map to the right zE call', () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  const cases = [
    [command('close'), ['messenger', 'close']],
    [command('show'), ['messenger', 'show']],
    [command('hide'), ['messenger', 'hide']],
    [command('voice', { voiceLineId: '53425f6ca3b02dd719ad9654af3fce38' }), ['messenger:open', 'voice', '53425f6ca3b02dd719ad9654af3fce38']],
    [command('navigation', { navScreen: 'Conversation', navConversationId: 'c9', openAfterNav: false }), ['messenger:ui', 'navigation', { screen: 'Conversation', options: { conversationId: 'c9' } }]],
    [command('setLocale', { cmdLocale: 'fr' }), ['messenger:set', 'locale', 'fr']],
    [command('setCookies', { cmdCookies: 'none' }), ['messenger:set', 'cookies', 'none']],
    [command('typingIndicator', { typingName: 'Ava' }), ['messenger:set', 'typingIndicator', { name: 'Ava' }]]
  ];
  for (const [data, expected] of cases) {
    const before = p.widget.calls.length;
    p.run(data);
    const call = p.widget.calls[before];
    assert.deepEqual(call.slice(0, expected.length), expected, data.command);
  }
});

test('toggle uses the tracked open state', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(command('toggle'));
  await tick();
  p.run(command('toggle'));
  const cmds = p.widget.calls.filter((c) => c[0] === 'messenger').map((c) => c[1]);
  assert.deepEqual(cmds.slice(-3), ['show', 'open', 'close']);
});

test('newConversation (programmatic) builds options, navigates and opens', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(command('newConversation', {
    convMode: 'programmatic',
    convDisplayName: 'VIP', convDescription: 'Order 1', convIconUrl: 'https://x.test/i.png',
    convMetadata: [{ key: 'orderId', value: '1', type: 'string' }],
    convMessageText: 'Hi', convMessageMetadata: [{ key: 'intent', value: 'order', type: 'string' }],
    navigateAfter: true, openAfterConv: true
  }));
  assert.deepEqual(p.widget.callsOf('messenger', 'newConversation')[0][2], {
    displayName: 'VIP', description: 'Order 1', iconUrl: 'https://x.test/i.png', metadata: { orderId: '1' },
    message: { content: { type: 'text', text: 'Hi' }, metadata: { intent: 'order' } }
  });
  await tick();
  const created = p.events().find((e) => e.event === 'zendesk_messaging.conversation_created');
  assert.ok(created.zendesk.conversation_id);
  assert.equal(p.widget.callsOf('messenger:ui', 'navigation')[0][2].options.conversationId, created.zendesk.conversation_id);
  assert.ok(p.widget.callsOf('messenger', 'open').length >= 1);
});

test('newConversation in the UI never sends message metadata', () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(command('newConversation', { convMode: 'ui', convDisplayName: 'Help', convMessageText: 'Hi', convMessageMetadata: [{ key: 'a', value: 'b' }], openAfterConv: true }));
  assert.deepEqual(p.widget.callsOf('messenger:ui', 'newConversation')[0][2], { displayName: 'Help', message: { content: { type: 'text', text: 'Hi' } } });
  assert.equal(p.widget.callsOf('messenger', 'open').length, 1, 'opened afterwards by default');
});

test('sendMessage without a known conversation reports an error', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(command('sendMessage', { sendText: 'Hi', sendTarget: 'specific', sendConversationId: 'nope' }));
  await tick();
  const err = p.events().find((e) => e.event === 'zendesk_messaging.error');
  assert.equal(err.zendesk.api, 'sendMessage');
});

test('fetchConversations can fetch all pages', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(command('fetchConversations', { fetchOffset: '0', fetchAll: true }));
  await tick(20);
  const fetched = p.events().find((e) => e.event === 'zendesk_messaging.conversations_fetched');
  assert.equal(fetched.zendesk.result.count, 25);
  assert.equal(fetched.zendesk.result.hasMore, false);
});

test('getConfig pushes the configuration', async () => {
  const p = page();
  p.run(setup());
  p.widget.boot();
  p.run(command('getConfig'));
  await tick();
  const ev = p.events().find((e) => e.event === 'zendesk_messaging.config_loaded');
  assert.equal(ev.zendesk.result.launcherShape, 'square');
});

test('resetWidget re-applies the remembered conversation context', async () => {
  const p = page();
  p.run(setup({ conversationTags: [{ tag: 'vip' }] }));
  p.widget.boot();
  p.run(command('resetWidget'));
  await tick();
  assert.equal(p.widget.callsOf('messenger:set', 'conversationTags').length, 2);
  assert.ok(p.eventNames().includes('zendesk_messaging.widget_reset'));
});

test('experimental: pre-conversation behavior and events', async () => {
  const p = page();
  p.run(setup({
    experimentalEnabled: true, expPreConversationEnabled: true,
    expPreConversationSettings: [{ setting: 'title', value: 'Hi!' }, { setting: 'prompt', value: 'Track my order' }, { setting: 'prompt', value: '' }],
    eventList: [{ event: 'formSubmitted' }]
  }));
  p.widget.boot();
  assert.deepEqual(p.widget.callsOf('messenger:set', 'behavior')[0][2], {
    messageLog: { preConversation: { enabled: true, settings: { title: 'Hi!', prompts: ['Track my order'] } } }
  });
  p.widget.emit('formSubmitted', { formType: 'ticketForm', id: 7, name: 'Returns' });
  await tick();
  const ev = p.events().find((e) => e.event === 'zendesk_messaging.form_submitted');
  assert.equal(ev.zendesk.form_name, 'Returns');
});

test('tracking off pushes nothing but still tracks state', async () => {
  const p = page();
  p.run(setup({ trackEvents: false }));
  p.widget.boot();
  p.widget.emit('open');
  await tick();
  assert.equal(p.events().length, 0);
  assert.equal(p.win.__gtmZendesk.isOpen, true);
});

test('the bridge delivers full payloads of class-instance events (the real widget)', async () => {
  const p = page();
  p.run(setup());
  assert.equal(p.bridges().length, 1, 'bridge injected once');
  p.widget.boot();
  p.widget.emit('messageReceived', { conversation: { id: 'c1' }, message: { id: 'm1', role: 'business', source: { type: 'zd:answerBot' } } });
  p.widget.emit('articleClicked', { articleId: 42, articleTitle: 'Returns' });
  await tick();
  const received = p.events().find((e) => e.event === 'zendesk_messaging.message_received');
  assert.equal(received.zendesk.conversation_id, 'c1');
  assert.equal(received.zendesk.message_source_type, 'zd:answerBot');
  assert.equal(p.events().find((e) => e.event === 'zendesk_messaging.article_clicked').zendesk.article_id, 42);
});

test('without the bridge, class-instance events arrive with their name and type only', async () => {
  const p = page();
  p.run(setup({ bridgeSource: 'off' }));
  assert.equal(p.bridges().length, 0);
  p.widget.boot();
  p.widget.emit('messageReceived', { conversation: { id: 'c1' }, message: { id: 'm1', role: 'business', source: { type: 'web' } } });
  p.widget.emit('open');
  await tick();
  const received = p.events().find((e) => e.event === 'zendesk_messaging.message_received');
  assert.equal(received.zendesk.event_type, 'messageReceived');
  assert.equal(received.zendesk.conversation_id, undefined);
  assert.equal(p.events().find((e) => e.event === 'zendesk_messaging.open').zendesk.event_type, 'messagingOpened');
  assert.equal(p.win.__gtmZendesk.isOpen, true);
});

test('when the bridge fails to load, events still fire with their name', async () => {
  const p = page({ bridgeFails: true });
  p.run(setup());
  p.widget.boot();
  p.widget.emit('conversationStarted', { conversation: { id: 'x' } });
  await tick();
  const ev = p.events().find((e) => e.event === 'zendesk_messaging.conversation_started');
  assert.equal(ev.zendesk.event_name, 'conversationStarted');
  assert.equal(ev.zendesk.conversation_id, undefined);
});

test('the bridge also gets payloads when the widget had already booted', async () => {
  const p = page();
  p.run(command('close'));
  p.win.zE.s = { src: 'https://static.zdassets.com/ekr/snippet.js?key=' + KEY };
  p.widget.boot();
  p.run(setup({ loadSnippet: false }));
  p.widget.emit('postbackButtonClicked', { actionName: 'add_to_cart', conversation: { id: 'c7' } });
  await tick();
  assert.equal(p.events().find((e) => e.event === 'zendesk_messaging.postback_button_clicked').zendesk.action_name, 'add_to_cart');
});

test('bridge from a Custom HTML tag in GTM: no injection, full payloads', async () => {
  const p = page();
  new Function('window', BRIDGE)(p.win); // eslint-disable-line no-new-func
  p.run(setup({ bridgeSource: 'gtm' }));
  assert.equal(p.bridges().length, 0, 'nothing loaded from the CDN');
  p.widget.boot();
  p.widget.emit('conversationStarted', { conversation: { id: 'c9' } });
  await tick();
  assert.equal(p.events().find((e) => e.event === 'zendesk_messaging.conversation_started').zendesk.conversation_id, 'c9');
});

test('bridge source gtm without the Custom HTML tag: names only, no injection', async () => {
  const p = page();
  p.run(setup({ bridgeSource: 'gtm' }));
  assert.equal(p.bridges().length, 0);
  p.widget.boot();
  p.widget.emit('conversationStarted', { conversation: { id: 'c9' } });
  await tick();
  const ev = p.events().find((e) => e.event === 'zendesk_messaging.conversation_started');
  assert.equal(ev.zendesk.conversation_id, undefined);
});
