import { projectUrl, publishableKey, emailAuthEnabled } from "./supabase-config.js?v=5";

const get = (id) => document.getElementById(id);
const status = get("cloud-status");
const form = get("cloud-form");
const actions = get("cloud-actions");
const importButton = get("cloud-import");
const storage = window.kansaiTravelState;
const groups = ["favorites", "visits", "budget", "stamps"];
const table = "kansai_travel_records";

function publicKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try {
    const message = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(message)).role === "anon";
  } catch { return false; }
}

function flatten(collection, values) {
  if (collection === "budget") return new Map(Object.entries(values).flatMap(([day, items]) =>
    Object.entries(items).map(([category, value]) => [day + ":" + category, value])));
  return new Map(Object.entries(values));
}

function inflate(records) {
  const state = Object.fromEntries(groups.map((name) => [name, {}]));
  for (const { collection, item_key, value } of records) {
    if (collection === "budget") {
      const [day, category] = item_key.split(":");
      (state.budget[day] ??= {})[category] = value;
    } else if (groups.includes(collection)) state[collection][item_key] = value;
  }
  return state;
}

const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl) && publicKey(publishableKey);
if (configured) {
  loadCatalog().catch(() => { get("catalog-source").textContent = "目前顯示隨站附帶的景點資料。"; });
  if (emailAuthEnabled && storage) {
    startCloud().catch(() => {
      status.textContent = "暫時無法連到同步服務，仍可使用此裝置的資料。";
    });
  } else status.textContent = "個人清單暫存在此裝置，跨裝置登入等待啟用。";
}

async function loadCatalog() {
  const endpoint = new URL("/rest/v1/kansai_places", projectUrl);
  endpoint.searchParams.set("select", "id,content");
  endpoint.searchParams.set("order", "id");
  const response = await fetch(endpoint, { headers: { apikey: publishableKey } });
  if (!response.ok) throw new Error("Catalog unavailable");
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error("Invalid catalog");
  const count = window.kansaiApplyCatalog(records);
  get("catalog-source").textContent = "已從 Supabase 載入 " + count + " 筆景點資料";
}

