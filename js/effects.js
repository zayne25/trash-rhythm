// js/effects.js —— 判定反馈特效【乙】
// 职责：判定时的视觉反馈。维护自身效果列表，由 main.js 每帧调 update(dt)/draw(ctx)。
window.Game = window.Game || {};

(function () {
  // 模块内部效果列表（闭包持有，不挂全局）
  let effects = [];

  // 各类特效参数（时间一律相对自身 e.t 累加，不用 performance.now）
  const RING = { r0: 10, r1: 46, life: 0.35, width: 4 };      // 判定扩散圆环
  const TEXT = { rise: 40, life: 0.8, size: 22 };             // 上浮文字：0.8s 上浮 40px
  const SHAKE = { life: 0.3, amp: 8 };                        // 震屏：0.3s 幅度 8px
  const PART = { count: 8, life: 0.5, speed: 260, size: 4 };  // perfect 粒子：8 个放射飞散
  const TAP = { r0: 8, r1: 22, life: 0.25, color: '#9ca3af' };// 空按小圆环（灰）
  const FONT = 'system-ui, "Microsoft YaHei", sans-serif';

  // 生成一个新效果对象（统一入口，保证都带 t/life/kind）
  function newEffect(kind, life, props) {
    const e = Object.assign({ kind: kind, t: 0, life: life }, props);
    effects.push(e);
    return e;
  }

  // perfect 粒子的放射角度：均匀铺开 + 少量随机抖动，视觉更自然
  function particleAngles() {
    const angles = [];
    for (let i = 0; i < PART.count; i++) {
      angles.push((Math.PI * 2 * i) / PART.count + (Math.random() - 0.5) * 0.5);
    }
    return angles;
  }

  // 震屏偏移：幅度随生命衰减，方向用不同频率正弦摆动（确定性，避免同帧抖动突兀）
  function shakeOffset(e) {
    const amp = SHAKE.amp * (1 - e.t / e.life);
    return {
      dx: Math.sin(e.t * 55) * amp,
      dy: Math.cos(e.t * 47) * amp,
    };
  }

  Game.fx = {
    // 文案与颜色（冻结，甲乙丙文案统一从这里取）
    LABEL: { perfect: '完美!', good: '良好', bad: '勉强', miss: '漏接', wrongBin: '分类错误!' },
    COLOR: { perfect: '#facc15', good: '#60a5fa', bad: '#9ca3af', miss: '#f87171', wrongBin: '#f87171' },

    // 判定命中：在 (x, y) 生成扩散圆环 + 上浮文字；perfect 追加粒子迸发；miss/wrongBin 触发震屏
    spawnJudge(x, y, result) {
      const color = this.COLOR[result];
      newEffect('ring', RING.life, { x: x, y: y, color: color });
      newEffect('text', TEXT.life, { x: x, y: y - 30, color: color, label: this.LABEL[result] });
      if (result === 'perfect') {
        newEffect('part', PART.life, { x: x, y: y, color: color, angles: particleAngles() });
      }
      if (result === 'miss' || result === 'wrongBin') {
        newEffect('shake', SHAKE.life, {});
      }
    },

    // 空按（没打到任何音符）：在桶中心生成灰色小圆环，提示"按了个寂寞"
    spawnTap(bin) {
      const r = Game.render.binRect(bin);
      newEffect('tap', TAP.life, {
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        color: TAP.color,
      });
    },

    // 累加各效果生命时间并移除过期项（dt 由 main clamp 后传入）
    update(dt) {
      for (const e of effects) e.t += dt;
      effects = effects.filter(e => e.t < e.life);
    },

    // 遍历绘制所有效果（只读列表，不改任何状态）
    draw(ctx) {
      for (const e of effects) {
        ctx.save();
        if (e.kind === 'ring' || e.kind === 'tap') drawRing(ctx, e);
        else if (e.kind === 'text') drawFloatText(ctx, e);
        else if (e.kind === 'part') drawParticles(ctx, e);
        ctx.restore();
      }
    },

    // 震屏偏移量：render.js 每帧先 ctx.translate(offset().dx, offset().dy) 再画场景
    offset() {
      let dx = 0, dy = 0;
      for (const e of effects) {
        if (e.kind !== 'shake') continue;
        const o = shakeOffset(e);
        dx += o.dx;
        dy += o.dy;
      }
      return { dx: dx, dy: dy };
    },
  };

  // 扩散圆环：半径 r0→r1 线性扩张，透明度随生命淡出，描边 4px
  function drawRing(ctx, e) {
    const p = e.t / e.life;
    const r = e.kind === 'tap'
      ? TAP.r0 + (TAP.r1 - TAP.r0) * p
      : RING.r0 + (RING.r1 - RING.r0) * p;
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = RING.width;
    ctx.beginPath();
    // 防御：特效时间异常（历史帧倒流）时半径不得为负，否则 arc 抛 IndexSizeError 打断主循环
    ctx.arc(e.x, e.y, Math.max(r, 0.5), 0, Math.PI * 2);
    ctx.stroke();
  }

  // 上浮文字：22px 加粗，0.8s 内上浮 40px 并淡出
  function drawFloatText(ctx, e) {
    const p = e.t / e.life;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = e.color;
    ctx.font = 'bold ' + TEXT.size + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.label, e.x, e.y - TEXT.rise * p);
  }

  // perfect 粒子：沿放射方向匀速飞散，半径缩小 + 淡出
  function drawParticles(ctx, e) {
    const p = e.t / e.life;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = e.color;
    for (const a of e.angles) {
      const d = PART.speed * e.t;
      const size = PART.size * (1 - p);
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, Math.max(size, 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
})();
