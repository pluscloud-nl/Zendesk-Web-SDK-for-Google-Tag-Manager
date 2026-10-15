// Zendesk Messaging – Web SDK (GTM custom template, sandboxed JavaScript)
//
// Supported language subset: ES5.1 + const/let + arrow functions. No typeof,
// new, this, try/catch, regex literals, template literals, spread or for-in.
// `npm run lint` enforces this before every build.

const addConsentListener = require('addConsentListener');
const aliasInWindow = require('aliasInWindow');
const callInWindow = require('callInWindow');
const copyFromDataLayer = require('copyFromDataLayer');
const copyFromWindow = require('copyFromWindow');
const createArgumentsQueue = require('createArgumentsQueue');
const createQueue = require('createQueue');
const encodeUriComponent = require('encodeUriComponent');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const getUrl = require('getUrl');
const injectScript = require('injectScript');
const isConsentGranted = require('isConsentGranted');
const JSON = require('JSON');
const localStorage = require('localStorage');
const logToConsole = require('logToConsole');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const Object = require('Object');
const readTitle = require('readTitle');
const setInWindow = require('setInWindow');
const templateStorage = require('templateStorage');

const SNIPPET_BASE = 'https://static.zdassets.com/ekr/snippet.js?key=';
const SNIPPET_CACHE_TOKEN = 'zendesk-messaging-snippet';
// Event bridge (bridge/zendesk-gtm-bridge.js), pinned to the template version.
const BRIDGE_URL = 'https://cdn.jsdelivr.net/gh/pluscloud-nl/Zendesk-Web-SDK-for-Google-Tag-Manager@0.1.0/bridge/zendesk-gtm-bridge.js';
const BRIDGE_ON = 'zendeskGtmBridge.on';
const STATE_GLOBAL = '__gtmZendesk';
const EVENT_HANDLER_FUNCTION = 'zendeskGtm.onEvent';
const RTL_LANGUAGES = ['ar', 'arc', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku', 'ps', 'ur', 'yi'];

const DOCUMENTED_EVENTS = [
  'open', 'close', 'show', 'hide',
  'proactiveMessageDisplayed', 'proactiveMessageClicked',
  'conversationStarted', 'conversationOpened', 'newConversationButtonClicked', 'conversationClicked',
  'conversationWithAgentRequested', 'conversationAgentAssigned',
  'messagesShown', 'messageReceived', 'postbackButtonClicked',
  'conversationExtensionOpened', 'conversationExtensionDisplayed',
  'articleClicked', 'articleBrowserClicked', 'sourcesOpened', 'sourcesClosed',
  'unreadMessages'
];
const EXPERIMENTAL_EVENTS = ['preConversationShown', 'formShown', 'formSubmitted'];
// Zendesk passes its event objects as class instances. GTM's sandbox converts
// those to undefined (custom templates always use conversion mode 2), so
// listeners are registered through the event bridge, which passes plain
// copies. Without the bridge, events only carry their name. API responses and
// delegate messages are plain objects and arrive intact either way.
const EVENT_TYPES = { open: 'messagingOpened', close: 'messagingClosed', show: 'messagingShown', hide: 'messagingHidden' };
// messagesShown fires for every rendered batch of messages; opt-in only.
const NOISY_EVENTS = ['messagesShown'];

/* ------------------------------------------------------------------------ *
 * Generic helpers
 * ------------------------------------------------------------------------ */

const isSet = (value) => value !== undefined && value !== null && value !== '';

const str = (value) => (isSet(value) ? makeString(value) : '');

const trim = (value) => str(value).trim();

const triState = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const toNumber = (value) => {
  if (!isSet(value)) return undefined;
  const n = makeNumber(value);
  return n === n ? n : undefined; // NaN check without isNaN
};

const contains = (list, item) => list.indexOf(item) > -1;

const rows = (table) => (getType(table) === 'array' ? table : []);

const camelToSnake = (name) => {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const c = name.charAt(i);
    const lower = c.toLowerCase();
    out += c !== lower ? '_' + lower : c;
  }
  return out;
};

// Converts a table cell according to the selected type column.
const typedValue = (value, type) => {
  if (type === 'number') return toNumber(value);
  if (type === 'boolean') return value === true || str(value).toLowerCase() === 'true';
  if (type === 'string') return str(value);
  // auto: keep GTM variable output types (number/boolean) and plain strings
  const t = getType(value);
  if (t === 'number' || t === 'boolean') return value;
  return str(value);
};

// Builds a flat {key: value} object from a key/value/type table.
const tableToObject = (table) => {
  const out = {};
  let count = 0;
  rows(table).forEach((row) => {
    const key = trim(row.key);
    if (!key) return;
    const value = typedValue(row.value, row.type);
    if (value === undefined) return;
    out[key] = value;
    count++;
  });
  return count ? out : undefined;
};

const shallowCopy = (obj) => {
  const out = {};
  if (getType(obj) !== 'object') return out;
  Object.keys(obj).forEach((k) => { out[k] = obj[k]; });
  return out;
};

