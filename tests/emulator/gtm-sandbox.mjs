// Minimal emulator of the GTM web sandbox, for running src/sandbox.js outside
// Tag Manager. It enforces the template's permissions and converts values at
// the sandbox boundary the strictest plausible way: functions are re-wrapped
// (identity is lost), plain objects and arrays are deep-copied, and class
// instances become undefined. Works in Node and in the browser.

// Port of the plain-object check in the GTM runtime (gtm.js): objects created
// in another realm (the widget iframe) pass, class instances do not.
const isPlainObject = (a) => {
  if (!a || Object.prototype.toString.call(a) !== '[object Object]' || a.nodeType || a == a.window) return false;
  try {
    if (a.constructor && !Object.prototype.hasOwnProperty.call(a, 'constructor') &&
        !Object.prototype.hasOwnProperty.call(a.constructor.prototype, 'isPrototypeOf')) return false;
  } catch (e) {
    return false;
  }
  let last;
  for (last in a); // eslint-disable-line no-empty
  return last === undefined || Object.prototype.hasOwnProperty.call(a, last);
};

const isArguments = (v) => Object.prototype.toString.call(v) === '[object Arguments]';

export const getType = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
};

const globMatch = (pattern, value) => {
  const re = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(value);
};

export class PermissionError extends Error {}

