// A fake Zendesk messaging widget that mimics the observed behavior of the
// real one (build 5eb6863) closely enough for unit tests:
// - boots only when window.zE === window.zEmbed, then replaces window.zE
// - reads the key from <script id="ze-snippet"> or zE.s.src
// - drains the zE._ queue in order; zE(fn) is the ready hook
// - unknown commands throw synchronously, errors are class instances
// - unreadMessages fires immediately on subscribe and returns no unsubscribe

class ZendeskError extends Error {
  constructor(type, reason, message) {
    super(message);
    this.type = type;
    this.reason = reason;
  }
}

// Real event objects are class instances (`class C extends l`), which the GTM
// sandbox cannot read; their payload is a plain object.
class BaseEvent {}
class WidgetEvent extends BaseEvent {
  constructor(fields) {
    super();
    Object.assign(this, fields);
  }
}

const KNOWN_EVENTS = [
  'open', 'close', 'show', 'hide', 'proactiveMessageDisplayed', 'proactiveMessageClicked',
  'conversationStarted', 'conversationOpened', 'newConversationButtonClicked', 'conversationClicked',
  'conversationWithAgentRequested', 'conversationAgentAssigned', 'messagesShown', 'messageReceived',
  'postbackButtonClicked', 'conversationExtensionOpened', 'conversationExtensionDisplayed',
  'articleClicked', 'articleBrowserClicked', 'sourcesOpened', 'sourcesClosed', 'unreadMessages',
  'preConversationShown', 'formShown', 'formSubmitted'
];

