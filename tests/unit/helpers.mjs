import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import parameters from '../../src/parameters.mjs';
import * as permissions from '../../src/permissions.mjs';
import { createSandbox } from '../emulator/gtm-sandbox.mjs';
import { installFakeWidget, tick } from '../emulator/fake-widget.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SOURCE = readFileSync(join(root, 'src/sandbox.js'), 'utf8');
export const BRIDGE = readFileSync(join(root, 'bridge/zendesk-gtm-bridge.js'), 'utf8');
export const KEY = '11111111-2222-3333-4444-555555555555';
export { tick };

// Default parameter values, the way GTM passes them to `data`.
export const defaults = () => {
  const out = {};
  const visit = (params) => params.forEach((p) => {
    if (p.name && p.type !== 'GROUP' && p.type !== 'LABEL') {
      if (p.defaultValue !== undefined) out[p.name] = p.defaultValue;
      else if (p.type === 'CHECKBOX') out[p.name] = false;
      else if (p.type === 'SIMPLE_TABLE') out[p.name] = undefined;
      else out[p.name] = '';
    }
    if (p.subParams) visit(p.subParams);
  });
  visit(parameters);
  return out;
};

export const makeWindow = (extra = {}) => {
  const store = {};
  const win = Object.assign({
    location: { href: 'https://shop.example/checkout?step=2' },
    document: { title: 'Checkout', documentElement: { dir: '', lang: 'en' } },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    }
  }, extra);
  win.open = (...args) => { win.__opened = args; };
  return win;
};

// Runs one or more tags (sharing templateStorage, like GTM) on one page.
export const page = (opts = {}) => {
  const win = makeWindow(opts.window);
  const widget = installFakeWidget(win, { plainEvents: opts.plainEvents });
  // The bridge loads synchronously here; the snippet is only recorded.
  const injectScript = (url, onSuccess, onFailure) => {
    if (url.indexOf('zendesk-gtm-bridge') === -1) return;
    if (opts.bridgeFails) { onFailure(); return; }
    new Function('window', BRIDGE)(win); // eslint-disable-line no-new-func
    onSuccess();
  };
  const sandbox = createSandbox({ window: win, permissions, consent: opts.consent, injectScript, log: () => {} });
  const run = (data) => sandbox.run(SOURCE, Object.assign(defaults(), data));
  const events = (prefix = 'zendesk_messaging.') => (win.dataLayer || []).filter((e) => e.event && e.event.indexOf(prefix) === 0);
  const eventNames = () => events().map((e) => e.event);
  const snippets = () => sandbox.injected.filter((i) => i.url.indexOf('/ekr/snippet.js') > -1);
  const bridges = () => sandbox.injected.filter((i) => i.url.indexOf('zendesk-gtm-bridge') > -1);
  return { win, widget, sandbox, run, events, eventNames, snippets, bridges };
};

// Unit tests load the bridge through the CDN path (synchronously, see above).
export const setup = (data = {}) => Object.assign({ tagType: 'setup', snippetKey: KEY, bridgeSource: 'cdn' }, data);
export const command = (name, data = {}) => Object.assign({ tagType: 'command', command: name }, data);
