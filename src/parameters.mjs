// Source of ___TEMPLATE_PARAMETERS___.
// - GTM allows at most 100 fields per template; groups and labels count too.
//   `npm run build` fails above MAX_FIELDS. Long lists (theme colors,
//   customization options, events) are therefore tables with a select column.
// - Every enabling condition depends on a single parameter, because GTM
//   combines multiple conditions with AND only.

export const MAX_FIELDS = 100;

const when = (paramName, paramValue, type = 'EQUALS') => ({ enablingConditions: [{ paramName, paramValue, type }] });

const text = (name, displayName, extra = {}) => ({ type: 'TEXT', name, displayName, simpleValueType: true, ...extra });
const checkbox = (name, checkboxText, defaultValue = false, extra = {}) => ({ type: 'CHECKBOX', name, checkboxText, simpleValueType: true, defaultValue, ...extra });
const items = (list) => list.map(([value, displayValue]) => ({ value, displayValue }));
const select = (name, displayName, list, defaultValue, extra = {}) => ({
  type: 'SELECT', name, displayName, macrosInSelect: false, simpleValueType: true,
  selectItems: items(list), defaultValue, ...extra
});
const group = (name, displayName, subParams, extra = {}) => ({ type: 'GROUP', name, displayName, groupStyle: 'ZIPPY_CLOSED', subParams, ...extra });
const table = (name, displayName, columns, extra = {}) => ({ type: 'SIMPLE_TABLE', name, displayName, simpleTableColumns: columns, newRowButtonText: 'Add row', ...extra });
const column = (name, displayName, extra = {}) => ({ defaultValue: '', displayName, name, type: 'TEXT', ...extra });
const selectColumn = (name, displayName, list, defaultValue) => ({ defaultValue, displayName, name, type: 'SELECT', selectItems: items(list) });

const regex = (pattern, errorMessage) => ({ type: 'REGEX', args: [pattern], errorMessage });
// BETWEEN rejects empty values, so numeric fields use a regex; an empty field
// keeps the Admin Center / widget default.
const optionalNumber = regex('^(|\\{\\{.+\\}\\}|\\d+(\\.\\d+)?)$', 'Enter a number, or leave empty.');

const TYPES = [['auto', 'Auto'], ['string', 'String'], ['number', 'Number'], ['boolean', 'Boolean']];
const kvTable = (name, displayName, help) => table(name, displayName, [
  column('key', 'Key', { isUnique: true, valueValidators: [{ type: 'NON_EMPTY' }] }),
  column('value', 'Value'),
  selectColumn('type', 'Type', TYPES, 'auto')
], { help });

const COLOR = regex('^(\\{\\{.+\\}\\}|#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\\([^)]*\\)|[a-zA-Z]+)$',
  'Enter a valid CSS color (hex, rgb(), rgba(), hsl(), hsla() or a named color). Invalid colors make Zendesk reject the whole customization.');
const URL = regex('^(|\\{\\{.+\\}\\}|https?://.+)$', 'Enter an absolute http(s) URL.');
const SELECTOR_HELP = 'CSS selector or element id of an element that already exists in the DOM when the tag fires, for example <code>#zendesk-container</code>.';

export const THEME_COLORS = [
  ['primary', 'primary – launcher, header, key UI'],
  ['onPrimary', 'onPrimary – text/icons on primary'],
  ['message', 'message – end user bubble'],
  ['onMessage', 'onMessage – text in end user bubble'],
  ['businessMessage', 'businessMessage – agent / AI agent bubble'],
  ['onBusinessMessage', 'onBusinessMessage – text in agent bubble'],
  ['action', 'action – action buttons'],
  ['onAction', 'onAction – text/icons on action'],
  ['onSecondaryAction', 'onSecondaryAction – Cancel / Back buttons'],
  ['background', 'background – widget background'],
  ['onBackground', 'onBackground – text/icons on background'],
  ['conversationListBackground', 'conversationListBackground'],
  ['onConversationListBackground', 'onConversationListBackground'],
  ['error', 'error – failed messages'],
  ['onError', 'onError – text/icons on error'],
  ['notify', 'notify – notification banners'],
  ['onNotify', 'onNotify – text/icons on notify']
];

