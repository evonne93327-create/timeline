/* ==========================================================
   共用的 UI 基礎建設 (ui.js)

   彈窗的鍵盤與焦點、手機的返回鍵、浮出提示。
   這三樣在「世界觀架構工作台」那邊是踩過坑之後才補上的，
   這裡從第一天就放進來，不要再踩一次。
   ========================================================== */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* 這台裝置主要是用手指操作的嗎。

   不能用寬度判斷：iPad 橫放超過 768px，版面算桌機，但它一樣沒有實體鍵盤。
   凡是「會不會吵到使用者」的判斷都要看這個。 */
function isTouchPrimary() {
  try {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  } catch (e) { return "ontouchstart" in window; }
}

/* ---------- 手機版的時間軸抽屜 ----------

   桌機上側欄是常駐的，這幾個函式在那邊等於沒作用（CSS 讓 .drawer-open
   沒有任何效果）。不去判斷「現在是不是手機」是刻意的：判斷寫在 CSS 的
   媒體查詢裡就好，JS 再判一次就會有兩份會走鐘的真相。 */

function sidebarDrawerOpen() {
  const el = document.getElementById("sidebar");
  return !!el && el.classList.contains("drawer-open");
}

function openSidebarDrawer() {
  const el = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  if (el) el.classList.add("drawer-open");
  if (ov) ov.classList.add("active");
}

function closeSidebarDrawer() {
  const el = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  if (el) el.classList.remove("drawer-open");
  if (ov) ov.classList.remove("active");
}

function toggleSidebarDrawer() {
  if (sidebarDrawerOpen()) closeSidebarDrawer(); else openSidebarDrawer();
}

/* ---------- 彈窗 ---------- */

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

function topMostModal() {
  const open = Array.from(document.querySelectorAll(".modal-overlay.active"));
  return open.length ? open[open.length - 1] : null;
}

/* 關閉時去「按下那個彈窗自己的關閉按鈕」，而不是直接拿掉 .active：
   有些彈窗的關閉是有副作用的（子視窗要回到設定總表），繞過會出事。 */
function dismissModal(modal) {
  if (!modal) return;
  const closeBtn = modal.querySelector(".modal-head .icon-btn");
  if (closeBtn) { closeBtn.click(); return; }
  const cancel = Array.from(modal.querySelectorAll("button")).find(function(b) {
    return /取消|關閉|知道了|稍後/.test(b.textContent || "");
  });
  if (cancel) { cancel.click(); return; }
  modal.classList.remove("active");
}

