const query = (selector) => document.querySelector(selector);
const schedule = query("#schedule");
const dayButtons = [...document.querySelectorAll("[data-day]")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const routeLinks = document.querySelectorAll("#day-route-top, #day-route-mobile, #day-route-card");
const routeCaption = query("#route-caption");
const savePanel = query("#saved-results");
const notice = query("#planner-notice");
const japaneseDialog = query("#japanese-card");
const timing = ["早上", "下午", "晚上"];

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem("kansai-" + key)) ?? fallback; }
  catch { return fallback; }
}

function write(key, value) {
  if (cloudWriter && key in syncedCollections) return cloudWriter(key, value);
  try { localStorage.setItem("kansai-" + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

const favorites = read("favorites", {});
const visits = read("visits", {});
const budgets = read("budget", {});
const stamps = read("stamps", {});
const preferences = read("preferences", {});
const syncedCollections = { favorites, visits, budget: budgets, stamps };
let cloudWriter;

function applyTravelState(state, writer) {
  cloudWriter = writer;
  for (const [name, collection] of Object.entries(syncedCollections)) {
    Object.keys(collection).forEach((key) => { delete collection[key]; });
    Object.assign(collection, state[name]);
  }
  renderStamps();
  renderDay();
  refreshSaved();
  renderBudget(true);
}

window.kansaiTravelState = {
  useCloud: applyTravelState,
  readDevice: () => Object.fromEntries(Object.keys(syncedCollections).map((name) => [name, read(name, {})])),
  useDevice: () => applyTravelState(window.kansaiTravelState.readDevice(), null)
};
const validDay = (value) => /^[1-4]$/.test(String(value));
const validVariant = (value) => ["full", "short", "rain"].includes(value);
let day = 1;
let mode = "plan";
let variant = "full";

function readLocation() {
  const params = new URLSearchParams(location.search);
  const linkDay = params.get("day");
  day = validDay(linkDay) ? Number(linkDay) : validDay(preferences.day) ? Number(preferences.day) : 1;
  mode = params.get("mode") === "travel" || (!linkDay && preferences.mode === "travel") ? "travel" : "plan";
  variant = validVariant(params.get("route")) ? params.get("route") : "full";
}
readLocation();

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function external(text, href, className = "text-link") {
  const link = element("a", className, text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}

function button(text, action, className = "button small") {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function mapsUrl(path, params) {
  return "https://www.google.com/maps/" + path + "/?" + new URLSearchParams({ api: "1", ...params });
}

const mapPlace = (place) => mapsUrl("search", { query: place.map });
let noticeTimer;
function announce(message) {
  notice.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ""; }, 3500);
}

function showJapanese(place) {
  if (!japaneseDialog.showModal) {
    window.open(mapPlace(place), "_blank", "noopener");
    return;
  }
  query("#japanese-title").textContent = place.japanese;
  const address = query("#japanese-address");
  address.hidden = !place.address;
  address.textContent = place.address ?? "";
  japaneseDialog.querySelector("a").href = mapPlace(place);
  japaneseDialog.showModal();
}

function saveButton(place) {
  const node = button("收藏", () => {
    const saved = !favorites[place.id];
    if (saved) favorites[place.id] = place.day;
    else delete favorites[place.id];
    const stored = write("favorites", favorites);
    refreshSaved();
    announce(stored ? (saved ? "已收藏「" + place.name + "」" : "已移除收藏") : "已更新本頁清單，瀏覽器無法永久儲存");
    if (saved) animatePart(node, [{ transform: "scale(.89) rotate(-5deg)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
  });
  node.dataset.savePlace = place.id;
  updateSaveButton(node);
  return node;
}

function updateSaveButton(node) {
  const saved = Boolean(favorites[node.dataset.savePlace]);
  node.setAttribute("aria-pressed", String(saved));
  node.textContent = saved ? "已收藏" : "收藏";
  node.setAttribute("aria-label", node.textContent + "「" + places[node.dataset.savePlace][0] + "」");
}

function detailsFor(place) {
  const details = element("details", "place-details");
  const summary = element("summary", "", "交通與參觀資訊");
  const body = element("div", "detail-body");
  const japanese = element("p", "", place.japanese);
  japanese.lang = "ja";
  body.append(japanese, element("p", "", place.access), element("p", "", place.visit));
  if (place.category === "角色商店") body.append(element("p", "", "官方店鋪名錄查核：2026-11-20"));
  body.append(
    external("官方資訊", place.source), button("日文出示卡", () => showJapanese(place)));
  details.append(summary, body);
  return details;
}

function placeCard(place, kind, supplementary = "") {
  const card = element("article", kind);
  const title = element("h3", "", place.name);
  const main = element("div", "place-main");
  main.append(title, element("p", "place-meta", place.station + supplementary));
  const actions = element("div", "place-actions");
  actions.append(external("地圖", mapPlace(place), "button small"), saveButton(place));
  card.append(main, actions, detailsFor(place));
  return card;
}

function currentStops() {
  const stops = planDays[day - 1].stops.map(([id, duration], index) => ({ ...placeInfo(id), duration, time: timing[index] }));
  if (variant === "rain") stops[0] = { ...placeInfo(planDays[day - 1].indoor), duration: 2, time: timing[0] };
  return variant === "short" ? [stops[0], stops[2]] : stops;
}

function shareUrl() {
  const url = new URL(location.href);
  url.searchParams.set("day", day);
  url.searchParams.delete("mode");
  if (variant === "full") url.searchParams.delete("route");
  else url.searchParams.set("route", variant);
  url.hash = "itinerary";
  return url;
}

function updateLocation() {
  const url = shareUrl();
  if (mode === "travel") url.searchParams.set("mode", mode);
  history.replaceState(null, "", url);
  preferences.day = day;
  preferences.mode = mode;
  write("preferences", preferences);
}

function renderDay(animate = false) {
  const info = planDays[day - 1];
  const stops = currentStops();
  const visited = visits[day] ?? [];
  const upcoming = stops.find((stop) => !visited.includes(stop.id));
  const travelling = mode === "travel";
  routeCaption.textContent = "Day " + day + " · " + info.city;
  routeCaption.closest(".route-card").dataset.city = info.city === "京都" ? "kyoto" : "osaka";
  dayButtons.forEach((node) => node.setAttribute("aria-pressed", String(+node.dataset.day === day)));
  modeButtons.forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.mode === mode)));
  query("#route-variant").value = variant;
  query("#route-duration").textContent = "建議停留合計約 " + stops.reduce((total, stop) => total + stop.duration, 0) + " 小時（交通時間另計）";

  const orderedStops = travelling && upcoming ? [upcoming, ...stops.filter((stop) => stop.id !== upcoming.id)] : stops;
  const rows = orderedStops.map((stop) => {
    const current = travelling && stop.id === upcoming?.id;
    const card = placeCard(stop, "stop stop-enhanced", " · 建議停留約 " + stop.duration + " 小時");
    const label = visited.includes(stop.id) ? "已到站" : current ? "下一站" : stop.time;
    card.prepend(element("p", "stop-time", label));
    if (current) {
      card.setAttribute("aria-current", "step");
      const complete = button("我已到站", () => {
        visits[day] = [...visited, stop.id];
        write("visits", visits);
        renderDay(true);
        (query('[aria-current="step"] .complete-stop') ?? query(".day-stamp")).focus();
      }, "button small complete-stop");
      card.querySelector(".place-actions").append(complete);
    }
    return card;
  });
  schedule.replaceChildren(...rows);

  if (travelling) {
    const remaining = stops.filter((stop) => !visited.includes(stop.id)).length;
    query("#travel-status").textContent = upcoming ? "下一站：" + upcoming.name + "，尚有 " + remaining + " 站" : "今日行程已完成";
    if (!remaining) {
      if (!stamps[day]) {
        stamps[day] = true;
        write("stamps", stamps);
        renderStamps();
      }
      const stamp = element("div", "day-stamp");
      stamp.tabIndex = -1;
      const mark = element("span", "stamp-mark");
      const character = element("img");
      const characters = [["chiikawa", "吉伊卡哇"], ["hachiware", "小八貓"], ["usagi", "兔兔"]];
      const [file, name] = characters[(day - 1) % characters.length];
      character.src = "assets/" + file + ".png";
      character.alt = name;
      mark.append(character);
      stamp.append(mark, element("strong", "", "Day " + day + " · " + info.city + "紀念章"));
      stamp.append(button("重新開始今日路線", () => {
        delete visits[day];
        write("visits", visits);
        renderDay();
        query(".complete-stop")?.focus();
      }));
      schedule.append(stamp);
      if (animate) animatePart(stamp, [{ transform: "scale(.95)", opacity: .5 }, { transform: "none", opacity: 1 }], { duration: 320 });
    }
  } else query("#travel-status").textContent = "";

  const route = mapsUrl("dir", {
    origin: stops[0].map,
    destination: stops.at(-1).map,
    ...(stops.length > 2 ? { waypoints: stops.slice(1, -1).map((stop) => stop.map).join("|") } : {}),
    travelmode: "transit"
  });
  routeLinks.forEach((link) => { link.href = route; });
  if (travelling && upcoming) query("#day-route-mobile").href = mapPlace(upcoming);

  renderAssigned();
  if (animate) rows.forEach((row, index) => animatePart(row,
    [{ opacity: .55, transform: "translateY(7px)" }, { opacity: 1, transform: "none" }],
    { duration: 330, delay: index * 36, easing: "ease-out" }));
}

const variantPicker = element("div", "variant-picker");
const variantLabel = element("label", "", "路線選擇");
const picker = element("select");
picker.id = "route-variant";
[["full", "四日手帳路線"], ["short", "精簡散步"], ["rain", "雨天備案"]].forEach(([value, name]) => {
  const option = element("option", "", name);
  option.value = value;
  picker.append(option);
});
variantLabel.append(picker);
const duration = element("p", "route-duration");
duration.id = "route-duration";
variantPicker.append(variantLabel, duration);
query(".planner-controls").after(variantPicker);
picker.addEventListener("change", () => {
  variant = picker.value;
  updateLocation();
  renderDay(true);
});

function selectDay(value, newMode = mode) {
  day = Number(value);
  mode = newMode;
  updateLocation();
  renderDay(true);
}

dayButtons.forEach((node) => node.addEventListener("click", () => selectDay(node.dataset.day)));
modeButtons.forEach((node) => node.addEventListener("click", () => selectDay(day, node.dataset.mode)));
document.querySelectorAll("[data-entry]").forEach((link) => link.addEventListener("click", () => selectDay(day, link.dataset.entry)));
document.querySelectorAll("[data-city-day]").forEach((link) => link.addEventListener("click", () => selectDay(link.dataset.cityDay, "plan")));
window.addEventListener("popstate", () => { readLocation(); renderDay(); });

async function shareDay() {
  const url = shareUrl().href;
  try {
    if (!navigator.clipboard?.writeText) throw new Error();
    await navigator.clipboard.writeText(url);
    announce("已複製 Day " + day + " 行程連結");
  } catch {
    window.prompt("複製 Day " + day + " 行程連結", url);
  }
}

function downloadDay() {
  const plan = planDays[day - 1];
  const saved = assignedToDay();
  const text = [
    "京都・大阪旅行手帳", "Day " + day + "　" + plan.city + "・" + plan.area,
    ...currentStops().flatMap((stop) => ["", stop.time + "　" + stop.name, "日文：" + stop.japanese,
      "車站：" + stop.station, ...(stop.address ? ["地址：" + stop.address] : []), stop.access, stop.visit, mapPlace(stop), stop.source]),
    ...(saved.length ? ["", "我的清單", ...saved.map((id) => {
      const place = placeInfo(id);
      return place.name + "／" + place.japanese + "／" + place.station;
    })] : [])
  ].join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", text], { type: "text/plain;charset=utf-8" }));
  const link = element("a");
  link.href = url;
  link.download = "kansai-day-" + day + ".txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("已準備離線行程檔");
}

query("#share-day").addEventListener("click", shareDay);
query("#download-day").addEventListener("click", downloadDay);

const search = query("#place-search");
const cityFilter = query("#place-city");
const categoryFilter = query("#place-category");
const resultList = query("#place-results");
const more = query("#more-places");
let fullCatalog = Object.keys(places).map(placeInfo);
let resultLimit = 6;
const normalized = (text) => text.normalize("NFKC").toLowerCase().replace(/[齋斎斉]/g, "斋")
  .replace(/稻/g, "稲").replace(/黑/g, "黒").replace(/鐵/g, "鉄").replace(/[\s・－-]+/g, "");

function renderPlaces() {
  const words = search.value.trim().split(/\s+/).map(normalized).filter(Boolean);
  const results = fullCatalog.filter((place) =>
    (!cityFilter.value || place.city === cityFilter.value) &&
    (!categoryFilter.value || place.category === categoryFilter.value) &&
    words.every((word) => normalized([place.name, place.japanese, place.map, place.station, place.category].join(" ")).includes(word))
  );
  query("#place-count").textContent = results.length ? results.length + " 個地點" : "沒有符合的地點，試試其他關鍵字或分類。";
  resultList.replaceChildren(...results.slice(0, resultLimit).map((place) =>
    placeCard(place, "catalog-card", " · " + place.city + " · " + place.category)));
  more.hidden = resultLimit >= results.length;
}

function resetPlaces() { resultLimit = 6; renderPlaces(); }
search.addEventListener("input", resetPlaces);
[cityFilter, categoryFilter].forEach((node) => node.addEventListener("change", resetPlaces));
const shopFilter = query("#shop-filter");
shopFilter.addEventListener("click", () => {
  const enable = categoryFilter.value !== "角色商店";
  search.value = "";
  cityFilter.value = "";
  categoryFilter.value = enable ? "角色商店" : "";
  resetPlaces();
});
more.addEventListener("click", () => {
  const firstNew = resultLimit;
  resultLimit += 6;
  renderPlaces();
  resultList.children[firstNew]?.querySelector("a")?.focus();
});

function assignedToDay() {
  return Object.keys(favorites).filter((id) => Number(favorites[id]) === day && places[id]);
}

function renderAssigned() {
  const assigned = assignedToDay();
  const panel = query("#assigned-places");
  panel.hidden = !assigned.length;
  const entries = assigned.map((id) => {
    const place = placeInfo(id);
    const row = element("li");
    row.append(external(place.name, mapPlace(place)));
    return row;
  });
  panel.querySelector("ul").replaceChildren(...entries);
}

function refreshSaved() {
  renderAssigned();
  document.querySelectorAll("[data-save-place]").forEach(updateSaveButton);
  const entries = Object.entries(favorites).filter(([id, assigned]) => places[id] && validDay(assigned));
  if (!entries.length) {
    savePanel.replaceChildren(element("p", "empty-saved", "清單還是空的。從景點或行程卡點「收藏」，就能加進來。"));
    return;
  }
  entries.sort((a, b) => a[1] - b[1]);
  savePanel.replaceChildren(...entries.map(([id, assigned]) => {
    const place = placeInfo(id);
    const row = element("article", "saved-row");
    const dayLabel = element("label", "saved-day", "安排到");
    const select = element("select");
    select.setAttribute("aria-label", "安排「" + place.name + "」的日期");
    for (let number = 1; number <= 4; number++) {
      const option = element("option", "", "Day " + number);
      option.value = number;
      select.append(option);
    }
    select.value = assigned;
    select.addEventListener("change", () => {
      favorites[id] = Number(select.value);
      const stored = write("favorites", favorites);
      renderAssigned();
      announce(stored ? "已安排到 Day " + select.value : "已更新本頁清單，瀏覽器無法永久儲存");
    });
    dayLabel.append(select);
    const remove = button("移除", () => {
      delete favorites[id];
      write("favorites", favorites);
      refreshSaved();
      (savePanel.querySelector("button") ?? query("#saved a")).focus();
    });
    row.append(element("h3", "", place.name), dayLabel, external("地圖", mapPlace(place)), remove);
    return row;
  }));
}

const stampGallery = query("#stamp-gallery");
const postcardDownload = query("#download-postcard");
function renderStamps() {
  stampGallery.replaceChildren(...planDays.map(({ city }, index) => {
    const number = index + 1;
    const stamp = element("span", "gallery-stamp", (stamps[number] ? "✽ " : "") + "Day " + number + " · " + city);
    stamp.dataset.earned = String(Boolean(stamps[number]));
    stamp.setAttribute("aria-label", stamp.textContent + (stamps[number] ? "，已取得" : "，未取得"));
    return stamp;
  }));
  postcardDownload.disabled = !planDays.every((_, index) => stamps[index + 1]);
}

async function downloadPostcard() {
  const image = new Image();
  image.src = "assets/kansai-dusk.webp";
  try {
    await image.decode();
    const canvas = element("canvas");
    canvas.width = 1440;
    canvas.height = 960;
    const context = canvas.getContext("2d");
    if (!context) throw new Error();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.fillStyle = "#291d34";
    context.fillRect(52, 675, 1336, 230);
    context.fillStyle = "#fff0d1";
    context.font = "bold 61px serif";
    context.fillText("京都・大阪旅行手帳", 108, 776);
    context.font = "bold 31px sans-serif";
    context.fillText("✽　KANSAI　/　DAY 1–4", 110, 844);
    canvas.toBlob((blob) => {
      if (!blob) { announce("這台裝置無法產生明信片"); return; }
      const url = URL.createObjectURL(blob);
      const link = element("a");
      link.href = url;
      link.download = "kansai-postcard.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } catch {
    announce("暫時無法產生明信片，請稍後再試");
  }
}
postcardDownload.addEventListener("click", downloadPostcard);

const budgetDay = query("#budget-day");
const budgetInputs = [...document.querySelectorAll("[data-budget]")];
const formatYen = new Intl.NumberFormat("zh-TW");
const cost = (value) => Math.min(99999999, Math.max(0, Math.trunc(Number(value) || 0)));
const sum = (values) => Object.values(values ?? {}).reduce((total, value) => total + cost(value), 0);

function renderBudget(updateFields = false) {
  const values = budgets[budgetDay.value] ?? {};
  if (updateFields) budgetInputs.forEach((input) => { input.value = values[input.dataset.budget] ?? ""; });
  query("#budget-total").textContent = "當日 ¥" + formatYen.format(sum(values)) +
    " ・ 四日合計 ¥" + formatYen.format(Object.values(budgets).reduce((total, values) => total + sum(values), 0));
}
budgetDay.addEventListener("change", () => renderBudget(true));
budgetInputs.forEach((input) => input.addEventListener("input", () => {
  const value = cost(input.value);
  if (input.value && value !== Number(input.value)) input.value = value;
  (budgets[budgetDay.value] ??= {})[input.dataset.budget] = value;
  write("budget", budgets);
  renderBudget();
}));

const rail = query("#rail-route");
function renderRail() {
  const route = railRoutes[rail.value];
  query("#rail-result").replaceChildren(element("h3", "", route.service), element("p", "", route.note),
    external("查官方時刻與搭乘方式", route.link));
}
rail.addEventListener("change", renderRail);

window.kansaiApplyCatalog = (records) => {
  let loaded = 0;
  let changed = false;
  for (const { id, content } of records) {
    if (!/^[a-z]+$/.test(id) || !Array.isArray(content?.fields) || content.fields.length !== 8 ||
        !content.fields.every((value) => typeof value === "string" && value.trim()) ||
        !/^https:\/\//.test(content.fields[7])) continue;
    if (!Object.hasOwn(places, id) && !validDay(content.day)) continue;
    if (JSON.stringify(places[id]) !== JSON.stringify(content.fields) || addresses[id] !== content.address) {
      places[id] = content.fields;
      addresses[id] = typeof content.address === "string" ? content.address : undefined;
      changed = true;
    }
    if (validDay(content.day)) {
      changed ||= catalogDays.get(id) !== Number(content.day);
      catalogDays.set(id, Number(content.day));
    }
    loaded += 1;
  }
  if (changed) {
    fullCatalog = Object.keys(places).map(placeInfo);
    renderDay();
    renderPlaces();
    refreshSaved();
  }
  return loaded;
};

renderStamps();
renderDay();
renderPlaces();
refreshSaved();
renderBudget(true);
renderRail();
document.querySelectorAll(".planner-controls, .discover-controls, .transit-finder, .budget-controls, #shop-filter")
  .forEach((node) => { node.hidden = false; });
