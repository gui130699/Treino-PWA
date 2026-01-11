const DB_NAME = "treino_pwa_db";
const DB_VER = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;

      // users (demo auth local)
      if (!db.objectStoreNames.contains("users")) {
        const s = db.createObjectStore("users", { keyPath: "email" });
        s.createIndex("role", "role", { unique: false });
      }

      // settings per user
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "userKey" });
      }

      // exercises
      if (!db.objectStoreNames.contains("exercises")) {
        const s = db.createObjectStore("exercises", { keyPath: "id" });
        s.createIndex("is_active", "is_active", { unique: false });
        s.createIndex("name", "name", { unique: false });
      }

      // exercise requests
      if (!db.objectStoreNames.contains("exercise_requests")) {
        const s = db.createObjectStore("exercise_requests", { keyPath: "id" });
        s.createIndex("status", "status", { unique: false });
        s.createIndex("requested_by", "requested_by", { unique: false });
      }

      // templates
      if (!db.objectStoreNames.contains("templates")) {
        const s = db.createObjectStore("templates", { keyPath: "id" });
        s.createIndex("owner_id", "owner_id", { unique: false });
      }

      // template days (cada dia dentro de um template)
      if (!db.objectStoreNames.contains("template_days")) {
        const s = db.createObjectStore("template_days", { keyPath: "id" });
        s.createIndex("template_id", "template_id", { unique: false });
      }

      // template items (agora vinculados a template_day_id)
      if (!db.objectStoreNames.contains("template_items")) {
        const s = db.createObjectStore("template_items", { keyPath: "id" });
        s.createIndex("template_id", "template_id", { unique: false });
        s.createIndex("template_day_id", "template_day_id", { unique: false });
      }

      // sessions
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("owner_id", "owner_id", { unique: false });
        s.createIndex("status", "status", { unique: false });
      }

      // session sets
      if (!db.objectStoreNames.contains("session_sets")) {
        const s = db.createObjectStore("session_sets", { keyPath: "id" });
        s.createIndex("session_id", "session_id", { unique: false });
        s.createIndex("exercise_id", "exercise_id", { unique: false });
      }

      // runtime (singletons)
      if (!db.objectStoreNames.contains("runtime")) {
        db.createObjectStore("runtime", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export const DB = {
  async put(store, value) {
    return tx(store, "readwrite", (s) => s.put(value));
  },
  async get(store, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const s = t.objectStore(store);
      const req = s.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async del(store, key) {
    return tx(store, "readwrite", (s) => s.delete(key));
  },
  async all(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const s = t.objectStore(store);
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async byIndex(store, indexName, query) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const s = t.objectStore(store);
      const idx = s.index(indexName);
      const req = idx.getAll(query);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
};
