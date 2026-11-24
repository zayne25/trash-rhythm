// js/chart.js —— 谱面生成【甲】
// 职责：按关卡配置在节拍网格上生成音符（相对时间），开局时绑定绝对时间。
window.Game = window.Game || {};

Game.chart = (function () {
  // GO! 提示消失的时刻（与 ui.js 的 showReadyGo 时间轴一致：READY 1.6s + GO 0.8s）
  const GO_END = 2.4;
  const X_MIN = 120;         // 下落横坐标范围（避开屏幕两侧）
  const X_SPAN = 720;        // 120 ~ 840

  // 从垃圾池随机取一条（池为空时按关卡难度过滤 Game.TRASH 兜底，避免崩）
  function pickTrash(pool, level) {
    let list = pool;
    if (!list || !list.length) {
      list = Game.TRASH.filter(function (item) {
        return item.diff <= level.diff;
      });
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  return {
    // 生成谱面。notes 必须按 offset 升序（judge.js 依赖此顺序做剪枝）。
    // level 字段见 data/levels.js：bpm / duration / step(相邻音符节拍间隔) /
    //   density(生成概率) / minGap(最小间隔秒) / count(可选，固定音符数量，优先于 density)
    generate(level, pool) {
      const notes = [];
      const spb = 60 / level.bpm;          // 一拍秒数
      const stepSec = level.step * spb;    // 网格点间隔（秒）

      // ★组长调整 2026-11-19：前奏动态计算（原为固定 2 拍的 LEAD_IN_BEATS）。
      // 瓦片从顶端到判定线需 550/speed 秒（全程可见时间），速度越慢越长——
      // 固定 2 拍前奏时，慢速下第一颗垃圾在 READY 期间就已出现在半屏。
      // 现在令第一颗垃圾恰好在 GO! 消失(2.4s)后从顶端进入：
      //   hitTime0 = GO_END + 550/speed，再向上对齐到拍网格（保证不早于 GO 结束）。
      const visibleAt = 550 / level.speed;
      const leadInSec = Math.ceil((GO_END + visibleAt) / spb) * spb;

      // 先收集所有可用网格点（offset 用乘法一次算出，避免浮点累加漂移）
      const slots = [];
      for (let i = 0; ; i++) {
        const offset = leadInSec + i * stepSec;
        if (offset > level.duration) break;
        slots.push(offset);
      }

      // 选取谱面偏移：
      //   count 优先——按等间隔精确取 count 个网格点（教学关保证数量可预期，
      //   不会因为随机密度出现"这局 11 颗、下局 26 颗"）；否则走密度随机 + 最小间隔。
      let picked;
      if (level.count > 0) {
        const n = Math.min(level.count, slots.length);
        const set = new Set();
        for (let k = 0; k < n; k++) {
          const idx = n === 1 ? 0 : Math.round((k * (slots.length - 1)) / (n - 1));
          set.add(idx);
        }
        picked = Array.from(set).map((idx) => slots[idx]).sort((a, b) => a - b);
      } else {
        picked = [];
        let lastOffset = -Infinity;
        for (const offset of slots) {
          if (Math.random() > level.density) continue;   // 概率密度过滤
          if (offset - lastOffset < level.minGap) continue; // 最小间隔过滤
          picked.push(offset);
          lastOffset = offset;
        }
      }

      for (const offset of picked) {
        const trash = pickTrash(pool, level);
        notes.push({
          id: notes.length,
          offset: offset,
          hitTime: 0,                                    // 由 attach() 绑定
          bin: trash.bin,
          trash: trash,
          x: X_MIN + Math.random() * X_SPAN,
          judged: false,
          result: null,
        });
      }

      // 网格顺序推进，notes 天然按 offset 升序（judge 依赖，勿打乱）
      return notes;
    },

    // 开局绑定时间（main.js 在 audio.start() 之后调用）
    // ★组长热修 2026-11-18（甲确认时请知悉）：不再加 startTime，hitTime 必须与
    // audio.getTime() 同基准（相对时钟起点）。否则 dtn = (startTime+offset) - (currentTime-startTime)
    // 会多算 2×startTime：首颗垃圾到线时间被推迟，且 startTime 随页面打开时长增长 →
    // 越到后面等待越久（重开一局尤其明显）。改后 hitTime = offset，与 BGM 节拍严格对齐。
    attach(notes) {
      for (let i = 0; i < notes.length; i++) {
        notes[i].hitTime = notes[i].offset;
      }
    },
  };
})();
