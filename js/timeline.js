/* ==========================================================
   時間軸的繪製與時間軸本身的增刪改 (timeline.js)
   ========================================================== */

function currentTimeline() {
  return appData.timelines.find(t => t.id === activeTimelineId) || appData.timelines[0];
}

/* 目前這條時間軸上的事件，依排序值由小到大。

   排序值一樣時用 id 當次要條件。少了這一條的話，兩筆同值事件的先後會
   依賴 sort 的穩定性與陣列原本的順序——看起來沒問題，但匯入、復原之後
   順序會莫名其妙變動，而且很難查。 */
function eventsOfCurrentTimeline() {
  return appData.events
    .filter(function(e) { return e.timelineId === activeTimelineId; })
    .sort(function(a, b) { return (a.sort - b.sort) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
}

/* 新事件的預設排序值：接在最後一筆後面。

   留 SORT_STEP 的間隔，是為了讓「插在這兩件事中間」可以直接填一個中間值，
   不必把後面每一筆都重新編號。 */
function nextSortValue() {
  const list = eventsOfCurrentTimeline();
  if (!list.length) return SORT_STEP;
  return list[list.length - 1].sort + SORT_STEP;
}

function renderAll() {
  renderTimelineBadge();
  renderSidebar();
  renderEvents();
}

/* 頂欄那顆時間軸名牌。手機與桌機共用同一份 DOM（版面是 CSS 折的），
   所以這裡只要更新一組元素。 */
function renderTimelineBadge() {
  const tl = currentTimeline();
  const n = eventsOfCurrentTimeline().length;

  const icon = document.getElementById("tlIcon");
  const name = document.getElementById("tlName");
  const count = document.getElementById("tlCount");
  if (icon) icon.textContent = tl ? (tl.icon || "📜") : "📜";
  if (name) name.textContent = tl ? tl.name : "";
  if (count) count.textContent = n ? n + " 件事" : "";

  /* 空狀態的說明。新增事件的入口在頂欄右邊，手機與桌機是同一顆
     （手機上只是把「新增事件」四個字收起來），所以兩邊講同一句話就好。 */
  const empty = document.getElementById("emptyText");
  if (empty) {
    empty.innerHTML = "按右上角的「＋」開始記下第一件事。<br>" +
      "時間可以直接寫「舊曆340年」這種，不必是真實日期。";
  }
}

/* 側欄的時間軸清單。列的樣式照工作台的目錄列：小圓角、平常沒有底色，
   選中才是強調色。 */
function renderSidebar() {
  const list = document.getElementById("sidebarList");
  if (!list) return;
  list.innerHTML = "";

  appData.timelines.forEach(function(tl) {
    const n = appData.events.filter(function(e) { return e.timelineId === tl.id; }).length;
    const on = tl.id === activeTimelineId;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "tl-node" + (on ? " is-on" : "");
    row.setAttribute("aria-current", on ? "true" : "false");
    row.onclick = function() {
      if (tl.id !== activeTimelineId) { activeTimelineId = tl.id; saveData(); renderAll(); }
      // 手機上抽屜是蓋在內容上的，選完不收起來就看不到選了什麼
      closeSidebarDrawer();
    };

    const icon = document.createElement("span");
    icon.className = "tl-node-icon";
    icon.textContent = tl.icon || "📜";

    const nameEl = document.createElement("span");
    nameEl.className = "tl-node-name";
    nameEl.textContent = tl.name;

    const countEl = document.createElement("span");
    countEl.className = "tl-node-count";
    countEl.textContent = n ? n + " 件事" : "";

    const edit = document.createElement("span");
    edit.className = "tl-node-edit";
    edit.title = "編輯這條時間軸";
    edit.textContent = "✎";
    /* 用 span 而不是巢狀的 <button>：按鈕裡面不能再放按鈕（HTML 不合法，
       瀏覽器會把它拆到外面去，版面就散了）。stopPropagation 擋住外層的切換。 */
    edit.onclick = function(e) { e.stopPropagation(); openTimelineEditModal(tl.id); };

    row.appendChild(icon);
    row.appendChild(nameEl);
    row.appendChild(countEl);
    row.appendChild(edit);
    list.appendChild(row);
  });
}

function renderEvents() {
  const wrap = document.getElementById("axis");
  const empty = document.getElementById("emptyState");
  if (!wrap) return;

  const list = eventsOfCurrentTimeline();
  wrap.innerHTML = "";

  if (!list.length) {
    wrap.classList.remove("has-items");
    if (empty) empty.classList.add("active");
    return;
  }
  wrap.classList.add("has-items");
  if (empty) empty.classList.remove("active");

  list.forEach(function(ev) {
    wrap.appendChild(buildEventRow(ev));
  });
}

/* 整列用 createElement 組出來，不用 innerHTML 拼字串。

   標題與內文是使用者自己打的，也可能是匯入來的——拼進 HTML 就等於把
   「"」「<」這些字元交給瀏覽器解讀。用 textContent 從源頭就不會有這個問題，
   不必每個欄位都記得 escape（漏掉一個就是一個洞）。 */
function buildEventRow(ev) {
  const cat = getCategory(ev.color);

  const row = document.createElement("div");
  row.className = "ev-row";
  row.dataset.id = ev.id;

  const rail = document.createElement("div");
  rail.className = "ev-rail";
  const dot = document.createElement("span");
  dot.className = "ev-dot";
  dot.style.backgroundColor = cat.dot;
  rail.appendChild(dot);

  const card = document.createElement("button");
  card.type = "button";
  card.className = "ev-card";
  card.onclick = function() { openEventModal(ev.id); };

  const when = document.createElement("div");
  when.className = "ev-when";
  when.textContent = ev.when || "（未填時間）";
  if (!ev.when) when.classList.add("is-empty");

  const title = document.createElement("div");
  title.className = "ev-title";
  title.textContent = ev.title || "（未命名事件）";

  card.appendChild(when);
  card.appendChild(title);

  if (ev.body) {
    const body = document.createElement("div");
    body.className = "ev-body";
    body.textContent = ev.body;
    card.appendChild(body);
  }

  const tag = document.createElement("span");
  tag.className = "ev-tag";
  tag.textContent = cat.name;
  tag.style.backgroundColor = cat.bg;
  tag.style.color = cat.text;
  card.appendChild(tag);

  row.appendChild(rail);
  row.appendChild(card);
  return row;
}

/* ==========================================================
   時間軸的切換與管理
   ========================================================== */

function openTimelineModal() {
  renderTimelineList();
  openModal("timelineModal");
}
function closeTimelineModal() { closeModal("timelineModal"); }

function renderTimelineList() {
  const list = document.getElementById("timelineList");
  if (!list) return;
  list.innerHTML = "";

  appData.timelines.forEach(function(tl) {
    const n = appData.events.filter(function(e) { return e.timelineId === tl.id; }).length;

    const row = document.createElement("div");
    row.className = "tl-row" + (tl.id === activeTimelineId ? " is-active" : "");

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "tl-pick";
    pick.onclick = function() { switchTimeline(tl.id); };

    const icon = document.createElement("span");
    icon.className = "tl-row-icon";
    icon.textContent = tl.icon || "📜";

    const text = document.createElement("span");
    text.className = "tl-row-text";
    const nameEl = document.createElement("span");
    nameEl.className = "tl-row-name";
    nameEl.textContent = tl.name;
    const metaEl = document.createElement("span");
    metaEl.className = "tl-row-meta";
    metaEl.textContent = n + " 件事";
    text.appendChild(nameEl);
    text.appendChild(metaEl);

    pick.appendChild(icon);
    pick.appendChild(text);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "icon-btn";
    edit.title = "重新命名";
    edit.textContent = "✎";
    edit.onclick = function() { openTimelineEditModal(tl.id, true); };

    row.appendChild(pick);
    row.appendChild(edit);
    list.appendChild(row);
  });
}

function switchTimeline(id) {
  activeTimelineId = id;
  saveData();
  renderAll();
  closeTimelineModal();
}

/* fromList：是不是從「時間軸清單」那個彈窗點進來的。

   關掉的時候要不要回清單，取決於這件事。舊版面只有清單一個入口，
   所以無條件回清單也沒錯；現在側欄的 ✎、側欄的 ＋、頂欄的名牌都會
   開這個視窗，無條件回清單就變成「按了取消反而多跳出一個視窗」。 */
let tlEditFromList = false;

function openTimelineEditModal(id, fromList) {
  tlEditFromList = !!fromList;
  editingTimelineId = id || null;
  const tl = id ? appData.timelines.find(t => t.id === id) : null;

  document.getElementById("tlEditTitle").textContent = tl ? "編輯時間軸" : "新增時間軸";
  document.getElementById("tlNameInput").value = tl ? tl.name : "";
  renderIconPicker(tl ? (tl.icon || "📜") : "📜");

  // 只剩一條的時候不給刪——刪光了畫面上什麼都沒有，也沒地方新增事件
  const delBtn = document.getElementById("tlDeleteBtn");
  delBtn.style.display = (tl && appData.timelines.length > 1) ? "" : "none";

  closeTimelineModal();
  openModal("timelineEditModal");
}

function closeTimelineEditModal() {
  closeModal("timelineEditModal");
  if (tlEditFromList) openTimelineModal();   // 從清單點進來的才回清單
}

let pickedIcon = "📜";

function renderIconPicker(current) {
  pickedIcon = current || "📜";
  const wrap = document.getElementById("tlIconPicker");
  if (!wrap) return;
  wrap.innerHTML = "";
  COMMON_ICONS.forEach(function(ic) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-opt" + (ic === pickedIcon ? " is-on" : "");
    b.textContent = ic;
    b.onclick = function() {
      pickedIcon = ic;
      wrap.querySelectorAll(".icon-opt").forEach(function(x) { x.classList.remove("is-on"); });
      b.classList.add("is-on");
    };
    wrap.appendChild(b);
  });
}

function submitTimelineEdit() {
  const name = document.getElementById("tlNameInput").value.trim();
  if (!name) { showHint("請先幫這條時間軸取個名字"); return; }

  if (editingTimelineId) {
    const tl = appData.timelines.find(t => t.id === editingTimelineId);
    if (tl) { tl.name = name; tl.icon = pickedIcon; }
  } else {
    const tl = { id: newId("tl"), name: name, icon: pickedIcon };
    appData.timelines.push(tl);
    activeTimelineId = tl.id;
  }
  saveData();
  renderAll();
  closeModal("timelineEditModal");
  closeTimelineModal();
}

function deleteTimeline() {
  const tl = appData.timelines.find(t => t.id === editingTimelineId);
  if (!tl) return;
  const n = appData.events.filter(function(e) { return e.timelineId === tl.id; }).length;

  // 一併刪掉的事件數要講出來——「刪掉一條時間軸」聽起來比實際發生的事小
  if (!confirm("要刪掉「" + tl.name + "」嗎？\n上面的 " + n + " 件事也會一起刪掉，這個動作無法復原。")) return;

  appData.timelines = appData.timelines.filter(function(t) { return t.id !== tl.id; });
  appData.events = appData.events.filter(function(e) { return e.timelineId !== tl.id; });
  if (activeTimelineId === tl.id) activeTimelineId = appData.timelines[0].id;

  saveData();
  renderAll();
  closeModal("timelineEditModal");
  closeTimelineModal();
  showHint("已刪除「" + tl.name + "」");
}
