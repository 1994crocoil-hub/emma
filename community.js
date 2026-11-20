import { projectUrl, publishableKey } from "./supabase-config.js?v=5";

const section = document.querySelector("[data-community]");
const list = section.querySelector("[data-community-list]");
const status = section.querySelector("[data-community-status]");
const more = section.querySelector("[data-community-more]");
const pageSize = 9;
let offset = 0;
let request;
let retry = false;

function element(tag, text, className) {
  const item = document.createElement(tag);
  item.textContent = text;
  if (className) item.className = className;
  return item;
}

function suggestionCard({ name, city, category, reason }) {
  const card = element("article", "", "catalog-card community-card");
  card.append(element("h3", name), element("p", city + " · " + category, "place-meta"));
  if (reason) card.append(element("p", reason, "community-reason"));
  const map = element("a", "開啟地圖", "text-link");
  const search = new URL("https://www.google.com/maps/search/");
  search.search = new URLSearchParams({ api: "1", query: name + " " + city + " 日本" });
  map.href = search.href;
  map.target = "_blank";
  map.rel = "noopener";
  card.append(map);
  return card;
}

async function loadCommunity(reset = false) {
  if (reset) offset = 0;
  request?.abort();
  const controller = new AbortController();
  request = controller;
  const timer = setTimeout(() => controller.abort(), 12000);
  const startingOffset = offset;
  more.disabled = true;
  retry = false;
  status.textContent = offset ? "正在載入更多推薦…" : "正在載入推薦…";

  try {
    const url = new URL("/rest/v1/rpc/kansai_community_spots", projectUrl);
    url.search = new URLSearchParams({ page_offset: startingOffset, page_size: pageSize + 1 });
    const response = await fetch(url, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (request !== controller) return;
    if (!Array.isArray(data)) throw new Error();
    const cards = data.slice(0, pageSize).map(suggestionCard);
    if (!startingOffset) list.replaceChildren(...cards);
    else list.append(...cards);
    offset = startingOffset + cards.length;
    status.textContent = offset ? "已顯示 " + offset + " 則推薦" : "還沒有人推薦，歡迎分享你的口袋名單。";
    more.textContent = "顯示更多推薦";
    more.hidden = data.length <= pageSize;
    if (startingOffset && cards[0]) cards[0].querySelector("a").focus();
  } catch {
    if (request !== controller) return;
    status.textContent = "暫時無法載入推薦。";
    retry = true;
    more.textContent = "重新載入";
    more.hidden = false;
  } finally {
    clearTimeout(timer);
    if (request === controller) more.disabled = false;
  }
}

more.addEventListener("click", () => loadCommunity(retry));
window.addEventListener("kansai:suggestion-sent", () => loadCommunity(true));
loadCommunity();