// Customization options without a dedicated field. The sandbox validates the
// value per option and skips invalid ones (Zendesk would reject everything).
export const CUSTOMIZATION_OPTIONS = [
  ['common.hideHeader', 'common.hideHeader (true/false)'],
  ['common.contentScale', 'common.contentScale (50–200, default 100)'],
  ['conversationList.hideNewConversationButton', 'conversationList.hideNewConversationButton (true/false)'],
  ['conversationList.hideHeader', 'conversationList.hideHeader (true/false)'],
  ['conversationList.avatar.hidden', 'conversationList.avatar.hidden (true/false)'],
  ['conversationList.avatar.size', 'conversationList.avatar.size (16–64)'],
  ['conversationList.hideTimestamp', 'conversationList.hideTimestamp (true/false)'],
  ['conversationList.hideMessagePreview', 'conversationList.hideMessagePreview (true/false)'],
  ['conversationList.hideDivider', 'conversationList.hideDivider (true/false)'],
  ['conversationList.groupByTimestamp', 'conversationList.groupByTimestamp (true/false)'],
  ['messageLog.hideHeader', 'messageLog.hideHeader (true/false)'],
  ['messageLog.header.hideAvatar', 'messageLog.header.hideAvatar (true/false)'],
  ['messageLog.endConversationOption.position', 'messageLog.endConversationOption.position (auto/headerRight/overflowMenu)'],
  ['messageLog.avatar.hidden', 'messageLog.avatar.hidden (true/false)'],
  ['messageLog.avatar.position', 'messageLog.avatar.position (side/top/top-side)'],
  ['messageLog.avatar.size', 'messageLog.avatar.size (16–64)'],
  ['messageLog.businessMessage.bubbleMaxWidth', 'messageLog.businessMessage.bubbleMaxWidth (10–100 %)'],
  ['messageLog.businessMessage.hideBubble', 'messageLog.businessMessage.hideBubble (true/false)'],
  ['messageLog.userMessage.bubbleMaxWidth', 'messageLog.userMessage.bubbleMaxWidth (10–100 %)'],
  ['messageLog.userMessage.hideBubble', 'messageLog.userMessage.hideBubble (true/false)'],
  ['messageLog.citations.sources', 'messageLog.citations.sources (button/bulletedList/numberedList)'],
  ['position.offset.web.horizontal', 'position.offset.web.horizontal (px)'],
  ['position.offset.web.vertical', 'position.offset.web.vertical (px)'],
  ['position.offset.mobile.horizontal', 'position.offset.mobile.horizontal (px)'],
  ['position.offset.mobile.vertical', 'position.offset.mobile.vertical (px)'],
  ['common.isHideButtonVisible', 'Experimental: common.isHideButtonVisible (true/false)']
];

export const EVENT_OPTIONS = [
  ['open', 'open'], ['close', 'close'], ['show', 'show'], ['hide', 'hide'],
  ['proactiveMessageDisplayed', 'proactiveMessageDisplayed'], ['proactiveMessageClicked', 'proactiveMessageClicked'],
  ['conversationStarted', 'conversationStarted'], ['conversationOpened', 'conversationOpened'],
  ['newConversationButtonClicked', 'newConversationButtonClicked'], ['conversationClicked', 'conversationClicked'],
  ['conversationWithAgentRequested', 'conversationWithAgentRequested'], ['conversationAgentAssigned', 'conversationAgentAssigned'],
  ['messagesShown', 'messagesShown (every rendered batch)'], ['messageReceived', 'messageReceived'],
  ['postbackButtonClicked', 'postbackButtonClicked'],
  ['conversationExtensionOpened', 'conversationExtensionOpened'], ['conversationExtensionDisplayed', 'conversationExtensionDisplayed'],
  ['articleClicked', 'articleClicked'], ['articleBrowserClicked', 'articleBrowserClicked'],
  ['sourcesOpened', 'sourcesOpened'], ['sourcesClosed', 'sourcesClosed'],
  ['unreadMessages', 'unreadMessages (only on change)'],
  ['preConversationShown', 'Experimental: preConversationShown'],
  ['formShown', 'Experimental: formShown'],
  ['formSubmitted', 'Experimental: formSubmitted']
];

