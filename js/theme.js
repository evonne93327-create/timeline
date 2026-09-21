/* ==========================================================
   日夜主題與設定總表 (theme.js)

   偏好存在 localStorage 而不是 appData：主題是「這台裝置」的事，
   不該跟著匯出的檔案跑到別台裝置上去。
   ========================================================== */

function getThemePref() {
  const v = safeStorageGet(THEME_KEY);
  return (v === "light" || v === "dark") ? v : "auto";
}

function resolveTheme(pref) {
  if (pref === "light" || pref === "dark") return pref;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (e) { return "light"; }
}

function applyTheme(pref) {
  document.documentElement.setAttribute("data-theme", resolveTheme(pref));
  /* 分類色是 JS 直接寫進 style 的，CSS 換了變數它們不會跟著變，
     所以切主題一定要重畫一次。少了這行會出現一半亮一半暗的畫面。 */
  if (typeof renderAll === "function") renderAll();
}

function setThemePref(pref) {
  if (pref === "auto") safeStorageRemove(THEME_KEY);
  else safeStorageSet(THEME_KEY, pref);
  applyTheme(pref);
  renderThemeChoice();
  renderSettingsRows();
}

function initTheme() {
  applyTheme(getThemePref());
  try {
    // 使用者在系統設定裡切換時要跟著變（只有「跟隨系統」才需要反應）
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function() {
      if (getThemePref() === "auto") applyTheme("auto");
    });
  } catch (e) { /* 舊瀏覽器沒有 addEventListener，維持載入時的判斷 */ }
}

/* ==========================================================
   設定總表

   每一列點進去開各自的視窗，子視窗關掉一律回到總表——從總表點進去的人
   心裡是「進了一層」，關掉那一層應該退回上一層，而不是整個關光。
   ========================================================== */

function openSettingsModal() {
  renderSettingsRows();
  openModal("settingsModal");
}

function closeSettingsModal() {
  settingsChildId = null;   // 是使用者自己關掉總表，不要再回來
  closeModal("settingsModal");
}

let settingsChildId = null;
const settingsWatched = {};

function settingsGoTo(open) {
  closeSettingsModal();
  if (typeof open !== "function") return;
  open();

  /* 哪一個彈窗被打開了，由「開完之後誰是 active」決定，不用在每個呼叫點
     各自寫死 id——那種東西一定會有人漏掉。匯入是叫出檔案選擇器、根本
     沒開彈窗，這時候就什麼都不記。 */
  const opened = document.querySelectorAll(".modal-overlay.active");
  settingsChildId = opened.length ? opened[opened.length - 1].id : null;
  if (settingsChildId) watchSettingsChild(settingsChildId);
}

function watchSettingsChild(id) {
  if (settingsWatched[id]) return;
  const modal = document.getElementById(id);
  if (!modal) return;
  settingsWatched[id] = true;

  new MutationObserver(function() {
    if (modal.classList.contains("active")) return;
    if (settingsChildId !== id) return;
    settingsChildId = null;
    /* 子視窗自己又開了別的彈窗時不要插隊，等那一層也收掉了再回來，
       否則設定會蓋在確認視窗底下。 */
    if (document.querySelector(".modal-overlay.active")) return;
    openSettingsModal();
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
}

function renderSettingsRows() {
  const v = document.getElementById("appearanceValue");
  if (v) {
    const pref = getThemePref();
    v.textContent = pref === "light" ? "日間" : (pref === "dark" ? "夜間" : "跟隨系統");
  }
  const t = document.getElementById("timelineRowValue");
  if (t) t.textContent = appData.timelines.length + " 條";
}

function openAppearanceModal() {
  closeSettingsModal();
  renderThemeChoice();
  openModal("appearanceModal");
}

function closeAppearanceModal() {
  closeModal("appearanceModal");
  openSettingsModal();
}

function renderThemeChoice() {
  const pref = getThemePref();
  const row = document.getElementById("themeChoice");
  if (!row) return;
  row.querySelectorAll(".theme-opt").forEach(function(btn) {
    const on = btn.getAttribute("data-theme") === pref;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  // 選「跟隨系統」時把現在實際是哪一邊講出來，否則使用者只看到一個沒有回饋的選項
  const hint = document.getElementById("themeAutoHint");
  if (hint) {
    hint.textContent = (pref === "auto")
      ? "跟隨這台裝置的設定，目前是" + (resolveTheme("auto") === "dark" ? "夜間" : "日間")
      : "";
  }
}
