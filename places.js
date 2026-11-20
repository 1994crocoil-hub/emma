const kyotoGuide = "https://kyoto.travel/en/getting-around/";
const chiikawaGuide = "https://chiikawa-info.jp/ck_land";

const places = {
  inari: ["伏見稻荷大社", "伏見稲荷大社", "Fushimi Inari Taisha Kyoto", "JR 稻荷站", "稻荷站出站後，沿神社入口方向前往表參道。", "上山有階梯，可依體力在鳥居途中折返。", "景點", "https://kyoto.travel/en/getting-around/comfortable-access-to-fushimi-fushimi-inari-taisha-shrine/"],
  kiyomizu: ["清水寺・二年坂", "清水寺・二寧坂", "Kiyomizu-dera Kyoto", "市巴士清水道站", "下車後依步行導航走向清水寺。", "步道有坡度。參拜時間與票價可先查寺院公告。", "景點", "https://www.kiyomizudera.or.jp/en/"],
  gion: ["祇園散步", "祇園・花見小路", "Hanamikoji Street Gion Kyoto", "京阪祇園四條站", "出站後從四條通往花見小路。", "請遵守私人巷道與拍攝告示。", "景點", "https://kyoto.travel/en/"],
  arashiyama: ["嵐山竹林・渡月橋", "嵐山 竹林の小径・渡月橋", "Arashiyama Bamboo Forest Kyoto", "JR 嵯峨嵐山站", "依景點導航先往竹林，再步行到渡月橋。", "沿途以戶外步行為主。", "景點", "https://www.kyoto.travel/en/areas/saga-arashiyama/"],
  nishiki: ["錦市場", "錦市場", "Nishiki Market Kyoto", "阪急京都河原町站", "出站後步行至錦小路通。", "各攤商營業時間不同。", "美食", "https://www.kyoto-nishiki.or.jp/"],
  pontocho: ["鴨川・先斗町", "鴨川・先斗町", "Pontocho Alley Kyoto", "京阪三條站", "從三條大橋往河岸與先斗町方向步行。", "想吃指定餐廳時，請先查是否需訂位。", "美食", kyotoGuide],
  castle: ["大阪城公園", "大阪城公園", "Osaka Castle Park", "JR 大阪城公園站", "出站後依公園指標步行。", "若要參觀天守閣，先查票券、入場規定與開放時間。", "景點", "https://www.osakacastle.net/"],
  shinsaibashi: ["心齋橋筋商店街", "心斎橋筋商店街", "Shinsaibashi-suji Shopping Street Osaka", "Osaka Metro 心齋橋站", "出站後往心齋橋筋商店街。", "店家營業時間各自公告。", "購物", "https://www.shinsaibashi.or.jp/"],
  dotonbori: ["道頓堀・戎橋", "道頓堀・戎橋", "Dotonbori Osaka", "Osaka Metro 難波站", "由難波往道頓堀川與戎橋方向步行。", "河畔與戎橋是戶外路段，餐廳可另查訂位。", "美食", "https://www.osaka-info.jp/en/spot/dotonbori/"],
  kuromon: ["黑門市場", "黒門市場", "Kuromon Ichiba Market Osaka", "Osaka Metro 日本橋站", "出站後沿市場指標進入商店街。", "各攤商營業時間不同。", "美食", "https://kuromon.com/"],
  shinsekai: ["新世界・通天閣", "新世界・通天閣", "Tsutenkaku Osaka", "Osaka Metro 惠美須町站", "從惠美須町往通天閣步行，或從 JR 新今宮站出發。", "登塔前確認票券與當日入場方式。", "景點", "https://www.osaka-info.jp/en/spot/tsutenkaku/"],
  umeda: ["梅田藍天大廈", "梅田スカイビル", "Umeda Sky Building Osaka", "JR 大阪站", "使用空中庭園官網的交通頁，依出站位置選擇步行路線。", "展望台需門票。", "景點", "https://www.skybldg.co.jp/"],
  mogumogu: ["吉伊卡哇本舗京都伏見店", "ちいかわもぐもぐ本舗 京都伏見店", "Chiikawa Mogumogu Honpo Kyoto Fushimi", "JR 稻荷站", "沿伏見稻荷大社參道前往，官網列 JR 稻荷站步行約 5 分鐘。", "入店整理券或預約依官方當期公告。", "角色商店", "https://www.chiikawamogumogu.jp/stores/fushimi/"],
  chikyoto: ["吉伊卡哇樂園 京都四條河原町店", "ちいかわらんど 京都四条河原町店", "Chiikawa Land Kyoto Shijo Kawaramachi", "阪急京都河原町站", "搭阪急到京都河原町後，往 KIDDY LAND 京都四條河原町店。", "出發前查店面樓層、營業及入場公告。", "角色商店", chiikawaGuide],
  chishinsaibashi: ["吉伊卡哇樂園 心齋橋 PARCO 店", "ちいかわらんど 心斎橋パルコ店", "Chiikawa Land Shinsaibashi Parco", "Osaka Metro 心齋橋站", "至心齋橋 PARCO 內的 KIDDY LAND。", "新商品發售時的入場與購買方式見官方公告。", "角色商店", chiikawaGuide],
  chiumeda: ["吉伊卡哇樂園 大阪梅田店", "ちいかわらんど 大阪梅田店", "Chiikawa Land Osaka Umeda", "阪急大阪梅田站", "由大阪梅田站前往阪急三番街。", "出發前確認館休與當日入場公告。", "角色商店", chiikawaGuide],
  railway: ["京都鐵道博物館", "京都鉄道博物館", "Kyoto Railway Museum", "JR 梅小路京都西站", "由梅小路京都西站往梅小路公園側。", "室內展館，參觀前查休館日與票券。", "室內", "https://www.kyotorailwaymuseum.jp/en/access/"],
  manga: ["京都國際漫畫博物館", "京都国際マンガミュージアム", "Kyoto International Manga Museum", "京都市營地下鐵烏丸御池站", "出站後往烏丸通，依博物館交通頁步行。", "參觀前查休館日、票券和當期展覽。", "室內", "https://kyotomm.jp/en/"],
  history: ["大阪歷史博物館", "大阪歴史博物館", "Osaka Museum of History", "Osaka Metro 谷町四丁目站", "搭谷町線或中央線到谷町四丁目，依館方指示出站。", "參觀前確認展覽和休館日。", "室內", "https://www.osakamushis.jp/"],
  aquarium: ["大阪海遊館", "海遊館", "Osaka Aquarium Kaiyukan", "Osaka Metro 大阪港站", "從大阪港站向天保山港灣村步行。", "入場時段與票券以海遊館官方公告為準。", "室內", "https://www.kaiyukan.com/"]
};

