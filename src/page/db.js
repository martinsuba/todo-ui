// Thin adapter over `await claude.use("db")`: subscribeTodos (T-001), later subscribeSyncMeta, tick.

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
