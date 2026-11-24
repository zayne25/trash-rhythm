// js/render.js —— Canvas 渲染【乙】
// 只读 Game.state 绘制，禁止写任何游戏状态（分数/连击/生命一律由 judge.js 管理）。
window.Game = window.Game || {};

Game.render = {
  // ★坐标常量（冻结，input.js 的点击判定依赖 binRect）
  W: 960,
  H: 640,
  JUDGE_Y: 500, // 2026-11-21 由 520 上移至 500（压在桶区上方）：★契约冻结值已变更，需组长同步 ARCHITECTURE.md 第 7 节
  BIN: { y: 522, w: 190, h: 110, gap: 16, pad: 56 }, // 2026-11-21 由 y=556/h=76 上移加高（判定线下方贴线）：★契约冻结值已变更，需组长同步 ARCHITECTURE.md 第 7 节
  BIN_NAMES: ['可回收物', '有害垃圾', '厨余垃圾', '其他垃圾'],
  BIN_KEYS: ['D', 'F', 'J', 'K'],
  BIN_COLORS: ['#3b82f6', '#ef4444', '#22c55e', '#9ca3af'], // 与 css 变量 --bin-0~3 一致

  binRect(i) {
    const B = this.BIN;
    return { x: B.pad + i * (B.w + B.gap), y: B.y, w: B.w, h: B.h };
  },
};

