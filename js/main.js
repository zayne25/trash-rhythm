// js/main.js —— 入口与状态机【组长独占，其他成员禁止修改】
// 状态机：menu → playing ⇄ paused → result → menu / retry
// ★必须用 ||：main.js 在所有模块之后加载，无条件赋值会把 audio/chart/judge/fx/render/input/ui/storage 全部冲掉
window.Game = window.Game || { state: null };

(function () {
  const cv = document.getElementById('stage');
  Game.canvas = cv;

  // 画布按 devicePixelRatio 放大BackingStore，绘制仍用 960×640 逻辑坐标（ARCHITECTURE 第 7 节）
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Game.render.W * DPR;
  cv.height = Game.render.H * DPR;
  const ctx = cv.getContext('2d');

  // ---- 主循环：优先 rAF；常驻看门狗保证"rAF 饿死"的环境（嵌入式预览/后台标签/
  //      无头虚拟时间等）也能持续出帧并评估结束条件，否则会出现"音符判完却永不结算" ----
  let running = false;      // 循环是否在跑（暂停/结算时置 false）
  let useTimer = false;     // 是否已降级为 setTimeout 驱动
  let lastFrame = 0;
  let guardTimer = 0;
  let slowFrames = 0;       // 连续慢帧计数（rAF 被节流的检测）

  function schedule() {
    if (!running) return;
    if (useTimer) {
      setTimeout(() => frame(performance.now()), 16);
      return;
    }
    requestAnimationFrame(frame);
    // 常驻看门狗：每帧布防。若 600ms 内 rAF 没能触发下一帧，就用定时器补一帧。
    // 补帧时先查 lastFrame，避免和刚触发的 rAF 帧重复跑。
    clearTimeout(guardTimer);
    guardTimer = setTimeout(() => {
      if (running && performance.now() - lastFrame > 500) frame(performance.now());
    }, 600);
  }

  function frame(now) {
    clearTimeout(guardTimer);              // 本帧已执行，撤销看门狗补帧
    const st = Game.state;
    if (!st || st.scene !== 'playing') { running = false; return; } // 暂停/结算时自然停摆

    // dt 限幅 [0, 50ms]：上限防切后台特效瞬移；下限防负 dt——
    // rAF 帧用 vsync 时间戳、看门狗补帧用 performance.now()，两者交错时 now-lastFrame
    // 可能为负，负 dt 会让特效时间倒流（e.t<0），effects 画环时 arc 半径为负直接抛异常，
    // 主循环中断 → 游戏中途冻结无法结算（11-19 联调实测定位）
    const dt = Math.max(0, Math.min((now - lastFrame) / 1000, 0.05));

    // 自适应降级：某些预览面板把 rAF 节流到 0.4~0.5 秒一帧（偶发触发但极慢），
    // 旧看门狗阈值救不了 → 画面只有 2fps，用户感知为"下落不顺滑"。
    // 连续 3 帧间隔超 120ms 就判定 rAF 不可用，本局剩余时间改用 16ms 定时器（60fps）。
    if (now - lastFrame > 120) slowFrames++; else slowFrames = 0;
    if (slowFrames >= 3 && !useTimer) useTimer = true;
    lastFrame = now;

    const t = Game.audio.getTime();          // ★唯一时间源
    Game.judge.update(t);                    // 超时自动 miss（含扣命，触发 onJudge）
    Game.fx.update(dt);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);  // 每帧重置，防止上一帧 save/restore 残留
    Game.render.draw(t);                     // 场景（内部含震屏偏移）
    drawSpawnHints(ctx, t, st.notes, st.level.speed); // 出生前提示箭头
    Game.fx.draw(ctx);                       // 特效叠在场景之上
    Game.ui.updateHUD();

    // 结束判定：生命耗尽 → 失败结算；全部判完且过尾音 0.6s → 通关结算
    const notes = st.notes;
    if (st.lives <= 0) { endRun(false); return; }
    const lastHit = notes.length ? notes[notes.length - 1].hitTime : 0;
    if (st.judged >= notes.length && t > lastHit + 0.6) { endRun(true); return; }

    schedule();
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastFrame = performance.now();
    schedule();
  }

  function stopLoop() {
    running = false;
    clearTimeout(guardTimer);
  }

  // ---- 出生前提示：垃圾还没进入屏幕时，在其落点 x 的顶部画一个下指箭头 ----
  // 窗口 = 瓦片进入屏幕前 1.5 秒；越接近出现时刻越亮，瓦片露头后箭头消失（交给瓦片本身）。
  // 注：本应属于 render.js（乙），组装期临时放在 main.js，待乙重构时挪入。
  // 竖屏全屏舞台时由 Game.ui.applyStageLayout 写入 Game.render.HINT（箭头放大下移）；
  // 桌面/横屏为 null，走下面这份默认值，画面不变
  const HINT_DEFAULT = { pre: 1.5, y: 26, half: 9 };
  let _hintColor = '';
  function hintColor() {
    if (!_hintColor) {
      _hintColor = (getComputedStyle(document.documentElement)
        .getPropertyValue('--accent') || '#3b82f6').trim();
    }
    return _hintColor;
  }
  function drawSpawnHints(ctx, t, notes, speed) {
    const HINT = Game.render.HINT || HINT_DEFAULT;
    const visibleAt = (Game.render.JUDGE_Y + 40) / speed; // 距落线多少秒时瓦片开始进入屏幕
    const c = hintColor();
    ctx.save();
    for (const n of notes) {
      if (n.judged) continue;
      const dtn = n.hitTime - t;
      if (dtn <= visibleAt || dtn > visibleAt + HINT.pre) continue; // 只在"即将出现"窗口显示
      const near = 1 - (dtn - visibleAt) / HINT.pre; // 0→1，越接近出现越亮
      ctx.globalAlpha = 0.2 + 0.8 * near;
      ctx.fillStyle = c;
      // 下指箭头
      ctx.beginPath();
      ctx.moveTo(n.x, HINT.y + 7);
      ctx.lineTo(n.x - HINT.half, HINT.y - 5);
      ctx.lineTo(n.x + HINT.half, HINT.y - 5);
      ctx.closePath();
      ctx.fill();
      // 下方竖线：指向即将出现的位置，长度随接近缩短
      ctx.strokeStyle = c;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(n.x, HINT.y + 12);
      ctx.lineTo(n.x, HINT.y + 12 + 18 * (1 - near));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- 判定回调：所有视觉/听觉反馈统一在这里分发（judge 纯逻辑，不碰 DOM）----
  function onJudge(ev) {
    const st = Game.state;
    // 音效开关（设置弹窗）：关闭时跳过播放（存储层仍照常记录）
    if (Game.storage.settings().sfx) Game.audio.sfx(ev.result);
    Game.fx.spawnJudge(ev.note.x, Game.render.JUDGE_Y, ev.result);
    // 分类错 / 漏接：不再弹知识点卡片（会遮挡下落物），只做轻量反馈（音效/特效/扣命），
    // 题目统一收进 st.mistakes，由结算页分区集中展示（选错 / 漏接 分开归类，用户要求区分）。
    // 漏接同样值得回顾：玩家没来得及处理，正确分类知识点照样要补。
    if (ev.result === 'wrongBin' || ev.result === 'miss') {
      st.mistakes.push({
        kind: ev.result,               // 'wrongBin' = 选错（按了但分类错）/'miss' = 漏接（没按）
        icon: ev.note.trash.icon || '',
        name: ev.note.trash.name,
        bin: ev.note.bin,              // 该垃圾应投入的分类
        tip: ev.note.trash.tip,
      });
    }
    // 最大连击：apply 先更新 combo 再回调，这里顺势记账（供结算页显示）
    if ((ev.result === 'perfect' || ev.result === 'good') && st.combo > st.maxCombo) {
      st.maxCombo = st.combo;
    }
  }

  // ---- 开局流程（ARCHITECTURE 第 6 节规定的顺序）----
  function newRun(levelIdx) {
    const level = Game.LEVELS[levelIdx];
    const pool = Game.TRASH.filter((item) => item.diff <= level.diff);
    const notes = Game.chart.generate(level, pool);
    const startTime = Game.audio.start(level);
    Game.chart.attach(notes);                // hitTime 与 audio.getTime() 同基准（相对时钟起点）

    Game.state = {
      scene: 'playing',
      levelIdx: levelIdx,
      level: level,
      notes: notes,
      score: 0,
      combo: 0,
      maxCombo: 0,
      lives: 3,
      // 本局用时（丙 2026-11-23）：不累计 dt（丢帧环境会走慢），改为对游戏时钟取差——
      // beginAt 在开局瞬间取值（约 -2，含 READY 前奏），暂停时 audio 时钟冻结、用时自然停
      beginAt: Game.audio.getTime(),
      elapsed: 0,
      judged: 0,
      mistakes: [],                          // 答错的题目（结算页集中回顾）
      counts: { perfect: 0, good: 0, bad: 0, miss: 0, wrongBin: 0 },
      pressedBin: null,                      // 仅供 render 按下高亮（input 写、render 读）
      pressedAt: null,
      onJudge: onJudge,
    };

    Game.ui.startLevel(levelIdx);
    Game.input.refocus();                    // 开局抢键盘焦点（线上 iframe 环境必修）
    Game.ui.showReadyGo();
    startLoop();
  }

  // ---- 结算：audio 停排、场景切 result，数值由 ui.showResult 读取 ----
  function endRun(cleared) {
    stopLoop();
    Game.audio.stop();
    Game.state.scene = 'result';             // 主循环下帧自然停
    Game.ui.showResult();
    return cleared;
  }

  Game.main = {
    newRun: newRun,

    // Esc/P 或按钮：playing ⇄ paused，音频时钟 suspend/resume 零漂移
    togglePause() {
      const st = Game.state;
      if (!st || (st.scene !== 'playing' && st.scene !== 'paused')) return;
      if (st.scene === 'playing') {
        st.scene = 'paused';
        Game.audio.pause();
        Game.ui.showPause(true);
      } else {
        st.scene = 'playing';
        Game.audio.resume();
        Game.ui.showPause(false);
        startLoop();                          // 暂停期间 rAF 已停，恢复要重启
      }
    },

    backToMenu() {
      stopLoop();
      if (Game.state && (Game.state.scene === 'playing' || Game.state.scene === 'paused')) {
        Game.audio.stop();
      }
      Game.state = { scene: 'menu' };
      Game.ui.showScreen('menu');
    },

    retry() {
      const st = Game.state;
      newRun(st && st.levelIdx !== undefined ? st.levelIdx : 0);
    },
  };

  Game.ui.init();
  Game.input.init();
  Game.render.preloadIcons(); // 开局预热 44 张垃圾图标，游戏内瓦片直接可绘
})();
