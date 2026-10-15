// Compact source of ___WEB_PERMISSIONS___. The build turns this into GTM's
// verbose typed format, and the local emulator enforces the same rules.

export const globals = [
  // key, read, write, execute
  ['zE', true, true, true],
  ['zE._', true, true, false],
  ['zE.s', true, true, false],
  ['zE.t', true, true, false],
  ['zE.version', true, false, false],
  ['zEmbed', true, true, false],
  ['zEMessenger', true, true, false],
  ['zESettings', true, true, false],
  ['zEACLoaded', true, false, false],
  ['__gtmZendesk', true, true, false],
  ['zendeskGtmBridge.on', true, false, true],
  ['zendeskGtm.onEvent', true, false, true],
  ['dataLayer', true, true, false]
];

export const scripts = [
  'https://static.zdassets.com/ekr/snippet.js*',
  'https://cdn.jsdelivr.net/gh/pluscloud-nl/Zendesk-Web-SDK-for-Google-Tag-Manager@*/bridge/zendesk-gtm-bridge.js'
];

export const consentTypes = ['functionality_storage', 'analytics_storage'];

export const localStorageKeys = [['ZD-debug', false, true]];

const str = (string) => ({ type: 1, string });
const bool = (boolean) => ({ type: 8, boolean });
const list = (listItem) => ({ type: 2, listItem });
const map = (keys, values) => ({ type: 3, mapKey: keys.map(str), mapValue: values });

const permission = (publicId, param) => ({
  instance: { key: { publicId, versionId: '1' }, param },
  clientAnnotations: { isEditedByUser: true },
  isRequired: true
});

export const toGtm = () => [
  permission('logging', [{ key: 'environments', value: str('debug') }]),
  permission('access_globals', [{
    key: 'keys',
    value: list(globals.map(([key, read, write, execute]) =>
      map(['key', 'read', 'write', 'execute'], [str(key), bool(read), bool(write), bool(execute)])))
  }]),
  permission('inject_script', [{ key: 'urls', value: list(scripts.map(str)) }]),
  permission('access_template_storage', []),
  permission('access_consent', [{
    key: 'consentTypes',
    value: list(consentTypes.map((type) => map(['consentType', 'read', 'write'], [str(type), bool(true), bool(false)])))
  }]),
  permission('read_data_layer', [{ key: 'allowedKeys', value: str('any') }]),
  permission('get_url', [
    { key: 'urlParts', value: str('any') },
    { key: 'queriesAllowed', value: str('any') }
  ]),
  permission('read_title', []),
  permission('access_local_storage', [{
    key: 'keys',
    value: list(localStorageKeys.map(([key, read, write]) => map(['key', 'read', 'write'], [str(key), bool(read), bool(write)])))
  }])
];
