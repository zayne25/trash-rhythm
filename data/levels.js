// data/levels.js —— 关卡配置【丙】
// schema（冻结）：
//   name    关卡名
//   bpm     节拍速度（BGM 与谱面共用）
//   speed   下落速度（像素/秒），y = JUDGE_Y - (hitTime - t) * speed
//   duration 谱面时长（秒，按节拍数换算）
//   step    相邻音符的节拍间隔（1 = 每拍一颗，0.5 = 半拍网格）
//   density 每个网格点的生成概率 0~1
//   minGap  相邻音符最小间隔（秒），防止不可读的密集音符
//   diff    难度等级，谱面垃圾池 = Game.TRASH 中 diff ≤ 该值的条目
window.Game = window.Game || {};

Game.LEVELS = [
  // 难度曲线（组长调整 2026-11-23 定稿）：速度温和递进 150/165/180（第 1 关 150 为基准，
  // 用户确认后二三关各快一档），数量 20/30/40 固定，间隔约 2.3/1.9/1.6 秒平滑收紧；
  // 单颗可见时间 3.7/3.3/3.1 秒，既保留"越往后越快"的直观升级感，又留足反应时间。
  // count 字段 = 等间隔精确取 N 个网格点（数量可预期）；前奏动态计算保证垃圾在 GO 消失后进屏。
  { name: '第 1 关 · 环保新人', bpm: 100, speed: 150, duration: 50, step: 1, count: 20, density: 0.27, minGap: 0.45, diff: 1 },
  { name: '第 2 关 · 分类能手', bpm: 118, speed: 165, duration: 60, step: 1, count: 30, density: 0.6,  minGap: 0.40, diff: 2 },
  { name: '第 3 关 · 环保大师', bpm: 128, speed: 180, duration: 70, step: 1, count: 40, density: 0.75, minGap: 0.34, diff: 3 },
];
