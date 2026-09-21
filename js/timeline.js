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

/* 手機版的頂部與電腦版的標題列顯示的是同一組東西，只是位置不同。
   兩邊一起更新，免得切換視窗寬度時其中一邊停在舊資料上。 */
function renderTimelineBadge() {
  const tl = currentTimeline();
  const n = eventsOfCurrentTimeline().length;
  const countText = n ? n + " 件事" : "";

  [["tlIcon", "tlName", "tlCount"], ["tlIconDesk", "tlNameDesk", "tlCountDesk"]]
    .forEach(function(ids) {
      const icon = document.getElementById(ids[0]);
      const name = document.getElementById(ids[1]);
      const count = document.getElementById(ids[2]);
      if (icon) icon.textContent = tl ? (tl.icon || "📜") : "📜";
      if (name) name.textContent = tl ? tl.name : "";
      if (count) count.textContent = countText;
    });

  /* 空狀態的說明文字要跟著版面走：電腦版沒有右下角那顆浮動按鈕，
     叫使用者去按一個看不到的東西只會讓人更困惑。 */
  const empty = document.getElementById("emptyText");
  if (empty) {
    const desktop = window.matchMedia("(min-width: 900px)").matches;
    empty.innerHTML = (desktop ? "按上面的「＋ 新增事件」" : "按右下角的 ＋") +
      "開始記下第一件事。<br>時間可以直接寫「舊曆340年」這種，不必是真實日期。";
  }
}

/* 電腦版的側邊欄。手機版整塊被 CSS 收起來，但還是照樣重畫——
   重畫幾個 DOM 節點的成本遠低於「忘記重畫」造成的錯亂（例如在手機上
   改了名字，轉橫向變成電腦版時側邊欄還寫著舊名字）。 */
function renderSidebar() {
  const list = document.getElementById("sidebarList");
  if (!list) return;
  list.innerHTML = "";

  appData.timelines.forEach(function(tl) {
    const n = appData.events.filter(function(e) { return e.timelineId === tl.id; }).length;
    const on = tl.id === activeTimelineId;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "side-row" + (on ? " is-active" : "");
    row.setAttribute("aria-current", on ? "true" : "false");
    row.onclick = function() {
      if (tl.id !== activeTimelineId) { activeTimelineId = tl.id; saveData(); renderAll(); }
    };

    const icon = document.createElement("span");
    icon.className = "side-row-icon";
    icon.textContent = tl.icon || "📜";

    const text = document.createElement("span");
    text.className = "side-row-text";
    const nameEl = document.createElement("span");
    nameEl.className = "side-row-name";
    nameEl.textContent = tl.name;
    const metaEl = document.createElement("span");
    metaEl.className = "side-row-meta";
    metaEl.textContent = n + " 件事";
    text.appendChild(nameEl);
    text.appendChild(metaEl);

    const edit = document.createElement("span");
    edit.className = "side-row-edit";
    edit.title = "編輯這條時間軸";
    edit.textContent = "✎";
    /* 用 span 而不是巢狀的 <button>：按鈕裡面不能再放按鈕（HTML 不合法，
       瀏覽器會把它拆到外面去，版面就散了）。stopPropagation 擋住外層的切換。 */
    edit.onclick = function(e) { e.stopPropagation(); openTimelineEditModal(tl.id); };

    row.appendChild(icon);
    row.appendChild(text);
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
    edit.onclick = function() { openTimelineEditModal(tl.id); };

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

function openTimelineEditModal(id) {
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
  openTimelineModal();   // 從清單點進來的，關掉要回清單
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