export function createSandbox(options) {
  const win = options.window;
  const perms = options.permissions;
  const consent = Object.assign({}, options.consent || {});
  const consentListeners = [];
  const storage = options.templateStorage || new Map();
  const injected = [];
  const logs = [];
  const log = options.log || ((...args) => logs.push(args));

  const sandboxFns = new WeakSet();

  const toSandbox = (v, depth = 0) => {
    if (depth > 50) return undefined;
    if (v === null || v === undefined) return v;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;
    if (t === 'function') {
      const wrapped = function () {
        const args = Array.prototype.map.call(arguments, (a) => toNative(a));
        return toSandbox(v.apply(undefined, args));
      };
      sandboxFns.add(wrapped);
      return wrapped;
    }
    if (Array.isArray(v) || isArguments(v)) return Array.prototype.map.call(v, (x) => toSandbox(x, depth + 1));
    if (isPlainObject(v)) {
      const out = {};
      Object.keys(v).forEach((k) => { out[k] = toSandbox(v[k], depth + 1); });
      return out;
    }
    return undefined; // class instances, DOM nodes, …
  };

  const toNative = (v, depth = 0) => {
    if (depth > 50) return undefined;
    if (v === null || v === undefined) return v;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;
    if (t === 'function') {
      return function () {
        const args = Array.prototype.map.call(arguments, (a) => toSandbox(a));
        return toNative(v.apply(undefined, args));
      };
    }
    if (Array.isArray(v)) return v.map((x) => toNative(x, depth + 1));
    if (isPlainObject(v)) {
      const out = {};
      Object.keys(v).forEach((k) => { out[k] = toNative(v[k], depth + 1); });
      return out;
    }
    return undefined;
  };

  /* -------------------------- permissions ------------------------------ */

  const globalPerm = (key, access) => {
    const entry = perms.globals.find((g) => g[0] === key);
    const idx = { read: 1, write: 2, execute: 3 }[access];
    if (!entry || !entry[idx]) throw new PermissionError(`access_globals: no ${access} permission for "${key}"`);
  };

  const resolve = (path) => {
    const parts = path.split('.');
    let obj = win;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj == null) return { parent: undefined, prop: parts[parts.length - 1] };
      obj = obj[parts[i]];
    }
    return { parent: obj, prop: parts[parts.length - 1] };
  };

  const getGlobal = (path) => {
    const { parent, prop } = resolve(path);
    return parent == null ? undefined : parent[prop];
  };

  const setGlobal = (path, value) => {
    const { parent, prop } = resolve(path);
    if (parent == null) throw new Error(`setInWindow: parent of "${path}" does not exist`);
    parent[prop] = value;
  };

  /* -------------------------- data layer ------------------------------- */

  const dataModel = () => {
    const model = {};
    const merge = (target, source) => {
      Object.keys(source).forEach((k) => {
        const v = source[k];
        if (isPlainObject(v) && isPlainObject(target[k])) merge(target[k], v);
        else target[k] = isPlainObject(v) ? merge({}, v) : v;
      });
      return target;
    };
    (win.dataLayer || []).forEach((item) => { if (isPlainObject(item)) merge(model, item); });
    return model;
  };

  /* -------------------------- APIs ------------------------------------- */

  const apis = {
    addConsentListener: (type, fn) => {
      if (!perms.consentTypes.includes(type)) throw new PermissionError(`access_consent: ${type}`);
      consentListeners.push({ type, fn });
    },
    aliasInWindow: (toPath, fromPath) => {
      globalPerm(toPath, 'write');
      globalPerm(fromPath, 'read');
      if (resolve(toPath).parent == null || resolve(fromPath).parent == null) return false;
      setGlobal(toPath, getGlobal(fromPath)); // native copy, no conversion
      return true;
    },
    callInWindow: (path, ...args) => {
      globalPerm(path, 'execute');
      // GTM converts arguments with mode 2: class instances become undefined.
      const { parent, prop } = resolve(path);
      const fn = parent == null ? undefined : parent[prop];
      if (typeof fn !== 'function') {
        log('callInWindow: not a function', path);
        return undefined;
      }
      return toSandbox(fn.apply(parent, args.map((a) => toNative(a))));
    },
    callLater: (fn) => setTimeout(() => fn(), 0),
    copyFromDataLayer: (key) => {
      let v = dataModel();
      for (const part of key.split('.')) v = v == null ? undefined : v[part];
      return toSandbox(v);
    },
    copyFromWindow: (path) => {
      globalPerm(path, 'read');
      return toSandbox(getGlobal(path));
    },
    createArgumentsQueue: (fnKey, arrayKey) => {
      // Mirrors gtm.js: an existing function is returned as is; otherwise a
      // native function is created that pushes `arguments` into the array.
      globalPerm(fnKey, 'read'); globalPerm(fnKey, 'write');
      globalPerm(arrayKey, 'read'); globalPerm(arrayKey, 'write');
      const existing = getGlobal(fnKey);
      if (existing) return typeof existing === 'function' ? toSandbox(existing) : null;
      let array = getGlobal(arrayKey);
      const fn = function () { array.push(arguments); };
      setGlobal(fnKey, fn);
      array = getGlobal(arrayKey);
      if (array === undefined) { array = []; setGlobal(arrayKey, array); }
      return toSandbox(fn);
    },
    createQueue: (key) => {
      globalPerm(key, 'read');
      globalPerm(key, 'write');
      if (!Array.isArray(getGlobal(key))) setGlobal(key, []);
      return (value) => getGlobal(key).push(toNative(value));
    },
    encodeUriComponent: (s) => encodeURIComponent(s),
    getTimestampMillis: () => Date.now(),
    getType,
    getUrl: () => (win.location ? win.location.href : ''),
    injectScript: (url, onSuccess, onFailure, cacheToken) => {
      if (!perms.scripts.some((p) => globMatch(p, url))) throw new PermissionError(`inject_script: ${url}`);
      injected.push({ url, cacheToken });
      if (options.injectScript) return options.injectScript(url, onSuccess, onFailure);
      if (win.document && win.document.createElement) {
        const s = win.document.createElement('script');
        s.src = url;
        s.onload = () => onSuccess && onSuccess();
        s.onerror = () => onFailure && onFailure();
        win.document.head.appendChild(s);
      }
    },
    isConsentGranted: (type) => {
      if (!perms.consentTypes.includes(type)) throw new PermissionError(`access_consent: ${type}`);
      return consent[type] !== 'denied';
    },
    JSON: {
      parse: (s) => { try { return toSandbox(JSON.parse(s)); } catch (e) { return undefined; } },
      stringify: (v) => JSON.stringify(toNative(v))
    },
    localStorage: {
      getItem: (k) => { if (!perms.localStorageKeys.some((e) => e[0] === k && e[1])) throw new PermissionError(`access_local_storage read ${k}`); return win.localStorage.getItem(k); },
      setItem: (k, v) => { if (!perms.localStorageKeys.some((e) => e[0] === k && e[2])) throw new PermissionError(`access_local_storage write ${k}`); win.localStorage.setItem(k, v); },
      removeItem: (k) => { if (!perms.localStorageKeys.some((e) => e[0] === k && e[2])) throw new PermissionError(`access_local_storage write ${k}`); win.localStorage.removeItem(k); }
    },
    logToConsole: (...args) => log(...args),
    makeInteger: (v) => Math.trunc(Number(v)),
    makeNumber: (v) => Number(v),
    makeString: (v) => String(v),
    Math,
    Object: {
      keys: (o) => Object.keys(o), values: (o) => Object.values(o), entries: (o) => Object.entries(o),
      freeze: (o) => Object.freeze(o), delete: (o, k) => { delete o[k]; return true; }
    },
    readTitle: () => (win.document ? win.document.title : ''),
    setInWindow: (path, value, override) => {
      globalPerm(path, 'write');
      if (getGlobal(path) !== undefined && !override) return false;
      setGlobal(path, toNative(value));
      return true;
    },
    templateStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => { storage.set(k, v); },
      removeItem: (k) => { storage.delete(k); },
      clear: () => storage.clear()
    }
  };

  const require = (name) => {
    if (!(name in apis)) throw new Error(`Unknown sandbox API: ${name}`);
    return apis[name];
  };

  return {
    run(source, data) {
      const result = { success: false, failure: false };
      const fullData = Object.assign({}, data, {
        gtmOnSuccess: () => { result.success = true; },
        gtmOnFailure: () => { result.failure = true; }
      });
      // eslint-disable-next-line no-new-func
      new Function('require', 'data', source)(require, fullData);
      return result;
    },
    updateConsent(type, state) {
      consent[type] = state;
      consentListeners.filter((l) => l.type === type).forEach((l) => l.fn(type, state === 'granted'));
    },
    injected,
    logs,
    storage
  };
}