/* ------------------------------------------------------------------------ */

const tagType = {
  type: 'RADIO', name: 'tagType', displayName: 'Tag type', simpleValueType: true, defaultValue: 'setup',
  radioItems: [
    { value: 'setup', displayValue: 'Setup – load and configure the Web Widget', help: 'Fire once per page, for example on Initialization or Consent Initialization.' },
    { value: 'command', displayValue: 'Command – run one Web Widget action', help: 'Fire on clicks or custom events. Commands fired before the widget has loaded are queued.' }
  ]
};

/* ----------------------------- Setup ------------------------------------ */

const setupLoading = group('grpLoading', 'Loading and rendering', [
  checkbox('loadSnippet', 'Load the Zendesk Web Widget', true, {
    help: 'Uncheck to only apply the configuration below, for example on a page where another tag or the site loads the widget.'
  }),
  text('snippetKey', 'Web Widget key', {
    help: 'Admin Center → Channels → Messaging and social → Messaging → your Web Widget → Installation: the value after <code>?key=</code>. A host key such as <code>web_widget/yoursubdomain.zendesk.com</code> also works.',
    valueHint: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    alwaysInSummary: true,
    valueValidators: [
      { type: 'NON_EMPTY', enablingConditions: [{ paramName: 'loadSnippet', paramValue: true, type: 'EQUALS' }] },
      regex('^(\\{\\{.+\\}\\}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|web_widget/[a-zA-Z0-9.-]+|)$', 'Enter the UUID key from the Zendesk snippet, a web_widget/<host> key, or a variable.')
    ],
    ...when('loadSnippet', true)
  }),
  select('loadMode', 'Load mode', [
    ['auto', 'Automatic – load unless a Zendesk snippet is already on the page (recommended)'],
    ['load', 'Always load the snippet from this tag'],
    ['existing', 'Never load – use the snippet that is already on the page']
  ], 'auto', {
    help: 'Event details (conversation id, message role, …) need the queue this template creates, so they are only complete when this tag runs before any site snippet.',
    ...when('loadSnippet', true)
  }),
  select('renderMode', 'Render mode', [
    ['floating', 'Floating (launcher in the corner)'],
    ['embedded', 'Embedded in page containers'],
    ['deferred', 'Deferred – render later with a "Render" command tag']
  ], 'floating', {
    help: 'Embedded and deferred set <code>window.zEMessenger = { autorender: false }</code> before loading. Containers must exist when the render runs: use a DOM Ready trigger, or Deferred plus a Render command on an Element Visibility trigger. Do not mix floating and embedded mode on one page. The containers below are also used by the Render command.',
    ...when('loadSnippet', true)
  }),
  text('setupRenderWidgetTarget', 'Full widget container', { help: SELECTOR_HELP, valueHint: '#zendesk-container', ...when('renderMode', 'floating', 'NOT_EQUALS') }),
  text('setupRenderListTarget', 'Conversation list container', { help: 'Optional. Combine with a message log container for a split view.', ...when('renderMode', 'floating', 'NOT_EQUALS') }),
  text('setupRenderLogTarget', 'Message log container', { help: 'Optional.', ...when('renderMode', 'floating', 'NOT_EQUALS') }),
  text('setupRenderSourcesTarget', 'Cited sources container', { help: 'Optional. AI agent sources open in this container instead of a modal. Cannot be the only container.', ...when('renderMode', 'floating', 'NOT_EQUALS') }),
  checkbox('setupRenderSourcesEventOnly', 'Sources close button only fires sourcesClosed (the page hides the container)', false, when('renderMode', 'floating', 'NOT_EQUALS')),
  select('initialVisibility', 'On page load', [
    ['default', 'Use the widget default'],
    ['close', 'Keep the messaging window closed'],
    ['open', 'Open the messaging window'],
    ['hide', 'Hide the widget completely (custom launcher)']
  ], 'default', when('loadSnippet', true)),
  checkbox('disableErrorReporting', 'Disable the snippet’s error reporting to Zendesk (zESettings.errorReporting = false)', false, when('loadSnippet', true))
]);

