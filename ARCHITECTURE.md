# ARCHITECTURE · 接口契约（冻结）

> 本文件是三人协作的"宪法"：**所有成员的 CodeBuddy 必须先读本文件和 AGENTS.md 再写代码。**
> 修改任何契约必须先在群里说明，由组长更新本文件后才能动代码。

## 1. 模块与文件所有权（物理隔离）

| 文件 | Owner | 分支 |
|---|---|---|
| `js/audio.js` `js/chart.js` `js/judge.js` | 甲 | `feat/core` |
| `js/render.js` `js/effects.js` `js/input.js` | 乙 | `feat/render` |
| `js/ui.js` `js/storage.js` `data/*.js` `css/*` | 丙 | `feat/ui` |
| `index.html` `js/main.js` `ARCHITECTURE.md` `AGENTS.md` `README.md` | **丙独占** | `master` |

规则：
- 禁止修改所有权之外的文件；想改接口 → 群里说 → 组长改契约文件；
- `index.html` 与 `main.js`（组装入口）全程由组长一人维护，避免三方冲突；
- 各模块 stub 里的"冻结"常量（判定窗口、坐标、键位、倍率）不许改。

## 2. 唯一时间源（音画同步的命脉）

```js
const t = Game.audio.getTime();   // = AudioContext.currentTime - startTime，单位秒，可为负
```

**禁止任何模块用 `performance.now()` / `Date.now()` 做判定**（它们与音频时钟漂移，
连玩 60 秒可偏差数十毫秒，"完美"判定会完全失真）。

## 3. 音符对象（三人都按此结构读写）

```js
{
  id: 0,            // 谱面内自增
  offset: 1.2,      // 相对开谱秒数（chart.generate 生成）
  hitTime: 12.34,   // 绝对时间 = startTime + offset（chart.attach 绑定）
  bin: 0,           // 正确桶：0 可回收物 | 1 有害垃圾 | 2 厨余垃圾 | 3 其他垃圾
  trash: { ... },   // 引用 Game.TRASH 条目
  x: 480,           // 下落横坐标（像素，chart 生成时随机 120~840）
  judged: false,
  result: null,     // 'perfect' | 'good' | 'bad' | 'miss' | 'wrongBin'
}
```

## 4. 判定窗口（冻结数值）

| 条件 | 判定 | 得分 |
|---|---|---|
| \|Δ\| ≤ 55ms | perfect 完美 | 100 × 连击倍率 |
| ≤ 115ms | good 良好 | 60 × 连击倍率 |
| ≤ 180ms | bad 勉强 | 30 × 连击倍率（combo 重置） |
| 超时未按 | miss 漏接 | 0，生命 -1 |
| **按错桶** | wrongBin 分类错误 | 0，生命 -1，弹知识点 |

连击倍率：combo ≥ 10 → ×1.2，≥ 25 → ×1.5。生命 3 点，归零结算（游戏结束）。

## 5. 模块对外接口（跨模块只允许调用这些）

```js
Game.audio.start(level) -> startTime     // 开局：返回绝对起始时间
Game.audio.getTime() -> t                // ★唯一时间源
Game.audio.stop() / pause() / resume()
Game.audio.sfx(result)                   // 判定音效
Game.chart.generate(level, pool) -> notes        // 相对时间，offset 升序
Game.chart.attach(notes, startTime)
Game.judge.press(bin, t) -> { note, result, delta } | null
Game.judge.update(t)                     // 每帧：超时自动 miss
Game.judge.accuracy() -> 0~1             // (perfect + good*0.65 + bad*0.3) / 总数
Game.judge.multFor(combo) -> 1.0|1.2|1.5
Game.render.draw(t)                      // 只读 state，禁止写状态
Game.render.binRect(i) / Game.render.JUDGE_Y (=520)
Game.fx.spawnJudge(x, y, result) / spawnTap(bin)
Game.fx.update(dt) / draw(ctx) / offset() -> {dx,dy}
Game.input.press(bin)                    // 三端输入统一入口
Game.ui.init() / showScreen(name) / startLevel(idx) / updateHUD()
Game.ui.popup(note, result) / showPause(bool) / showResult()
Game.storage.get(levelIdx) -> number / set(levelIdx, score)
Game.main.newRun(levelIdx) / togglePause() / backToMenu() / retry()
```

## 6. 全局命名空间

```js
window.Game = { state, audio, chart, judge, render, fx, input, ui, storage, main, canvas, TRASH, LEVELS }
```

禁止向 `window` 挂其他全局变量；模块内部状态用闭包。

## 7. 画布与坐标常量（冻结）

- 逻辑分辨率 960×640，devicePixelRatio 缩放由 main.js 统一处理（`ctx.setTransform(dpr,0,0,dpr,0,0)`）；
- 判定线 `JUDGE_Y = 520`；
- 桶区：`y=556`，高 76；桶宽 190、间距 16、左右 pad 56（见 `render.BIN`）；
- 音符瓦片 124×44，**白底深字 + 中性灰描边**（**不得显示分类颜色，否则泄题**）；
- 视觉主题：**蓝白清爽浅色主题**（画布内也是浅色底：浅色背景渐变、蓝色判定线、淡蓝节拍网格线），颜色一律引用 `css/base.css` 变量；
- 下落公式：`y = JUDGE_Y - (hitTime - t) * state.level.speed`。

## 8. 数据文件说明

`data/trash.js`、`data/levels.js` 使用 **JS 而非 JSON**：双击 `index.html`（file:// 协议）
时浏览器拦截 fetch，JS 全局变量无此限制——保证"clone 即双击可玩"。

## 9. 状态机

```
menu ──newRun──▶ playing ──通关/生命归零──▶ result ──retry──▶ playing
                   ▲  │                        └─back──▶ menu
              pause└──┘ paused
```

## 10. 部署（零构建）

- Gitee：主仓库（协作、PR、报告素材）；
- GitHub：`git push github master` 后 Settings → Pages → master / (root)；
- 线上地址：`https://<GitHub用户名>.github.io/trash-rhythm/`（README 占位待填）。
