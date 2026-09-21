const { chromium } = require('/opt/node22/lib/node_modules/playwright');
let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } }
const BASE = 'http://127.0.0.1:8800';

async function fresh(browser, vp) {
  const ctx = await browser.newContext(vp || { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE);
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('\n[1] 事件的新增、排序、編輯、刪除');
  {
    const { ctx, page, errs } = await fresh(browser);
    const r = await page.evaluate(async () => {
      const before = eventsOfCurrentTimeline().length;
      openEventModal();
      document.getElementById('evTitleInput').value = '新事件';
      document.getElementById('evWhenInput').value = '舊曆700年';
      document.getElementById('evSortInput').value = '5';   // 刻意排在最前面
      submitEvent();
      await new Promise(r => setTimeout(r, 80));
      const list = eventsOfCurrentTimeline();
      const cards = [...document.querySelectorAll('.ev-title')].map(e => e.textContent);
      return { before, after: list.length, first: list[0].title, cards,
               modalClosed: !document.getElementById('eventModal').classList.contains('active') };
    });
    ok('新增後多一筆', r.after === r.before + 1, r.before + ' → ' + r.after);
    ok('排序值小的排最前面', r.first === '新事件', r.first);
    ok('畫面上的順序跟資料一致', r.cards[0] === '新事件', JSON.stringify(r.cards));
    ok('儲存後彈窗關起來', r.modalClosed);

    const persisted = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('timeline_data_v1'));
      return saved.events.some(e => e.title === '新事件');
    });
    ok('真的寫進 localStorage', persisted);

    // 重新載入之後還在
    await page.reload();
    await page.waitForTimeout(500);
    const afterReload = await page.evaluate(() =>
      [...document.querySelectorAll('.ev-title')].map(e => e.textContent));
    ok('重新載入之後資料還在', afterReload[0] === '新事件', JSON.stringify(afterReload));

    // 編輯
    const edited = await page.evaluate(async () => {
      const id = eventsOfCurrentTimeline()[0].id;
      openEventModal(id);
      const titleWas = document.getElementById('evTitleInput').value;
      document.getElementById('evTitleInput').value = '改過的標題';
      submitEvent();
      await new Promise(r => setTimeout(r, 80));
      return { titleWas, now: document.querySelector('.ev-title').textContent,
               count: eventsOfCurrentTimeline().length };
    });
    ok('編輯時帶出原本的內容', edited.titleWas === '新事件', edited.titleWas);
    ok('編輯是改同一筆，不是新增一筆', edited.count === r.after, 'count=' + edited.count);
    ok('畫面跟著更新', edited.now === '改過的標題', edited.now);

    // 刪除
    page.on('dialog', d => d.accept());
    const deleted = await page.evaluate(async () => {
      const id = eventsOfCurrentTimeline()[0].id;
      openEventModal(id);
      deleteEvent();
      await new Promise(r => setTimeout(r, 120));
      return eventsOfCurrentTimeline().length;
    });
    ok('刪除後少一筆', deleted === r.before, 'count=' + deleted);
    ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n[2] 排序值：留空、亂填、從時間猜');
  {
    const { ctx, page, errs } = await fresh(browser);
    const r = await page.evaluate(async () => {
      const out = {};
      openEventModal();
      document.getElementById('evTitleInput').value = 'A';
      document.getElementById('evSortInput').value = '';   // 留空
      submitEvent();
      await new Promise(r => setTimeout(r, 60));
      const list = eventsOfCurrentTimeline();
      out.emptyGoesLast = list[list.length - 1].title === 'A';

      openEventModal();
      document.getElementById('evWhenInput').value = '舊曆340年 春';
      guessSortFromWhen();
      out.guessed = document.getElementById('evSortInput').value;
      closeEventModal();

      openEventModal();
      document.getElementById('evWhenInput').value = '沒有數字的時間';
      const was = document.getElementById('evSortInput').value;
      guessSortFromWhen();
      out.noNumberKeeps = document.getElementById('evSortInput').value === was;
      out.hint = document.getElementById('toast').textContent;
      closeEventModal();
      return out;
    });
    ok('排序值留空會接在最後', r.emptyGoesLast);
    ok('「舊曆340年 春」猜出 340', r.guessed === '340', r.guessed);
    ok('沒有數字時不亂改，並且說明原因', r.noNumberKeeps && /沒有數字/.test(r.hint), r.hint);
    ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n[3] 多條時間軸彼此獨立');
  {
    const { ctx, page, errs } = await fresh(browser);
    const r = await page.evaluate(async () => {
      openTimelineEditModal(null);
      document.getElementById('tlNameInput').value = '外傳年表';
      submitTimelineEdit();
      await new Promise(r => setTimeout(r, 80));
      const switched = currentTimeline().name;
      const emptyNow = eventsOfCurrentTimeline().length;

      openEventModal();
      document.getElementById('evTitleInput').value = '外傳的事件';
      submitEvent();
      await new Promise(r => setTimeout(r, 80));

      const mainId = appData.timelines[0].id;
      switchTimeline(mainId);
      await new Promise(r => setTimeout(r, 80));
      const backTitles = eventsOfCurrentTimeline().map(e => e.title);
      return { switched, emptyNow, backTitles,
               totalEvents: appData.events.length,
               emptyShown: document.getElementById('emptyState').classList.contains('active') };
    });
    ok('新增時間軸後自動切過去', r.switched === '外傳年表', r.switched);
    ok('新的時間軸是空的', r.emptyNow === 0, 'count=' + r.emptyNow);
    ok('切回主年表看不到外傳的事件', !r.backTitles.includes('外傳的事件'), JSON.stringify(r.backTitles));
    ok('但資料還在（只是不屬於這條）', r.totalEvents === 4, 'total=' + r.totalEvents);
    ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n[4] 匯入的驗證');
  {
    const { ctx, page } = await fresh(browser);
    const r = await page.evaluate(() => {
      const good = { version: 1, timelines: [{ id: 'tl_a', name: 'A', icon: '📜' }],
        events: [{ id: 'ev_a', timelineId: 'tl_a', title: 'X', when: '1年', sort: 1, body: '', color: 'c_blue' }] };
      return {
        good: !!validateImported(good),
        notObject: validateImported("我是字串"),
        noArrays: validateImported({ version: 1 }),
        emptyTimelines: validateImported({ timelines: [], events: [] }),
        // 掛在不存在時間軸上的事件要被丟掉，否則永遠看不到
        orphan: validateImported({ timelines: [{ id: 'tl_a', name: 'A' }],
          events: [{ id: 'ev_x', timelineId: 'tl_ZZZ', title: 'X' }] }).events.length,
        // id 含奇怪字元的不收
        badId: validateImported({ timelines: [{ id: 'tl_a', name: 'A' }],
          events: [{ id: '../../x', timelineId: 'tl_a', title: 'X' }] }).events.length,
        // 沒有標題也沒有時間的不是一件事
        blank: validateImported({ timelines: [{ id: 'tl_a', name: 'A' }],
          events: [{ id: 'ev_b', timelineId: 'tl_a', title: '', when: '' }] }).events.length,
        // 不認得的分類色退回灰色，不要直接寫進 style
        badColor: validateImported({ timelines: [{ id: 'tl_a', name: 'A' }],
          events: [{ id: 'ev_c', timelineId: 'tl_a', title: 'X', color: 'javascript:alert(1)' }] }).events[0].color,
        // 多帶的欄位不要跟著進來
        extra: Object.keys(validateImported({ timelines: [{ id: 'tl_a', name: 'A', evil: 1 }], events: [] }).timelines[0])
      };
    });
    ok('正常的檔案收得下', r.good);
    ok('不是物件的擋掉', r.notObject === null);
    ok('缺少 timelines/events 的擋掉', r.noArrays === null);
    ok('一條時間軸都沒有的擋掉', r.emptyTimelines === null);
    ok('掛在不存在時間軸上的事件丟掉', r.orphan === 0, 'kept=' + r.orphan);
    ok('id 含奇怪字元的丟掉', r.badId === 0, 'kept=' + r.badId);
    ok('標題與時間都空的丟掉', r.blank === 0, 'kept=' + r.blank);
    ok('不認得的分類色退回灰色', r.badColor === 'c_gray', r.badColor);
    ok('多帶的欄位不會跟著進來', !r.extra.includes('evil'), JSON.stringify(r.extra));
    await ctx.close();
  }

  console.log('\n[5] 使用者打的字不會被當成 HTML');
  {
    const { ctx, page, errs } = await fresh(browser);
    const r = await page.evaluate(async () => {
      window.__xss = false;
      openEventModal();
      document.getElementById('evTitleInput').value = '<img src=x onerror="window.__xss=true">';
      document.getElementById('evBodyInput').value = '</div><script>window.__xss=true<\/script>';
      document.getElementById('evSortInput').value = '1';
      submitEvent();
      await new Promise(r => setTimeout(r, 200));
      return { xss: window.__xss,
               shown: document.querySelector('.ev-title').textContent,
               imgs: document.querySelectorAll('.ev-card img').length };
    });
    ok('沒有被執行', !r.xss);
    ok('原樣當成文字顯示', r.shown === '<img src=x onerror="window.__xss=true">', r.shown);
    ok('沒有生出 <img> 元素', r.imgs === 0, 'imgs=' + r.imgs);
    ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n[6] 主題');
  {
    const { ctx, page, errs } = await fresh(browser);
    const r = await page.evaluate(async () => {
      setThemePref('dark');
      await new Promise(r => setTimeout(r, 120));
      const darkAttr = document.documentElement.getAttribute('data-theme');
      const dotDark = getComputedStyle(document.querySelector('.ev-dot')).backgroundColor;
      const stored = localStorage.getItem('timeline_theme');
      setThemePref('light');
      await new Promise(r => setTimeout(r, 120));
      const dotLight = getComputedStyle(document.querySelector('.ev-dot')).backgroundColor;
      setThemePref('auto');
      return { darkAttr, dotDark, dotLight, stored, autoCleared: localStorage.getItem('timeline_theme') };
    });
    ok('切夜間會寫進 data-theme', r.darkAttr === 'dark', r.darkAttr);
    ok('偏好存在 localStorage（不跟著匯出檔跑）', r.stored === 'dark', r.stored);
    // 分類色是 JS 寫進 style 的，CSS 變數管不到，切主題一定要重畫
    ok('分類色有跟著主題重畫', r.dotDark !== r.dotLight, r.dotDark + ' vs ' + r.dotLight);
    ok('選「跟隨系統」會把偏好清掉', r.autoCleared === null, String(r.autoCleared));
    ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n[7] 手機的返回鍵');
  {
    const { ctx, page, errs } = await fresh(browser);
    await page.evaluate(() => openEventModal());
    await page.waitForTimeout(150);
    ok('開彈窗會推一筆歷史', await page.evaluate(() => uiHistoryDepth) === 1);
    await page.goBack();
    await page.waitForTimeout(300);
    ok('返回鍵關掉彈窗', !(await page.evaluate(() => document.getElementById('eventModal').classList.contains('active'))));
    ok('還停在同一頁（沒離開 app）', await page.evaluate(() => !!document.getElementById('axis')));

    // 用 ✕ 關掉時那筆歷史要自己收回來，否則會累積成「按了沒反應」
    await page.evaluate(() => { openEventModal(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => closeEventModal());
    await page.waitForTimeout(400);
    ok('用 ✕ 關掉之後歷史深度歸零', await page.evaluate(() => uiHistoryDepth) === 0);

    // 設定 → 子視窗 → 返回，要回到設定而不是整個關光
    await page.evaluate(() => { openSettingsModal(); settingsGoTo(openAppearanceModal); });
    await page.waitForTimeout(250);
    await page.goBack();
    await page.waitForTimeout(400);
    ok('從子視窗返回會回到設定總表', await page.evaluate(() =>
      document.getElementById('settingsModal').classList.contains('active') &&
      !document.getElementById('appearanceModal').classList.contains('active')));
    ok('沒有 JS 錯誤', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log('\n[8] 觸控裝置打開彈窗不要跳鍵盤');
  {
    const { ctx, page } = await fresh(browser);
    await page.evaluate(() => openEventModal());
    await page.waitForTimeout(250);
    const tag = await page.evaluate(() => document.activeElement.tagName);
    ok('焦點不在輸入框上', tag !== 'INPUT' && tag !== 'TEXTAREA', 'activeElement=' + tag);
    await ctx.close();

    const desk = await fresh(browser, { viewport: { width: 1280, height: 900 } });
    await desk.page.evaluate(() => openEventModal());
    await desk.page.waitForTimeout(250);
    const dtag = await desk.page.evaluate(() => document.activeElement.tagName);
    ok('桌機維持自動聚焦輸入框', dtag === 'INPUT', 'activeElement=' + dtag);
    await desk.ctx.close();
  }

  console.log('\n[9] service worker 的 SHELL 要跟實際檔案一致');
  {
    const { ctx, page } = await fresh(browser);
    const r = await page.evaluate(async () => {
      const sw = await (await fetch('sw.js')).text();
      const html = await (await fetch('index.html')).text();
      const shell = (sw.match(/const SHELL = \[([\s\S]*?)\]/) || [])[1] || '';
      const listed = [...shell.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
      const used = [...html.matchAll(/(?:src|href)="((?:js\/|icons\/)?[\w./-]+\.(?:js|css|json|png))"/g)].map(m => m[1]);
      const missing = used.filter(u => !listed.includes(u) && u !== 'icons/favicon-32.png');
      return { listed, missing };
    });
    ok('SHELL 沒有漏掉 index.html 用到的檔案', r.missing.length === 0, JSON.stringify(r.missing));
    ok('SHELL 有列出全部 8 個 js', r.listed.filter(x => x.startsWith('js/')).length === 8,
       JSON.stringify(r.listed.filter(x => x.startsWith('js/'))));
    await ctx.close();
  }

  await browser.close();
  console.log('\n通過 ' + pass + ' 項，失敗 ' + fail + ' 項');
  process.exit(fail ? 1 : 0);
})();