const setupGeneral = group('grpGeneral', 'Language and stacking', [
  text('locale', 'Locale', {
    help: 'Overrides the browser language, for example <code>nl</code>, <code>en-US</code> or <code>pt-BR</code>. See <a href="https://support.zendesk.com/api/v2/locales/public.json">supported locales</a>.',
    valueHint: 'en-US',
    valueValidators: [regex('^(|\\{\\{.+\\}\\}|[a-zA-Z]{2,3}([-_][a-zA-Z0-9]{2,8})*)$', 'Enter a locale code such as en-US.')]
  }),
  text('zIndex', 'z-index', { help: 'CSS z-index of all widget iframes. Zendesk default: 999999.', valueValidators: [regex('^(|\\{\\{.+\\}\\}|-?\\d+)$', 'Enter a whole number.')] })
]);

const setupConsent = group('grpConsent', 'Cookies and consent', [
  select('cookieMode', 'Cookie usage', [
    ['default', 'Widget default (essential, functional and analytics)'],
    ['all', 'All cookies'],
    ['functional', 'Functional only (no analytics)'],
    ['none', 'None (hides the widget and clears its storage)'],
    ['consent', 'Follow Google Consent Mode']
  ], 'default', {
    help: 'Consent Mode: <code>functionality_storage</code> granted → functional, plus <code>analytics_storage</code> granted → all. Updates are applied live. Analytics cookies power "Pages viewed" and proactive message analytics.'
  }),
  select('consentDeniedBehavior', 'When functionality_storage is denied', [
    ['none', 'Load the widget with cookies "none" (widget hidden)'],
    ['skip', 'Do not load the widget'],
    ['functional', 'Load the widget with functional cookies anyway']
  ], 'none', when('cookieMode', 'consent')),
  checkbox('waitForConsent', 'If the widget was not loaded because of denied consent, load it once consent is granted', true, when('cookieMode', 'consent'))
]);

const setupContext = group('grpContext', 'Conversation and user context', [
  table('conversationTags', 'Conversation tags', [column('tag', 'Tag')], {
    help: 'Added to the ticket when it is created. Zendesk lowercases tags, replaces spaces with underscores and accepts at most 20. Requires Messaging Metadata (conversationTicketMetadata).'
  }),
  table('conversationFields', 'Conversation fields (custom ticket fields)', [
    column('id', 'Ticket field ID', { valueValidators: [{ type: 'NON_EMPTY' }] }),
    column('value', 'Value'),
    selectColumn('type', 'Type', TYPES, 'auto')
  ], {
    help: 'The field must be editable by end users. Checkbox → Boolean, drop-down → exact option tag, multi-select → comma-separated tags, date → YYYY-MM-DD. Applied when a conversation starts or a message is sent from this page.'
  }),
  kvTable('conversationMetadata', 'Conversation metadata', 'Free-form key/value pairs for the next conversation or message (max 4 KB). Not shown as ticket fields.'),
  kvTable('userMetadata', 'User metadata (on user creation)', 'Stored on the Sunshine Conversations user when it is first created.'),
  kvTable('updateUser', 'Update user', 'Partially updates the current user (updateUser). All rows are sent as one object.')
]);

const setupCustomization = group('grpCustomization', 'Appearance (Customization API)', [
  checkbox('customizationEnabled', 'Override the Admin Center appearance on pages where this tag fires', false, {
    help: 'Only filled-in options are sent. One invalid value makes Zendesk reject the whole customization, so invalid table values are skipped.'
  }),
  table('themeColors', 'Theme colors', [
    selectColumn('property', 'Property', THEME_COLORS, 'primary'),
    column('color', 'Color', { valueValidators: [COLOR] })
  ], { help: 'Any CSS color, for example <code>#1F73B7</code>. Unsupported elements: wait time banner, forms, settings menus, carousels.', ...when('customizationEnabled', true) }),
  select('commonStylingPreset', 'Styling preset', [['', 'Default'], ['default', 'default'], ['minimalistic', 'minimalistic – compact chat style']], '', when('customizationEnabled', true)),
  select('posSide', 'Position', [['', 'Default'], ['right', 'Right'], ['left', 'Left'], ['auto', 'Automatic – left for right-to-left locales (uses the Locale field)']], '', when('customizationEnabled', true)),
  table('customizationOptions', 'More options', [
    selectColumn('option', 'Option', CUSTOMIZATION_OPTIONS, 'conversationList.hideNewConversationButton'),
    column('value', 'Value')
  ], { help: 'Use true/false for switches and numbers for sizes.', ...when('customizationEnabled', true) }),
  text('customizationJson', 'Advanced: extra customization JSON', {
    help: 'Deep-merged over everything above, for options without a field. Example: <code>{"messageLog":{"avatar":{"size":24}}}</code>',
    lineCount: 3, ...when('customizationEnabled', true)
  })
]);