function focusablesIn(el) {
  return Array.from(el.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(function(n) { return n.offsetWidth > 0 || n.offsetHeight > 0; });
}

let focusBeforeModal = null;

function setupModalKeyboard() {
  document.querySelectorAll(".modal-overlay").forEach(function(modal) {
    modal.addEventListener("mousedown", function(e) {
      if (e.target === modal) dismissModal(modal);
    });

    /* 用 MutationObserver 攔「被加上 .active」，而不是去改每個開啟函式：
       以後新增的彈窗自動就有這些行為，不會有人忘記。 */
    new MutationObserver(function() {
      if (!modal.classList.contains("active")) return;
      if (!focusBeforeModal) focusBeforeModal = document.activeElement;

      const card = modal.querySelector(".modal-card") || modal;
      if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1");

      /* 觸控裝置不自動聚焦輸入框：會把軟體鍵盤叫出來，鍵盤又把彈窗擠掉
         半個畫面。手機上沒有 Tab 鍵要導航，聚焦本來就沒有桌機上的價值。 */
      const input = isTouchPrimary()
        ? null
        : focusablesIn(card).find(function(n) { return /^(INPUT|TEXTAREA)$/.test(n.tagName); });
      (input || card).focus();
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  });

  document.addEventListener("keydown", function(e) {
    const modal = topMostModal();
    if (e.key === "Escape") {
      if (!modal) return;
      e.preventDefault();
      dismissModal(modal);
      return;
    }
    if (e.key === "Tab" && modal) {   // Tab 不要跑出彈窗，在裡面繞回來
      const card = modal.querySelector(".modal-card") || modal;
      const targets = focusablesIn(card);
      if (!targets.length) return;
      const first = targets[0], last = targets[targets.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  new MutationObserver(function() {
    if (document.querySelector(".modal-overlay.active")) return;
    if (focusBeforeModal && document.contains(focusBeforeModal)) {
      try { focusBeforeModal.focus(); } catch (e) {}
    }
    focusBeforeModal = null;
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
}

/* ==========================================================
   手機的返回鍵

   在手機上，看到一個蓋住畫面的東西，第一個反射動作就是按返回鍵。
   不處理的話按下去會直接離開 app，正在填的東西就這樣丟了。

   做法：算出「現在有幾層東西是返回鍵該收掉的」，讓瀏覽器的歷史深度跟著
   對齊。誰開的、怎麼關的都不用管——不管是點 ✕、點遮罩、按 Esc 還是程式
   自己關掉，層數一變就會自動對齊。

   反過來也要對齊：使用者按 ✕ 關掉時，推出去的那筆歷史要自己收回來，
   否則會累積一堆空紀錄，變成「按了三次返回鍵都沒反應」。
   ========================================================== */

let uiHistoryDepth = 0;     // 我們往歷史推了幾筆
let uiHistoryPending = 0;   // 還有幾次 popstate 是 history.go() 自己的回音
let uiHistoryTimer = null;

/* 返回鍵該收掉的東西有幾層。抽屜也算一層——它蓋住半個畫面，
   在手機上看到它的第一個反射動作一樣是按返回鍵。 */
function openLayerCount() {
  return document.querySelectorAll(".modal-overlay.active").length + (sidebarDrawerOpen() ? 1 : 0);
}

function syncUiHistory() {
  const n = openLayerCount();
  if (n === uiHistoryDepth) return;

  if (n > uiHistoryDepth) {
    // 不給 URL：網址不變，重新整理還是回到同一頁
    for (let i = uiHistoryDepth; i < n; i++) history.pushState({ layer: i + 1 }, "");
    uiHistoryDepth = n;
    return;
  }
  const diff = uiHistoryDepth - n;
  uiHistoryDepth = n;
  uiHistoryPending += diff;
  history.go(-diff);
}

/* 一次操作可能連續改好幾層（關掉設定、同時開子視窗），
   等這一輪跑完再一次對齊，不要中間每一步都去動歷史。 */
function scheduleUiHistorySync() {
  if (uiHistoryTimer) return;
  uiHistoryTimer = setTimeout(function() { uiHistoryTimer = null; syncUiHistory(); }, 0);
}

function setupBackButton() {
  if (!history.state) history.replaceState({ base: true }, "");

  new MutationObserver(scheduleUiHistorySync)
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });

  window.addEventListener("popstate", function() {
    if (uiHistoryPending > 0) { uiHistoryPending--; return; }
    /* 彈窗疊在抽屜上面，所以先收彈窗、再收抽屜。
       兩個都沒開就讓它正常往回走（真的離開 app）。 */
    const modal = topMostModal();
    if (!modal && !sidebarDrawerOpen()) return;

    /* 先把計數減掉：瀏覽器已經幫我們吐掉那一筆了，
       這裡再去 history.go() 會多退一步，直接跳出 app。 */
    if (uiHistoryDepth > 0) uiHistoryDepth--;
    if (modal) dismissModal(modal); else closeSidebarDrawer();
    // 收尾：關不掉的會被補回一筆，關掉之後又開了別的也在這裡對齊
    scheduleUiHistorySync();
  });
}

/* ---------- 浮出提示 ---------- */

let hintTimer = null;

function showHint(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("active");
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(function() {
    el.classList.remove("active");
    hintTimer = null;
  }, 2600);
}