(function () {
  // 画布内用到的字体（与 base.css body 字体一致，非色值不违反规则5）
  const FONT = 'system-ui, "Microsoft YaHei", sans-serif';

  // ---- 调色板：一律取 css/base.css 的 CSS 变量，丙切换浅色主题后本模块自动跟随 ----
  // 变量缺失时才使用浅蓝白兜底值；瓦片底/字色待丙在 base.css 补 --tile / --tile-text 后生效
  let palette = null;
  function loadPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    palette = {
      bg1: v('--bg-1', '#eaf4ff'),        // 背景渐变起色（浅蓝白）
      bg2: v('--bg-2', '#ffffff'),        // 背景渐变止色
      accent: v('--accent', '#3b82f6'),   // 判定线呼吸发光（蓝色 accent）
      grid: v('--accent-2', '#60a5fa'),   // 节拍网格线（淡蓝）
      muted: v('--muted', '#94a3b8'),     // 瓦片中性灰描边
      tileFill: v('--tile', '#ffffff'),   // 瓦片白底
      tileText: v('--tile-text', '#12325b'), // 瓦片深字
      binText: '#ffffff',                 // 桶内文字白色（压在彩色底上，四桶通用）
    };
  }

  // #rrggbb → rgba(r,g,b,a)，用于给 CSS 变量色值叠加透明度
  function withAlpha(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // 圆角矩形路径（不依赖 ctx.roundRect，兼容旧浏览器）
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 把任意时间相位归一化到 [0,1)——t 可为负（开局倒计时），不能直接取模
  function phaseOf(t, period) {
    return ((t / period) % 1 + 1) % 1;
  }

  // ① 背景：浅色线性渐变（--bg-1 → --bg-2）
  function drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, Game.render.H);
    g.addColorStop(0, palette.bg1);
    g.addColorStop(1, palette.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Game.render.W, Game.render.H);
  }

  // ② 节拍网格线：按 bpm 求半拍间距，判定线下方若干淡蓝横线随时间上移
  function drawGrid(ctx, t, level) {
    const half = 30 / level.bpm;            // 半拍秒数
    const spacing = half * level.speed;     // 对应像素间距（与下落速度一致）
    const phase = phaseOf(t, half);
    ctx.strokeStyle = withAlpha(palette.grid, 0.22);
    ctx.lineWidth = 1;
    for (let y = Game.render.JUDGE_Y - phase * spacing; y < Game.render.H; y += spacing) {
      if (y < Game.render.JUDGE_Y) continue; // 只画判定线下方
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(Game.render.W, y);
      ctx.stroke();
    }
  }

  // ③ 判定线：y=JUDGE_Y 横线，透明度/线宽随节拍相位呼吸发光
  function drawJudgeLine(ctx, t, bpm) {
    const pulse = 1 - phaseOf(t, 60 / bpm); // 正拍瞬间最亮，随后衰减
    const R = Game.render;
    ctx.save();
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 6 + 14 * pulse;
    ctx.strokeStyle = withAlpha(palette.accent, 0.55 + 0.45 * pulse);
    ctx.lineWidth = 2 + 2 * pulse;
    ctx.beginPath();
    ctx.moveTo(0, R.JUDGE_Y);
    ctx.lineTo(R.W, R.JUDGE_Y);
    ctx.stroke();
    ctx.restore();
  }

  // ---- 垃圾图标缓存（组长 2026-11-23）：美术组实拍图标 assets/trash/<id>.png，
  //      替换原"纯文字名称"占位。首次绘制时按需加载，加载完成前回退为纯名称兜底。
  const ICONS = {};
  function getIcon(src) {
    if (!src) return null;
    let im = ICONS[src];
    if (!im) {
      im = new Image();
      im.src = src;
      ICONS[src] = im;
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  // 开局/进菜单时批量预热（避免游戏内图标"逐个蹦出来"）
  Game.render.preloadIcons = function () {
    (Game.TRASH || []).forEach((t) => getIcon(t.icon));
  };

  // ④ 下落音符：82×82 方形瓦片（白底灰描边，绝不露出分类颜色防泄题）。
  //    组长调整 2026-11-23（用户反馈"四角边框断开"）：根因是图标 PNG 为不透明白底
  //    矩形，80×80 图片四角盖住了圆角弧线（r=12 的弧距瓦片角仅 ~3.5px，图片边距 2px）。
  //    对策：图片裁剪在圆角路径内（clip）绘制，且描边放最后——边框永远在图标之上，
  //    四角无缝衔接；内容区 (TW-4)=78px 等比 contain 缩放防变形；
  //    图标未加载完成时回退为纯名称兜底。
  function drawNotes(ctx, t, speed) {
    const R = Game.render;
    const TW = R.TILE || 82, TH = TW; // 竖屏由 Game.ui.applyStageLayout 放大（桌面仍 82）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of Game.state.notes || []) {
      const dtn = n.hitTime - t;
      // 组长热修 2026-11-18（乙重构时请吸收本行）：绘制窗口不能写死 2.2s——
      // 必须随 speed 换算全屏行程，否则速度调慢后垃圾会在半空凭空出现而非从顶端滑入
      if (dtn > (R.JUDGE_Y + TH / 2) / speed) break; // 谱面按 offset 升序，后面更远，直接截断
      if (n.judged) continue;          // 已判定的反馈交给 fx
      const y = R.JUDGE_Y - dtn * speed;
      if (y < -TH / 2 - 4) continue;   // 还没进入可视区（瓦片变大，随高度修正）
      const left = n.x - TW / 2, top = y - TH / 2;

      roundRect(ctx, left, top, TW, TH, 12);
      ctx.fillStyle = palette.tileFill;
      ctx.fill();

      const im = getIcon(n.trash.icon);
      if (im) {
        // 图标裁剪在圆角路径内绘制，避免白底矩形四角盖住边框弧线
        ctx.save();
        roundRect(ctx, left, top, TW, TH, 12);
        ctx.clip();
        // 等比 contain 缩放：适配 78×78 内容区并居中，不拉伸变形
        const s = Math.min((TW - 4) / im.naturalWidth, (TH - 4) / im.naturalHeight);
        const w = im.naturalWidth * s, h = im.naturalHeight * s;
        ctx.drawImage(im, n.x - w / 2, y - h / 2, w, h);
        ctx.restore();
      }

      // 描边最后画：永远压在图标之上，四角连续闭合
      roundRect(ctx, left, top, TW, TH, 12);
      ctx.strokeStyle = palette.muted;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (!im) {
        // 兜底：图标尚未加载完成时显示名称
        ctx.fillStyle = palette.tileText;
        ctx.font = Math.round(17 * TW / 82) + 'px ' + FONT;
        ctx.fillText(n.trash.name, n.x, y);
      }
    }
  }

  // ⑤ 四个分类桶：按参考图还原街边分类垃圾桶（收口桶身/圆顶盖提手/白色字与标识/小物件插画），按下 130ms 内提亮
  //    竖屏适配（丙 2026-11-24）：整桶改在 190×110 的"设计坐标系"里绘制，再按 binRect
  //    的 w/h 做一次 ctx.scale —— 桌面 w=190/h=110 时缩放比为 1，画面逐像素不变；
  //    竖屏 applyStageLayout 把 binRect 改成均分宽度、更高的桶区，桶与字自动等比放大。
  function drawBins(ctx, st) {
    const R = Game.render;
    const now = performance.now(); // 仅用于按下高亮的视觉反馈，判定时间仍走 audio.getTime()
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const r = R.binRect(i);
      const color = R.BIN_COLORS[i];
      const pressed = st.pressedBin === i && st.pressedAt != null && now - st.pressedAt < 130;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(r.w / 190, r.h / 110);
      const cx = 95, BH = 110;                 // 局部设计坐标系：桶框 190×110
      // 参考图是竖长的环卫桶：桶身窄于命中框、几乎直筒，盖子三层且盖沿最宽
      const wTop = 112, wBot = 100;
      const bodyTop = 30, bodyBottom = BH;

      // 盖子三层（自上而下：中央凸台 → 盖板 → 最宽的盖沿横条）
      roundRect(ctx, cx - 32, 0, 64, 12, 5);            // 凸台
      ctx.fillStyle = shade(color, 0.60);
      ctx.fill();
      roundRect(ctx, cx - (wTop + 12) / 2, 5, wTop + 12, 14, 5); // 盖板
      ctx.fillStyle = shade(color, 0.74);
      ctx.fill();
      roundRect(ctx, cx - (wTop + 12) / 2, 8, wTop + 12, 4, 2);  // 盖板顶面高光
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
      roundRect(ctx, cx - (wTop + 34) / 2, 17, wTop + 34, 14, 7); // 盖沿（全桶最宽）
      ctx.fillStyle = shade(color, 0.66);
      ctx.fill();

      // 桶身：分类色垂直渐变 + 深色细描边
      const g = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
      g.addColorStop(0, shade(color, 1.10));
      g.addColorStop(1, shade(color, 0.82));
      canBodyPath(ctx, cx, bodyTop, wTop, wBot, bodyBottom, 14);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = shade(color, 0.66);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 盖沿下三只小卡扣（挂在桶身顶部）
      ctx.beginPath();
      for (const dx of [-26, 0, 26]) {
        ctx.moveTo(cx + dx, bodyTop);
        ctx.lineTo(cx + dx, bodyTop + 7);
      }
      ctx.strokeStyle = shade(color, 0.60);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      // 柱面光感：裁剪进桶身轮廓后，画左侧高光条与右侧阴影条
      ctx.save();
      canBodyPath(ctx, cx, bodyTop, wTop, wBot, bodyBottom, 14);
      ctx.clip();
      roundRect(ctx, cx - 44, bodyTop + 8, 12, BH - 46, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      roundRect(ctx, cx + 32, bodyTop + 8, 12, BH - 46, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fill();
      ctx.restore();

      // 白色字与标识：可回收物=字上标下，其余三类=标上字下（与参考图排版一致）
      ctx.fillStyle = palette.binText;
      ctx.font = 'bold 14px ' + FONT;
      if (i === 0) {
        ctx.fillText(R.BIN_NAMES[i], cx, 52);
        drawBinEmblem(ctx, i, cx, 74);
      } else {
        drawBinEmblem(ctx, i, cx, 52);
        ctx.fillText(R.BIN_NAMES[i], cx, 74);
      }
      drawBinItems(ctx, i, cx, 97);

      // 键位角标：桶右侧分类色圆片 + 白字（位置仍在 binRect 内）
      const kx = 190 - 16, ky = 14;
      ctx.beginPath();
      ctx.arc(kx, ky, 10, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = palette.binText;
      ctx.font = 'bold 12px ' + FONT;
      ctx.fillText(R.BIN_KEYS[i], kx, ky + 1);

      if (pressed) { // 提亮：整桶叠白光 + 分类色加粗描边
        canBodyPath(ctx, cx, bodyTop, wTop, wBot, bodyBottom, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.24)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        roundRect(ctx, cx - wTop / 2 - 7, 7, wTop + 14, 15, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.24)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 桶身路径：上宽下窄梯形 + 底部圆角（只建路径，供填充/描边/高亮复用）
  function canBodyPath(ctx, cx, top, wTop, wBot, bottom, r) {
    const tl = cx - wTop / 2, tr = cx + wTop / 2;
    const bl = cx - wBot / 2, br = cx + wBot / 2;
    ctx.beginPath();
    ctx.moveTo(tl, top);
    ctx.lineTo(tr, top);
    ctx.lineTo(br, bottom - r);
    ctx.quadraticCurveTo(br, bottom, br - r, bottom);
    ctx.lineTo(bl + r, bottom);
    ctx.quadraticCurveTo(bl, bottom, bl, bottom - r);
    ctx.closePath();
  }

  // 白色分类标识：0 循环箭头 / 1 警示三角叉 / 2 投放小人 / 3 开口桶+下落箭头
  function drawBinEmblem(ctx, bin, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = palette.binText;
    ctx.fillStyle = palette.binText;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (bin === 0) { // 三支首尾相接的循环箭头（可回收物标志）
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * k) / 3);
        ctx.beginPath();
        ctx.moveTo(-9, 7);
        ctx.lineTo(3, 7);
        ctx.quadraticCurveTo(8, 7, 8, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(3, 1);
        ctx.lineTo(11, 1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (bin === 1) { // 警示三角 + 叉（有害垃圾标志）
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(11, 9);
      ctx.lineTo(-11, 9);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, -2); ctx.lineTo(3, 4);
      ctx.moveTo(3, -2);  ctx.lineTo(-3, 4);
      ctx.stroke();
    } else if (bin === 2) { // 投放小人（厨余垃圾标志：小人前抛垃圾）
      ctx.beginPath();
      ctx.arc(-4, -9, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3, -6);
      ctx.quadraticCurveTo(0, -2, -1, 3);
      ctx.moveTo(-1, 3); ctx.lineTo(-5, 9);
      ctx.moveTo(-1, 3); ctx.lineTo(3, 9);
      ctx.moveTo(-2, -4);
      ctx.quadraticCurveTo(4, -4, 8, -1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -3);
      ctx.lineTo(6, 1);
      ctx.lineTo(11, 1);
      ctx.closePath();
      ctx.fill();
    } else { // 开口桶 + 下落箭头（其他垃圾标志）
      ctx.beginPath();
      ctx.moveTo(-8, -3); ctx.lineTo(-6, 9); ctx.lineTo(6, 9); ctx.lineTo(8, -3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(0, -2);
      ctx.moveTo(-4, -6); ctx.lineTo(0, -2); ctx.lineTo(4, -6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 白色小物件插画：每类三种代表性垃圾的极简剪影
  function drawBinItems(ctx, bin, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = palette.binText;
    ctx.strokeStyle = palette.binText;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const xs = [-24, 0, 24];
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(xs[k], 0);
      if (bin === 0) { // 易拉罐 / 塑料瓶 / 纸叠
        if (k === 0) { roundRect(ctx, -4, -5, 8, 11, 2); ctx.fill(); }
        if (k === 1) { roundRect(ctx, -3, -6, 6, 12, 2); ctx.fill(); roundRect(ctx, -2, -9, 4, 3, 1); ctx.fill(); }
        if (k === 2) { ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-4, -4); ctx.lineTo(5, -4); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill(); }
      } else if (bin === 1) { // 电池 / 药瓶 / 灯管
        if (k === 0) { roundRect(ctx, -4, -6, 8, 12, 1); ctx.fill(); roundRect(ctx, -2, -8, 4, 2, 1); ctx.fill(); }
        if (k === 1) { roundRect(ctx, -4, -4, 8, 10, 2); ctx.fill(); roundRect(ctx, -3, -7, 6, 3, 1); ctx.fill(); }
        if (k === 2) { ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(4, -6); ctx.moveTo(-4, 6); ctx.lineTo(4, 6); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke(); }
      } else if (bin === 2) { // 鱼骨 / 菜叶 / 果皮
        if (k === 0) { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(3, -3); ctx.lineTo(6, 0); ctx.lineTo(3, 3); ctx.moveTo(-3, -3); ctx.lineTo(-3, 3); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke(); }
        if (k === 1) { ctx.beginPath(); ctx.ellipse(0, 0, 5, 7, -0.5, 0, Math.PI * 2); ctx.fill(); }
        if (k === 2) { ctx.beginPath(); ctx.arc(0, 0, 6, 0.4, 2.6); ctx.stroke(); }
      } else { // 灰堆 / 纸团 / 碎瓷
        if (k === 0) { ctx.beginPath(); ctx.moveTo(-7, 6); ctx.quadraticCurveTo(0, -6, 7, 6); ctx.closePath(); ctx.fill(); }
        if (k === 1) { ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-3, -3); ctx.lineTo(1, -5); ctx.lineTo(5, 1); ctx.lineTo(3, 5); ctx.closePath(); ctx.fill(); }
        if (k === 2) { ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(0, -5); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill(); }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // 颜色明暗调整：f>1 提亮、f<1 压暗（#rrggbb 各通道乘系数后截断）
  function shade(hex, f) {
    const h = hex.replace('#', '');
    const ch = s => Math.min(255, Math.round(parseInt(h.slice(s, s + 2), 16) * f));
    return 'rgb(' + ch(0) + ',' + ch(2) + ',' + ch(4) + ')';
  }

  // 挂到 Game.render，保留 stub 冻结常量与 binRect
  Object.assign(Game.render, {
    // 每帧绘制（main.js 已做 dpr setTransform，这里全用逻辑坐标）
    draw(t) {
      if (!palette) loadPalette();
      const ctx = Game.canvas.getContext('2d');
      drawBackground(ctx); // 背景不参与震屏，避免露边
      const st = Game.state;
      if (!st || !st.level) return; // 菜单等场景只画背景
      ctx.save();
      const off = Game.fx.offset(); // 震屏：miss/wrongBin 时整体平移
      ctx.translate(off.dx, off.dy);
      drawGrid(ctx, t, st.level);
      drawJudgeLine(ctx, t, st.level.bpm);
      drawNotes(ctx, t, st.level.speed);
      drawBins(ctx, st);
      ctx.restore();
    },
  });
})();