const deepMerge = (target, source) => {
  if (getType(source) !== 'object') return target;
  const out = shallowCopy(target);
  Object.keys(source).forEach((k) => {
    const value = source[k];
    if (getType(value) === 'object' && getType(out[k]) === 'object') {
      out[k] = deepMerge(out[k], value);
    } else {
      out[k] = value;
    }
  });
  return out;
};

// Removes undefined members recursively; returns undefined for empty objects.
const compact = (obj) => {
  if (getType(obj) !== 'object') return obj;
  const out = {};
  let count = 0;
  Object.keys(obj).forEach((k) => {
    const value = getType(obj[k]) === 'object' ? compact(obj[k]) : obj[k];
    if (value === undefined) return;
    out[k] = value;
    count++;
  });
  return count ? out : undefined;
};

const parseJson = (text, label) => {
  if (!trim(text)) return undefined;
  const parsed = JSON.parse(text);
  if (getType(parsed) !== 'object') {
    logError('Ignoring ' + label + ': not a valid JSON object.');
    return undefined;
  }
  return parsed;
};

/* ------------------------------------------------------------------------ *
 * Logging
 * ------------------------------------------------------------------------ */

const LOG_LEVEL = data.logLevel || 'errors';

const logInfo = (message, details) => {
  if (LOG_LEVEL !== 'verbose') return;
  if (details === undefined) logToConsole('[Zendesk GTM] ' + message);
  else logToConsole('[Zendesk GTM] ' + message, details);
};

const logError = (message, details) => {
  if (LOG_LEVEL === 'none') return;
  if (details === undefined) logToConsole('[Zendesk GTM] ERROR: ' + message);
  else logToConsole('[Zendesk GTM] ERROR: ' + message, details);
};

/* ------------------------------------------------------------------------ *
 * State (templateStorage is shared by every tag using this template)
 * ------------------------------------------------------------------------ */

const getState = () => {
  let state = templateStorage.getItem('state');
  if (getType(state) !== 'object') {
    state = {
      ready: false, version: undefined, isOpen: false, isShown: true, unreadCount: undefined,
      conversationId: undefined, conversationStatus: undefined,
      multiConvoEnabled: undefined, canUserCreateMoreConversations: undefined, launcherShape: undefined,
      cookies: undefined
    };
    templateStorage.setItem('state', state);
  }
  return state;
};

const updateState = (changes) => {
  const state = getState();
  Object.keys(changes).forEach((k) => { state[k] = changes[k]; });
  templateStorage.setItem('state', state);
  // Public, read-only mirror for the companion variable template and site code.
  setInWindowSafe(STATE_GLOBAL, shallowCopy(state));
};

const setInWindowSafe = (key, value) => setInWindow(key, value, true);

/* ------------------------------------------------------------------------ *
 * dataLayer
 * ------------------------------------------------------------------------ */

const dataLayerPush = createQueue('dataLayer');
const EVENT_PREFIX = isSet(data.eventPrefix) ? str(data.eventPrefix) : 'zendesk_messaging.';

// Every key is always present so that values of a previous event never leak
// into the next one through the recursive merge of the GTM data model.
const emptyEventModel = () => ({
  event_name: undefined, event_type: undefined, event_id: undefined, event_timestamp: undefined,
  conversation_id: undefined, conversation_status: undefined,
  message_id: undefined, message_role: undefined, message_source_type: undefined, message_received_at: undefined,
  messages_count: undefined,
  proactive_message_id: undefined, campaign_id: undefined,
  article_id: undefined, article_title: undefined, url: undefined,
  action_name: undefined, new_conversation_source: undefined, trigger: undefined,
  form_type: undefined, form_id: undefined, form_name: undefined,
  unread_count: undefined,
  api: undefined, error_type: undefined, error_reason: undefined, error_message: undefined,
  result: undefined, raw: undefined
});

const pushEvent = (name, fields) => {
  const model = emptyEventModel();
  model.event_name = name;
  Object.keys(fields || {}).forEach((k) => { model[k] = fields[k]; });
  const payload = { event: EVENT_PREFIX + camelToSnake(name), zendesk: model };
  logInfo('dataLayer.push ' + payload.event, payload);
  dataLayerPush(payload);
  if (data.forwardToHandler) {
    if (getType(copyFromWindow(EVENT_HANDLER_FUNCTION)) === 'function') {
      callInWindow(EVENT_HANDLER_FUNCTION, payload);
    }
  }
};

const pushApiResults = data.pushApiResults !== false;

// Zendesk passes `null` on success and an error class instance on failure.
// Class instances may not survive the sandbox boundary, so anything that is
// not exactly `null` (including `undefined`) is treated as a failure.
const isFailure = (error) => error !== null;

const reportError = (api, error) => {
  const e = getType(error) === 'object' ? error : {};
  logError(api + ' failed', error);
  if (!pushApiResults) return;
  pushEvent('error', {
    api: api,
    error_type: e.type || 'UnknownError',
    error_reason: e.reason,
    error_message: e.message
  });
};

