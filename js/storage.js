// js/storage.js —— 本地持久化【丙】
// 用 localStorage 存每关最高分，key: 'trash-rhythm-best'，值为 { "0": 1234, "1": ... }
// 注意：某些嵌入式预览面板（sandbox iframe）会禁用 localStorage 并抛 SecurityError。
// 此前的实现是"静默降级"，导致首页最高分永远是 '--' 且用户看不出原因——现在改为：
//   ① 始终维护一份内存兜底，本轮打开期间最高分照常生效；
//   ② 暴露 persistent 标记，UI 可在菜单上提示"当前环境不支持本地存储"。
window.Game = window.Game || {};

Game.storage = {
  KEY: 'trash-rhythm-best',

  _mem: {},        // 内存兜底：localStorage 不可用时的会话内存储

  // 探测 localStorage 是否真的可写（隐私模式/沙箱 iframe 会抛异常）
  _probe() {
    try {
      const k = '__probe__';
      localStorage.setItem(k, '1');
      const ok = localStorage.getItem(k) === '1';
      localStorage.removeItem(k);
      return ok;
    } catch (e) {
      return false;
    }
  },

  // 内部：安全读取整包数据，任何异常（隐私模式/JSON 损坏）都返回 {}
  _all() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) { /* 落到内存兜底 */ }
    return this._mem;
  },

  get(levelIdx) {
    const all = this._all();
    const v = all[String(levelIdx)];
    return typeof v === 'number' && isFinite(v) ? v : 0;
  },

  set(levelIdx, score) {
    // 仅当 score > 现有记录时写入
    if (typeof score !== 'number' || !isFinite(score)) return;
    if (score <= this.get(levelIdx)) return;
    const key = String(levelIdx);
    const val = Math.round(score);

    // 先写内存（保证本轮一定生效），再尝试持久化
    const mem = this._all();
    mem[key] = val;
    this._mem = mem;

    try {
      localStorage.setItem(this.KEY, JSON.stringify(mem));
    } catch (e) {
      // localStorage 不可用：保留内存兜底，不阻断游戏
    }
  },

  // ---- 收藏（知识库"我的收藏"标签用）：key 'trash-rhythm-fav'，值为垃圾 id 数组 ----
  FAV_KEY: 'trash-rhythm-fav',

  // 读收藏列表（异常/损坏时返回空数组）
  favs() {
    try {
      const raw = localStorage.getItem(this.FAV_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) return arr;
    } catch (e) { /* 落到空数组 */ }
    return [];
  },

  isFav(id) {
    return this.favs().indexOf(id) !== -1;
  },

  // 切换收藏状态，返回切换后是否已收藏（供 UI 即时刷新）
  toggleFav(id) {
    const list = this.favs();
    const idx = list.indexOf(id);
    if (idx === -1) {
      list.push(id);
    } else {
      list.splice(idx, 1);
    }
    try {
      localStorage.setItem(this.FAV_KEY, JSON.stringify(list));
    } catch (e) { /* 持久化失败仅影响下次打开 */ }
    return idx === -1;
  },

  // ---- 设置（BGM / 音效 / 音量）：key 'trash-rhythm-settings' ----
  SET_KEY: 'trash-rhythm-settings',
  DEFAULTS: { bgm: true, sfx: true, volume: 0.85 }, // 0.85 与 audio.js 的 MASTER_VOLUME 契约一致

  // 读设置（缺项用默认值补齐，兼容旧数据）
  settings() {
    let saved = {};
    try {
      const raw = localStorage.getItem(this.SET_KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (e) { /* 落到默认值 */ }
    return {
      bgm: saved.bgm !== false,
      sfx: saved.sfx !== false,
      volume: typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1
        ? saved.volume : this.DEFAULTS.volume,
    };
  },

  // 增量保存设置（patch 与现有值合并）
  saveSettings(patch) {
    const next = Object.assign(this.settings(), patch);
    try {
      localStorage.setItem(this.SET_KEY, JSON.stringify(next));
    } catch (e) { /* 持久化失败仅影响下次打开 */ }
    return next;
  },

  // 重置全部本地数据（设置弹窗"确认重置"调用）：最高分 / 收藏 / 设置一并清空
  resetAll() {
    this._mem = {};
    [this.KEY, this.FAV_KEY, this.SET_KEY].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ }
    });
  },
};

// 启动时探测一次，供 UI 提示用
Game.storage.persistent = Game.storage._probe();
