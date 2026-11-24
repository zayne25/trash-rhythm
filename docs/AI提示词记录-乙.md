# AI 提示词记录 —— 乙（render：render / effects / input）

> 按 AGENTS.md 规范记录：目标 → 提示词 → AI 输出的问题 → 我的修改。
> 每阶段 ≥3 条，报告直接取材。

### 示例（正式条目照此格式写，写完删除本示例）

**M月D日 · 实现音符下落绘制**

- 提示词：
  “请先阅读 ARCHITECTURE.md 和 AGENTS.md。实现 js/render.js 的 draw(t)：按
  y = JUDGE_Y - (hitTime - t) × level.speed 绘制下落音符瓦片（124×44 圆角矩形 + trash.name），
  绘制判定线（随节拍呼吸发光）与四个分类桶（BIN 常量坐标，键位角标），背景节拍网格线。
  只读 state，禁止写状态，颜色用中性描边不露分类色。”
- AI 输出的问题：
  ① 给音符描边用了分类色（泄题，违反设计说明 2.2）；② 用 performance.now() 做桶按下高亮
  时把整个渲染时间基准搞混；③ 循环里没按 hitTime 升序提前 break，每帧全量遍历。
- 我的修改：
  ① 描边改中性白灰；② 高亮判断改用 state.pressedAt；③ 加 `if (hitTime - t > 2.2) break`。

## 阶段一：需求分析（待填）

（待填）

## 阶段二：视觉规范设计（待填）

（待填）

## 阶段三：实现 —— render.js

**11月15日 · 实现 render.js 的 draw(t) 主绘制流程**

- 提示词：
  “请先阅读根目录的 ARCHITECTURE.md 和 AGENTS.md，严格遵守其中的接口契约与代码规则。
  我是乙（feat/render），只负责 js/render.js、js/effects.js、js/input.js。视觉主题为蓝白清爽
  浅色主题（色值一律取 css/base.css 变量）。实现 js/render.js 的 draw(t)：canvas 逻辑分辨率
  960×640。① 背景浅色线性渐变（--bg-1 到 --bg-2）；② 节拍网格线——按 level.bpm 算出半拍间距，
  判定线下方画淡蓝横线随时间上移；③ 判定线 y=520，透明度和线宽随节拍相位呼吸发光（蓝色 accent）；
  ④ 下落音符——y = JUDGE_Y - (hitTime - t) × level.speed，跳过 judged 和 y<-30 的，
  hitTime-t>2.2 时 break；每颗画 124×44 圆角矩形瓦片（白底深字 + 中性灰描边，绝对不能用分类
  颜色，否则泄题）+ 居中写 trash.name（17px 深色字）；⑤ 四个分类桶——按 BIN 常量画圆角矩形，
  BIN_COLORS 填色，桶里写白色 BIN_NAMES 和键位角标 D/F/J/K；state.pressedBin===i 且距 pressedAt
  不足 130ms 时该桶提亮。写一个 roundRect 帮助函数。”
- AI 输出的问题：
  ① base.css 目前仍是深绿主题、且没有瓦片专用变量，若按提示词把“浅蓝白背景 / 白底深字”直接
  写死在 render.js 里，违反规则 5（颜色只能引用 base.css 变量），而且丙换主题后画面不会跟随；
  ② 开局倒计时阶段 t 为负数，直接 t % period 会得到负相位，网格线滚动和判定线呼吸会错位；
  ③ fx.draw(ctx) 的调用归属契约没写死（main.js 循环 TODO 里只列了 fx.update），AI 若自作主张
  在 render 末尾调用，将来 main 也调一次就会双重绘制。
- 我的修改：
  ① 改为运行时 getComputedStyle(document.documentElement) 读取 CSS 变量并缓存成 palette，
  变量缺失才用浅蓝白兜底值——丙把 base.css 换成浅色主题后渲染自动跟随，乙零改动；同时发现
  需要瓦片底/字色两个新变量，建议丙在 base.css 补 --tile / --tile-text；
  ② 加 phaseOf(t, period) 帮助函数，用 ((t/period)%1+1)%1 把任意时间相位归一化到 [0,1)，
  负 t 时网格与呼吸均正确；
  ③ render 里不调 fx.draw，把“反馈绘制归属”列为联调议题留组长裁决。

