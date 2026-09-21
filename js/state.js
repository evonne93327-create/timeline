/* ==========================================================
   全域狀態與常數 (state.js)
   ========================================================== */

/* 分類色。跟「世界觀架構工作台」同一組七色、同一個順序
   （灰紅橙黃綠藍紫：灰是中性放最前，其餘照色相環），
   之後兩邊要互通的時候才對得起來。 */
const DEFAULT_CATEGORIES = {
  "c_gray":   { name: "一般事件", bg: "#EFE9DC", text: "#5A4F42", dot: "#8A7C69" },
  "c_rose":   { name: "重大轉折", bg: "#F3DAD5", text: "#8C3527", dot: "#C05A46" },
  "c_orange": { name: "戰爭衝突", bg: "#F3E1CC", text: "#8A4F1F", dot: "#C4803A" },
  "c_yellow": { name: "傳說神話", bg: "#F2E8C9", text: "#7A5B12", dot: "#BFA033" },
  "c_green":  { name: "建立與誕生", bg: "#DCEAE1", text: "#2C5A44", dot: "#4F9070" },
  "c_blue":   { name: "地理與遷徙", bg: "#DCE7F0", text: "#28506B", dot: "#4E82AB" },
  "c_purple": { name: "人物生平", bg: "#E7DFF0", text: "#553B76", dot: "#8464B0" }
};

/* 夜間版的同一組分類。色相跟日間對齊，只換明暗，
   所以「紫色＝人物生平」在兩個主題下都還是紫的。

   名稱不放這裡：使用者改過的名字存在 appData.categories，兩個主題共用。 */
const DARK_CATEGORIES = {
  "c_gray":   { bg: "#33302A", text: "#D5CCBC", dot: "#A0937E" },
  "c_rose":   { bg: "#3A2220", text: "#E7A194", dot: "#D4776B" },
  "c_orange": { bg: "#3A2A1B", text: "#E2B079", dot: "#D19A5C" },
  "c_yellow": { bg: "#363019", text: "#DCC98A", dot: "#C9B267" },
  "c_green":  { bg: "#1E3229", text: "#99D0B3", dot: "#6FB894" },
  "c_blue":   { bg: "#1F2E3C", text: "#9FC4E2", dot: "#6F9FC7" },
  "c_purple": { bg: "#2D2539", text: "#C4AFDD", dot: "#9B7FC4" }
};

/* 主題目前是不是暗的。唯一的判斷來源是 <html data-theme>，由 js/theme.js
   寫入；CSS 與 JS 看同一個值，不會各自解讀。 */
function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function getCategory(key) {
  const id = DEFAULT_CATEGORIES[key] ? key : "c_gray";
  const saved = (appData && appData.categories && appData.categories[id]) || DEFAULT_CATEGORIES[id];
  const colors = isDarkTheme() ? DARK_CATEGORIES[id] : DEFAULT_CATEGORIES[id];
  return { id: id, name: saved.name || DEFAULT_CATEGORIES[id].name,
           bg: colors.bg, text: colors.text, dot: colors.dot };
}

/* ==========================================================
   localStorage 的安全存取

   不是只有「空間滿了」一種壞法：瀏覽器設定關掉網站資料、企業政策、
   某些嚴格的隱私模式下，光是讀 window.localStorage 這個屬性本身就會丟
   SecurityError。沒有包起來的話，一丟例外整個檔案就在那裡中斷，後面的
   宣告全部沒執行到，函式因為提升看起來還在、一呼叫就撞上 TDZ。

   結果是 app 看起來完全正常，但每次存檔都在背景丟例外、什麼都沒存進去，
   而且不會告訴使用者。這是最糟的一種壞法，所有存取一律走這三個工具。
   ========================================================== */
function storageAvailable() {
  try {
    const k = "__probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
}

function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}

/* 存成功回傳 null，失敗回傳那個 error——呼叫端要據此決定怎麼告訴使用者 */
function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); return null; } catch (e) { return e; }
}

function safeStorageRemove(key) {
  try { window.localStorage.removeItem(key); } catch (e) { /* 存不了就不用刪 */ }
}

/* ---------- 常數 ---------- */

const STORAGE_KEY = "timeline_data_v1";
const UI_STATE_KEY = "timeline_ui_v1";
const THEME_KEY = "timeline_theme";

const COMMON_ICONS = ["📜", "🌍", "⚔️", "👑", "🏰", "🐉", "🔮", "⛵", "🗿", "🌗", "🔥", "❄️", "🌱", "⭐", "🕯️", "📖"];

/* 新事件的排序值預設接在最後一筆後面 +10。
   留間隔是為了讓「插在這兩件事中間」不用把後面全部重編號。 */
const SORT_STEP = 10;

const INITIAL_APP_DATA = {
  version: 1,
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  timelines: [
    { id: "tl_main", name: "主世界年表", icon: "📜" }
  ],
  events: [
    {
      id: "ev_1", timelineId: "tl_main",
      title: "創世", when: "舊曆元年", sort: 10,
      body: "諸神分割光與影，大陸自海中升起。",
      color: "c_yellow"
    },
    {
      id: "ev_2", timelineId: "tl_main",
      title: "北境之戰", when: "舊曆340年", sort: 20,
      body: "白銀騎士團於北境抵禦霜雪巨獸，戰役極為慘烈。",
      color: "c_orange"
    },
    {
      id: "ev_3", timelineId: "tl_main",
      title: "反抗軍成立", when: "舊曆512年 春", sort: 30,
      body: "黑市的情報商人串連各地勢力，反抗組織正式浮上檯面。",
      color: "c_rose"
    }
  ]
};

let appData = JSON.parse(JSON.stringify(INITIAL_APP_DATA));
let activeTimelineId = "tl_main";
let editingEventId = null;      // null = 正在新增
let editingTimelineId = null;
