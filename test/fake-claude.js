// In-memory fake of the claude.ai artifact runtime, for page tests and `npm run dev`.
// Plain classic script (no import/export): load it in the page BEFORE the app script, e.g.
//   page.addInitScript((cfg) => { window.__FAKE_CLAUDE_CONFIG = cfg; }, { seed: {...} });
//   page.addInitScript({ path: "test/fake-claude.js" });
// Mirrors the shapes of the real `db` capability (contract 0.2.77): window.claude.use("db") resolves
// { doc(path), collection(path) }; refs support get/set/update/delete/onSnapshot; collections also
// add/doc()/where/orderBy/limit/get/onSnapshot. Snapshots: { id, exists, data(), metadata } and
// { docs, size, empty, docChanges(), metadata }.
//
// Config (window.__FAKE_CLAUDE_CONFIG):
//   seed:       { "todos/a1b2": {...}, "meta/sync": {...} }   initial documents by path
//   dbNull:     true  -> claude.use("db") resolves null
//   failWrites: true | { code, message }  -> every set/update/delete rejects with a DbError
// Test handle (window.__fakeClaude):
//   attempts    every write call made by the page: { op, path, data? }  (also failed ones)
//   writes      only the writes that succeeded
//   failWrites  assignable at any time (true | { code, message } | false)
//   dump()      current store as { path: data }
//   externalSet(path, data) / externalDelete(path)   change the db as another viewer (HAL's sync) would
//   subscriptions  number of active onSnapshot listeners (to detect leaks / resubscribe loops)
(function () {
  const config = window.__FAKE_CLAUDE_CONFIG || {};
  /** @type {Map<string, any>} */
  const store = new Map();
  /** @type {Set<{ refresh: () => void }>} */
  const listeners = new Set();

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const freeze = (o) => {
    for (const v of Object.values(o)) if (v && typeof v === "object") freeze(v);
    return Object.freeze(o);
  };
  const segments = (path) => {
    const parts = String(path).split("/");
    if (parts.some((s) => !/^[A-Za-z0-9_\-.~:@+]+$/.test(s) || s === "." || s === "..")) {
      throw new TypeError(`bad path: ${path}`);
    }
    return parts;
  };
  const docPath = (path) => {
    if (segments(path).length % 2 !== 0) throw new TypeError(`not a document path: ${path}`);
    return path;
  };
  const colPath = (path) => {
    if (segments(path).length % 2 !== 1) throw new TypeError(`not a collection path: ${path}`);
    return path;
  };
  const dbError = (code, message) => ({ code, message });
  const metadata = () => ({ fromCache: false, hasPendingWrites: false });
  const docSnap = (path) => {
    const exists = store.has(path);
    const data = exists ? freeze(clone(store.get(path))) : undefined;
    return { id: path.split("/").pop(), exists, data: () => data, metadata: metadata() };
  };
  const notify = () => listeners.forEach((l) => queueMicrotask(l.refresh));

  const handle = {
    /** @type {any[]} */
    attempts: [],
    /** @type {any[]} */
    writes: [],
    failWrites: config.failWrites || false,
    get subscriptions() {
      return listeners.size;
    },
    dump() {
      return Object.fromEntries([...store].map(([k, v]) => [k, clone(v)]));
    },
    externalSet(path, data) {
      store.set(docPath(path), clone(data));
      notify();
    },
    externalDelete(path) {
      store.delete(docPath(path));
      notify();
    },
  };
  for (const [path, data] of Object.entries(config.seed || {}))
    store.set(docPath(path), clone(data));

  async function write(op, path, data, apply) {
    handle.attempts.push(data === undefined ? { op, path } : { op, path, data: clone(data) });
    await Promise.resolve();
    if (handle.failWrites) {
      const f = handle.failWrites === true ? {} : handle.failWrites;
      throw dbError(f.code || "unavailable", f.message || "fake write failure");
    }
    if (data !== undefined && (data === null || typeof data !== "object" || Array.isArray(data))) {
      throw dbError("invalid_argument", "document body must be an object");
    }
    apply();
    handle.writes.push(data === undefined ? { op, path } : { op, path, data: clone(data) });
    notify();
  }

  function makeQuery(collection, filters, order, max) {
    const run = () => {
      const prefix = collection + "/";
      let ids = [...store.keys()].filter(
        (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"),
      );
      ids = ids.filter((p) =>
        filters.every(([field, op, value]) => {
          const v = store.get(p)[field];
          if (op === "==") return v === value;
          if (op === "!=") return v !== value;
          if (op === "<") return v < value;
          if (op === "<=") return v <= value;
          if (op === ">") return v > value;
          if (op === ">=") return v >= value;
          if (op === "in") return value.includes(v);
          if (op === "not-in") return !value.includes(v);
          if (op === "array-contains") return Array.isArray(v) && v.includes(value);
          throw dbError("invalid_argument", `bad operator ${op}`);
        }),
      );
      ids.sort((a, b) => (a < b ? -1 : 1));
      if (order) {
        const dir = order.dir === "desc" ? -1 : 1;
        const has = (p) => store.get(p)[order.field] !== undefined;
        ids.sort((a, b) => {
          if (has(a) !== has(b)) return has(a) ? -1 : 1;
          const x = store.get(a)[order.field];
          const y = store.get(b)[order.field];
          return x < y ? -dir : x > y ? dir : 0;
        });
      }
      if (max) ids = ids.slice(0, max);
      return ids;
    };
    const querySnap = (ids, previous) => {
      const docs = ids.map(docSnap);
      return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        docChanges: () => {
          const before = new Map(previous.map((d, i) => [d.id, [d, i]]));
          const changes = [];
          docs.forEach((d, newIndex) => {
            const prev = before.get(d.id);
            if (!prev) changes.push({ type: "added", doc: d, oldIndex: -1, newIndex });
            else if (JSON.stringify(prev[0].data()) !== JSON.stringify(d.data()))
              changes.push({ type: "modified", doc: d, oldIndex: prev[1], newIndex });
            before.delete(d.id);
          });
          for (const [d, oldIndex] of before.values())
            changes.push({ type: "removed", doc: d, oldIndex, newIndex: -1 });
          return changes;
        },
        metadata: metadata(),
      };
    };
    const query = {
      where: (field, op, value) =>
        makeQuery(collection, [...filters, [field, op, value]], order, max),
      orderBy: (field, dir = "asc") => makeQuery(collection, filters, { field, dir }, max),
      limit: (n) => makeQuery(collection, filters, order, n),
      get: async () => querySnap(run(), []),
      onSnapshot(next, error) {
        let previous = [];
        let live = true;
        const listener = {
          refresh() {
            if (!live) return;
            const snap = querySnap(run(), previous);
            previous = snap.docs;
            try {
              next(snap);
            } catch (e) {
              if (error) error(dbError("invalid_argument", String(e)));
            }
          },
        };
        listeners.add(listener);
        queueMicrotask(listener.refresh);
        return () => {
          live = false;
          listeners.delete(listener);
        };
      },
    };
    return query;
  }

  function makeDoc(path) {
    docPath(path);
    return {
      id: path.split("/").pop(),
      path,
      get: async () => docSnap(path),
      set: (data) => write("set", path, data, () => store.set(path, clone(data))),
      update: (data) =>
        write("update", path, data, () => {
          if (!store.has(path)) throw dbError("invalid_argument", `no such document: ${path}`);
          store.set(path, { ...store.get(path), ...clone(data) });
        }),
      delete: () => write("delete", path, undefined, () => store.delete(path)),
      onSnapshot(next, error) {
        let live = true;
        const listener = {
          refresh() {
            if (!live) return;
            try {
              next(docSnap(path));
            } catch (e) {
              if (error) error(dbError("invalid_argument", String(e)));
            }
          },
        };
        listeners.add(listener);
        queueMicrotask(listener.refresh);
        return () => {
          live = false;
          listeners.delete(listener);
        };
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
      acquire: async () => {
        throw dbError("capability_removed", "acquire is not implemented by the fake");
      },
    };
  }

  function makeCollection(path) {
    colPath(path);
    const query = makeQuery(path, [], null, 0);
    let counter = 0;
    return Object.assign(query, {
      path,
      doc: (id) =>
        makeDoc(`${path}/${id ?? "auto" + ++counter + Math.random().toString(36).slice(2, 6)}`),
      add: async (data) => {
        const ref = makeDoc(`${path}/auto${++counter}${Math.random().toString(36).slice(2, 6)}`);
        await ref.set(data);
        return ref;
      },
    });
  }

  const db = { doc: makeDoc, collection: makeCollection };

  window.claude = {
    use: async (name) => (name === "db" && !config.dbNull ? db : null),
  };
  window.__fakeClaude = handle;
})();
