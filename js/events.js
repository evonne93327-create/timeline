/* ==========================================================
   事件的新增、編輯、刪除 (events.js)
   ========================================================== */

function openEventModal(id) {
  editingEventId = id || null;
  const ev = id ? appData.events.find(e => e.id === id) : null;

  document.getElementById("evModalTitle").textContent = ev ? "編輯事件" : "新增事件";
  document.getElementById("evTitleInput").value = ev ? ev.title : "";
  document.getElementById("evWhenInput").value = ev ? ev.when : "";
  document.getElementById("evSortInput").value = ev ? ev.sort : nextSortValue();
  document.getElementById("evBodyInput").value = ev ? ev.body : "";
  renderCategoryPicker(ev ? ev.color : "c_gray");

  document.getElementById("evDeleteBtn").style.display = ev ? "" : "none";
  openModal("eventModal");
}

function closeEventModal() {
  closeModal("eventModal");
  editingEventId = null;
}

let pickedCategory = "c_gray";

function renderCategoryPicker(current) {
  pickedCategory = DEFAULT_CATEGORIES[current] ? current : "c_gray";
  const wrap = document.getElementById("evCategoryPicker");
  if (!wrap) return;
  wrap.innerHTML = "";

  /* 順序以 DEFAULT_CATEGORIES 的鍵順序為準，不要去迭代 appData.categories——
     那是使用者存檔裡的複本，鍵的順序停在他第一次存檔的那一天。 */
  Object.keys(DEFAULT_CATEGORIES).forEach(function(key) {
    const cat = getCategory(key);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat-opt" + (key === pickedCategory ? " is-on" : "");
    b.style.backgroundColor = cat.bg;
    b.style.color = cat.text;
    b.textContent = cat.name;
    b.onclick = function() {
      pickedCategory = key;
      wrap.querySelectorAll(".cat-opt").forEach(function(x) { x.classList.remove("is-on"); });
      b.classList.add("is-on");
    };
    wrap.appendChild(b);
  });
}

/* 從「時間」的文字裡猜一個排序數字。

   年表的時間多半不是真實日期（「舊曆340年」「第三紀元 12 年」），沒辦法
   直接比大小，所以排序是另一個數字欄位。但要使用者每一筆都自己想一個
   數字太煩，這個按鈕把文字裡第一串數字抓出來當建議值。

   刻意只抓第一串、而且只當「建議」不自動套用：「第三紀元 12 年」抓到的是
   3 不是 12，猜錯的時候使用者要看得到、改得動，不能在背後偷偷決定順序。 */
function guessSortFromWhen() {
  const when = document.getElementById("evWhenInput").value || "";
  const m = when.match(/-?\d+/);
  if (!m) { showHint("這段文字裡沒有數字，請自己填一個排序值"); return; }
  document.getElementById("evSortInput").value = Number(m[0]);
  showHint("已用「" + m[0] + "」當排序值，不對的話可以直接改");
}

function submitEvent() {
  const title = document.getElementById("evTitleInput").value.trim();
  const when = document.getElementById("evWhenInput").value.trim();
  const body = document.getElementById("evBodyInput").value;
  const sortRaw = document.getElementById("evSortInput").value;

  if (!title && !when) { showHint("至少要填標題或時間其中一個"); return; }

  /* 留空要接在最後面，不是排到最前面。

     Number("") 是 0 而不是 NaN——直接丟給 isFinite() 會判定成「有填，值是 0」，
     於是那筆事件跑到整條時間軸的最前面。空字串要先自己擋掉。 */
  const sortText = String(sortRaw).trim();
  let sort = sortText === "" ? NaN : Number(sortText);
  if (!isFinite(sort)) sort = nextSortValue();   // 空白或亂填就接在最後面

  if (editingEventId) {
    const ev = appData.events.find(e => e.id === editingEventId);
    if (ev) {
      ev.title = title; ev.when = when; ev.body = body;
      ev.sort = sort; ev.color = pickedCategory;
    }
  } else {
    appData.events.push({
      id: newId("ev"),
      timelineId: activeTimelineId,
      title: title, when: when, sort: sort, body: body, color: pickedCategory
    });
  }

  saveData();
  renderAll();
  closeEventModal();
}

function deleteEvent() {
  const ev = appData.events.find(e => e.id === editingEventId);
  if (!ev) return;
  if (!confirm("要刪掉「" + (ev.title || ev.when || "這件事") + "」嗎？這個動作無法復原。")) return;

  appData.events = appData.events.filter(function(x) { return x.id !== ev.id; });
  saveData();
  renderAll();
  closeEventModal();
  showHint("已刪除");
}