## 阶段四：实现 —— effects.js / input.js

**11月17日 · 实现 effects.js 判定反馈特效**

- 提示词：
  “实现 js/effects.js（自维护效果列表，由 main.js 每帧调 update(dt)/draw）：spawnJudge(x,y,result)
  生成扩散圆环（半径10→46、0.35秒淡出、描边4px，颜色用 COLOR 表）+ 上浮文字（LABEL 表文案，
  22px 加粗，0.8秒上浮40px淡出）；perfect 时追加 8 个粒子沿放射方向飞散；miss/wrongBin 时触发
  震屏（0.3秒、幅度8px）；spawnTap(bin) 在对应桶中心画一个灰色小圆环表示空按；update(dt) 累加
  e.t 并移除过期效果；offset() 汇总所有 shake 效果返回 {dx,dy}，render.js 每帧开头会
  ctx.translate(offset().dx, offset().dy)。特效颜色已在浅色底上验证过对比度，直接使用 COLOR 表。”
- AI 输出的问题：
  ① 初版 drawRing 里留了一个无意义的 R1() 占位函数包装 RING.r1，纯属多余抽象，读代码的人会
  误以为有特殊含义；② 提示词说“render.js 每帧开头会 translate(offset)”，检查后发现昨天写的
  render.js 其实还没有这一行，AI 只按提示词照做而没有指出契约与现状的差距；③ 若 translate
  放在最开头，震屏时背景会平移导致画布边缘露底色。
- 我的修改：
  ① 删掉 R1()，直接引用 RING.r1；② 补齐 render.js 的 draw(t)：背景先画（不参与震屏），
  再 save → translate(fx.offset()) → 网格/判定线/音符/桶 → restore；③ 两文件同属乙名下，
  一次改动闭环，未触碰他人文件。

**11月17日 · 实现 input.js 三端统一输入入口**

- 提示词：
  “实现 js/input.js：press(bin) 是统一入口——scene 不是 playing 直接 return；记录
  state.pressedBin=i、state.pressedAt=performance.now()（这两个只供 render 高亮用，不参与判定）；
  调 Game.judge.press(bin, Game.audio.getTime())，返回 null 时调 Game.fx.spawnTap(bin)。init() 里：
  ① keydown 监听——e.repeat 忽略，Escape/KeyP 调 Game.main.togglePause()，KEYS 表命中
  （KeyD/KeyF/KeyJ/KeyK 对应 0/1/2/3）时 preventDefault 并 press；② canvas pointerdown 监听——
  用 getBoundingClientRect 把 clientX/Y 换算成 960×640 逻辑坐标，命中 Game.render.binRect(i)
  区域就 press(i)，用 pointerdown 天然兼容鼠标和触屏。”
- AI 输出的问题：
  ① 初版 keydown / pointerdown 监听器用箭头函数写、里面却用了 this.KEYS / this.press——箭头
  函数不绑定 this，运行时 this 指向 window，整个键盘输入会静默失效（且不报错，最难排查）；
  ② pointerdown 初版直接拿 e.clientX 判断，没按 getBoundingClientRect 缩放——canvas 被 CSS
  拉伸（base.css 里 #stage 是 width:100%）时点击位置全部偏移；③ press 里直接读 Game.state
  未判空，menu 场景下 state 只有 {scene:'menu'}，虽然不会崩但链路上有隐患。
- 我的修改：
  ① 监听器内统一改成显式 Game.input.KEYS / Game.input.press，不依赖 this 绑定；② 加 toLogical()
  帮助函数，按 960/rect.width、640/rect.height 比例换算后再用 hitBin() 遍历 binRect 判定；
  ③ press 开头加 st 判空，与 render.js 的防御写法保持一致。

## 阶段五：联调与调试

**11月17日 · 修复启动崩溃（组长代码审查发现）**

- 提示词：
  （转发组长的代码审查报告与修复指令）“乙：render.js 和 input.js 各有一处启动崩溃，改两处就好：
  render.js 在 window.Game = ... 之后把骨架里的冻结常量块加回来（这段是契约冻结的，不能删）；
  input.js 在 window.Game = ... 之后加一行 Game.input = {}；改完必须双击 index.html 打开页面
  按 F12 确认控制台没有红色报错，再 push + 更新日志。”
