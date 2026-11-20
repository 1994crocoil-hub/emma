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
const routeLinks = document.querySelectorAll("#day-route-top, #day-route-mobile, #day-route-card");
const routeCaption = document.querySelector("#route-caption");
const routeCard = routeCaption.closest(".route-card");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.documentElement;
const motionToggle = document.querySelector(".motion-toggle");
const scrollProgress = document.querySelector(".reading-progress");
const postcard = document.querySelector("[data-parallax]");
const pointerPreference = window.matchMedia("(hover: hover) and (pointer: fine)");
const activeAnimations = new Set();

try {
  if (sessionStorage.getItem("kansai-motion") === "off") root.dataset.motion = "off";
} catch {
  // The toggle also works in browsers that disable session storage.
}

function motionEnabled() {
  return !motionPreference.matches && root.dataset.motion !== "off";
}

function animatePart(element, keyframes, options) {
  if (!motionEnabled() || !element.animate) return;
  const animation = element.animate(keyframes, options);
  activeAnimations.add(animation);
  animation.finished.then(
    () => activeAnimations.delete(animation),
    () => activeAnimations.delete(animation)
  );
}

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
  const inKyoto = Number(day) <= 2;
  routeCaption.textContent = "Day " + day + " · " + (inKyoto ? "京都" : "大阪");
  routeCard.dataset.city = inKyoto ? "kyoto" : "osaka";
  dayButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.day === day)));
  schedule.replaceChildren(...stops.map(renderStop));
  const route = mapsUrl("dir", {
    origin: stops[0].map,
    destination: stops[2].map,
    waypoints: stops[1].map,
    travelmode: "transit"
  });
  routeLinks.forEach((link) => { link.href = route; });
  if (animate) {
    [...schedule.children].forEach((row, index) => animatePart(
      row,
      [{ opacity: .4, transform: "translateY(9px)" }, { opacity: 1, transform: "none" }],
      { duration: 370, delay: index * 52, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "backwards" }
    ));
  }
}

dayButtons.forEach((button) => {
  button.addEventListener("click", () => showDay(button.dataset.day, true));
});

document.querySelectorAll("[data-city-day]").forEach((link) => {
  link.addEventListener("click", () => showDay(link.dataset.cityDay, true));
});
showDay("1");

if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver((entries, observer) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      if (target.hasAttribute("data-reveal-photo")) {
        animatePart(target,
          [{ clipPath: "inset(0 0 20% 0)" }, { clipPath: "inset(0)" }],
          { duration: 810, easing: "cubic-bezier(.22, 1, .36, 1)" });
        return;
      }
      animatePart(target,
        [{ opacity: .52, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }],
        { duration: 600, easing: "cubic-bezier(.22, 1, .36, 1)" });
    });
  }, { threshold: .12 });

  document.querySelectorAll("[data-reveal], [data-reveal-photo]").forEach((element) => reveal.observe(element));
}

let scrollFrame;
function updateReadingProgress() {
  if (scrollFrame || !motionEnabled()) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    if (!motionEnabled()) return;
    const scrollRoom = Math.max(1, root.scrollHeight - root.clientHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollRoom));
    scrollProgress.style.transform = "scaleX(" + progress + ")";
  });
}

function resetPointer() {
  postcard.style.removeProperty("--pointer-x");
  postcard.style.removeProperty("--pointer-y");
}

function syncMotion() {
  motionToggle.hidden = motionPreference.matches;
  motionToggle.textContent = motionEnabled() ? "關閉動畫" : "開啟動畫";
  if (motionEnabled()) {
    updateReadingProgress();
    return;
  }
  activeAnimations.forEach((animation) => animation.cancel());
  resetPointer();
  scrollProgress.style.removeProperty("transform");
}

motionToggle.addEventListener("click", () => {
  root.dataset.motion = motionEnabled() ? "off" : "on";
  try {
    sessionStorage.setItem("kansai-motion", root.dataset.motion);
  } catch {
    // The current page still keeps the selected setting.
  }
  syncMotion();
});
motionPreference.addEventListener("change", syncMotion);
window.addEventListener("scroll", updateReadingProgress, { passive: true });
window.addEventListener("resize", updateReadingProgress, { passive: true });

postcard.addEventListener("pointermove", (event) => {
  if (!pointerPreference.matches || event.pointerType === "touch" || !motionEnabled()) return;
  const { left, top, width, height } = postcard.getBoundingClientRect();
  postcard.style.setProperty("--pointer-x", ((event.clientX - left) / width - .5) * 19 + "px");
  postcard.style.setProperty("--pointer-y", ((event.clientY - top) / height - .5) * 14 + "px");
}, { passive: true });
postcard.addEventListener("pointerleave", resetPointer);
syncMotion();