const setupBehavior = group('grpBehavior', 'Behavior', [
  select('behSuppressAutoFocus', 'Focus the composer when new messages arrive', [['', 'Default'], ['false', 'Yes'], ['true', 'No (suppressAutoFocus)']], ''),
  checkbox('behLogoAltTextEnabled', 'Set header logo alt text', false),
  text('behLogoAltText', 'Header logo alt text', { help: 'Leave empty to stop screen readers from announcing the logo.', ...when('behLogoAltTextEnabled', true) })
]);

const setupEvents = group('grpEvents', 'Events → dataLayer', [
  checkbox('trackEvents', 'Push Web Widget events to the dataLayer', true),
  text('eventPrefix', 'Event name prefix', {
    defaultValue: 'zendesk_messaging.',
    help: 'Event name = prefix + snake_case event, for example <code>zendesk_messaging.message_received</code>. Use <code>zendesk_</code> for GA4-style names. Details are in the <code>zendesk</code> object.',
    ...when('trackEvents', true)
  }),
  select('eventSelection', 'Events', [
    ['recommended', 'All events except messagesShown (recommended)'],
    ['all', 'All 22 documented events'],
    ['custom', 'Choose events']
  ], 'recommended', when('trackEvents', true)),
  table('eventList', 'Events to push', [selectColumn('event', 'Event', EVENT_OPTIONS, 'open')], when('eventSelection', 'custom')),
  select('bridgeSource', 'Event bridge (needed for event details)', [
    ['gtm', 'Custom HTML tag in this container (fire it before this tag with tag sequencing)'],
    ['cdn', 'Load from cdn.jsdelivr.net'],
    ['off', 'Off – events only carry their name']
  ], 'gtm', {
    help: 'Zendesk passes events as class instances, which GTM templates cannot read. The open-source bridge passes plain copies, so conversation_id, message_role, article_id and the other details are filled in. For "Custom HTML tag", paste <code>bridge/gtm-custom-html.html</code> from the template repository into a Custom HTML tag and set it as setup tag of this tag. If the bridge is missing, events still fire with their name only.',
    ...when('trackEvents', true)
  }),
  checkbox('pushApiResults', 'Also push API results (ready, conversation_created, message_sent, error, …)', true, when('trackEvents', true)),
  checkbox('includeRawPayload', 'Include the Zendesk event object as zendesk.raw', false, when('trackEvents', true)),
  checkbox('forwardToHandler', 'Also pass every event to window.zendeskGtm.onEvent(payload) when it exists', false, when('trackEvents', true))
]);