const reportResult = (name, api, fields) => {
  if (!pushApiResults) return;
  const out = fields || {};
  out.api = api;
  pushEvent(name, out);
};

/* ------------------------------------------------------------------------ *
 * zE access
 * ------------------------------------------------------------------------ */

// Always resolve window.zE at call time: the snippet queue is replaced by the
// real API once the widget boots, so a cached reference would go stale.
const ze = (args) => {
  logInfo('zE(' + args.slice(0, 2).join(', ') + ')', args.slice(2));
  const n = args.length;
  if (n === 1) return callInWindow('zE', args[0]);
  if (n === 2) return callInWindow('zE', args[0], args[1]);
  if (n === 3) return callInWindow('zE', args[0], args[1], args[2]);
  if (n === 4) return callInWindow('zE', args[0], args[1], args[2], args[3]);
  return callInWindow('zE', args[0], args[1], args[2], args[3], args[4]);
};

const zeExists = () => getType(copyFromWindow('zE')) === 'function';

const snippetUrl = (key) => {
  const k = trim(key);
  // Host-based keys ("web_widget/<sub>.zendesk.com") must keep their slash.
  return SNIPPET_BASE + (k.indexOf('web_widget/') === 0 ? k : encodeUriComponent(k));
};

// Creates the same command queue as the official snippet. The snippet reads
// the key from `zE.s.src` when there is no <script id="ze-snippet"> (which GTM
// cannot create), and the widget only installs its API when zE === zEmbed.
const ensureQueue = (key) => {
  if (!zeExists()) {
    createArgumentsQueue('zE', 'zE._');
    aliasInWindow('zEmbed', 'zE');
    setInWindowSafe('zE.t', getTimestampMillis());
    templateStorage.setItem('ownQueue', true);
    logInfo('Created zE command queue');
  }
  if (isSet(key) && !isSet(copyFromWindow('zE.s'))) {
    setInWindowSafe('zE.s', { src: snippetUrl(key) });
  }
};

/* ------------------------------------------------------------------------ *
 * Configuration builders
 * ------------------------------------------------------------------------ */

const THEME_KEYS = [
  'primary', 'onPrimary', 'message', 'onMessage', 'action', 'onAction',
  'businessMessage', 'onBusinessMessage', 'background', 'onBackground',
  'conversationListBackground', 'onConversationListBackground',
  'error', 'onError', 'notify', 'onNotify', 'onSecondaryAction'
];

// Option path -> value kind. 'bool', [min, max] for numbers, or a list of
// accepted strings. Invalid values are skipped: Zendesk rejects the whole
// customization when a single value is invalid.
const CUSTOMIZATION_OPTIONS = {
  'common.hideHeader': 'bool',
  'common.contentScale': [50, 200],
  'conversationList.hideNewConversationButton': 'bool',
  'conversationList.hideHeader': 'bool',
  'conversationList.avatar.hidden': 'bool',
  'conversationList.avatar.size': [16, 64],
  'conversationList.hideTimestamp': 'bool',
  'conversationList.hideMessagePreview': 'bool',
  'conversationList.hideDivider': 'bool',
  'conversationList.groupByTimestamp': 'bool',
  'messageLog.hideHeader': 'bool',
  'messageLog.header.hideAvatar': 'bool',
  'messageLog.endConversationOption.position': ['auto', 'headerRight', 'overflowMenu'],
  'messageLog.avatar.hidden': 'bool',
  'messageLog.avatar.position': ['side', 'top', 'top-side'],
  'messageLog.avatar.size': [16, 64],
  'messageLog.businessMessage.bubbleMaxWidth': [10, 100],
  'messageLog.businessMessage.hideBubble': 'bool',
  'messageLog.userMessage.bubbleMaxWidth': [10, 100],
  'messageLog.userMessage.hideBubble': 'bool',
  'messageLog.citations.sources': ['button', 'bulletedList', 'numberedList'],
  'position.offset.web.horizontal': [0, 10000],
  'position.offset.web.vertical': [0, 10000],
  'position.offset.mobile.horizontal': [0, 10000],
  'position.offset.mobile.vertical': [0, 10000],
  'common.isHideButtonVisible': 'bool'
};
const EXPERIMENTAL_OPTIONS = ['common.isHideButtonVisible'];

const optionValue = (option, raw) => {
  const kind = CUSTOMIZATION_OPTIONS[option];
  if (kind === 'bool') return triState(str(raw).toLowerCase());
  if (getType(kind) !== 'array') return undefined;
  if (getType(kind[0]) === 'number') {
    const n = toNumber(raw);
    return n !== undefined && n >= kind[0] && n <= kind[1] ? n : undefined;
  }
  return contains(kind, str(raw)) ? str(raw) : undefined;
};

// Sets a dotted path such as "messageLog.avatar.size" on a nested object.
const setPath = (obj, path, value) => {
  const parts = path.split('.');
  let node = obj;
  parts.slice(0, -1).forEach((part) => {
    if (getType(node[part]) !== 'object') node[part] = {};
    node = node[part];
  });
  node[parts[parts.length - 1]] = value;
};

