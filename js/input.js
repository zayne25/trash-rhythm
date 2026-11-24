// js/input.js —— 输入模块【乙】
// 职责：键盘 / 鼠标 / 触屏三端输入，统一收敛到 press(bin)，屏蔽 scene 状态。
window.Game = window.Game || {};

Game.input = {}; // 骨架占位：后续 Object.assign(Game.input, ...) 需要它先存在

(function () {
  // 把指针事件坐标换算成画布 960×640 逻辑坐标（canvas CSS 尺寸可能与逻辑分辨率不同）
  function toLogical(e) {
    const rect = Game.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (Game.render.W / rect.width),
      y: (e.clientY - rect.top) * (Game.render.H / rect.height),
    };
  }

  // 判断逻辑坐标落在哪个桶内（不命中返回 -1）
  function hitBin(x, y) {
    for (let i = 0; i < 4; i++) {
      const r = Game.render.binRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  Object.assign(Game.input, {
    // ★键位映射（冻结）：D 可回收 / F 有害 / J 厨余 / K 其他
    KEYS: { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 },

    // 本局是否收到过真实按键（键盘活性检测，组长 2026-11-23）：
    // 预览面板 iframe 里 document.hasFocus() 并不完全可靠（部分嵌入环境恒为 true），
    // 不能只靠它判断"键盘是否可用"。改为实测：开局置 false，收到任意 keydown 置 true；
    // ui.updateHUD 据此显示"点击画面激活键盘"提示条——只要键盘真没通，提示就一直挂着，
    // 直到玩家按下任意键或点击画面（点击手势会让浏览器把焦点交还 iframe）。
    keyboardAlive: false,

    // 统一输入入口：
    //   1. scene !== 'playing' 直接 return
    //   2. 记录 state.pressedBin / state.pressedAt = performance.now()（仅供 render 高亮，不参与判定）
    //   3. res = Game.judge.press(bin, Game.audio.getTime())（判定时间走唯一时间源）
    //   4. res 为 null（没打到任何音符）→ Game.fx.spawnTap(bin)
    press(bin) {
      const st = Game.state;
      if (!st || st.scene !== 'playing') return;
      st.pressedBin = bin;
      st.pressedAt = performance.now(); // 仅视觉反馈用，判定一律走 Game.audio.getTime()
      const res = Game.judge.press(bin, Game.audio.getTime());
      if (!res) Game.fx.spawnTap(bin);
    },

    init() {
      // 线上输入修复（组长 2026-11-23）：预览面板把游戏装进 sandbox iframe，键盘事件
      // 归属最外层文档——iframe 未获得焦点时 keydown 不会派发给游戏，按键"没反应"，
      // 音符过线被 judge.update 自动判 miss（用户感知为"按了键反而显示漏接"）。
      // 本地 file:// 是顶层标签页永远持有焦点，所以只在"线上"触发。
      // 对策：canvas 可聚焦 + 开局主动抢焦点；焦点丢失由 ui.updateHUD 显示提示条。
      try {
        Game.canvas.setAttribute('tabindex', '0'); // 双保险：index.html 里也写了
      } catch (e) { /* 忽略 */ }

      // 键盘：忽略按住重复触发；Esc/P 暂停；D/F/J/K 分拣
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        Game.input.keyboardAlive = true; // 任何真实按键到达 = 键盘链路已通（供提示条判定）
        if (e.code === 'Escape' || e.code === 'KeyP') {
          Game.main.togglePause();
          return;
        }
        const bin = Game.input.KEYS[e.code];
        if (bin !== undefined) {
          e.preventDefault(); // 防止按键滚动页面等默认行为
          Game.input.press(bin);
        }
      });

      // 指针（pointerdown 天然兼容鼠标与触屏）：点击桶区域即分拣。
      // 点击画面的用户手势同时会把焦点交还 iframe（浏览器默认行为），键盘随即恢复
      Game.canvas.addEventListener('pointerdown', (e) => {
        const p = toLogical(e);
        const bin = hitBin(p.x, p.y);
        if (bin !== -1) Game.input.press(bin);
      });
    },

    // 主动把键盘焦点抢进游戏（开局时调用；iframe 内 window.focus() 对父页聚焦也有效）
    refocus() {
      Game.input.keyboardAlive = false;    // 每局重置键盘活性（提示条据此重新亮起）
      try { window.focus(); } catch (e) { /* 忽略 */ }
      try { Game.canvas.focus({ preventScroll: true }); }
      catch (e) { try { Game.canvas.focus(); } catch (e2) { /* 极端环境忽略 */ } }
    },
  });
})();
