// js/audio.js —— 音频模块【甲】
// 职责：WebAudio 程序化合成 BGM 与音效，提供唯一时间源。禁止引入外部音频文件。
window.Game = window.Game || {};

// 模块内部状态全部收进闭包，不向 window.Game.audio 挂任何可变全局
Game.audio = (function () {
  let ctx = null;              // AudioContext，首次 start() 时创建（用户手势内）
  let master = null;           // master GainNode，统一控制总音量
  let startTime = 0;           // 谱面绝对起始时间 = ctx.currentTime + 准备时间
  let running = false;         // 是否处于可计时的运行状态
  let schedulerTimer = null;   // BGM 八分音符调度定时器

  let bpm = 120;               // 当前关卡 BPM（start(level) 时从关卡数据读取）
  let stepDur = 0.25;          // 八分音符时长 = 60 / bpm / 2
  let nextStepTime = 0;        // 下一个待排程节拍的绝对音频时间
  let step = 0;                // 小节内步号 0~7（8 步 = 一小节）
  let bassIdx = 0;             // 贝斯音序游标（跨小节循环五声音阶）
  let noiseBuffer = null;      // 复用的白噪声缓冲（军鼓/踩镲共用，避免反复生成）

  const MASTER_VOLUME = 0.85;  // 契约：总音量 0.85
  const READY_TIME = 2.0;      // 契约：开局 2 秒准备时间
  const LOOKAHEAD = 0.12;      // 调度前瞻：提前 0.12s 排程（契约注释值）
  const TICK_MS = 40;          // 调度器轮询间隔 40ms（契约注释值）
  const STEPS_PER_BAR = 8;     // 每小节 8 步（八分音符）

  // A2 附近五声音阶（A 角调式：A C D E G），贝斯循环取音
  const BASS_SCALE = [110.0, 130.81, 146.83, 164.81, 196.0];

  // 首次调用时创建 AudioContext 与 master GainNode（单一职责：只管初始化）
  function ensureCtx() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ctx.destination);
      noiseBuffer = createNoiseBuffer();
    }
    return ctx;
  }

  // 生成 1 秒白噪声缓冲，军鼓/踩镲共用一份（单一职责）
  function createNoiseBuffer() {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // 底鼓：sine 150Hz 指数下滑到 45Hz + 快速衰减包络
  function playKick(t) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // 军鼓：白噪声 + 带通，短促
  function playSnare(t) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 0.15);
  }

  // 踩镲：白噪声 + 高通 6000Hz，强拍音量更大
  function playHiHat(t, accent) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    gain.gain.setValueAtTime(accent ? 0.30 : 0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (accent ? 0.08 : 0.04));
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 0.1);
  }

  // 贝斯：triangle 波，包络稍长铺底
  function playBass(t, freq) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.setValueAtTime(0.35, t + stepDur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + stepDur);
  }

  // 按小节 8 步图案排程一个节拍（单一职责：只决定"哪步发什么音"）
  function scheduleStep(t) {
    const s = step;
    // 每步踩镲一次：step0/4 为强拍（音量大、衰减稍长）
    playHiHat(t, s === 0 || s === 4);
    if (s === 0) {                       // step0：底鼓 + 贝斯
      playKick(t);
    } else if (s === 4) {                // step4：底鼓 + 军鼓
      playKick(t);
      playSnare(t);
    } else if (s === 2 || s === 6) {     // step2/6：军鼓
      playSnare(t);
    }
    if (s === 0 || s === 3 || s === 6) { // step0/3/6：贝斯，五声音阶循环
      playBass(t, BASS_SCALE[bassIdx % BASS_SCALE.length]);
      bassIdx++;
    }
  }

  // 调度器心跳：把未来 LOOKAHEAD 内的节拍用 WebAudio 精确排程
  function schedulerTick() {
    while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(nextStepTime);
      nextStepTime += stepDur;
      step = (step + 1) % STEPS_PER_BAR;
    }
  }

  // 清理调度定时器
  function clearScheduler() {
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  // ---- 判定音效辅助：短促单音（统一封装复用） ----
  function playTone(freq, type, dur, vol) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // perfect：1180 → 1560Hz 短促上滑音
  function playPerfect() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(1560, t + 0.1);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  // wrongBin：两个下行音（提示"分类错了"）
  function playWrongBin() {
    if (!ctx) return;
    playTone(660, 'sine', 0.12, 0.35);
    const t2 = ctx.currentTime + 0.13;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t2);
    gain.gain.setValueAtTime(0.35, t2);
    gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.18);
    osc.connect(gain).connect(master);
    osc.start(t2);
    osc.stop(t2 + 0.2);
  }

  return {
    // 开局：创建/唤醒 AudioContext（由点击关卡按钮触发，满足用户手势要求），
    //       startTime = ctx.currentTime + 2.0，返回 startTime（main.js 用它绑谱面绝对时间）
    start(level) {
      ensureCtx();
      if (ctx.state === 'suspended') {
        ctx.resume(); // 上下文可能因手势限制处于 suspended，开局时唤醒
      }
      clearScheduler();
      // 从关卡数据读取 BPM（缺省 120），换算八分音符时长
      bpm = (level && level.bpm) || 120;
      stepDur = 60 / bpm / 2;
      step = 0;
      bassIdx = 0;
      running = true;
      startTime = ctx.currentTime + READY_TIME;
      // 从准备期结束的那个节拍开始排，保证 BGM 与谱面同源对齐
      nextStepTime = startTime;
      schedulerTimer = setInterval(schedulerTick, TICK_MS);
      return startTime;
    },

    // ★唯一时间源：t = ctx.currentTime - startTime（单位：秒，可为负数=尚未开始）
    // 禁止任何模块用 performance.now()/Date.now() 做判定
    getTime() {
      if (!running || !ctx) {
        return -9999; // 未运行，调用方据 scene 判断，不会误用
      }
      return ctx.currentTime - startTime;
    },

    // 结束：停掉调度定时器并退出运行状态
    stop() {
      clearScheduler();
      running = false;
      startTime = 0;
      step = 0;
      bassIdx = 0;
    },

    // 暂停：ctx.suspend() 后 currentTime 冻结，调度器心跳虽在跑但
    // nextStepTime 始终领先冻结的 currentTime，不会多排音符，恢复后零漂移
    pause() {
      if (running && ctx && ctx.state === 'running') {
        ctx.suspend();
      }
    },

    // 恢复：ctx.resume()，AudioContext 时钟从冻结点继续
    resume() {
      if (running && ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    },

    // 判定音效：perfect(高音上滑) / good(中音) / bad(短促低) / miss(低鸣) / wrongBin(双降音)
    sfx(result) {
      if (!ctx) return;
      switch (result) {
        case 'perfect':  playPerfect(); break;
        case 'good':     playTone(880, 'sine', 0.10, 0.35); break;
        case 'bad':      playTone(520, 'sine', 0.08, 0.30); break;
        case 'miss':     playTone(180, 'square', 0.25, 0.25); break;
        case 'wrongBin': playWrongBin(); break;
      }
    },
  };
})();