// GTM does not allow reading document.* from a template, so the automatic
// side follows the locale set in this tag.
const isRtl = () => contains(RTL_LANGUAGES, trim(data.locale).toLowerCase().split('-')[0].split('_')[0]);

const buildCustomization = () => {
  if (!data.customizationEnabled) return undefined;
  const custom = {};
  rows(data.themeColors).forEach((row) => {
    const color = trim(row.color);
    if (color && contains(THEME_KEYS, row.property)) setPath(custom, 'theme.' + row.property, color);
  });
  if (data.commonStylingPreset) setPath(custom, 'common.stylingPreset', data.commonStylingPreset);
  let side = data.posSide;
  if (side === 'auto') side = isRtl() ? 'left' : 'right';
  if (side) setPath(custom, 'position.side', side);
  rows(data.customizationOptions).forEach((row) => {
    const option = str(row.option);
    if (contains(EXPERIMENTAL_OPTIONS, option) && !data.experimentalEnabled) return;
    const value = optionValue(option, row.value);
    if (value === undefined) {
      logError('Skipping customization option ' + option + ': invalid value "' + str(row.value) + '"');
      return;
    }
    setPath(custom, option, value);
  });
  return compact(deepMerge(custom, parseJson(data.customizationJson, 'customization JSON')));
};

const buildBehavior = () => {
  const behavior = {
    composer: { focus: { suppressAutoFocus: triState(data.behSuppressAutoFocus) } },
    header: { logo: { altText: data.behLogoAltTextEnabled ? str(data.behLogoAltText) : undefined } }
  };
  if (data.experimentalEnabled && data.expPreConversationEnabled) {
    const settings = {};
    const prompts = [];
    rows(data.expPreConversationSettings).forEach((row) => {
      const value = trim(row.value);
      if (!value) return;
      if (row.setting === 'prompt') prompts.push(value);
      else settings[row.setting] = value;
    });
    if (prompts.length) settings.prompts = prompts;
    behavior.messageLog = { preConversation: { enabled: true, settings: settings } };
  }
  // compact() would drop an intentionally empty alt text, so restore it.
  const out = compact(behavior);
  if (data.behLogoAltTextEnabled && !str(data.behLogoAltText)) {
    const fixed = out || {};
    fixed.header = { logo: { altText: '' } };
    return fixed;
  }
  return out;
};

const buildTags = () => {
  const tags = [];
  rows(data.conversationTags).forEach((row) => {
    const tag = trim(row.tag);
    if (tag && !contains(tags, tag)) tags.push(tag);
  });
  if (tags.length > 20) logError('Zendesk accepts at most 20 conversation tags; extra tags are ignored by Zendesk.');
  return tags.length ? tags : undefined;
};

const buildFields = () => {
  const fields = [];
  rows(data.conversationFields).forEach((row) => {
    const id = trim(row.id);
    if (!id) return;
    const value = typedValue(row.value, row.type);
    if (value === undefined) return;
    fields.push({ id: id, value: value });
  });
  return fields.length ? fields : undefined;
};

/* ------------------------------------------------------------------------ *
 * Cookies & consent
 * ------------------------------------------------------------------------ */

const consentTypes = () => ({ functional: 'functionality_storage', analytics: 'analytics_storage' });

// Returns 'all' | 'functional' | 'none' | 'blocked' ('blocked' = do not load).
const cookieRangeFromConsent = () => {
  const types = consentTypes();
  if (!isConsentGranted(types.functional)) {
    const denied = data.consentDeniedBehavior || 'none';
    return denied === 'skip' ? 'blocked' : denied;
  }
  return isConsentGranted(types.analytics) ? 'all' : 'functional';
};

const currentCookieRange = () => {
  const mode = data.cookieMode || 'default';
  if (mode === 'consent') return cookieRangeFromConsent();
  if (mode === 'all' || mode === 'functional' || mode === 'none') return mode;
  return undefined;
};

const applyCookies = (range) => {
  if (!range || range === 'blocked') return;
  if (getState().cookies === range) return;
  ze(['messenger:set', 'cookies', range]);
  updateState({ cookies: range });
};

const watchConsent = (onGranted) => {
  if (data.cookieMode !== 'consent') return;
  if (templateStorage.getItem('consentListener')) {
    if (onGranted) templateStorage.setItem('pendingLoad', onGranted);
    return;
  }
  templateStorage.setItem('consentListener', true);
  if (onGranted) templateStorage.setItem('pendingLoad', onGranted);
  const types = consentTypes();
  const onChange = () => {
    const range = cookieRangeFromConsent();
    const pending = templateStorage.getItem('pendingLoad');
    if (range !== 'blocked' && getType(pending) === 'function') {
      templateStorage.removeItem('pendingLoad');
      pending();
      return;
    }
    if (zeExists()) {
      applyCookies(range === 'blocked' ? 'none' : range);
      pushEvent('consentUpdated', { result: range });
    }
  };
  addConsentListener(types.functional, onChange);
  addConsentListener(types.analytics, onChange);
};

