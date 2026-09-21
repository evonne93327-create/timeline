/* ==========================================================
   進入點 (app.js)
   ========================================================== */

window.addEventListener("DOMContentLoaded", function() {
  initTheme();
  renderAll();
  setupModalKeyboard();
  setupBackButton();
  registerServiceWorker();
});

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
