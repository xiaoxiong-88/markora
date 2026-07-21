/**
 * Key-value persistence backed by tauri-plugin-store, with a localStorage
 * fallback so the app also runs in tests and plain-browser dev.
 */
import { isTauri } from "./backend";

type StoreLike = {
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

let storePromise: Promise<StoreLike> | null = null;

async function getStore(): Promise<StoreLike> {
  if (!storePromise) {
    storePromise = (async () => {
      if (isTauri()) {
        const { Store } = await import("@tauri-apps/plugin-store");
        return Store.load("markora-state.json") as unknown as StoreLike;
      }
      // fallback: localStorage-backed shim
      return {
        async get<T>(key: string): Promise<T | null> {
          const raw = localStorage.getItem(`markora:${key}`);
          return raw ? (JSON.parse(raw) as T) : null;
        },
        async set(key: string, value: unknown) {
          localStorage.setItem(`markora:${key}`, JSON.stringify(value));
        },
        async save() {},
      } satisfies StoreLike;
    })();
  }
  return storePromise!;
}

export async function loadPersisted<T>(key: string): Promise<T | null> {
  try {
    const store = await getStore();
    return (await store.get<T>(key)) ?? null;
  } catch {
    // Corrupted or unavailable state must never crash the app.
    return null;
  }
}

export async function savePersisted(key: string, value: unknown): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  } catch {
    // Persistence failure is non-fatal; the app keeps running.
  }
}

/** Test hook: reset the cached store between tests. */
export function __resetPersistenceForTests() {
  storePromise = null;
}