/* ------------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------------ */

const normalizeEvent = (name, e) => {
  const evt = getType(e) === 'object' ? e : {};
  const p = getType(evt.payload) === 'object' ? evt.payload : {};
  const conv = getType(p.conversation) === 'object' ? p.conversation : {};
  const msg = getType(p.message) === 'object' ? p.message : {};
  const source = getType(msg.source) === 'object' ? msg.source : {};
  return {
    event_type: evt.type,
    event_id: evt.id,
    event_timestamp: evt.createdAt,
    conversation_id: conv.id,
    conversation_status: conv.status,
    message_id: msg.id,
    message_role: msg.role,
    message_source_type: source.type,
    message_received_at: msg.receivedAt,
    messages_count: getType(p.messages) === 'array' ? p.messages.length : undefined,
    proactive_message_id: p.proactiveMessageId,
    campaign_id: p.campaignId,
    article_id: p.articleId,
    article_title: p.articleTitle,
    url: p.url,
    action_name: p.actionName,
    new_conversation_source: p.newConversationSource,
    trigger: p.trigger,
    form_type: p.formType,
    form_id: p.id,
    form_name: p.name,
    raw: data.includeRawPayload ? evt : undefined
  };
};

const stateFromEvent = (name, fields) => {
  if (name === 'open') updateState({ isOpen: true });
  else if (name === 'close') updateState({ isOpen: false });
  else if (name === 'show') updateState({ isShown: true });
  else if (name === 'hide') updateState({ isShown: false, isOpen: false });
  if (fields.conversation_id) {
    updateState({ conversationId: fields.conversation_id });
    if (fields.conversation_status) updateState({ conversationStatus: fields.conversation_status });
  }
};

const selectedEvents = () => {
  if (data.trackEvents === false) return [];
  const mode = data.eventSelection || 'recommended';
  const list = [];
  const chosen = rows(data.eventList).map((row) => row.event);
  DOCUMENTED_EVENTS.forEach((name) => {
    if (mode === 'all') list.push(name);
    else if (mode === 'recommended' && !contains(NOISY_EVENTS, name)) list.push(name);
    else if (mode === 'custom' && contains(chosen, name)) list.push(name);
  });
  if (data.experimentalEnabled) {
    EXPERIMENTAL_EVENTS.forEach((name) => {
      if (contains(chosen, name)) list.push(name);
    });
  }
  return list;
};

const bridgeReady = () => getType(copyFromWindow(BRIDGE_ON)) === 'function';

const listen = (name, handler) => (bridgeReady()
  ? callInWindow(BRIDGE_ON, name, handler)
  : ze(['messenger:on', name, handler]));

// Runs `callback` once the event bridge is available (or failed to load).
// With the "gtm" source a Custom HTML tag provides the bridge; it must run
// before this tag (tag sequencing).
const withBridge = (callback) => {
  const source = data.bridgeSource || 'gtm';
  if (source !== 'cdn' || data.trackEvents === false || bridgeReady()) {
    if (source === 'gtm' && data.trackEvents !== false && !bridgeReady()) {
      logError('Event bridge not found: add the Custom HTML bridge tag as setup tag of this tag. Events only contain their name.');
    }
    callback();
    return;
  }
  const pending = templateStorage.getItem('bridgeCallbacks') || [];
  pending.push(callback);
  templateStorage.setItem('bridgeCallbacks', pending);
  if (templateStorage.getItem('bridgeRequested')) return;
  templateStorage.setItem('bridgeRequested', true);
  const flush = () => {
    const callbacks = templateStorage.getItem('bridgeCallbacks') || [];
    templateStorage.setItem('bridgeCallbacks', []);
    callbacks.forEach((cb) => cb());
  };
  injectScript(BRIDGE_URL, flush, () => {
    logError('Could not load the event bridge (' + BRIDGE_URL + '); events will only contain their name.');
    flush();
  }, 'zendesk-gtm-bridge');
};

// templateStorage 'listeners' maps event name -> 'push' | 'state'. A listener
// is registered with Zendesk only once per page; later setup tags can upgrade
// a state-only listener to 'push' because handlers read the mode at runtime.
const listenerMode = (name) => (templateStorage.getItem('listeners') || {})[name];

const registerEvents = () => withBridge(() => {
  const modes = templateStorage.getItem('listeners') || {};
  // State tracking needs these even when they are not pushed to the dataLayer.
  const selected = selectedEvents();
  const wanted = selected.slice();
  ['open', 'close', 'show', 'hide', 'conversationStarted', 'conversationOpened', 'unreadMessages']
    .forEach((name) => { if (!contains(wanted, name)) wanted.push(name); });

  wanted.forEach((name) => {
    const mode = contains(selected, name) ? 'push' : 'state';
    if (modes[name]) {
      if (mode === 'push') modes[name] = 'push';
      return;
    }
    modes[name] = mode;
    if (name === 'unreadMessages') {
      listen(name, (count) => {
        const n = toNumber(count);
        if (n === getState().unreadCount) return; // Zendesk repeats identical counts
        updateState({ unreadCount: n });
        if (listenerMode(name) === 'push') pushEvent(name, { unread_count: n });
      });
      return;
    }
    listen(name, (e) => {
      const evt = getType(e) === 'object' ? e : { type: EVENT_TYPES[name] || name };
      const fields = normalizeEvent(name, evt);
      stateFromEvent(name, fields);
      if (listenerMode(name) === 'push') pushEvent(name, fields);
    });
  });
  templateStorage.setItem('listeners', modes);
});