async function startCloud() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.96.0");
  const client = createClient(projectUrl, publishableKey, { auth: { flowType: "pkce" } });
  let activeUser;
  let desiredUser;
  let baseline = new Map();
  let pending = new Map();
  let queue = Promise.resolve();
  const outboxKey = (user) => "kansai-outbox:" + user.id;

  function restoreOutbox(user) {
    try {
      const entries = JSON.parse(localStorage.getItem(outboxKey(user))) ?? [];
      return new Map(entries.filter(([, record]) => record.user_id === user.id && groups.includes(record.collection)));
    } catch { return new Map(); }
  }

  function keepOutbox(user) {
    try {
      if (pending.size) localStorage.setItem(outboxKey(user), JSON.stringify([...pending]));
      else localStorage.removeItem(outboxKey(user));
    } catch {
      // The active tab can still retry in-memory edits.
    }
  }

  function enqueue(task) {
    queue = queue.then(task).catch(() => {
      status.textContent = "雲端同步失敗。請檢查網路後按「手動同步」。";
    });
    return queue;
  }

  async function flush(user) {
    for (const [id, record] of pending) {
      const { user_id, collection, item_key, value } = record;
      if (user_id !== user.id || desiredUser?.id !== user.id) return;
      const result = value === undefined
        ? await client.from(table).delete().eq("user_id", user_id).eq("collection", collection).eq("item_key", item_key)
        : await client.from(table).upsert(record);
      if (result.error) throw result.error;
      if (pending.get(id) === record) pending.delete(id);
      keepOutbox(user);
    }
    status.textContent = pending.size ? "同步中…" : "已登入，資料已同步。";
  }

  function save(collection, values) {
    const user = activeUser;
    const oldItems = baseline.get(collection);
    const items = flatten(collection, values);
    const keys = new Set([...oldItems.keys(), ...items.keys()]);
    for (const item_key of keys) {
      const value = items.get(item_key);
      if (JSON.stringify(oldItems.get(item_key)) === JSON.stringify(value)) continue;
      pending.set(collection + "/" + item_key, { user_id: user.id, collection, item_key,
        value: value === undefined ? undefined : structuredClone(value) });
    }
    baseline.set(collection, structuredClone(items));
    keepOutbox(user);
    status.textContent = "同步中…";
    enqueue(() => flush(user));
    return true;
  }

  async function refresh(user) {
    if (desiredUser?.id !== user.id) return;
    if (pending.size) {
      await flush(user);
      if (pending.size) return;
    }
    const { data, error } = await client.from(table).select("collection,item_key,value").eq("user_id", user.id);
    if (error) {
      if (activeUser?.id !== user.id) status.textContent = "已登入，暫時無法讀取雲端資料。可按「手動同步」。";
      else status.textContent = "暫時無法讀取最新資料，可按「手動同步」。";
      return;
    }
    if (desiredUser?.id !== user.id || pending.size) return;
    const state = inflate(data);
    const nextBaseline = new Map(groups.map((name) => [name, flatten(name, state[name])]));
    const changed = activeUser?.id !== user.id || groups.some((name) => {
      const before = baseline.get(name);
      const after = nextBaseline.get(name);
      return before.size !== after.size || [...after].some(([key, value]) => JSON.stringify(before.get(key)) !== JSON.stringify(value));
    });
    baseline = nextBaseline;
    activeUser = user;
    if (changed) storage.useCloud(state, save);
    const device = storage.readDevice();
    importButton.hidden = !groups.some((name) => [...flatten(name, device[name]).keys()].some((key) => !baseline.get(name).has(key)));
    status.textContent = "已登入，資料已同步。";
  }

  function applySession(user) {
    const priorId = desiredUser?.id;
    desiredUser = user;
    form.hidden = Boolean(user);
    actions.hidden = !user;
    if (!user) {
      if (activeUser) storage.useDevice();
      activeUser = undefined;
      pending = new Map();
      baseline = new Map();
      importButton.hidden = true;
      status.textContent = "登入後可同步收藏、到站進度、預算與印章。";
      return;
    }
    if (priorId === user.id && activeUser?.id === user.id) return;
    if (activeUser && activeUser.id !== user.id) {
      activeUser = undefined;
      pending = new Map();
      storage.useDevice();
    }
    if (priorId !== user.id) pending = restoreOutbox(user);
    status.textContent = "正在讀取雲端資料…";
    enqueue(() => refresh(user));
  }

  client.auth.onAuthStateChange((_, session) => {
    setTimeout(() => applySession(session?.user), 0);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "正在寄送登入連結…";
    try {
      const redirect = new URL("./", location.href);
      const { error } = await client.auth.signInWithOtp({
        email: new FormData(form).get("email").trim(),
        options: { emailRedirectTo: redirect.href }
      });
      if (error) throw error;
      status.textContent = "登入連結已寄出，請用同一個瀏覽器開啟郵件中的連結。";
    } catch {
      status.textContent = "無法寄出連結。請核對電子郵件，稍後再試。";
    } finally { button.disabled = false; }
  });

  get("cloud-signout").addEventListener("click", () => enqueue(async () => {
    if (desiredUser) await flush(desiredUser);
    if (pending.size) return;
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
  }));
  get("cloud-refresh").addEventListener("click", () => {
    if (desiredUser) enqueue(() => refresh(desiredUser));
  });
  importButton.addEventListener("click", () => {
    if (!activeUser) return;
    const local = storage.readDevice();
    const merged = [];
    for (const name of groups) {
      const items = new Map(baseline.get(name));
      for (const [key, value] of flatten(name, local[name])) {
        if (!items.has(key)) items.set(key, value);
      }
      for (const [item_key, value] of items) merged.push({ collection: name, item_key, value });
    }
    const state = inflate(merged);
    groups.forEach((name) => save(name, state[name]));
    storage.useCloud(state, save);
    importButton.hidden = true;
  });

  window.addEventListener("focus", () => {
    const user = activeUser;
    if (user) enqueue(() => refresh(user));
  });
  window.addEventListener("online", () => {
    const user = activeUser;
    if (user) enqueue(() => refresh(user));
  });
}
