// Thin adapter over `await claude.use("db")`: subscribeTodos, subscribeSyncMeta, tick.

/**
 * Subscribe once to the `todos` collection. Calls `onRows` with [{id, ...data}] on every snapshot.
 * @param {(rows: any[]) => void} onRows
 * @param {(err: unknown) => void} [onError]
 */
export async function subscribeTodos(onRows, onError) {
  const db = await claude.use("db");
  if (!db) return false;
  db.collection("todos").onSnapshot(
    (snap) => onRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
  return true;
}

/**
 * Subscribe once to `meta/sync`. Calls `onSyncedAt` with the ISO string, or null when the doc is absent.
 * @param {(syncedAt: string|null) => void} onSyncedAt
 * @param {(err: unknown) => void} [onError]
 */
export async function subscribeSyncMeta(onSyncedAt, onError) {
  const db = await claude.use("db");
  if (!db) return false;
  db.doc("meta/sync").onSnapshot((snap) => {
    const data = snap.exists ? snap.data() : null;
    onSyncedAt(data && typeof data.syncedAt === "string" ? data.syncedAt : null);
  }, onError);
  return true;
}

/**
 * Mark a todo ticked: the page's only write, `todos/<id>.tickedAt`. Rejects when the write fails.
 * @param {string} id
 * @param {string} iso
 */
export async function tick(id, iso) {
  const db = await claude.use("db");
  if (!db) throw new Error("db unavailable");
  await db.doc(`todos/${id}`).update({ tickedAt: iso });
}
