/* ==========================================================
   進入點 (app.js)
   ========================================================== */

window.addEventListener("DOMContentLoaded", function() {
  initTheme();
  renderAll();
  setupModalKeyboard();
  setupBackButton();
  setupDesktopShortcuts();
  setupViewportWatch();
  registerServiceWorker();
});

/* 電腦版的鍵盤快捷。只做一個：N ＝ 新增事件。

   不用 Ctrl/Cmd 組合鍵：那些多半已經被瀏覽器佔走（Ctrl+N 是開新視窗，
   攔不下來）。單鍵在「沒有在打字」的前提下是安全的，文字編輯器與
   這類工具的慣例也是如此。

   三種情況不能攔：焦點在輸入框裡（那是在打字）、有彈窗開著（N 可能是
   要填進欄位的字），以及按著修飾鍵（那是別的快捷）。 */
function setupDesktopShortcuts() {
  document.addEventListener("keydown", function(e) {
    if (e.key !== "n" && e.key !== "N") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".modal-overlay.active")) return;

    const el = document.activeElement;
    const tag = el ? el.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || (el && el.isContentEditable)) return;

    e.preventDefault();
    openEventModal();
  });
}

/* 視窗寬度跨過手機／桌機的分界時，把抽屜收掉。

   抽屜開著的時候把視窗拉寬（或手機轉向），.drawer-open 會留在那裡——
   桌機的 CSS 不理它，所以畫面看起來正常，但遮罩還在，點哪裡都沒反應。

   用 matchMedia 而不是 resize：只有真的跨過分界時才觸發，
   拖動視窗的過程中不會被呼叫上百次。分界跟 CSS 同一個值。 */
function setupViewportWatch() {
  try {
    window.matchMedia("(max-width: 768px), (max-height: 500px)")
      .addEventListener("change", function() { closeSidebarDrawer(); });
  } catch (e) { /* 舊瀏覽器沒有 addEventListener，維持載入時的判斷 */ }
}

/* ==========================================================
   Service Worker

   策略是「網路優先、離線才回退快取」，不是常見的快取優先。
   這個 app 放在 GitHub Pages 上會持續更新，快取優先會讓使用者被鎖在
   舊版程式碼裡，而且很難自己救回來——強制重新整理也未必有用，因為
   回應是 service worker 給的，根本沒碰到網路。

   代價是連線正常時不會變快。對這個 app 無所謂：資料都在 localStorage，
   網路只負責抓靜態檔。換來的是「更新一定拿得到」。
   ========================================================== */

const SW_UPDATE_CHECK_MS = 30 * 60 * 1000;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1") return;

  /* 要在 register() 之前就抓，而且抓在最前面。sw.js 有 skipWaiting()
     + clients.claim()，新的 worker 一裝好就立刻接管，晚一步去看 controller
     就分不出「第一次安裝」和「更新」了。 */
  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", function() {
    if (!hadController) { hadController = true; return; }
    showUpdateModal();
  });

  navigator.serviceWorker.register("sw.js").then(function(reg) {
    /* 備援：萬一哪天 sw.js 拿掉了 skipWaiting，新 worker 會停在 waiting
       不接管，controllerchange 就不會來，這時要靠 updatefound 才發現得到。 */
    reg.addEventListener("updatefound", function() {
      const incoming = reg.installing;
      if (!incoming || !hadController) return;
      incoming.addEventListener("statechange", function() {
        if (incoming.state === "installed" || incoming.state === "activated") showUpdateModal();
      });
    });
    reg.update().catch(function() {});
    setInterval(function() { reg.update().catch(function() {}); }, SW_UPDATE_CHECK_MS);
  }).catch(function(e) {
    // 註冊失敗只代表沒有離線能力，app 照常運作，不需要打擾使用者
    console.warn("Service worker 註冊失敗：", e);
  });
}

/* 偵測到新版時提示，但不自動重載——正在打字的人被硬生生重整會很惱火。 */
let updateModalShown = false;
let updatePendingTimer = null;

function otherModalOpen() {
  const open = document.querySelector(".modal-overlay.active");
  return !!open && open.id !== "updateModal";
}

function showUpdateModal() {
  if (updateModalShown) return;
  const el = document.getElementById("updateModal");
  if (!el) return;

  // 有別的彈窗開著時不要疊上去。更新沒有急迫性，等對方關掉再說。
  if (otherModalOpen()) {
    if (!updatePendingTimer) {
      updatePendingTimer = setInterval(function() {
        if (updateModalShown) { clearInterval(updatePendingTimer); updatePendingTimer = null; return; }
        if (!otherModalOpen()) showUpdateModal();
      }, 5000);
    }
    return;
  }
  if (updatePendingTimer) { clearInterval(updatePendingTimer); updatePendingTimer = null; }
  updateModalShown = true;
  el.classList.add("active");
}

function dismissUpdateModal() { closeModal("updateModal"); }
function reloadForUpdate() { dismissUpdateModal(); location.reload(); }
