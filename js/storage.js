/* ==========================================================
   存檔與載入 (storage.js)
   ========================================================== */

(function loadFromStorage() {
  const raw = safeStorageGet(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.timelines) && Array.isArray(parsed.events)) {
        appData = parsed;
      }
    } catch (e) { console.error("讀取存檔失敗：", e); }
  }

  const rawUi = safeStorageGet(UI_STATE_KEY);
  if (rawUi) {
    try {
      const ui = JSON.parse(rawUi);
      if (ui && ui.activeTimelineId) activeTimelineId = ui.activeTimelineId;
    } catch (e) { /* UI 狀態壞掉無所謂，用預設的 */ }
  }
})();

/* 補齊可能缺少的欄位。舊版存檔、手動改過的檔案、或匯入的資料都可能缺，
   缺了就讓後面每一處都要各自防一次，不如在入口補好。 */
(function normalizeLoadedData() {
  if (!appData.categories || typeof appData.categories !== "object") {
    appData.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }
  Object.keys(DEFAULT_CATEGORIES).forEach(function(k) {
    if (!appData.categories[k]) appData.categories[k] = Object.assign({}, DEFAULT_CATEGORIES[k]);
  });

  if (!Array.isArray(appData.timelines) || !appData.timelines.length) {
    appData.timelines = [{ id: "tl_main", name: "主世界年表", icon: "📜" }];
  }
  if (!Array.isArray(appData.events)) appData.events = [];

  appData.events.forEach(function(ev, i) {
    if (typeof ev.sort !== "number" || !isFinite(ev.sort)) ev.sort = (i + 1) * SORT_STEP;
    if (typeof ev.when !== "string") ev.when = "";
    if (typeof ev.title !== "string") ev.title = "";
    if (typeof ev.body !== "string") ev.body = "";
    if (!DEFAULT_CATEGORIES[ev.color]) ev.color = "c_gray";
  });

  // 目前選的時間軸被刪掉了（或存檔壞了）就退回第一條
  if (!appData.timelines.find(t => t.id === activeTimelineId)) {
    activeTimelineId = appData.timelines[0].id;
  }
})();

/* localStorage 滿了或被封鎖時只提醒一次，不要每敲一個字就跳一次。
   真的存成功了才把旗標放掉——中間都還在危險狀態。 */
let storageFullNotified = false;

/* 存成功回傳 true。呼叫端多半不用管，但「匯入」那種一次寫一大包的
   要知道成功與否才能決定要不要繼續。 */
function saveData() {
  const err = safeStorageSet(STORAGE_KEY, JSON.stringify(appData));
  if (!err) {
    safeStorageSet(UI_STATE_KEY, JSON.stringify({ activeTimelineId: activeTimelineId }));
    storageFullNotified = false;
    return true;
  }
  console.error("存檔失敗：", err);
  notifyStorageProblem(err);
  return false;
}

function notifyStorageProblem(err) {
  const isQuota = err && (err.name === "QuotaExceededError" ||
                          err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22);
  // 「空間滿了」跟「瀏覽器根本不讓存」是兩回事，能做的事也完全不同
  const isBlocked = !isQuota && !storageAvailable();

  if (storageFullNotified) return;
  storageFullNotified = true;

  const modal = document.getElementById("storageModal");
  const detail = document.getElementById("storageDetail");
  const hint = document.getElementById("storageHint");

  const detailText = isQuota
    ? "這台裝置的瀏覽器儲存空間已經滿了。"
    : isBlocked
    ? "這個瀏覽器不允許網站在本機儲存資料（可能是隱私模式，或設定裡關掉了網站資料）。" +
      "在這個狀態下所有的修改都只存在記憶體裡，關掉分頁就會消失。"
    : "存檔時發生錯誤：" + (err && err.message ? err.message : "未知錯誤");

  const hintText = isBlocked
    ? "解決方法：關掉隱私／無痕模式，或在瀏覽器設定裡允許這個網站儲存資料。"
    : "先用「匯出」把資料存成檔案，再刪掉用不到的事件。";

  if (!modal) { alert(detailText + "\n\n" + hintText); return; }
  if (detail) detail.textContent = detailText;
  if (hint) hint.textContent = hintText;
  modal.classList.add("active");
}

function closeStorageModal() {
  document.getElementById("storageModal").classList.remove("active");
}

/* 產生 id。用時間戳 + 隨機字串，不用流水號——流水號在匯入別人的檔案時
   一定會撞，而撞到的後果是兩筆資料互相蓋掉。 */
function newId(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" +
         Math.random().toString(36).slice(2, 8);
}
