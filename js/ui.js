// js/ui.js —— 页面外壳与 HUD【丙】
// 职责：三个页面的显示切换、HUD 更新、知识点弹窗、结算页、暂停遮罩。
window.Game = window.Game || {};

Game.ui = {
  CAT_NAMES: ['可回收物', '有害垃圾', '厨余垃圾', '其他垃圾'], // 与 render.BIN_NAMES 一致

  // 初始化：绑定按钮（.level-card → Game.main.newRun、btn-resume/btn-quit/btn-retry/btn-back），
  //         刷新菜单最高分（.lv-best[data-best=i] ← Game.storage.get(i)，0 显示 '--'）
  init() {
    document.querySelectorAll('.level-card').forEach((card) => {
      card.addEventListener('click', () => {
        Game.main.newRun(Number(card.dataset.level));
      });
    });
    document.getElementById('btn-resume').addEventListener('click', () => Game.main.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => Game.main.retry());
    document.getElementById('btn-quit').addEventListener('click', () => Game.main.backToMenu());
    document.getElementById('btn-retry').addEventListener('click', () => Game.main.retry());
    document.getElementById('btn-back').addEventListener('click', () => Game.main.backToMenu());

    // 画面可见暂停按钮（丙 2026-11-23）：此前只能 Esc/P 暂停，鼠标/触屏玩家无法暂停
    document.getElementById('btn-pause').addEventListener('click', () => Game.main.togglePause());

    // 游戏说明弹层（主入口）：开/关，点背景空白处也可关闭
    const help = document.getElementById('help-overlay');
    document.getElementById('home-help').addEventListener('click', () => this.showHelp(true));
    document.getElementById('btn-help-close').addEventListener('click', () => this.showHelp(false));
    document.getElementById('btn-help-close2').addEventListener('click', () => this.showHelp(false));
    help.addEventListener('click', (e) => { if (e.target === help) this.showHelp(false); });

    // ---- 首页四大入口（丙 2026-11-23）----
    document.getElementById('home-start').addEventListener('click', () => this.showScreen('levels'));
    document.getElementById('home-wiki').addEventListener('click', () => this.showScreen('wiki'));
    document.getElementById('home-settings').addEventListener('click', () => {
      this.openModal('modal-settings');
      this.syncSettingsUI();
    });

    // ---- 关卡页 / 知识库页的返回按钮（data-back 指定目标页）----
    document.querySelectorAll('.btn-back').forEach((btn) => {
      btn.addEventListener('click', () => this.showScreen(btn.dataset.back));
    });

    // ---- 设置弹窗通用关闭：右上 × 与点击遮罩空白处 ----
    document.querySelectorAll('.modal-close[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-mask').forEach((mask) => {
      mask.addEventListener('click', (e) => {
        if (e.target === mask) mask.classList.add('hidden');
      });
    });

    // ---- 设置项即时保存并应用 ----
    document.getElementById('set-bgm').addEventListener('change', (e) => {
      Game.storage.saveSettings({ bgm: e.target.checked });
      this.applySettings();
    });
    document.getElementById('set-sfx').addEventListener('change', (e) => {
      Game.storage.saveSettings({ sfx: e.target.checked });
      this.applySettings();
    });
    document.getElementById('set-volume').addEventListener('input', (e) => {
      const vol = Number(e.target.value) / 100;
      document.getElementById('set-volume-val').textContent = e.target.value + '%';
      Game.storage.saveSettings({ volume: vol });
      this.applySettings();
    });

    // ---- 重置数据二次确认：第一击只展开确认条，确认才真正清空 ----
    document.getElementById('btn-reset').addEventListener('click', () => {
      document.getElementById('reset-confirm').classList.remove('hidden');
    });
    document.getElementById('btn-reset-no').addEventListener('click', () => {
      document.getElementById('reset-confirm').classList.add('hidden');
    });
    document.getElementById('btn-reset-yes').addEventListener('click', () => {
      Game.storage.resetAll();
      document.getElementById('reset-confirm').classList.add('hidden');
      this.refreshBest();
      this.renderWiki(this._wikiTab || 'all');
    });

    // ---- 知识库标签切换与收藏（事件委托：卡片每次重渲染都重建）----
    document.querySelectorAll('.wiki-tab').forEach((tab) => {
      tab.addEventListener('click', () => this.renderWiki(tab.dataset.tab));
    });
    document.getElementById('wiki-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.fav-btn');
      if (!btn) return;
      Game.storage.toggleFav(btn.dataset.fav);
      this.renderWiki(this._wikiTab || 'all');
    });

    this.refreshBest();
    this.applySettings(); // 开机读取已保存的音效/BGM 设置

    // 旋屏/窗口尺寸变化时重算舞台（游戏页可见才需要处理，防抖避免连续 resize 抖动）
    let layoutTimer = 0;
    const relayout = () => {
      clearTimeout(layoutTimer);
      layoutTimer = setTimeout(() => {
        if (!document.getElementById('screen-game').classList.contains('hidden')) {
          this.applyStageLayout();
        }
      }, 120);
    };
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);
  },

  // 游戏说明弹层开关（切页时顺手关闭，防止残留）
  showHelp(show) {
    document.getElementById('help-overlay').classList.toggle('hidden', !show);
  },

  // 秒 → "mm:ss"（HUD 实时用时与结算页共用）
  fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  // 刷新菜单三个卡片的最高分（结算破纪录后回菜单也要是最新的）
  // 若 localStorage 不可用（沙箱 iframe/隐私模式），额外显示一条说明，
  // 否则用户只会看到永远 '--' 却不知道原因
  refreshBest() {
    document.querySelectorAll('.lv-best').forEach((el) => {
      const best = Game.storage.get(Number(el.dataset.best));
      el.textContent = best > 0 ? '最高分 ' + best : '最高分 --';
    });
    const note = document.getElementById('storage-note');
    if (note) note.classList.toggle('hidden', Game.storage.persistent !== false);
  },

  // 切页：showScreen('menu' | 'levels' | 'wiki' | 'game' | 'result')，操作 #screen-* 的 .hidden
  showScreen(name) {
    ['menu', 'levels', 'wiki', 'game', 'result'].forEach((n) => {
      document.getElementById('screen-' + n).classList.toggle('hidden', n !== name);
    });
    if (name !== 'game') this.showPause(false);
    this.showHelp(false);                     // 切页顺手关说明弹层，防止残留
    if (name === 'menu' || name === 'levels') this.refreshBest();
    if (name === 'wiki') this.renderWiki(this._wikiTab || 'all');
    if (name === 'game') this.applyStageLayout(); // 页面已可见，才能量到舞台尺寸
  },

  // 竖屏全屏舞台（丙 2026-11-24）：按舞台实际 CSS 尺寸动态拉长画布的"逻辑高度"。
  // 宽保持 960（谱面 x=120~840 不用动），H = W * 舞台高/舞台宽，比例一致不拉伸变形；
  // 判定线、桶区随 H 下移，四桶均分整个宽度，瓦片与桶同步放大。
  // 绘制层、input.js、effects.js、judge.js 都动态读 Game.render 的 W/H/BIN/JUDGE_Y，
  // 所以这里只改常量 + backing store 尺寸，节奏与判定逻辑零改动。
  applyStageLayout() {
    const cv = Game.canvas;
    if (!cv) return;
    const portrait = window.matchMedia &&
      window.matchMedia('(max-width: 640px) and (orientation: portrait)').matches;
    const W = 960;
    let H = 640, JUDGE_Y = 500, TILE = 82, HINT = null;
    let BIN = { y: 522, w: 190, h: 110, gap: 16, pad: 56 };

    if (portrait) {
      const r = cv.parentElement.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        H = Math.max(1100, Math.min(2600, Math.round(W * r.height / r.width)));
        const binH = Math.min(Math.round(H * 0.15), 300);  // 桶区占底部 15%
        const pad = 12, gap = 8;
        const bw = (W - 2 * pad - 3 * gap) / 4;             // 四桶均分宽度
        const binY = H - binH - Math.round(H * 0.012);
        JUDGE_Y = binY - Math.round(H * 0.02);
        BIN = { y: binY, w: bw, h: binH, gap, pad };
        TILE = 132;                                         // 瓦片放大约 1.6 倍
        HINT = { pre: 1.5, y: Math.round(H * 0.025), half: 22 };
      }
    }

    Object.assign(Game.render, { W, H, JUDGE_Y, BIN, TILE, HINT });
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const bw = W * DPR, bh = H * DPR;
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  },

  // 开局：切到 game 页，#hud-level = level.name，清空 HUD
  startLevel(levelIdx) {
    this.showScreen('game');
    document.getElementById('hud-level').textContent = Game.LEVELS[levelIdx].name;
    document.getElementById('hud-score').textContent = '0';
    document.getElementById('hud-combo').textContent = '';
    document.getElementById('hud-lives').textContent = '';
    document.getElementById('hud-progress').style.width = '0%';
  },

  // 开局倒计时提示：READY（1.6s）→ GO!（0.8s）→ 自动隐藏。
  // 时间轴与甲的模块对齐：audio 2 秒准备期 + chart 前奏 2 拍（第1关约 1.2s），
  // 第一颗垃圾约在开局 3.2s 后落线，GO! 消失时正好开始有垃圾进入屏幕。
  // 连续重开时先清掉上一局的定时器，防止提示错拍残留。
  showReadyGo() {
    const el = document.getElementById('ready-go');
    clearTimeout(this._rgT1);
    clearTimeout(this._rgT2);
    el.classList.remove('hidden', 'go');
    el.textContent = 'READY';
    this._rgT1 = setTimeout(() => {
      el.textContent = 'GO!';
      el.classList.add('go');
      this._rgT2 = setTimeout(() => el.classList.add('hidden'), 800);
    }, 1600);
  },

  // 每帧刷新：#hud-score / #hud-combo（≥2 连击显示 "N 连击 ×倍率"）/
  //           #hud-time（本局用时，main.frame 累计 dt）/ #hud-lives（'♥'.repeat(lives) +
  //           '♡'.repeat(3-lives)）/ #hud-progress 宽度%
  updateHUD() {
    const st = Game.state;
    if (!st || st.score === undefined) return; // 菜单页没有运行数据，跳过
    document.getElementById('hud-score').textContent = st.score;
    // 用时 = 游戏时钟差（暂停冻结、丢帧不影响），写入 state 供结算页复用
    st.elapsed = Math.max(0, Game.audio.getTime() - (st.beginAt || 0));
    document.getElementById('hud-time').textContent = this.fmtTime(st.elapsed);
    document.getElementById('hud-combo').textContent =
      st.combo >= 2 ? st.combo + ' 连击 ×' + Game.judge.multFor(st.combo) : '';
    const lives = Math.max(0, Math.min(3, st.lives));
    document.getElementById('hud-lives').textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives);
    const total = st.notes ? st.notes.length : 0;
    const pct = total > 0 ? (st.judged / total) * 100 : 0;
    document.getElementById('hud-progress').style.width = pct.toFixed(1) + '%';

    // 线上键盘焦点提示（组长 2026-11-23，同日二次加固）：预览面板 iframe 中物理键盘
    // 事件只投递给持有焦点的文档，游戏收不到 → 按键没反应、音符自动漏接。
    // 判定条件不依赖 document.hasFocus()（部分嵌入环境该值不可靠），改用实测的
    // input.keyboardAlive：本局尚未收到任何真实按键时持续显示提示条，引导玩家
    // "点击画面激活键盘"；收到按键（或 hasFocus 恢复）后消失。本地顶层页面按键即通，几乎不显示。
    const hint = document.getElementById('input-hint');
    if (hint) {
      // 手机/平板（粗指针）没有物理键盘，keyboardAlive 永远为 false，若沿用键盘提示
      // 会一直挂着误导用户。触屏改显示"点按分类桶"引导，并在开局前 6 秒后自动收起。
      const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        || navigator.maxTouchPoints > 0;
      if (coarse) {
        hint.textContent = '👆 点按下方分类桶进行分拣';
        hint.classList.toggle('hidden', !(st.scene === 'playing' && (st.elapsed || 0) < 6));
      } else {
        hint.textContent = '⌨️ 键盘无响应？点击一下画面任意位置激活键盘';
        const dead = !Game.input.keyboardAlive || !document.hasFocus();
        hint.classList.toggle('hidden', !(st.scene === 'playing' && dead));
      }
    }
  },

  // 分类错误弹窗（wrongBin 时由 main.onJudge 调用）：
  //   "<名字> 属于 <分类名(cat-N 着色)>" + "<tip>"，2.4 秒后自动隐藏（注意 clearTimeout 防叠加）
  popup(note, result) {
    const el = document.getElementById('popup');
    const t = note.trash;
    el.innerHTML =
      '<b>' + t.name + '</b> 属于 <span class="cat-' + note.bin + '">' +
      this.CAT_NAMES[note.bin] + '</span><br>' + t.tip;
    el.classList.remove('hidden');
    clearTimeout(this._popupTimer);
    this._popupTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  },

  showPause(show) {
    document.getElementById('pause-overlay').classList.toggle('hidden', !show);
  },

  // 结算：评级 S(≥0.9)/A(≥0.75)/B(≥0.6)/C，未通关(生命耗尽)直接 C 且标题"游戏结束"；
  //       通关时 Game.storage.set 更新最高分，破纪录显示 #result-record
  //       评级元素 #result-grade 需按结果追加 grade-S / grade-A / grade-B / grade-C 类（css 已定义配色）
  showResult() {
    const st = Game.state;
    const cleared = st.lives > 0;
    const acc = Game.judge ? Game.judge.accuracy() : 0;
    const grade = cleared
      ? (acc >= 0.9 ? 'S' : acc >= 0.75 ? 'A' : acc >= 0.6 ? 'B' : 'C')
      : 'C';

    document.getElementById('result-title').textContent = cleared ? '通关结算' : '游戏结束';

    const gradeEl = document.getElementById('result-grade');
    gradeEl.className = 'grade grade-' + grade;
    gradeEl.textContent = grade;

    document.getElementById('result-score').textContent = st.score;
    document.getElementById('result-combo').textContent = st.maxCombo;
    document.getElementById('result-acc').textContent = Math.round(acc * 100) + '%';

    // 判定分布条（丙 2026-11-24）：对/错/漏 三段比例条，一屏看清本局构成。
    // 数据全部来自 Game.state.counts（judge.js 已维护 perfect/good/bad/wrongBin/miss）
    const c = st.counts || {};
    const okCnt = (c.perfect || 0) + (c.good || 0) + (c.bad || 0);
    const wrongCnt = c.wrongBin || 0;
    const missCnt = c.miss || 0;
    const judged = okCnt + wrongCnt + missCnt;
    const verdict = document.getElementById('verdict');
    if (judged > 0) {
      verdict.classList.remove('hidden');
      const segs = [
        { el: document.getElementById('v-ok'), v: okCnt },
        { el: document.getElementById('v-wrong'), v: wrongCnt },
        { el: document.getElementById('v-miss'), v: missCnt },
      ];
      segs.forEach(({ el }) => { el.style.transition = 'none'; el.style.width = '0%'; });
      void verdict.getBoundingClientRect();   // 先归零再开过渡，重开一局也从头动画
      segs.forEach(({ el, v }) => {
        el.style.transition = 'width 0.7s ease-out';
        el.style.width = (v / judged * 100).toFixed(2) + '%';
      });
      document.getElementById('verdict-legend').textContent =
        '✓ 对 ' + okCnt + ' · ✗ 错 ' + wrongCnt + ' · ⏱ 漏 ' + missCnt;
    } else {
      verdict.classList.add('hidden');
    }

    // 连击星星（丙 2026-11-24）：轻量装饰反馈，1 连击 1 颗、封顶 5 颗，0 连击隐藏
    const stars = Math.min(st.maxCombo || 0, 5);
    const starEl = document.getElementById('combo-stars');
    starEl.textContent = '★'.repeat(stars);
    starEl.classList.toggle('hidden', stars === 0);

    // 双环（评级徽章大环 + 准确率小环，丙 2026-11-23 美化）：
    //   同一分档色、同一准确率比例、同一 0→目标值动画，视觉呼应；
    //   颜色通过 CSS 变量 --tier-* 引用（色值只在 base.css 定义），并写内联 style.stroke，
    //   即使浏览器把 base.css 缓存成旧版，SVG 也有内联 fill/stroke 兜底，不会退化成实心黑圆
    const pct = Math.round(acc * 100);
    const tier = pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D';
    // 从 base.css 读分档色：读到就用，读不到（旧版 CSS 被缓存）就清掉内联 stroke，
    // 让 SVG 自带的 stroke="#2563eb" 表现属性兜底，绝不出现实心黑圆或隐形的环
    const stroke = getComputedStyle(document.documentElement)
      .getPropertyValue('--tier-' + tier.toLowerCase()).trim();
    const rings = [
      { svg: document.getElementById('acc-ring'), fg: document.getElementById('acc-ring-fg'),
        base: 'acc-ring', c: 125.66 },                    // 2πr, r=20
      { svg: document.getElementById('grade-ring'), fg: document.getElementById('grade-ring-fg'),
        base: 'grade-ring', c: 263.89 },                  // 2πr, r=42
    ];
    rings.forEach(({ svg, fg, base, c }) => {
      // SVG 的 className 是只读 SVGAnimatedString，必须用 setAttribute
      svg.setAttribute('class', base + ' lv-' + tier);
      if (stroke) fg.style.stroke = stroke;
      else fg.style.removeProperty('stroke');
      fg.style.transition = 'none';
      fg.style.strokeDashoffset = c;                     // 先归零，重开一局也从头动画
      void fg.getBoundingClientRect();                   // 强制回流，让归零立即生效
      fg.style.transition = 'stroke-dashoffset 0.9s ease-out';
      fg.style.strokeDashoffset = c * (1 - pct / 100);
    });
    // 本局用时（丙 2026-11-23）：非限时玩法的时长正向统计，结算页留档
    document.getElementById('result-time').textContent = this.fmtTime(st.elapsed || 0);

    // 最高分：无论通关与否都参与评比（失败局的高分同样有价值），
    // storage.set 内部只在"超过旧纪录"时才真正写入
    const oldBest = Game.storage.get(st.levelIdx);
    Game.storage.set(st.levelIdx, st.score);
    const newBest = Game.storage.get(st.levelIdx);
    document.getElementById('result-best').textContent = newBest;
    document.getElementById('result-record').classList.toggle(
      'hidden', !(st.score > oldBest && st.score > 0)
    );

    // 得分对比条（丙 2026-11-24）：本局得分相对历史最高分的位置；
    // 破纪录时填充变金色与"新纪录"胶囊呼应。分母取 max(新旧最高分, 1)，
    // 保证破纪录时本局能填满整条（旧纪录只到一半左右，位置差即超出幅度）
    const denom = Math.max(newBest, st.score, 1);
    const scFill = document.getElementById('sc-fill');
    const isRecord = st.score > oldBest && st.score > 0;
    scFill.style.transition = 'none';
    scFill.style.width = '0%';
    void scFill.getBoundingClientRect();
    scFill.style.transition = 'width 0.7s ease-out';
    scFill.style.minWidth = st.score > 0 ? '4px' : '0';  // 低分时也保留一小截可见填充
    scFill.style.width = Math.min(st.score / denom * 100, 100).toFixed(2) + '%';
    scFill.classList.toggle('is-record', isRecord);
    document.getElementById('sc-label').textContent =
      '本局 ' + st.score + ' · 历史最高 ' + newBest;

    // 答错回顾（用户要求：漏接和选错要区分展示）：
    //   ❌ 选错 = 按了键但分类错（wrongBin），重点看"应投入哪类"的知识点；
    //   ⏱ 漏接 = 没来得及按键（miss），垃圾掉走了，同样补知识点。
    const wrap = document.getElementById('result-mistakes');
    const ms = st.mistakes || [];
    const wrong = ms.filter((m) => m.kind !== 'miss');
    const missed = ms.filter((m) => m.kind === 'miss');
    const card = (m) =>
      '<div class="mistake-card ' + (m.kind === 'miss' ? 'is-miss' : 'is-wrong') + '">'
      + '<span class="m-badge">' + (m.kind === 'miss' ? '⏱ 漏接' : '❌ 选错') + '</span>'
      + '<span class="m-name">'
      + (m.icon ? '<img class="m-icon" src="' + m.icon + '" alt="">' : '')
      + m.name + '</span>'
      + '　应投入：<span class="m-cat cat-' + m.bin + '">' + Game.render.BIN_NAMES[m.bin] + '</span>'
      + '<div class="m-tip">' + m.tip + '</div>'
      + '</div>';
    wrap.classList.toggle('hidden', ms.length === 0);
    wrap.innerHTML = ms.length
      ? '<h3>📖 答错回顾（选错 ' + wrong.length + ' · 漏接 ' + missed.length + '）</h3>'
      + (wrong.length ? '<h4 class="m-sub m-sub-wrong">❌ 选错 · 按了但分类放错</h4>' + wrong.map(card).join('') : '')
      + (missed.length ? '<h4 class="m-sub m-sub-miss">⏱ 漏接 · 没来得及处理</h4>' + missed.map(card).join('') : '')
      : '';

    this.showScreen('result');
  },

  // ---- 设置弹窗开关 ----
  openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  },

  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    if (id === 'modal-settings') {
      // 关闭弹窗时收起未确认的重置确认条
      document.getElementById('reset-confirm').classList.add('hidden');
    }
  },

  // 把已保存的设置同步到弹窗控件（每次打开设置时调用）
  syncSettingsUI() {
    const cfg = Game.storage.settings();
    document.getElementById('set-bgm').checked = cfg.bgm;
    document.getElementById('set-sfx').checked = cfg.sfx;
    const pct = Math.round(cfg.volume * 100);
    document.getElementById('set-volume').value = pct;
    document.getElementById('set-volume-val').textContent = pct + '%';
  },

  // 应用设置到运行时：
  //   音效开关 → main.js 判定回调里读 Game.storage.settings().sfx 后再播（丙名下文件，已接入）；
  //   BGM 开关 / 音量 → 需要 master GainNode，契约上应由甲提供 Game.audio.setVolume(v)；
  //   此处前向兼容：接口一到位立即生效，缺位时静默跳过不报错（值已持久化不丢）。
  applySettings() {
    const cfg = Game.storage.settings();
    if (typeof Game.audio.setVolume === 'function') {
      Game.audio.setVolume(cfg.bgm ? cfg.volume : 0);
    }
  },

  // ---- 知识库渲染：tab = 'all'（全部垃圾）| 'fav'（我的收藏）----
  // 卡片复用结算页错题卡结构（圆角/徽标/图标/tip），中性描边 + 分类色左色条
  renderWiki(tab) {
    this._wikiTab = tab;
    document.querySelectorAll('.wiki-tab').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    const favs = Game.storage.favs();
    const list = tab === 'fav'
      ? Game.TRASH.filter((t) => favs.indexOf(t.id) !== -1)
      : Game.TRASH;

    document.getElementById('wiki-count').textContent =
      tab === 'fav'
        ? '已收藏 ' + list.length + ' 条 · 在卡片右上角点 ♥ 收藏'
        : '共 ' + list.length + ' 条 · 四类各 11 条 · 点 ♥ 收藏到"我的收藏"';

    const grid = document.getElementById('wiki-grid');
    if (!list.length) {
      grid.innerHTML =
        '<p class="wiki-empty">' +
        (tab === 'fav' ? '还没有收藏，去"全部垃圾"里点亮 ♥ 吧！' : '暂无数据') +
        '</p>';
      return;
    }
    grid.innerHTML = list.map((t) => {
      const faved = favs.indexOf(t.id) !== -1;
      return '<div class="mistake-card wiki-card wk-' + t.bin + '">'
        + '<span class="m-badge bb-' + t.bin + '">' + this.CAT_NAMES[t.bin] + '</span>'
        + '<span class="m-name">'
        + (t.icon ? '<img class="m-icon" src="' + t.icon + '" alt="">' : '')
        + t.name + '</span>'
        + '<button class="fav-btn' + (faved ? ' on' : '') + '" data-fav="' + t.id
        + '" aria-label="收藏">' + (faved ? '♥' : '♡') + '</button>'
        + '<div class="m-tip">' + t.tip + '</div>'
        + '</div>';
    }).join('');
  },
};