export function installFakeWidget(win, opts = {}) {
  const calls = [];
  const listeners = {};
  const delegates = {};
  const state = {
    open: false, unread: 0, conversations: [], cookies: 'all',
    config: { canUserCreateMoreConversations: true, multiConvoEnabled: true, launcherShape: 'square' }
  };
  let seq = 0;
  const id = (p) => `${p}${++seq}`;
  const later = (fn) => setTimeout(fn, 0);

  const emit = (name, payload) => {
    const type = { open: 'messagingOpened', close: 'messagingClosed', show: 'messagingShown', hide: 'messagingHidden' }[name] || name;
    const fields = Object.assign({ id: id('evt'), createdAt: Date.now(), type }, payload ? { payload } : {});
    const event = name === 'unreadMessages' ? payload : opts.plainEvents ? fields : new WidgetEvent(fields);
    (listeners[name] || []).forEach((cb) => later(() => cb(event)));
  };

  const commands = {
    messenger: {
      open: () => { state.open = true; emit('open'); },
      close: () => { state.open = false; emit('close'); },
      show: () => emit('show'),
      hide: () => emit('hide'),
      render: (config, cb) => {
        const target = config && config.widget && config.widget.targetElement;
        const err = target === '#missing' ? new ZendeskError('RenderFailedError', 'TargetElementNotFound', 'not found') : null;
        if (cb) later(() => cb(err));
      },
      resetWidget: (cb) => { state.conversations = []; if (cb) later(cb); },
      loginUser: (jwtCb, loginCb) => {
        jwtCb((jwt) => {
          const ok = typeof jwt === 'string' && jwt.split('.').length === 3;
          if (loginCb) later(() => loginCb(ok ? null : new ZendeskError('LoginFailedError', 'InvalidJwt', 'bad jwt')));
        });
      },
      logoutUser: () => {},
      useSessionAuth: (cb) => later(() => cb(null)),
      updateUser: (obj, cb) => { if (cb) cb(); },
      newConversation: (options, cb) => {
        if (options && options.message && !options.message.content.text.trim()) {
          later(() => cb(new ZendeskError('ConversationCreationError', 'Invalid configuration', 'empty text'), undefined));
          return;
        }
        const conv = { id: id('conv'), createdAt: 1, lastUpdatedAt: 1, displayName: (options && options.displayName) || null, iconUrl: null, status: 'active', type: 'personal', brandId: null, unreadCount: 0 };
        state.conversations.push(conv);
        later(() => { cb(null, conv); emit('conversationStarted', { conversation: { id: conv.id } }); });
      },
      sendMessage: (message, conversationId, cb) => {
        if (!state.conversations.some((c) => c.id === conversationId)) {
          later(() => cb(new ZendeskError('SendMessageError', 'Conversation not found', 'nope'), undefined));
          return;
        }
        const sent = delegates.beforeMessageSent ? delegates.beforeMessageSent(message, { conversationId }) || message : message;
        calls.push(['__sent', sent]);
        later(() => cb(null, { id: id('msg'), receivedAt: Date.now() }));
      },
      fetchConversations: (offset, cb) => {
        const all = [];
        for (let i = 0; i < 25; i++) all.push({ id: `c${i}`, status: 'active' });
        later(() => cb(null, { data: all.slice(offset, offset + 10), hasMore: offset + 10 < all.length }));
      }
    },
    'messenger:set': {
      locale: () => {}, zIndex: () => {}, customization: () => {}, behavior: () => {},
      cookies: (range) => { state.cookies = range; },
      conversationFields: (fields, cb) => { if (cb) later(cb); },
      conversationTags: () => {}, conversationMetadata: () => {}, userMetadata: () => {},
      typingIndicator: () => {},
      beforeMessageSent: (fn) => { delegates.beforeMessageSent = fn; return () => { delete delegates.beforeMessageSent; }; },
      beforeMessageDisplay: (fn) => { delegates.beforeMessageDisplay = fn; return () => { delete delegates.beforeMessageDisplay; }; }
    },
    'messenger:get': { config: (cb) => later(() => cb(Object.assign({}, state.config))) },
    'messenger:ui': {
      newConversation: (options, cb) => { if (cb) later(() => cb(null)); },
      navigation: () => {},
      preConversation: (options, cb) => { if (cb) later(() => cb(null)); }
    },
    'messenger:open': { voice: () => {} },
    'messenger:on': Object.fromEntries(KNOWN_EVENTS.map((name) => [name, (cb) => {
      (listeners[name] = listeners[name] || []).push(cb);
      if (name === 'unreadMessages') { later(() => cb(state.unread)); return undefined; }
      return () => { listeners[name] = listeners[name].filter((x) => x !== cb); };
    }]))
  };

  const api = function (ns, cmd, ...args) {
    if (typeof ns === 'function') { later(ns); return undefined; }
    calls.push([ns, cmd, ...args]);
    const handler = commands[ns] && commands[ns][cmd];
    if (typeof handler !== 'function') throw new Error(`Method ${ns}.${cmd} does not exist.`);
    return handler(...args);
  };
  api.version = 'fake123';
  api.widget = 'messenger';

  const boot = () => {
    const queue = win.zE;
    if (typeof queue !== 'function' || queue !== win.zEmbed) return { booted: false, reason: 'zE !== zEmbed' };
    const snippet = win.document && win.document.getElementById && win.document.getElementById('ze-snippet');
    const src = snippet ? snippet.src : queue.s && queue.s.src;
    const key = src && /[?&]key=([^&]+)/.exec(src);
    if (!key) return { booted: false, reason: 'Key is missing from snippet' };
    const pending = queue._ || [];
    win.zE = api;
    win.zEmbed = api;
    win.zEACLoaded = true;
    // The real widget logs a failing queue entry and continues with the next.
    pending.forEach((args) => {
      try { api(...Array.prototype.slice.call(args)); } catch (e) { calls.push(['__error', String(e.message)]); }
    });
    return { booted: true, key: decodeURIComponent(key[1]) };
  };

  return {
    boot, calls, listeners, delegates, state, emit,
    callsOf: (ns, cmd) => calls.filter((c) => c[0] === ns && (cmd === undefined || c[1] === cmd)),
    display: (message) => (delegates.beforeMessageDisplay ? delegates.beforeMessageDisplay(message, { conversationId: 'x' }) : undefined)
  };
}

export const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