const planDays = [
  { city: "京都", area: "伏見稻荷・東山", stops: [["inari", 2], ["kiyomizu", 3], ["gion", 1.5]], indoor: "railway", shop: "mogumogu" },
  { city: "京都", area: "嵐山・錦市場", stops: [["arashiyama", 3], ["nishiki", 1.5], ["pontocho", 1.5]], indoor: "manga", shop: "chikyoto" },
  { city: "大阪", area: "大阪城・難波", stops: [["castle", 2.5], ["shinsaibashi", 2], ["dotonbori", 2]], indoor: "history", shop: "chishinsaibashi" },
  { city: "大阪", area: "新世界・梅田", stops: [["kuromon", 1.5], ["shinsekai", 2], ["umeda", 2]], indoor: "aquarium", shop: "chiumeda" }
];

const addresses = {
  inari: "京都府京都市伏見区深草藪之内町68",
  kiyomizu: "京都府京都市東山区清水1丁目294",
  mogumogu: "京都府京都市伏見区深草稲荷中之町46-1",
  shinsekai: "大阪府大阪市浪速区恵美須東1丁目18-6",
  chishinsaibashi: "大阪府大阪市中央区心斎橋筋1丁目8-3 心斎橋PARCO"
};

const catalogDays = new Map();

function placeInfo(id) {
  const [name, japanese, map, station, access, visit, category, source] = places[id];
  const routeDay = planDays.findIndex(item => item.shop === id || item.indoor === id || item.stops.some(([stop]) => stop === id)) + 1;
  const day = routeDay || catalogDays.get(id);
  return { id, name, japanese, map, station, access, visit, category, source, address: addresses[id], day, city: planDays[day - 1].city };
}

const railRoutes = {
  kyoto: { name: "關西機場 → 京都站", service: "JR 特急 HARUKA", note: "到 JR 關西機場站，搭往京都的班次。搭車前核對停靠與特急券。", link: "https://www.westjr.co.jp/travel-information/tc/tickets-passes/oneway/haruka/" },
  namba: { name: "關西機場 → 南海難波站", service: "南海 Rapi:t 或空港急行", note: "到南海關西機場站搭車，Rapi:t 另需特急券。", link: "https://www.nankai.co.jp/en_railway/access-timetable" },
  osaka: { name: "關西機場 → 大阪站", service: "JR 特急 HARUKA 或關空快速", note: "兩種車停靠月台可能不同，請核對當天班次與出入口。", link: "https://www.westjr.co.jp/travel-information/tc/train-usage-guide/howto/guide/" },
  between: { name: "京都站 → 大阪站", service: "JR 京都線", note: "從 JR 京都站搭往大阪方向；已在四條河原町時也可比較阪急路線。", link: "https://kyoto.travel/en/getting-to/" }
};
