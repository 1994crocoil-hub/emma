import { projectUrl, publishableKey, emailAuthEnabled } from "./supabase-config.js?v=5";

const get = (id) => document.getElementById(id);
const form = get("editor-form");
const status = get("editor-status");
const layout = document.querySelector(".admin-shell");
const list = get("editor-list");
const signin = get("admin-signin");
const inputs = ["name", "japanese", "map", "station", "access", "booking", "category", "source"];
const optional = ["aliases", "city", "day", "address", "notice", "lat", "lng", "checked_at"];
const statusNames = { draft: "草稿", published: "已發布", archived: "已下架" };
const auditNames = { save: "儲存草稿", publish: "發布", archive: "下架", review: "標記已查核" };
const fieldNames = {
  name: "中文名", japanese: "日文名", map: "地圖搜尋名稱", station: "車站",
  access: "步行提示", booking: "預約方式", category: "分類", source: "官方來源",
  aliases: "搜尋別名", day: "行程日期", city: "城市", address: "地址",
  notice: "入場公告", lat: "緯度", lng: "經度", checked_at: "最後查核日期"
};
const group = [...document.querySelectorAll("[data-editor-filter]")];
let rows = [];
let place;
let filter = "all";
let dirty = false;
let busy = false;
let authorization = 0;
let checkedUser;

const node = (tag, text) => { const element = document.createElement(tag); element.textContent = text; return element; };
const value = (name) => form.elements.namedItem(name);
const validUrl = (url) => /^https:\/\//i.test(url ?? "");
const linked = (id) => planDays.some((plan) => plan.indoor === id || plan.shop === id || plan.stops.some(([stop]) => stop === id));

function reviewReasons(row) {
  const content = row.content;
  const reasons = [];
  const cutoff = Date.now() - 90 * 86400000;
  const checked = Date.parse(content.checked_at);
  if (!Number.isFinite(checked)) reasons.push("未查核");
  else if (checked < cutoff) reasons.push("超過 90 天");
  if (!validUrl(content.fields[7])) reasons.push("缺官方來源");
  if (!content.fields[5]?.trim()) reasons.push("缺預約資訊");
  return reasons;
}

function renderList() {
  const needle = get("editor-search").value.trim().toLowerCase();
  const visible = rows.filter((row) => (filter !== "review" || (row.status !== "archived" && reviewReasons(row).length)) &&
    [row.id, ...row.content.fields, row.content.aliases].join(" ").toLowerCase().includes(needle));
  if (filter === "review") visible.sort((a, b) => Number(linked(b.id) || b.content.fields[6] === "角色商店")
    - Number(linked(a.id) || a.content.fields[6] === "角色商店")
    || (a.content.checked_at ?? "").localeCompare(b.content.checked_at ?? ""));
  get("editor-count").textContent = visible.length + " 筆景點";
  list.replaceChildren(...visible.map((row) => {
    const item = node("button", row.content.fields[0] || "未命名草稿");
    item.type = "button";
    item.className = "editor-list-item";
    item.setAttribute("aria-pressed", String(place?.id === row.id));
    item.append(node("small", [statusNames[row.status], ...reviewReasons(row)].join(" · ")));
    item.addEventListener("click", () => selectPlace(row));
    return item;
  }));
}

function payload() {
  const result = { fields: inputs.map((name) => value(name).value.trim()) };
  for (const name of optional) {
    const raw = value(name).value.trim();
    if (!raw) continue;
    result[name] = ["day", "lat", "lng"].includes(name) ? Number(raw) : raw;
  }
  return result;
}

function renderPreview() {
  const data = payload();
  const [label, japanese, , station, access, booking, category] = data.fields;
  const area = get("editor-preview");
  area.replaceChildren(node("h3", label || "景點名稱"));
  for (const line of [japanese, [data.city, category, station].filter(Boolean).join(" ・ "), data.address, access, booking,
    data.checked_at ? "最後查核：" + data.checked_at : "最後查核：尚未記錄"]) {
    if (line) area.append(node("p", line));
  }
  const link = get("editor-source");
  link.hidden = !validUrl(data.fields[7]);
  if (!link.hidden) link.href = data.fields[7];
}

let client;
let logRequest = 0;
async function renderLog() {
  const request = ++logRequest;
  const output = get("editor-log");
  output.replaceChildren();
  if (!place?.version) return;
  try {
    const { data, error } = await client.from("kansai_editor_log").select("kind, changed_fields, occurred_at")
      .eq("place_id", place.id).order("id", { ascending: false }).limit(20);
    if (request !== logRequest) return;
    if (error) throw error;
    output.replaceChildren(...data.map(({ kind, changed_fields, occurred_at }) => node("li",
      new Date(occurred_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) +
      " ・ " + auditNames[kind] + (changed_fields.length ? " ・ " + changed_fields.map((change) => fieldNames[change] ?? change).join("、") : ""))));
  } catch {
    if (request === logRequest) output.append(node("li", "暫時無法讀取異動紀錄。"));
  }
}

