(() => {
  const list = document.querySelector("#shop-list");
  const panel = document.querySelector("#shops-map-panel");
  const mapElement = document.querySelector("#shops-map");
  const selected = document.querySelector("#selected-shop");
  const mapStatus = document.querySelector("#shop-map-status");
  const cityButtons = [...document.querySelectorAll("[data-shop-city]")];
  const viewButtons = [...document.querySelectorAll("[data-shop-view]")];
  const tileSource = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  let city = "";
  let view = "list";
  let selectedId;
  let leaflet;
  let map;
  let pins;
  let version = 0;

  function loadLeaflet() {
    if (leaflet) return leaflet;
    leaflet = Promise.all([["link", "vendor/leaflet/leaflet.css"], ["script", "vendor/leaflet/leaflet.js"]].map(([tag, url]) =>
      new Promise((resolve, reject) => {
        const asset = document.createElement(tag);
        if (tag === "link") { asset.rel = "stylesheet"; asset.href = url; }
        else asset.src = url;
        asset.onload = resolve;
        asset.onerror = () => { asset.remove(); reject(new Error("Map assets unavailable")); };
        document.head.append(asset);
      }))).then(() => window.L).catch((error) => { leaflet = undefined; throw error; });
    return leaflet;
  }

  function card(place) {
    const result = window.kansaiRenderShopCard(place);
    const actions = result.querySelector(".place-actions");
    const official = document.createElement("a");
    official.className = "button small";
    official.textContent = "入場與店鋪公告";
    official.href = place.notice || place.source;
    official.target = "_blank";
    official.rel = "noopener";
    actions.append(official);
    if (place.checkedAt) {
      const date = document.createElement("p");
      date.className = "place-meta";
      date.textContent = "最後查核：" + place.checkedAt;
      result.append(date);
    }
    return result;
  }

  function chooseShop(place) {
    selectedId = place?.id;
    selected.replaceChildren(...(place ? [card(place)] : []));
  }

  async function showMap(shops, token) {
    mapStatus.textContent = "正在載入地圖…";
    try {
      const L = await loadLeaflet();
      if (version !== token || view !== "map") return;
      if (!map) {
        map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true });
        const tiles = L.tileLayer(tileSource, {
          maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        tiles.on("tileerror", () => { mapStatus.textContent = "底圖暫時無法載入，仍可切換列表或直接開啟店家導航。"; });
        pins = L.layerGroup().addTo(map);
      }
      pins.clearLayers();
      const mapped = shops.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
      const points = [];
      mapped.forEach((place) => {
        const point = [place.lat, place.lng];
        points.push(point);
        const pin = L.marker(point, {
          title: place.name, alt: place.name, icon: L.divIcon({ className: "shop-pin", html: "<span>✽</span>", iconSize: [34, 34], iconAnchor: [17, 17] })
        }).addTo(pins);
        pin.on("click", () => chooseShop(place));
      });
      map.invalidateSize();
      if (points.length) map.fitBounds(points, { padding: [35, 35], maxZoom: 15, animate: false });
      else map.setView([34.85, 135.63], 9, { animate: false });
      mapStatus.textContent = points.length ? "選擇標記查看門市；精確步行路線可用店家導航。" : "這個範圍暫無已標記門市。";
    } catch {
      if (version === token) mapStatus.textContent = "地圖暫時無法載入，請使用門市列表。";
    }
  }

  function render() {
    const token = ++version;
    const shops = window.kansaiShopCatalog().filter((place) => !city || place.city === city);
    list.hidden = view === "map";
    panel.hidden = view !== "map";
    cityButtons.forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.shopCity === city)));
    viewButtons.forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.shopView === view)));
    if (view === "map") {
      chooseShop(shops.find((place) => place.id === selectedId) ?? shops[0]);
      showMap(shops, token);
    } else list.replaceChildren(...shops.map(card));
  }

  cityButtons.forEach((node) => node.addEventListener("click", () => { city = node.dataset.shopCity; render(); }));
  viewButtons.forEach((node) => node.addEventListener("click", () => { view = node.dataset.shopView; render(); }));
  window.addEventListener("kansai:catalog", render);
  render();
})();