const setupDelegates = group('grpDelegates', 'Message delegates', [
  checkbox('beforeSentEnabled', 'Add metadata to every message the end user sends (beforeMessageSent)', false),
  table('beforeSentMetadata', 'Message metadata', [
    column('key', 'Key', { isUnique: true, valueValidators: [{ type: 'NON_EMPTY' }] }),
    selectColumn('source', 'Source', [['static', 'Static value'], ['dataLayer', 'dataLayer key']], 'static'),
    column('value', 'Value or dataLayer key'),
    selectColumn('type', 'Type', TYPES, 'auto')
  ], {
    help: '"Static value" is fixed when this tag fires (variables allowed). "dataLayer key" is read at the moment the message is sent. Do not put sensitive data in metadata.',
    ...when('beforeSentEnabled', true)
  }),
  checkbox('beforeSentPageContext', 'Add page_url and page_title to message metadata', false, when('beforeSentEnabled', true)),
  checkbox('beforeDisplayEnabled', 'Change or hide incoming messages (beforeMessageDisplay)', false),
  table('displayNameMap', 'Rename authors', [
    column('from', 'Display name', { isUnique: true }),
    column('to', 'Show as')
  ], { help: 'Changes the name in the widget only; the transcript keeps the original.', ...when('beforeDisplayEnabled', true) }),
  table('hideRules', 'Hide messages', [
    column('key', 'Metadata key'),
    column('value', 'Value')
  ], { help: 'Hides a message when its metadata key has this value, or exists when the value is empty. Example: internal_only = true.', ...when('beforeDisplayEnabled', true) })
]);

const setupExperimental = group('grpExperimental', 'Experimental (undocumented Zendesk features)', [
  checkbox('experimentalEnabled', 'Enable experimental features', false, {
    help: 'Found in the current widget build but not documented by Zendesk; may change without notice. Also enables the experimental events and customization options.'
  }),
  checkbox('expPreConversationEnabled', 'Show a pre-conversation screen (behavior.messageLog.preConversation)', false, when('experimentalEnabled', true)),
  table('expPreConversationSettings', 'Pre-conversation screen', [
    selectColumn('setting', 'Setting', [['title', 'Title'], ['subtitle', 'Subtitle'], ['icon', 'Icon URL'], ['prompt', 'Suggested prompt']], 'title'),
    column('value', 'Value')
  ], { help: 'Add a row per suggested prompt. A prompt containing […] pre-fills the composer instead of sending.', ...when('expPreConversationEnabled', true) }),
  checkbox('expZdDebug', 'Turn on Zendesk widget debug logging (localStorage ZD-debug)', false, when('experimentalEnabled', true))
]);

const setupGroup = group('grpSetup', 'Setup', [
  setupLoading, setupGeneral, setupConsent, setupContext, setupCustomization,
  setupBehavior, setupEvents, setupDelegates, setupExperimental
], { ...when('tagType', 'setup'), groupStyle: 'NO_ZIPPY' });

/* ----------------------------- Command ---------------------------------- */

const COMMAND_ITEMS = [
  ['open', 'Open the messaging window'],
  ['close', 'Close the messaging window'],
  ['toggle', 'Toggle open / closed (uses the state tracked by the Setup tag)'],
  ['show', 'Show the widget'],
  ['hide', 'Hide the widget'],
  ['navigation', 'Navigate to a screen (multi-conversation)'],
  ['newConversation', 'New conversation'],
  ['sendMessage', 'Send a message as the end user'],
  ['fetchConversations', 'Fetch conversations → dataLayer'],
  ['getConfig', 'Get widget configuration → dataLayer'],
  ['updateUser', 'Update user'],
  ['setLocale', 'Change locale'],
  ['setCookies', 'Change cookie usage'],
  ['voice', 'Start a voice call (Talk digital line)'],
  ['resetWidget', 'Reset the widget (re-applies the Setup tag’s tags, fields and metadata)'],
  ['render', 'Render in the containers of the Setup tag (deferred mode)'],
  ['preConversation', 'Experimental: show the pre-conversation screen'],
  ['typingIndicator', 'Experimental: show a local typing indicator']
];

