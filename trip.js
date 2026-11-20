const itinerary = {
  1: [
    { time: "早上", name: "伏見稻荷大社", station: "JR 稻荷站", duration: "約 2 小時", map: "Fushimi Inari Taisha Kyoto" },
    { time: "下午", name: "清水寺・二年坂", station: "市巴士清水道站", duration: "約 3 小時", map: "Kiyomizu-dera Kyoto" },
    { time: "晚上", name: "祇園散步", station: "京阪祇園四條站", duration: "約 1.5 小時", map: "Gion Kyoto" }
  ],
  2: [
    { time: "早上", name: "嵐山竹林・渡月橋", station: "JR 嵯峨嵐山站", duration: "約 3 小時", map: "Arashiyama Bamboo Forest Kyoto" },
    { time: "下午", name: "錦市場", station: "阪急京都河原町站", duration: "約 1.5 小時", map: "Nishiki Market Kyoto" },
    { time: "晚上", name: "鴨川・先斗町", station: "京阪三條站", duration: "約 1.5 小時", map: "Pontocho Alley Kyoto" }
  ],
  3: [
    { time: "早上", name: "大阪城公園", station: "JR 大阪城公園站", duration: "約 2.5 小時", map: "Osaka Castle Park" },
    { time: "下午", name: "心齋橋筋商店街", station: "Osaka Metro 心齋橋站", duration: "約 2 小時", map: "Shinsaibashi-suji Shopping Street Osaka" },
    { time: "晚上", name: "道頓堀・戎橋", station: "Osaka Metro 難波站", duration: "約 2 小時", map: "Dotonbori Osaka" }
  ],
  4: [
    { time: "早上", name: "黑門市場", station: "Osaka Metro 日本橋站", duration: "約 1.5 小時", map: "Kuromon Ichiba Market Osaka" },
    { time: "下午", name: "新世界・通天閣", station: "Osaka Metro 惠美須町站", duration: "約 2 小時", map: "Tsutenkaku Osaka" },
    { time: "晚上", name: "梅田藍天大廈", station: "JR 大阪站", duration: "約 2 小時", map: "Umeda Sky Building Osaka" }
  ]
};

const schedule = document.querySelector("#schedule");
const dayButtons = document.querySelectorAll("[data-day]");
const routeLinks = document.querySelectorAll("#day-route-top, #day-route-mobile");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let scheduleAnimation;

function mapsUrl(path, query) {
  return "https://www.google.com/maps/" + path + "/?" + new URLSearchParams({ api: "1", ...query });
}

function renderStop(stop) {
  const row = document.createElement("article");
  row.className = "stop";

  const time = document.createElement("p");
  time.className = "stop-time";
  time.textContent = stop.time;

  const details = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = stop.name;
  const info = document.createElement("p");
  info.textContent = stop.station + " · 建議停留" + stop.duration;
  details.append(title, info);

  const map = document.createElement("a");
  map.className = "text-link stop-map";
  map.href = mapsUrl("search", { query: stop.map });
  map.target = "_blank";
  map.rel = "noopener";
  map.textContent = "開啟地圖";
  map.setAttribute("aria-label", "開啟" + stop.name + "的地圖");
  row.append(time, details, map);
  return row;
}

function showDay(day, animate = false) {
  const stops = itinerary[day];
  dayButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.day === day)));
  schedule.replaceChildren(...stops.map(renderStop));
  const route = mapsUrl("dir", {
    origin: stops[0].map,
    destination: stops[2].map,
    waypoints: stops[1].map,
    travelmode: "transit"
  });
  routeLinks.forEach((link) => { link.href = route; });
  if (animate) animateSchedule();
}

dayButtons.forEach((button) => {
  button.addEventListener("click", () => showDay(button.dataset.day, true));
});

document.querySelectorAll("[data-city-day]").forEach((link) => {
  link.addEventListener("click", () => showDay(link.dataset.cityDay, true));
});
showDay("1");

function animateSchedule() {
  if (motionPreference.matches || !schedule.animate) return;
  scheduleAnimation?.cancel();
  scheduleAnimation = schedule.animate(
    [{ opacity: .5, transform: "translateY(5px)" }, { opacity: 1, transform: "none" }],
    { duration: 230, easing: "ease-out" }
  );
}

if ("IntersectionObserver" in window) {
  const scrollReveal = new IntersectionObserver((entries, observer) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      if (motionPreference.matches || !target.animate) return;
      target.animate(
        [{ opacity: .72, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
        { duration: 450, easing: "ease-out" }
      );
    });
  }, { rootMargin: "0px 0px -12px" });

  document.querySelectorAll("[data-reveal]").forEach((element) => scrollReveal.observe(element));
}
