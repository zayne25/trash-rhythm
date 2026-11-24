# 垃圾分类大作战

音乐节奏 × 垃圾分类的网页小游戏：垃圾随节拍从上方落下，玩家在垃圾到达**判定线**的瞬间按下对应分类桶完成分类。越准分越高，按错桶会弹出分类知识并扣生命——把环保知识玩出"节奏感"。

> 主题积极向上（环保教育），纯前端零依赖，双击即玩。

## 玩法

| 按键 | 桶 | 分类 |
|---|---|---|
| D | 蓝 | 可回收物 |
| F | 红 | 有害垃圾 |
| J | 绿 | 厨余垃圾 |
| K | 灰 | 其他垃圾 |

- 垃圾落到判定线那一刻按键：|Δ|≤55ms 完美(100分)、≤115ms 良好(60)、≤180ms 勉强(30)、超时漏接扣 1 命；
- **按错桶 = 分类错误**：扣 1 命并弹出知识点（如"🔋 电池属于有害垃圾"）；
- 连击 ≥10 得分 ×1.2，≥25 ×1.5；生命 3 点；三个关卡难度递增；
- 也支持鼠标点击 / 触屏直接点桶，手机竖屏可玩。

## 运行

无需安装任何依赖：

- **方式一**：直接双击 `index.html`；
- **方式二**（CodeBuddy 预览 / 局域网手机测试）：`python -m http.server 8080` 后访问 `http://localhost:8080`。

## 团队分工

| 成员 | 分支 | 模块 | 职责 |
|---|---|---|---|
| 甲 | `feat/core` | `audio.js` `chart.js` `judge.js` | 音频时钟、BGM 合成、谱面生成、判定/计分/连击/生命 |
| 乙 | `feat/render` | `render.js` `effects.js` `input.js` | Canvas 渲染、判定特效、键盘/鼠标/触屏输入 |
| 丙（组长） | `feat/ui` | `ui.js` `storage.js` `data/*.js` `css/*` | 页面外壳、关卡与垃圾数据、最高分存档、组装联调、部署 |
| 丙（组长） | `master` | `index.html` `main.js` | 入口组装、状态机、契约维护 |

## 在线体验

- GitHub Pages：`待部署后填写（https://<用户名>.github.io/trash-rhythm/）`
- Gitee 仓库：`https://gitee.com/pan-aaa/trash-rhythm`

## 复现步骤

```bash
git clone https://gitee.com/pan-aaa/trash-rhythm.git
cd trash-rhythm
# 双击 index.html 即可游玩，无需构建
```

## 仓库协作约定

见 [`ARCHITECTURE.md`](ARCHITECTURE.md)（接口契约）与 [`AGENTS.md`](AGENTS.md)（AI 协作规则、分支流程、提示词日志规范）。

## License

MIT