const registerReadyHook = () => {
  if (templateStorage.getItem('readyHook')) return;
  templateStorage.setItem('readyHook', true);
  ze([() => {
    const version = copyFromWindow('zE.version');
    updateState({ ready: true, version: version });
    ze(['messenger:get', 'config', (config) => {
      const c = getType(config) === 'object' ? config : {};
      updateState({
        multiConvoEnabled: c.multiConvoEnabled,
        canUserCreateMoreConversations: c.canUserCreateMoreConversations,
        launcherShape: c.launcherShape
      });
      if (data.trackEvents !== false) pushEvent('ready', { result: { version: version, config: c } });
    }]);
  }]);
};

/* ------------------------------------------------------------------------ *
 * Delegates
 * ------------------------------------------------------------------------ */

const replaceDelegate = (name, fn) => {
  const previous = templateStorage.getItem('delegate:' + name);
  if (getType(previous) === 'function') previous();
  const unsubscribe = ze(['messenger:set', name, fn]);
  templateStorage.setItem('delegate:' + name, unsubscribe);
};

const registerDelegates = () => {
  if (data.beforeSentEnabled) {
    const metaRows = rows(data.beforeSentMetadata);
    const pageContext = data.beforeSentPageContext;
    replaceDelegate('beforeMessageSent', (message) => {
      const msg = getType(message) === 'object' ? message : {};
      const metadata = shallowCopy(msg.metadata);
      metaRows.forEach((row) => {
        const key = trim(row.key);
        if (!key) return;
        const raw = row.source === 'dataLayer' ? copyFromDataLayer(str(row.value)) : row.value;
        const value = typedValue(raw, row.type || 'auto');
        if (value !== undefined && value !== '') metadata[key] = value;
      });
      if (pageContext) {
        metadata.page_url = getUrl();
        metadata.page_title = readTitle();
      }
      const out = shallowCopy(msg);
      out.metadata = metadata;
      return out;
    });
  }
  if (data.beforeDisplayEnabled) {
    const hideRules = rows(data.hideRules);
    const nameMap = rows(data.displayNameMap);
    replaceDelegate('beforeMessageDisplay', (message) => {
      const msg = getType(message) === 'object' ? message : {};
      const metadata = getType(msg.metadata) === 'object' ? msg.metadata : {};
      const hidden = hideRules.some((rule) => {
        const key = trim(rule.key);
        if (!key || !isSet(metadata[key])) return false;
        const expected = str(rule.value);
        return !expected || str(metadata[key]) === expected;
      });
      if (hidden) return null;
      const author = getType(msg.author) === 'object' ? msg.author : {};
      const match = nameMap.filter((row) => str(row.from) === str(author.displayName))[0];
      if (!match) return undefined;
      const out = shallowCopy(msg);
      out.author = { displayName: str(match.to) };
      return out;
    });
  }
};

/* ------------------------------------------------------------------------ *
 * Setup: configuration
 * ------------------------------------------------------------------------ */

const applyContext = (context) => {
  if (context.tags) ze(['messenger:set', 'conversationTags', context.tags]);
  if (context.fields) {
    ze(['messenger:set', 'conversationFields', context.fields, () => {
      logInfo('Conversation fields applied');
    }]);
  }
  if (context.conversationMetadata) ze(['messenger:set', 'conversationMetadata', context.conversationMetadata]);
};

const applyConfiguration = (cookieRange) => {
  applyCookies(cookieRange);

  const locale = trim(data.locale);
  if (locale) ze(['messenger:set', 'locale', locale]);

  const zIndex = toNumber(data.zIndex);
  if (zIndex !== undefined) ze(['messenger:set', 'zIndex', zIndex]);

  const customization = buildCustomization();
  if (customization) ze(['messenger:set', 'customization', customization]);

  const behavior = buildBehavior();
  if (behavior) ze(['messenger:set', 'behavior', behavior]);

  const context = {
    tags: buildTags(),
    fields: buildFields(),
    conversationMetadata: tableToObject(data.conversationMetadata)
  };
  applyContext(context);
  // Remembered so the reset command can re-apply it (Zendesk clears it).
  templateStorage.setItem('context', context);

  const userMetadata = tableToObject(data.userMetadata);
  if (userMetadata) ze(['messenger:set', 'userMetadata', userMetadata]);

  const user = tableToObject(data.updateUser);
  if (user) ze(['messenger', 'updateUser', user]);

  registerDelegates();
};

/* ------------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------------ */

