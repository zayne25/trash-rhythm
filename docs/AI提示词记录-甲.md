# AI 提示词记录 —— 甲（core：audio / chart / judge）

> 按 AGENTS.md 规范记录：目标 → 提示词 → AI 输出的问题 → 我的修改。
> 每阶段 ≥3 条，报告直接取材。

### 示例（正式条目照此格式写，写完删除本示例）

**M月D日 · 实现判定引擎 press()**

- 提示词：
  “请先阅读根目录的 ARCHITECTURE.md 和 AGENTS.md，严格遵守接口契约。实现 js/judge.js 的
  press(bin, t)：在未判定音符中找 |hitTime-t| 最小且 ≤0.18s 的音符（notes 按 hitTime 升序可提前
  break），note.bin !== bin 时 result='wrongBin'，否则按 ≤0.055/≤0.115/≤0.18 分档，调用内部
  apply 更新 combo/score/lives 并触发 state.onJudge。纯逻辑，不碰 DOM。”
- AI 输出的问题：
  ① delta 正负号反了（把按下早算成按下晚）；② 把 combo 倍率乘到了 miss 扣命逻辑上；③ 在
  judge 里直接操作了 DOM（违反模块边界）。
- 我的修改：
  ① 统一 delta = note.hitTime - t（正=按早）；② 倍率只作用于得分；③ 删掉 DOM 代码，改由
  onJudge 回调交给 fx/ui 处理。

## 阶段一：需求分析（待填）

（待填）

## 阶段二：设计（待填）

（待填）

## 阶段三：实现 —— audio.js

### 11月15日 · audio.js 音频时钟骨架

- 提示词：
  请先阅读项目根目录的 ARCHITECTURE.md 和 AGENTS.md，严格遵守接口契约与代码规则。
  现在实现 js/audio.js 的时钟部分（先不做 BGM）：
  模块内部用闭包保存 AudioContext、master GainNode(音量0.85)、startTime、running 状态；
  实现 start(level)：首次调用创建 AudioContext（开局由点击关卡按钮触发，满足用户手势要求），startTime = ctx.currentTime + 2.0（2秒准备时间），返回 startTime；
  实现 getTime()：返回 ctx.currentTime - startTime，未运行返回 -9999；
  实现 stop()（清理调度定时器）、pause()（ctx.suspend()，currentTime 会冻结所以暂停后音画零漂移）、resume()（ctx.resume()）。
  不修改任何其他文件。
  挂载到全局 Game.audio 对象。
- AI 输出的问题：
  暂未发现问题
- 我的修改：
  无

### 11月15日 · audio.js BGM 八分音符调度器 + 判定音效 sfx

- 提示词：
  继续在 js/audio.js 中实现 BGM 程序化合成（禁止外部音频文件）：一个八分音符调度器，
  setInterval 每 40ms 检查一次，把未来 0.12 秒内的节拍用 WebAudio 精确排程；每小节 8 步：
  step0 底鼓（sine 150Hz 指数下滑到 45Hz）、step4 底鼓+军鼓、step2 和 step6 军鼓
  （白噪声+带通）、每步踩镲（白噪声+高通6000Hz，强拍音量大些）、step0/3/6 贝斯
  （triangle，音高从 A2 附近的五声音阶循环取）；节拍时长 = 60/bpm/2，音色函数封装复用。
  然后实现 sfx(result)：perfect 是 1180→1560Hz 短促上滑音，good 是 880Hz 短音，
  bad 是 520Hz 短音，miss 是 180Hz 方波低鸣，wrongBin 是两个下行音。
- AI 输出的问题：
  ① scheduleStep 里 step0/4 分支先排了一个强拍踩镲，末尾又无条件补排一个弱拍踩镲，
  导致强拍上踩镲被触发两次（音量叠加失真、与"每步踩镲一次"的节奏设计不符）；
  ② nextStepTime 起点没有说明与 startTime 的关系，BGM 有和谱面错开一拍的风险。
- 我的修改：
  ① 把踩镲抽出来放最前，每步只调一次 playHiHat(t, s === 0 || s === 4)，用 accent 参数
  区分强拍（0.30）与弱拍（0.14）音量；② 明确 nextStepTime = startTime，让 BGM 第一个
  节拍正好落在 2 秒准备期结束处，与谱面同源对齐（都是 ctx.currentTime 推算）。

## 阶段四：实现 —— chart.js / judge.js

### 11月16日 · chart.js 谱面生成 generate / attach

