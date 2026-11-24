// js/judge.js —— 判定引擎【甲】
// 纯逻辑模块：不碰 DOM / Canvas / 样式。窗口与倍率为冻结数值，禁止修改。
window.Game = window.Game || {};

Game.judge = (function () {
  // ★判定窗口（冻结，单位秒）：修改前必须群内共识并更新 ARCHITECTURE.md
  const WIN = { perfect: 0.055, good: 0.115, bad: 0.180 };
  // 得分基数（冻结）
  const BASE = { perfect: 100, good: 60, bad: 30 };

  // 连击倍率（冻结）：≥25 连击 ×1.5，≥10 连击 ×1.2
  function multFor(combo) {
    return combo >= 25 ? 1.5 : combo >= 10 ? 1.2 : 1.0;
  }

  // 取当前局状态（main.js 在 newRun 里初始化，judge 只读写约定的字段）
  function st() {
    return Game.state;
  }

  // 在未判定音符里找 |hitTime - t| 最小且 ≤ WIN.bad 的那颗
  // notes 按 hitTime 升序：hitTime - t > WIN.bad 说明后面的更远，可直接 break
  function findTarget(t) {
    const notes = st().notes;
    let best = null;
    let bestAbs = Infinity;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.judged) continue;
      const d = n.hitTime - t;
      if (d > WIN.bad) break;
      const abs = Math.abs(d);     // 按早/按晚都取绝对值比较
      if (abs <= WIN.bad && abs < bestAbs) {
        best = n;
        bestAbs = abs;
      }
    }
    return best;
  }

  // 按 |delta| 分档（分类对的前提下）
  function gradeOf(abs) {
    if (abs <= WIN.perfect) return 'perfect';
    if (abs <= WIN.good) return 'good';
    return 'bad';
  }

  // 结算一颗音符：更新 combo / score / lives / counts / judged，并回调 onJudge
  function apply(note, result, delta) {
    const s = st();
    if (!s.counts) {
      s.counts = { perfect: 0, good: 0, bad: 0, miss: 0, wrongBin: 0 };
    }

    note.result = result;
    note.judged = true;
    s.judged = (s.judged || 0) + 1;
    s.counts[result] = (s.counts[result] || 0) + 1;

    if (result === 'perfect' || result === 'good') {
      s.combo = (s.combo || 0) + 1;
      s.score = (s.score || 0) + Math.round(BASE[result] * multFor(s.combo));
    } else if (result === 'bad') {
      // 契约第 4 节「30 × 连击倍率（combo 重置）」的先后顺序已由组长裁定：
      // 先用归零前的连击取倍率计分，再重置连击（与 perfect/good 先加 combo 再取倍率一致）
      s.score = (s.score || 0) + Math.round(BASE.bad * multFor(s.combo || 0));
      s.combo = 0;
    } else {
      // miss / wrongBin：重置连击并扣 1 命
      s.combo = 0;
      s.lives = (typeof s.lives === 'number' ? s.lives : 3) - 1;
    }

    // 交给 fx / ui / audio.sfx 挂钩（judge 自身不碰 DOM）
    if (typeof s.onJudge === 'function') {
      s.onJudge({ note: note, result: result, delta: delta });
    }
  }

  return {
    WIN: WIN,
    multFor: multFor,

    // 玩家按下某个桶。bin: 0可回收 1有害 2厨余 3其他；t 来自 Game.audio.getTime()
    press(bin, t) {
      const s = st();
      if (!s || !s.notes || !s.notes.length) return null;

      const note = findTarget(t);
      if (!note) return null;                  // 空按

      const delta = note.hitTime - t;          // 正数 = 按早了
      const result = note.bin !== bin ? 'wrongBin' : gradeOf(Math.abs(delta));
      apply(note, result, delta);
      return { note: note, result: result, delta: delta };
    },

    // 每帧调用：超时未处理（t - hitTime > WIN.bad）→ 自动判 miss
    update(t) {
      const s = st();
      if (!s || !s.notes) return;
      for (let i = 0; i < s.notes.length; i++) {
        const n = s.notes[i];
        if (n.judged) continue;
        if (n.hitTime - t > WIN.bad) break;    // 升序：后面的还没进窗口
        if (t - n.hitTime > WIN.bad) apply(n, 'miss', n.hitTime - t);
      }
    },

    // 准确率（结算评级用）：(perfect + good*0.65 + bad*0.3) / 总音符数，0~1
    accuracy() {
      const s = st();
      if (!s || !s.notes || !s.notes.length) return 0;
      const c = s.counts || {};
      const hit = (c.perfect || 0) + (c.good || 0) * 0.65 + (c.bad || 0) * 0.3;
      return hit / s.notes.length;
    },
  };
})();