const buildRenderConfig = () => {
  const config = { mode: 'embedded' };
  const target = (name) => trim(data['setupRender' + name]);
  if (target('WidgetTarget')) config.widget = { targetElement: target('WidgetTarget') };
  if (target('ListTarget')) config.conversationList = { targetElement: target('ListTarget') };
  if (target('LogTarget')) config.messageLog = { targetElement: target('LogTarget') };
  if (target('SourcesTarget')) {
    config.sources = { targetElement: target('SourcesTarget'), eventOnly: data.setupRenderSourcesEventOnly === true };
  }
  // Without any container Zendesk renders the floating widget instead.
  return config.widget || config.conversationList || config.messageLog ? config : { mode: 'floating' };
};

const render = (config) => {
  ze(['messenger', 'render', config, (error) => {
    if (isFailure(error)) reportError('render', error);
    else reportResult('rendered', 'render', { result: config.mode });
  }]);
};

/* ------------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------------ */

const loadWidget = (cookieRange) => {
  const renderMode = data.renderMode || 'floating';
  if (renderMode !== 'floating') setInWindowSafe('zEMessenger', { autorender: false });
  if (data.disableErrorReporting) setInWindowSafe('zESettings', { errorReporting: false });
  if (data.experimentalEnabled && data.expZdDebug) localStorage.setItem('ZD-debug', 'true');

  const loadMode = data.loadMode || 'auto';
  // A queue created by an earlier command tag of this template is not a snippet.
  const alreadyPresent = (zeExists() && !templateStorage.getItem('ownQueue')) || copyFromWindow('zEACLoaded') === true;
  const inject = loadMode === 'load' || (loadMode === 'auto' && !alreadyPresent);
  if (loadMode === 'load' && alreadyPresent && !templateStorage.getItem('injected')) {
    logError('A Zendesk snippet seems to be present already. Loading a second snippet can load the wrong brand; consider the "Use existing snippet" load mode.');
  }

  ensureQueue(inject ? data.snippetKey : undefined);
  registerReadyHook();
  applyConfiguration(cookieRange);
  registerEvents(); // with tracking off this only registers state listeners


  if (renderMode !== 'floating') templateStorage.setItem('renderConfig', buildRenderConfig());
  if (renderMode === 'embedded') render(buildRenderConfig());

  const visibility = data.initialVisibility || 'default';
  if (visibility === 'hide') ze(['messenger', 'hide']);
  else if (visibility === 'close') ze(['messenger', 'close']);
  else if (visibility === 'open') ze(['messenger', 'open']);

  if (!inject) {
    logInfo('Using the Zendesk snippet that is already on the page');
    return;
  }
  if (templateStorage.getItem('injected')) return;
  templateStorage.setItem('injected', true);
  const url = snippetUrl(data.snippetKey);
  injectScript(url, () => {
    logInfo('Zendesk snippet loaded');
  }, () => {
    templateStorage.removeItem('injected');
    reportError('loadSnippet', { type: 'LoadError', reason: 'ScriptLoadFailed', message: 'Could not load ' + url });
  }, SNIPPET_CACHE_TOKEN);
};

const runSetup = () => {
  if (!data.loadSnippet) {
    // Configuration-only mode for a widget that is (being) loaded elsewhere.
    ensureQueue();
    applyConfiguration(currentCookieRange());
    registerEvents();
    watchConsent();
    return;
  }
  const range = currentCookieRange();
  if (range === 'blocked') {
    if (data.waitForConsent) {
      logInfo('Waiting for consent before loading the Zendesk widget');
      watchConsent(() => loadWidget(currentCookieRange()));
    } else {
      logInfo('Consent denied: the Zendesk widget is not loaded');
    }
    return;
  }
  loadWidget(range);
  watchConsent();
};

/* ------------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------------ */

const conversationOptions = (programmatic) => {
  const options = compact({
    displayName: trim(data.convDisplayName) || undefined,
    description: programmatic ? trim(data.convDescription) || undefined : undefined,
    iconUrl: trim(data.convIconUrl) || undefined,
    metadata: tableToObject(data.convMetadata)
  }) || {};
  const text = trim(data.convMessageText);
  if (text) {
    options.message = { content: { type: 'text', text: text } };
    // messenger:ui newConversation ignores message metadata.
    const messageMetadata = programmatic ? tableToObject(data.convMessageMetadata) : undefined;
    if (messageMetadata) options.message.metadata = messageMetadata;
  }
  return options;
};

const reapplyContext = () => {
  const context = templateStorage.getItem('context');
  if (getType(context) === 'object') applyContext(context);
};

const fetchConversations = (offset, all, collected) => {
  ze(['messenger', 'fetchConversations', offset, (error, response) => {
    if (getType(response) !== 'object') {
      reportError('fetchConversations', error);
      return;
    }
    const list = collected.concat(getType(response.data) === 'array' ? response.data : []);
    if (all && response.hasMore && list.length < 100) {
      fetchConversations(offset + 10, all, list);
      return;
    }
    reportResult('conversationsFetched', 'fetchConversations', {
      result: { conversations: list, count: list.length, hasMore: response.hasMore === true }
    });
  }]);
};