const commandGroup = group('grpCommand', 'Command', [
  select('command', 'Command', COMMAND_ITEMS, 'open', { alwaysInSummary: true }),
  checkbox('showBeforeOpen', 'Show the widget first (needed when it was hidden on page load)', true, when('command', 'open')),
  select('navScreen', 'Screen', [
    ['ConversationList', 'Conversation list'],
    ['MostRecentActiveConversation', 'Most recent active conversation (created if none)'],
    ['Conversation', 'Specific conversation']
  ], 'ConversationList', { help: 'Multi-conversation mode only, not in embedded split view.', ...when('command', 'navigation') }),
  text('navConversationId', 'Conversation ID', { valueValidators: [{ type: 'NON_EMPTY' }], ...when('navScreen', 'Conversation') }),
  checkbox('openAfterNav', 'Open the messaging window afterwards (Zendesk does not open it by itself)', true, when('command', 'navigation')),
  select('convMode', 'Mode', [
    ['ui', 'Open it in the widget (messenger:ui)'],
    ['programmatic', 'Programmatic – with description, message metadata and the result in the dataLayer']
  ], 'ui', when('command', 'newConversation')),
  text('convDisplayName', 'Conversation title (displayName)', when('command', 'newConversation')),
  text('convIconUrl', 'Icon URL', { valueValidators: [URL], ...when('command', 'newConversation') }),
  { ...kvTable('convMetadata', 'Conversation metadata', 'Flat key/value pairs.'), ...when('command', 'newConversation') },
  text('convMessageText', 'Initial message (optional)', {
    help: 'Sent as the first end user message. Text only, max 4096 characters.', lineCount: 2,
    valueValidators: [{ type: 'STRING_LENGTH', args: [0, 4096] }],
    ...when('command', 'newConversation')
  }),
  text('convDescription', 'Description', when('convMode', 'programmatic')),
  { ...kvTable('convMessageMetadata', 'Initial message metadata', 'Flat key/value pairs on the first message.'), ...when('convMode', 'programmatic') },
  checkbox('navigateAfter', 'Navigate to the new conversation', true, when('convMode', 'programmatic')),
  checkbox('openAfterConv', 'Open the messaging window afterwards (Zendesk does not open it by itself)', true, when('command', 'newConversation')),
  text('sendText', 'Message text', {
    lineCount: 2, valueValidators: [{ type: 'NON_EMPTY' }, { type: 'STRING_LENGTH', args: [1, 4096] }],
    ...when('command', 'sendMessage')
  }),
  { ...kvTable('sendMetadata', 'Message metadata', 'Combine with the "Hide messages" delegate to send hidden workflow messages.'), ...when('command', 'sendMessage') },
  select('sendTarget', 'Conversation', [['current', 'Current conversation (tracked by the Setup tag)'], ['specific', 'Specific conversation ID']], 'current', when('command', 'sendMessage')),
  text('sendConversationId', 'Conversation ID', { valueValidators: [{ type: 'NON_EMPTY' }], ...when('sendTarget', 'specific') }),
  text('fetchOffset', 'Offset', {
    defaultValue: '0', help: '10 conversations per page. The result is pushed as <code>conversations_fetched</code> (zendesk.result.conversations).',
    valueValidators: [regex('^(\\{\\{.+\\}\\}|\\d+)$', 'Enter 0 or a positive whole number.')], ...when('command', 'fetchConversations')
  }),
  checkbox('fetchAll', 'Fetch all pages (up to 100 conversations)', false, when('command', 'fetchConversations')),
  { ...kvTable('cmdUserData', 'User properties', 'All rows are sent as one updateUser call.'), ...when('command', 'updateUser') },
  text('cmdLocale', 'Locale', { valueValidators: [{ type: 'NON_EMPTY' }], ...when('command', 'setLocale') }),
  select('cmdCookies', 'Cookie usage', [['all', 'All'], ['functional', 'Functional only'], ['none', 'None (hides the widget)']], 'all', when('command', 'setCookies')),
  text('voiceLineId', 'Digital line line_id', {
    help: 'The 32-character <code>line_id</code> of the Talk digital line (not the numeric id).',
    valueValidators: [{ type: 'NON_EMPTY' }, regex('^(\\{\\{.+\\}\\}|[0-9a-zA-Z]{32})$', 'The line_id is a 32-character alphanumeric string.')],
    ...when('command', 'voice')
  }),
  text('typingName', 'Typing indicator name', when('command', 'typingIndicator'))
], { ...when('tagType', 'command'), groupStyle: 'NO_ZIPPY' });

/* ----------------------------- Shared ----------------------------------- */

const logLevel = select('logLevel', 'Console logging (GTM Preview only)', [['errors', 'Errors only'], ['verbose', 'Verbose (every zE call and dataLayer push)'], ['none', 'Off']], 'errors');

export default [tagType, setupGroup, commandGroup, logLevel];