- AI 输出的问题：
  ① 我重写 render.js / input.js 时把 stub 开头定义 Game.render = { W, H, JUDGE_Y, BIN, ... binRect }
  和 Game.input = { KEYS, ... } 的骨架块整段删掉了，只留 IIFE 里的 Object.assign——
  Object.assign(undefined) 抛 "Cannot convert undefined or null to object"，页面一打开就崩，
  画面和键盘全部失效；② 根因是合并 master 解决 render.js 冲突时用整文件重写覆盖了冲突，
  顺手把骨架注释块也冲掉了，属于不当合并方式；③ 提交前只看了 lint（只能查语法，查不出
  运行时引用错误），没有实际打开页面验证——这个崩溃在 file:// 下双击必现。
- 我的修改：
  ① 按组长指令恢复 Game.render 冻结骨架（W/H/JUDGE_Y/BIN/BIN_NAMES/BIN_KEYS/BIN_COLORS/
  binRect 一字不动）与 Game.input = {}; 占位；② 用 node 冒烟测试模拟浏览器全局环境按
  index.html 顺序加载三模块，断言对象与方法齐全并实际调用 draw/spawnJudge/offset/press，
  全部通过；③ 教训入册：改完代码必须双击 index.html 开页面按 F12 过一遍控制台，
  静态检查不能替代运行验证；解决合并冲突禁用整文件重写，用 git checkout --ours 精确恢复。

**11月23日 · 判定线上移与分类桶按参考图重绘**

- 提示词：
  “修改 js/render.js：① 将 JUDGE_Y 常量从 520 上移到 500（压在底部桶的上方）；② 美化分类桶，
  参考街边分类垃圾桶实拍/AI 参考图（收口桶身 + 圆顶盖 + 白色分类字与标识 + 白色小物件插画），
  保留 BIN_COLORS 作为主色，按下高亮逻辑和 binRect 判定范围保持不变。”（后续多轮追加：
  “原图没有明显的上窄下宽，几乎看不出，只是盖子比较大”“现在的桶太宽大了，盖子也不像”，
  并附豆包生成的参考图）
- AI 输出的问题：
  ① JUDGE_Y 是 ARCHITECTURE.md 第 7 节冻结的契约常量，AI 提示后确认全仓无写死 520 的引用
  （均走 Game.render.JUDGE_Y），但契约文件必须由组长同步更新——AI 主动标注了变更行提醒；
  ② 第一版桶画成“纯色圆角矩形+垃圾桶小图标”，与参考图差距大；第二版矫枉过正把收口画得
  太明显（110→86 锥度）、盖子太小；第三版按“盖子大”的反馈又把桶身画得太宽（148），
  变成矮胖的方桶——AI 对“几乎直筒 + 盖子大 + 桶身竖长”的比例理解需要用户多轮纠偏；
  ③ 用户先问能否直接用参考图：AI 分析出三条否决理由（图右下角有豆包水印烙在像素里、
  AI 生成素材入库需额外来源声明、参考图是白底方图会与浅蓝渐变画布冲突），最终坚持
  纯 canvas path 重绘（零资源、随 dpr 无级缩放、颜色跟随 BIN_COLORS）。
- 我的修改：
  ① JUDGE_Y 520→500，BIN 区 y 556→522 / 高 76→110，全部动态引用无副作用，冻结值变更
  已在代码注释与群消息中提请组长同步契约文档；② 最终版照参考图结构重画：桶身 112→100
  近直筒收口 + 底部大圆角 + 裁剪轮廓内的左右明暗条营造柱面体积感；盖子三层——中央凸台、
  盖板（带顶面高光）、全桶最宽的盖沿横条，盖沿下挂三只圆头小卡扣；③ 排版与参考图逐桶
  一致：可回收物字上标下，其余三类标上字下；白色标识重画（三支循环箭头/警示三角叉/
  投放小人/开口桶下落箭头），每类配三种白色小物件剪影；④ binRect 与 input.js 点击判定、
  按下 130ms 提亮逻辑全程未动，契约面零改动。