const resolveConversationId = () => {
  if (data.sendTarget === 'current') return getState().conversationId;
  return trim(data.sendConversationId);
};

const COMMANDS = {
  open: () => {
    if (data.showBeforeOpen) ze(['messenger', 'show']);
    ze(['messenger', 'open']);
  },
  close: () => ze(['messenger', 'close']),
  show: () => ze(['messenger', 'show']),
  hide: () => ze(['messenger', 'hide']),
  toggle: () => {
    if (getState().isOpen) {
      ze(['messenger', 'close']);
    } else {
      if (data.showBeforeOpen) ze(['messenger', 'show']);
      ze(['messenger', 'open']);
    }
  },
  voice: () => ze(['messenger:open', 'voice', trim(data.voiceLineId)]),
  resetWidget: () => {
    ze(['messenger', 'resetWidget', () => {
      updateState({ conversationId: undefined, conversationStatus: undefined, unreadCount: undefined });
      reapplyContext();
      reportResult('widgetReset', 'resetWidget');
    }]);
  },
  navigation: () => {
    const config = { screen: data.navScreen || 'ConversationList' };
    if (config.screen === 'Conversation') config.options = { conversationId: trim(data.navConversationId) };
    ze(['messenger:ui', 'navigation', config]);
    if (data.openAfterNav) ze(['messenger', 'open']);
  },
  newConversation: () => {
    if (data.convMode !== 'programmatic') {
      ze(['messenger:ui', 'newConversation', conversationOptions(false), (error) => {
        if (isFailure(error)) reportError('newConversation', error);
        else reportResult('conversationCreated', 'messenger:ui.newConversation');
      }]);
      if (data.openAfterConv) ze(['messenger', 'open']);
      return;
    }
    ze(['messenger', 'newConversation', conversationOptions(true), (error, conversation) => {
      if (getType(conversation) !== 'object') {
        reportError('newConversation', error);
        return;
      }
      updateState({ conversationId: conversation.id, conversationStatus: conversation.status });
      reportResult('conversationCreated', 'newConversation', {
        conversation_id: conversation.id,
        conversation_status: conversation.status,
        result: conversation
      });
      if (data.navigateAfter) {
        ze(['messenger:ui', 'navigation', { screen: 'Conversation', options: { conversationId: conversation.id } }]);
      }
      if (data.openAfterConv) ze(['messenger', 'open']);
    }]);
  },
  sendMessage: () => {
    const conversationId = resolveConversationId();
    if (!conversationId) {
      reportError('sendMessage', { type: 'SendMessageError', reason: 'Invalid conversationId', message: 'No conversation id available' });
      return;
    }
    const message = { content: { type: 'text', text: str(data.sendText) } };
    const metadata = tableToObject(data.sendMetadata);
    if (metadata) message.metadata = metadata;
    ze(['messenger', 'sendMessage', message, conversationId, (error, result) => {
      if (getType(result) !== 'object') {
        reportError('sendMessage', error);
        return;
      }
      reportResult('messageSent', 'sendMessage', { conversation_id: conversationId, message_id: result.id, result: result });
    }]);
  },
  fetchConversations: () => fetchConversations(toNumber(data.fetchOffset) || 0, data.fetchAll === true, []),
  getConfig: () => {
    ze(['messenger:get', 'config', (config) => {
      const c = getType(config) === 'object' ? config : {};
      updateState({
        multiConvoEnabled: c.multiConvoEnabled,
        canUserCreateMoreConversations: c.canUserCreateMoreConversations,
        launcherShape: c.launcherShape
      });
      reportResult('configLoaded', 'messenger:get.config', { result: c });
    }]);
  },
  updateUser: () => {
    const user = tableToObject(data.cmdUserData);
    if (user) ze(['messenger', 'updateUser', user, () => reportResult('userUpdated', 'updateUser')]);
  },
  setLocale: () => ze(['messenger:set', 'locale', trim(data.cmdLocale)]),
  setCookies: () => {
    const range = data.cmdCookies || 'all';
    ze(['messenger:set', 'cookies', range]);
    updateState({ cookies: range });
  },
  render: () => {
    const config = templateStorage.getItem('renderConfig');
    render(getType(config) === 'object' ? config : { mode: 'floating' });
  },
  preConversation: () => {
    ze(['messenger:ui', 'preConversation', {}, (error) => {
      if (isFailure(error)) reportError('preConversation', error);
    }]);
    ze(['messenger', 'open']);
  },
  typingIndicator: () => {
    ze(['messenger:set', 'typingIndicator', compact({ name: trim(data.typingName) || undefined }) || {}]);
  }
};

const runCommand = () => {
  const command = data.command || 'open';
  const handler = COMMANDS[command];
  if (getType(handler) !== 'function') {
    logError('Unknown command: ' + command);
    return;
  }
  // Commands may run before the setup tag; the queue keeps their order.
  ensureQueue();
  handler();
};

/* ------------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------------ */

if (data.tagType === 'command') runCommand();
else runSetup();

data.gtmOnSuccess();