- 提示词：
  请阅读 data/levels.js 和 data/trash.js 的 schema。实现 js/chart.js：
  generate(level, pool) 按 60/bpm 为节拍长度，从 leadIn=2 拍遍历到 level.duration，
  步长 level.step 节拍；每个网格点以 level.density 概率生成音符，与上一颗间隔小于
  level.minGap 秒则跳过；从 pool 随机取垃圾；音符对象严格按 ARCHITECTURE.md 第 3 节的
  结构 { id, offset, hitTime:0, bin, trash, x, judged:false, result:null }，x 在 120~840
  随机；notes 必须按 offset 升序（judge 依赖此顺序）。attach(notes, startTime) 把每颗
  音符的 hitTime 绑定为 startTime + n.offset。
- AI 输出的问题：
  ① offset 用 `offset += stepSec` 浮点累加推进，第 3 关 132 颗音符累到最后会积累亚毫秒级
  误差，长谱面下和 BGM 节拍、judge 的 hitTime 比对都会漂；② 对 pool 没做空值/空数组防御，
  控制台单测传空池直接崩；③ generate 里顺手做了 sort，虽然结果正确但掩盖了"网格顺序
  天然升序"这一依赖（judge 的 break 剪枝靠它），sort 一旦被动过就是隐形炸弹。
- 我的修改：
  ① 改成 `offset = leadInSec + i * stepSec` 乘法一次算出，无累加漂移；② 加 pickTrash
  兜底：pool 为空时按 level.diff 过滤 Game.TRASH；③ 删掉 sort，改为按网格序号顺序生成
  并加注释"notes 天然按 offset 升序，勿打乱"；写完后用 Node 实跑三关验证（数量、升序、
  minGap、x 范围 120~840、四分类覆盖）。

### 11月16日 · judge.js 判定引擎 press / update / accuracy

- 提示词：
  实现 js/judge.js（纯逻辑，禁止碰 DOM/Canvas/样式，禁止修改 WIN 窗口和倍率）：
  press(bin, t) 在未判定音符中找 |hitTime - t| 最小且 ≤0.18s 的一颗（notes 按 hitTime
  升序，hitTime - t > 0.18 可直接 break）；找不到返回 null；note.bin !== bin 时
  result = wrongBin，否则按 0.055/0.115/0.18 分档为 perfect/good/bad；内部 apply()：
  perfect/good 时 combo+1，bad/miss/wrongBin 时 combo 归零；得分 = round(基数(100/60/30)
  × multFor(combo))；miss 和 wrongBin 额外扣 1 命；每帧更新 state.judged、
  state.counts[result]、note.result，最后调用 state.onJudge({note, result, delta})，
  delta 统一为 note.hitTime - t（正数=按早了）。update(t) 每帧检查超时：t - hitTime > 0.18
  的未判定音符自动判 miss。accuracy() 返回 (perfect + good×0.65 + bad×0.3) / 音符总数。
- AI 输出的问题：
  ① findTarget 里把 |Δ| 简写成了 `-d`（只考虑了按晚 d<0 的情况），按早（d>0）时 abs
  恒为负，`abs <= WIN.bad` 永远不成立——提前按的手全部判不出来，是方向性 bug；
  ② bad 的处理写成了"先按旧 combo 算倍率加分再归零"，与契约"bad 重置 combo"后倍率
  回 ×1.0 的意图不符；③ lives 扣减没做初始化防御，state.lives 未初始化时会算出 NaN。
- 我的修改：
  ① 改回 `Math.abs(d)`，并用 Node 写了 10 组用例（正中/早按 100ms/150ms/错桶/空按/
  超时自动 miss/连击 11 次 ×1.2/accuracy/空局）全部跑通后删掉临时脚本；② bad 的倍率
  先后顺序属于契约歧义（"30 × 连击倍率（combo 重置）"未写清先乘还是先清零），我把
  两种读法都摆到群里由组长裁定，最终定"先按归零前的连击取倍率计分，再清零"（与
  perfect/good 先加 combo 再取倍率保持一致），代码改为先加分后归零，实测 combo 0/9
  → 30 分、combo 12 → 36 分（×1.2）、combo 30 → 45 分（×1.5）；③ apply 里加
  `typeof s.lives === 'number' ? s.lives : 3` 兜底，counts 为空时初始化五档计数。
  这条"契约歧义怎么解"已记入答辩素材：发现歧义 → 群里定死规则 → 组长更新契约文件 →
  改代码并补日志，形成闭环。

## 阶段五：联调与调试（待填）

（待填）
