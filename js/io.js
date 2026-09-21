/* ==========================================================
   匯出與匯入 (io.js)

   這個 app 的資料只存在這台裝置的 localStorage 裡——沒有雲端、沒有帳號。
   所以「匯出」不是加分功能，是唯一的備份手段，要做得夠穩。
   ========================================================== */

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 不放掉的話這個 blob 會一直佔著記憶體，直到整頁被關掉
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

/* 檔名一律用 ASCII。中文檔名在部分 Chromium 版本上會變成沒有副檔名的
   「download」，使用者拿到一個打不開的檔案還不知道為什麼。 */
function timestampForFilename() {
  const d = new Date();
  const p = function(n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" +
         p(d.getHours()) + p(d.getMinutes());
}

function exportAll() {
  downloadJSON(appData, "timeline_backup_" + timestampForFilename() + ".json");
  showHint("已匯出備份檔");
}

function triggerImport() {
  document.getElementById("importFile").click();
}

function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  // 先清掉，否則選同一個檔案第二次不會觸發 change
  e.target.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.onerror = function() { alert("讀取檔案失敗。"); };
  reader.onload = function() {
    let parsed;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch (err) {
      alert("這個檔案不是有效的 JSON，沒辦法匯入。");
      return;
    }
    const clean = validateImported(parsed);
    if (!clean) {
      alert("這個檔案看起來不是這個 app 匯出的備份，沒辦法匯入。");
      return;
    }

    /* 匯入會整包換掉，換掉之前先把現在這份存成檔案。
       使用者以為自己在「加進來」、實際是「取代掉」的情況太常見了，
       而這個 app 沒有雲端可以救。 */
    const n = clean.events.length;
    if (!confirm("匯入會用檔案裡的內容「取代」目前全部的資料" +
                 "（" + appData.timelines.length + " 條時間軸、" + appData.events.length + " 件事" +
                 " → " + clean.timelines.length + " 條、" + n + " 件事）。\n\n" +
                 "按確定之前會先自動下載一份目前資料的備份。要繼續嗎？")) return;

    downloadJSON(appData, "timeline_before_import_" + timestampForFilename() + ".json");

    appData = clean;
    activeTimelineId = appData.timelines[0].id;
    if (!saveData()) return;    // 存不進去的話已經跳過提示了
    renderAll();
    closeSettingsModal();
    showHint("已匯入 " + n + " 件事");
  };
  reader.readAsText(file);
}

/* 匯入的檔案來路不明——可能是別人給的、也可能是使用者自己手改壞的。
   一律重新組一份乾淨的物件，只留認得的欄位、型別不對就換成預設值，
   不要把原物件直接接上去（多帶的欄位會一路跟著存進 localStorage）。

   回傳 null 代表這份檔案根本不是這個 app 的東西。 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function validateImported(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!Array.isArray(raw.timelines) || !Array.isArray(raw.events)) return null;

  const str = function(v) { return typeof v === "string" ? v : ""; };

  const timelines = [];
  const seen = {};
  raw.timelines.forEach(function(t) {
    if (!t || typeof t !== "object") return;
    const id = str(t.id);
    if (!id || !SAFE_ID.test(id) || seen[id]) return;   // 重複的 id 會讓事件歸錯邊
    seen[id] = true;
    timelines.push({
      id: id,
      name: str(t.name).slice(0, 100) || "未命名時間軸",
      icon: str(t.icon).slice(0, 8) || "📜"
    });
  });
  if (!timelines.length) return null;

  const events = [];
  raw.events.forEach(function(ev) {
    if (!ev || typeof ev !== "object") return;
    const id = str(ev.id);
    const tid = str(ev.timelineId);
    if (!id || !SAFE_ID.test(id)) return;
    if (!seen[tid]) return;        // 掛在不存在的時間軸上＝永遠看不到，不如不收
    const title = str(ev.title).slice(0, 200);
    const when = str(ev.when).slice(0, 100);
    if (!title && !when) return;   // 兩個都空的不是一件事，只是雜訊

    const sort = Number(ev.sort);
    events.push({
      id: id, timelineId: tid, title: title, when: when,
      sort: isFinite(sort) ? sort : events.length * SORT_STEP,
      body: str(ev.body),
      color: DEFAULT_CATEGORIES[ev.color] ? ev.color : "c_gray"
    });
  });

  const categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  if (raw.categories && typeof raw.categories === "object") {
    Object.keys(categories).forEach(function(k) {
      const name = raw.categories[k] && str(raw.categories[k].name);
      if (name) categories[k].name = name.slice(0, 40);
    });
  }

  return { version: 1, categories: categories, timelines: timelines, events: events };
}
