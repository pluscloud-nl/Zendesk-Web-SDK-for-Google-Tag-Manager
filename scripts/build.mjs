// Builds template.tpl from src/ and lints the sandboxed JavaScript.
//   node scripts/build.mjs             lint + build
//   node scripts/build.mjs --lint-only lint only
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import parameters, { MAX_FIELDS } from '../src/parameters.mjs';
import { toGtm, globals } from '../src/permissions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Sandboxed APIs this template is allowed to require (web container).
const SANDBOX_APIS = new Set([
  'addConsentListener', 'aliasInWindow', 'callInWindow', 'callLater', 'copyFromDataLayer', 'copyFromWindow',
  'createArgumentsQueue', 'createQueue', 'encodeUri', 'encodeUriComponent', 'getTimestampMillis', 'getType',
  'getUrl', 'injectScript', 'isConsentGranted', 'JSON', 'localStorage', 'logToConsole', 'makeInteger',
  'makeNumber', 'makeString', 'Math', 'Object', 'readTitle', 'setInWindow', 'templateStorage'
]);

const FORBIDDEN = {
  NewExpression: '`new` is not available in sandboxed JavaScript',
  ThisExpression: '`this` is not available in sandboxed JavaScript',
  TryStatement: 'try/catch is not supported in sandboxed JavaScript',
  ThrowStatement: 'throw is not supported in sandboxed JavaScript',
  TemplateLiteral: 'template literals are not supported',
  SpreadElement: 'spread syntax is not supported',
  RestElement: 'rest parameters are not supported',
  ObjectPattern: 'destructuring is not supported',
  ArrayPattern: 'destructuring is not supported',
  AssignmentPattern: 'default parameters are not supported',
  ForInStatement: 'for...in is not supported; use Object.keys()',
  ForOfStatement: 'for...of is not supported',
  ClassDeclaration: 'classes are not supported',
  SwitchStatement: 'avoid switch; use an object map',
  ContinueStatement: 'avoid continue',
  LabeledStatement: 'labels are not supported'
};

export const collectParamNames = (params, names = new Set()) => {
  for (const p of params) {
    if (p.name) {
      if (names.has(p.name) && p.type !== 'LABEL') throw new Error(`Duplicate parameter name: ${p.name}`);
      names.add(p.name);
    }
    if (p.subParams) collectParamNames(p.subParams, names);
    if (p.radioItems) for (const item of p.radioItems) if (item.subParams) collectParamNames(item.subParams, names);
  }
  return names;
};

export const lint = (source) => {
  const errors = [];
  const ast = acorn.parse(source, { ecmaVersion: 2015, sourceType: 'script', locations: true, allowReturnOutsideFunction: true });
  const at = (node) => `line ${node.loc.start.line}`;
  const paramNames = collectParamNames(parameters);
  const dataRefs = new Set();

  walk.full(ast, (node) => {
    if (FORBIDDEN[node.type]) errors.push(`${at(node)}: ${FORBIDDEN[node.type]}`);
    if (node.type === 'UnaryExpression' && (node.operator === 'typeof' || node.operator === 'delete')) {
      errors.push(`${at(node)}: \`${node.operator}\` is not supported; use getType()`);
    }
    if (node.type === 'Literal' && node.regex) errors.push(`${at(node)}: regex literals are not supported`);
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      const name = node.arguments[0] && node.arguments[0].value;
      if (!SANDBOX_APIS.has(name)) errors.push(`${at(node)}: unknown or unlisted sandbox API require('${name}')`);
    }
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'data' && !node.computed) {
      dataRefs.add(node.property.name);
    }
  });

  // GTM: "Keys must be valid JavaScript identifiers separated by periods" and
  // "must not start with any key predefined on global scope or a keyword".
  const windowGlobals = new Set(JSON.parse(read('scripts/window-globals.json')));
  const KEYWORDS = new Set(['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'null', 'true', 'false']);
  for (const [key] of globals) {
    if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(key)) errors.push(`access_globals key "${key}" is not valid in GTM`);
    const first = key.split('.')[0];
    if (windowGlobals.has(first) || KEYWORDS.has(first)) errors.push(`access_globals key "${key}" starts with a predefined global or keyword`);
  }
  const fieldCount = collectParamNames(parameters).size;
  if (fieldCount > MAX_FIELDS) errors.push(`${fieldCount} fields; GTM allows at most ${MAX_FIELDS} (groups and labels count too)`);

  for (const name of dataRefs) {
    if (name === 'gtmOnSuccess' || name === 'gtmOnFailure') continue;
    if (!paramNames.has(name)) errors.push(`data.${name} is used but no template parameter has that name`);
  }
  return errors;
};

const section = (name, body) => `___${name}___\n\n${body}\n\n\n`;

export const build = () => {
  const sandbox = read('src/sandbox.js');
  const errors = lint(sandbox);
  if (errors.length) {
    console.error('Sandbox lint failed:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  if (process.argv.includes('--lint-only')) {
    console.log('Sandbox lint passed.');
    return;
  }

  const info = JSON.parse(read('src/info.json'));
  info.brand.thumbnail = 'data:image/png;base64,' + readFileSync(join(root, 'assets/icon.png')).toString('base64');
  const pkg = JSON.parse(read('package.json'));
  const tests = read('tests/gtm-tests.yaml');
  // GTM's test runner predefines `data`; declaring it again fails all tests.
  if (/\b(const|let|var)\s+data\b/.test(tests)) {
    console.error('tests/gtm-tests.yaml declares a variable named "data", which GTM reserves.');
    process.exit(1);
  }
  // GTM rejects test names with quotes and other special characters.
  for (const [, name] of tests.matchAll(/^- name: (.*)$/gm)) {
    if (!/^[A-Za-z0-9 ]+$/.test(name)) {
      console.error(`Invalid GTM test name (letters, digits and spaces only): ${name}`);
      process.exit(1);
    }
  }
  const terms = 'By creating or modifying this file you agree to Google Tag Manager\'s Community\n' +
    'Template Gallery Developer Terms of Service available at\n' +
    'https://developers.google.com/tag-manager/gallery-tos (or such other URL as\n' +
    'Google may provide), as modified from time to time.';

  const tpl =
    section('TERMS_OF_SERVICE', terms) +
    section('INFO', JSON.stringify(info, null, 2)) +
    section('TEMPLATE_PARAMETERS', JSON.stringify(parameters, null, 2)) +
    section('SANDBOXED_JS_FOR_WEB_TEMPLATE', sandbox.trim()) +
    section('WEB_PERMISSIONS', JSON.stringify(toGtm(), null, 2)) +
    section('TESTS', tests.trim()) +
    `___NOTES___\n\nZendesk Messaging – Web SDK template v${pkg.version}. Built from src/ by scripts/build.mjs; do not edit template.tpl by hand.\n`;

  writeFileSync(join(root, 'template.tpl'), tpl);

  // Custom HTML tag variant of the event bridge, for use inside GTM.
  const bridge = read('bridge/zendesk-gtm-bridge.js').trim();
  writeFileSync(join(root, 'bridge/gtm-custom-html.html'),
    '<!-- Zendesk Messaging – Web SDK: event bridge. Fire this Custom HTML tag before the Setup tag (tag sequencing). -->\n' +
    '<script>\n' + bridge + '\n</script>\n');
  console.log(`template.tpl written (${(tpl.length / 1024).toFixed(1)} KB, ${collectParamNames(parameters).size} parameters).`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