function selectPlace(row, force = false) {
  if (busy && !force) return;
  if (dirty && !force && !confirm("目前有未儲存的變更。要切換景點嗎？")) return;
  place = row;
  dirty = false;
  form.reset();
  if (row) {
    inputs.forEach((name, i) => { value(name).value = row.content.fields[i] ?? ""; });
    const days = planDays.findIndex((plan) => plan.indoor === row.id || plan.shop === row.id || plan.stops.some(([stop]) => stop === row.id)) + 1;
    optional.forEach((name) => { if (row.content[name] !== undefined) value(name).value = row.content[name]; });
    value("day").value = row.content.day || days || 1;
    value("city").value = row.content.city || planDays[Number(value("day").value) - 1].city;
  }
  get("editor-title").textContent = row ? (row.content.fields[0] || "未命名") + " · " + statusNames[row.status] : "新增景點";
  get("editor-review").disabled = !row;
  get("editor-archive").disabled = !row || row.status === "archived";
  renderPreview();
  renderList();
  renderLog();
}

function newId() {
  return "place" + [...crypto.getRandomValues(new Uint8Array(12))].map((byte) => String.fromCharCode(97 + byte % 26)).join("");
}

async function save(operation) {
  if (busy) return;
  if (["review", "archive"].includes(operation) && dirty) {
    status.textContent = "請先儲存或發布這次修改，再做查核或下架。";
    return;
  }
  if (operation === "archive" && !confirm("下架後，這個景點會從公開搜尋、地圖及行程中隱藏。要下架嗎？")) return;
  const data = payload();
  const hasCoordinates = Number.isFinite(data.lat) || Number.isFinite(data.lng);
  if (["save", "publish"].includes(operation) && (!form.reportValidity() ||
      (hasCoordinates && (!Number.isFinite(data.lat) || !Number.isFinite(data.lng))) ||
      (data.notice && !validUrl(data.notice)))) {
    status.textContent = "請核對網址與地圖座標。";
    return;
  }
  if (operation === "publish" && (![0, 1, 2].every((i) => data.fields[i]) || !validUrl(data.fields[7]))) {
    status.textContent = "發布前請填中文名、日文名、地圖搜尋名稱與 HTTPS 官方來源。";
    return;
  }
  busy = true;
  const currentAuthorization = authorization;
  get("editor-fields").disabled = true;
  status.textContent = "正在處理…";
  try {
    const { data: result, error } = await client.rpc("kansai_edit_place", {
      place_key: place?.id ?? newId(), operation,
      payload: ["save", "publish"].includes(operation) ? data : null,
      expected_version: place?.version ?? 0
    });
    if (error) throw error;
    if (currentAuthorization !== authorization) return;
    const saved = Array.isArray(result) ? result[0] : result;
    if (!saved?.id) throw new Error("Missing result");
    rows = rows.some((row) => row.id === saved.id) ? rows.map((row) => row.id === saved.id ? saved : row) : [...rows, saved];
    selectPlace(saved, true);
    status.textContent = auditNames[operation] + "成功。";
  } catch (error) {
    status.textContent = error.code === "40001" ? "另一位編輯已更新該景點。請複製未儲存的文字，再重新整理。" : "操作未完成，請核對資料或登入狀態後再試。";
  } finally {
    get("editor-fields").disabled = false;
    busy = false;
  }
}

form.addEventListener("input", () => { dirty = true; renderPreview(); });
form.addEventListener("submit", (event) => { event.preventDefault(); save(event.submitter?.value ?? "save"); });
get("editor-new").addEventListener("click", () => selectPlace(null));
get("editor-review").addEventListener("click", () => save("review"));
get("editor-archive").addEventListener("click", () => save("archive"));
get("editor-search").addEventListener("input", renderList);
group.forEach((control) => control.addEventListener("click", () => {
  filter = control.dataset.editorFilter;
  group.forEach((item) => item.setAttribute("aria-pressed", String(item === control)));
  renderList();
}));

async function authorize(session) {
  const ticket = ++authorization;
  checkedUser = session?.user?.id;
  layout.hidden = true;
  signin.hidden = true;
  if (!session) {
    rows = [];
    place = undefined;
    dirty = false;
    status.textContent = "請用有管理權限的信箱登入旅行手帳。";
    signin.hidden = false;
    return;
  }
  try {
    const { data: allowed, error } = await client.rpc("kansai_editor_access");
    if (ticket !== authorization) return;
    if (error) throw error;
    if (!allowed) { status.textContent = "這個登入帳號沒有景點編輯權限。"; return; }
    const result = await client.from("kansai_place_drafts").select("id,content,status,version,updated_at").order("id");
    if (ticket !== authorization) return;
    if (result.error) throw result.error;
    rows = result.data;
    layout.hidden = false;
    status.textContent = "已登入景點管理。";
    selectPlace(rows[0], true);
  } catch {
    if (ticket === authorization) status.textContent = "暫時無法確認管理權限，請重新整理。";
  }
}

async function start() {
  if (!emailAuthEnabled) {
    status.textContent = "景點管理已準備，等待啟用 Supabase 電子郵件登入。";
    return;
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.96.0");
  client = createClient(projectUrl, publishableKey, { auth: { flowType: "pkce" } });
  client.auth.onAuthStateChange((event, session) => {
    if (["INITIAL_SESSION", "SIGNED_OUT", "USER_UPDATED"].includes(event) ||
        (event === "SIGNED_IN" && session?.user?.id !== checkedUser))
      setTimeout(() => authorize(session), 0);
  });
}
start().catch(() => { status.textContent = "目前無法連線，請重新整理。"; });
