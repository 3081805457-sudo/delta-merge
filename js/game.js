(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Delta Merge — a Suika-style merge game with Delta Force fan-art.
   * Physics: Matter.js (MIT). Rendering: Canvas 2D.
   * ------------------------------------------------------------------ */

  if (!window.Matter) {
    document.body.innerHTML = '<p style="color:#fff;font-family:sans-serif;padding:30px">物理引擎加载失败，请确认 vendor/matter.min.js 存在。</p>';
    return;
  }

  const { Engine, Bodies, Body, Composite, Events } = window.Matter;

  const W = 460;
  const H = 680;
  const STEP = 1000 / 60;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const TAU = Math.PI * 2;

  const INNER_LEFT = 38;
  const INNER_RIGHT = 422;
  const FLOOR_Y = 656;
  const DROP_Y = 96;
  const DANGER_Y = 168;
  const DROP_COOLDOWN = 430;
  const WEILONG_LEVEL = 6;
  const FENGYI_LEVEL = 7;
  const MAX_LEVEL = FENGYI_LEVEL;
  const MAX_BONUS = 3000;
  const MEME_DURATION = 2200;
  const FENGYI_STACK_GAP = 1.28;
  const FENGYI_SETTLE_MS = 850;

  const LEVELS = [
    { id: 1, name: '乌鲁鲁', code: 'ULURU', r: 24, color: '#8be8a4', light: '#c9ffd8', dark: '#2b6c41', img: 'assets/characters/uluru.png' },
    { id: 2, name: '麦晓雯', code: 'HACKCLAW', r: 32, color: '#c8a8ff', light: '#ebddff', dark: '#5d4192', img: 'assets/characters/maixiaowen.png' },
    { id: 3, name: '露娜', code: 'LUNA', r: 42, color: '#6ec8ff', light: '#c6efff', dark: '#1d5a80', img: 'assets/characters/luna.png' },
    { id: 4, name: '疾风', code: 'JIFENG', r: 54, color: '#ff7d6e', light: '#ffbaaf', dark: '#8f3128', img: 'assets/characters/jifeng.png' },
    { id: 5, name: '红狼', code: 'DIRE WOLF', r: 66, color: '#ff9f43', light: '#ffd19b', dark: '#8e4a16', img: 'assets/characters/honglang.png' },
    { id: 6, name: '威龙', code: 'VYRON', r: 80, color: '#f6c453', light: '#ffe7a8', dark: '#7a5a12', img: 'assets/characters/weilong.png' },
    { id: 7, name: '蜂医', code: 'BEE MEDIC', r: 90, color: '#ffd166', light: '#fff3c4', dark: '#6b4a00', img: 'assets/characters/fengyi.png' }
  ];

  const MERGE_SCORE = { 2: 20, 3: 50, 4: 120, 5: 300, 6: 800, 7: 1800 };

  /* ------------------------------- dom ------------------------------ */

  function $(id) { return document.getElementById(id); }

  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);

  const scoreEl = $('score');
  const bestEl = $('best');
  const comboChip = $('comboChip');
  const comboChipValue = comboChip.querySelector('b');
  const soundBtn = $('soundBtn');
  const restartBtn = $('restartBtn');
  const ladderEl = $('ladder');
  const nextCanvas = $('nextCanvas');
  const nextName = $('nextName');
  const nextCode = $('nextCode');
  const nextCanvasMini = $('nextCanvasMini');
  const nextNameMini = $('nextNameMini');
  const rankList = $('rankList');
  const myRank = $('myRank');
  const myName = $('myName');
  const myScore = $('myScore');

  const startOverlay = $('startOverlay');
  const startBtn = $('startBtn');
  const playerNameInput = $('playerName');
  const pauseOverlay = $('pauseOverlay');
  const resumeBtn = $('resumeBtn');
  const gameOverOverlay = $('gameOverOverlay');
  const finalScore = $('finalScore');
  const finalBest = $('finalBest');
  const finalRank = $('finalRank');
  const newRecord = $('newRecord');
  const againBtn = $('againBtn');
  const shareBtn = $('shareBtn');
  const memeLayer = $('memeLayer');
  const memePoints = $('memePoints');
  const memeImg = $('memeImg');

  const editNameBtn = $('editNameBtn');
  const nameModal = $('nameModal');
  const modalNameInput = $('modalNameInput');
  const modalCancelBtn = $('modalCancelBtn');
  const modalSaveBtn = $('modalSaveBtn');
  const modalClearBtn = $('modalClearBtn');
  const toastEl = $('toast');

  /* ----------------------------- helpers ---------------------------- */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatScore(value) {
    return String(Math.max(0, Math.floor(Number(value) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function hexToRgba(hex, alpha) {
    let h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return 'rgba(255,255,255,' + alpha + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function defaultCallsign() {
    return '干员-' + String(Math.floor(1000 + Math.random() * 9000));
  }

  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('show');
    }, 1900);
  }

  /* ------------------------------ sound ----------------------------- */

  const Sound = (function () {
    let audio = null;
    let master = null;
    let enabled = Leaderboard.getSound();
    const audioBuffers = new Map();
    const audioPromises = new Map();
    const fallbackPlayers = new Map();
    const FENGYI_CLIP = 'assets/meme/fengyi_clip.m4a';
    const WEILONG_CLIP = 'assets/meme/weilong_voice.m4a';

    function ensure() {
      if (!enabled) return null;
      if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audio = new AC();
        master = audio.createGain();
        master.gain.value = 0.2;
        master.connect(audio.destination);
      }
      if (audio.state === 'suspended') audio.resume();
      return audio;
    }

    function tone(freq, duration, type, volume, delay) {
      const ac = ensure();
      if (!ac) return;
      const start = ac.currentTime + (delay || 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.2, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }

    function loadBuffer(url) {
      if (audioBuffers.has(url)) return Promise.resolve(audioBuffers.get(url));
      if (audioPromises.has(url)) return audioPromises.get(url);
      const ac = ensure();
      if (!ac) return null;
      const pending = fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error('clip load failed');
          return response.arrayBuffer();
        })
        .then(function (buffer) {
          return new Promise(function (resolve, reject) {
            ac.decodeAudioData(buffer, resolve, reject);
          });
        })
        .then(function (decoded) {
          audioBuffers.set(url, decoded);
          return decoded;
        })
        .catch(function () {
          return null;
        });
      audioPromises.set(url, pending);
      return pending;
    }

    function preloadClips() {
      loadBuffer(FENGYI_CLIP);
      loadBuffer(WEILONG_CLIP);
    }

    function playFallback(url, volume) {
      if (!enabled) return;
      let player = fallbackPlayers.get(url);
      if (!player) {
        player = new Audio(url);
        player.preload = 'auto';
        fallbackPlayers.set(url, player);
      }
      try {
        player.pause();
        player.currentTime = 0;
      } catch (error) { /* ignore */ }
      player.volume = clamp(volume, 0, 0.95);
      player.play().catch(function () { /* autoplay blocked */ });
    }

    function playClip(url, volume) {
      if (!enabled) return;
      const amount = clamp(volume == null ? 1 : volume, 0, 2);
      const startBuffer = function (buffer) {
        if (!buffer || !enabled) return;
        const ac = ensure();
        if (!ac) return;
        const source = ac.createBufferSource();
        const gain = ac.createGain();
        source.buffer = buffer;
        gain.gain.value = amount;
        source.connect(gain);
        gain.connect(master);
        source.start();
      };

      if (audioBuffers.has(url)) {
        startBuffer(audioBuffers.get(url));
        return;
      }
      const pending = loadBuffer(url);
      if (!pending) {
        playFallback(url, amount);
        return;
      }
      pending.then(function (buffer) {
        if (buffer) startBuffer(buffer);
        else playFallback(url, amount);
      });
    }

    function duang(strength) {
      const ac = ensure();
      if (!ac) return;
      const amount = strength == null ? 1 : strength;
      const start = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(168, start);
      osc.frequency.exponentialRampToValueAtTime(52, start + 0.26);
      lfo.type = 'sine';
      lfo.frequency.value = 18;
      lfoGain.gain.value = 24;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2 * amount, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      lfo.start(start);
      osc.stop(start + 0.35);
      lfo.stop(start + 0.35);
    }

    return {
      get enabled() { return enabled; },
      setEnabled: function (value) {
        enabled = Boolean(value);
        if (master) master.gain.value = enabled ? 0.2 : 0;
        if (enabled) {
          ensure();
          preloadClips();
        }
      },
      unlock: function () {
        ensure();
        preloadClips();
      },
      drop: function () { tone(120, 0.08, 'triangle', 0.22); },
      merge: function (level) {
        const f = 250 + level * 55;
        tone(f, 0.09, 'sine', 0.14);
        tone(f * 1.5, 0.15, 'sine', 0.08, 0.03);
      },
      duang: duang,
      fengyi: function () {
        const ac = ensure();
        if (!ac) return;
        tone(74, 0.5, 'sine', 0.24);
        tone(148, 0.34, 'triangle', 0.1, 0.04);
        playClip(FENGYI_CLIP, 1.05);
      },
      weilong: function () {
        if (!enabled) return;
        playClip(WEILONG_CLIP, 1.25);
      },
      max: function () {
        [523, 659, 784, 1047].forEach(function (f, i) {
          tone(f, 0.35, 'sine', 0.12, i * 0.06);
        });
      },
      over: function () {
        [330, 262, 196, 147].forEach(function (f, i) {
          tone(f, 0.28, 'triangle', 0.16, i * 0.12);
        });
      },
      start: function () {
        tone(440, 0.08, 'sine', 0.14);
        tone(660, 0.14, 'sine', 0.11, 0.06);
      },
      click: function () { tone(620, 0.04, 'square', 0.05); }
    };
  })();

  /* ------------------------------ state ----------------------------- */

  const state = {
    running: false,
    over: false,
    paused: false,
    score: 0,
    best: Leaderboard.getBest(),
    combo: 0,
    lastMergeAt: 0,
    currentLevel: 1,
    nextLevel: 2,
    aimX: W / 2,
    dropReadyAt: 0,
    overLineMs: 0,
    shake: 0,
    flash: 0,
    memeUntil: 0,
    balls: [],
    particles: [],
    floaters: [],
    shockwaves: []
  };

  let bag = [];
  let lastTime = performance.now();
  let accumulator = 0;
  let pointerActive = false;
  let lastScan = 0;
  let memeTimer = 0;

  function bagNext() {
    if (!bag.length) {
      // Only the first three tiers are ever dropped. 6:3:1 keeps the board
      // busy without handing out free high-tier merges.
      bag = [1, 1, 1, 1, 1, 1, 2, 2, 2, 3];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = bag[i];
        bag[i] = bag[j];
        bag[j] = temp;
      }
    }
    return bag.pop();
  }

  /* --------------------------- badge art ---------------------------- */

  const BADGE_SIZE = 320;
  const BADGE_CENTER = 160;
  const BADGE_RADIUS = 152;
  const BADGE_DRAW_FACTOR = BADGE_CENTER / BADGE_RADIUS;

  const iconImages = LEVELS.map(function (level) {
    const image = new Image();
    const record = { image: image, ok: false };
    image.onload = function () {
      record.ok = true;
      buildBadge(level.id);
      updateNext();
    };
    image.onerror = function () {
      record.ok = false;
    };
    image.src = level.img;
    return record;
  });

  const badgeCache = new Map();

  function drawImageContain(c, image, x, y, width, height) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (!iw || !ih) return;
    const imageRatio = iw / ih;
    const boxRatio = width / height;
    let dw;
    let dh;
    if (imageRatio > boxRatio) {
      dw = width;
      dh = width / imageRatio;
    } else {
      dh = height;
      dw = height * imageRatio;
    }
    c.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
  }

  function buildBadge(level) {
    const info = LEVELS[level - 1];
    const cv = document.createElement('canvas');
    cv.width = BADGE_SIZE;
    cv.height = BADGE_SIZE;
    const c = cv.getContext('2d');
    const R = BADGE_RADIUS;

    c.save();
    c.translate(BADGE_CENTER, BADGE_CENTER);

    // dark outer ring base
    c.beginPath();
    c.arc(0, 0, R, 0, TAU);
    c.fillStyle = info.dark;
    c.fill();

    // inner artwork
    c.save();
    c.beginPath();
    c.arc(0, 0, R - 4, 0, TAU);
    c.clip();

    const bg = c.createRadialGradient(-R * 0.36, -R * 0.42, R * 0.06, 0, 0, R * 1.18);
    bg.addColorStop(0, info.light);
    bg.addColorStop(0.48, info.color);
    bg.addColorStop(1, info.dark);
    c.fillStyle = bg;
    c.fillRect(-R, -R, R * 2, R * 2);

    c.save();
    c.globalAlpha = 0.13;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    for (let i = -R; i < R * 1.5; i += 20) {
      c.beginPath();
      c.moveTo(i, -R);
      c.lineTo(i + R, R);
      c.stroke();
    }
    c.restore();

    const record = iconImages[level - 1];
    if (record.ok) {
      const pad = R * 0.1;
      drawImageContain(c, record.image, -R + pad, -R + pad, (R - pad) * 2, (R - pad) * 2);
    } else {
      c.fillStyle = 'rgba(0,0,0,0.17)';
      c.fillRect(-R, -R, R * 2, R * 2);
      c.fillStyle = 'rgba(255,255,255,0.94)';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '900 ' + Math.round(R * 0.78) + 'px "Microsoft YaHei", "PingFang SC", sans-serif';
      c.fillText(info.name.charAt(0), 0, R * 0.04);
    }

    const shade = c.createLinearGradient(0, R * 0.05, 0, R);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.34)');
    c.fillStyle = shade;
    c.fillRect(-R, -R, R * 2, R * 2);

    c.beginPath();
    c.ellipse(-R * 0.29, -R * 0.41, R * 0.56, R * 0.31, -0.46, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fill();

    c.restore(); // clip

    // rings
    c.beginPath();
    c.arc(0, 0, R - 3, 0, TAU);
    c.lineWidth = R * 0.055;
    c.strokeStyle = info.color;
    c.stroke();

    c.beginPath();
    c.arc(0, 0, R - 9, 0, TAU);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,255,255,0.32)';
    c.stroke();

    c.beginPath();
    c.arc(0, 0, R, 0, TAU);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.stroke();

    // small tactical notches
    c.strokeStyle = 'rgba(5,10,6,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-R * 0.1, -R + 2);
    c.lineTo(R * 0.1, -R + 2);
    c.stroke();

    c.restore();

    badgeCache.set(level, cv);
    return cv;
  }

  LEVELS.forEach(function (level) { buildBadge(level.id); });

  function drawBadgeOn(target, level, x, y, radius, alpha, scale, squashX, squashY) {
    const badge = badgeCache.get(level) || buildBadge(level);
    if (!badge) return;
    const size = radius * 2 * BADGE_DRAW_FACTOR * (scale == null ? 1 : scale);
    const sx = squashX == null ? 1 : squashX;
    const sy = squashY == null ? 1 : squashY;
    target.save();
    target.globalAlpha = alpha == null ? 1 : alpha;
    target.shadowColor = 'rgba(0,0,0,0.5)';
    target.shadowBlur = Math.max(2, radius * 0.22);
    target.shadowOffsetY = Math.max(1, radius * 0.1);
    target.translate(x, y);
    target.scale(sx, sy);
    target.drawImage(badge, -size / 2, -size / 2, size, size);
    target.restore();
  }

  /* --------------------------- board draw --------------------------- */

  function drawSideWall(x) {
    const gradient = ctx.createLinearGradient(x, 0, x + 14, 0);
    gradient.addColorStop(0, '#263126');
    gradient.addColorStop(0.32, '#151d15');
    gradient.addColorStop(1, '#090e0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 0, 14, FLOOR_Y);

    const innerX = x < W / 2 ? x + 12 : x;
    ctx.fillStyle = 'rgba(200,255,120,0.12)';
    ctx.fillRect(innerX, 0, 2, FLOOR_Y);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x < W / 2 ? x : x + 12, 0, 2, FLOOR_Y);

    for (let y = 78; y < FLOOR_Y; y += 76) {
      ctx.beginPath();
      ctx.arc(x + 7, y, 1.5, 0, TAU);
      ctx.fillStyle = 'rgba(200,255,150,0.18)';
      ctx.fill();
    }
  }

  function drawRim() {
    const y = 42;
    const h = 13;
    const gradient = ctx.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, '#3b4838');
    gradient.addColorStop(0.45, '#161f16');
    gradient.addColorStop(1, '#080c08');
    ctx.fillStyle = gradient;
    ctx.fillRect(24, y, 412, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(24, y, 412, 3);
    ctx.clip();
    for (let x = 18; x < 442; x += 13) {
      ctx.fillStyle = Math.round(x / 13) % 2 === 0 ? '#ff8a3d' : '#161712';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x + 3, y + 3);
      ctx.lineTo(x - 4, y + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 7px "Bahnschrift", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(200,255,140,0.55)';
    ctx.fillText('DROP ZONE', 30, 33);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,138,61,0.62)';
    ctx.fillText('DELTA // 07', 430, 33);
    for (let x = INNER_LEFT; x <= INNER_RIGHT; x += 24) {
      ctx.fillStyle = 'rgba(200,255,120,0.2)';
      ctx.fillRect(x, 37, 1, 3);
    }
    ctx.restore();
  }

  function drawFloor() {
    const gradient = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    gradient.addColorStop(0, '#202a1e');
    gradient.addColorStop(1, '#060906');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    ctx.fillStyle = 'rgba(200,255,120,0.24)';
    ctx.fillRect(INNER_LEFT, FLOOR_Y, INNER_RIGHT - INNER_LEFT, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(INNER_LEFT, FLOOR_Y + 2, INNER_RIGHT - INNER_LEFT, 2);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 7px "Bahnschrift", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(200,255,120,0.24)';
    ctx.fillText('DELTA MERGE // 07', W / 2, H - 9);
    ctx.restore();

    [52, 408].forEach(function (x) {
      ctx.beginPath();
      ctx.arc(x, H - 12, 2, 0, TAU);
      ctx.fillStyle = 'rgba(200,255,150,0.22)';
      ctx.fill();
    });
  }

  function drawDangerLine(now) {
    const pressure = clamp(state.overLineMs / 1800, 0, 1);
    const pulse = 0.35 + 0.2 * Math.sin(now / 420) + pressure * 0.35;
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,82,82,' + clamp(pulse, 0, 0.9) + ')';
    ctx.beginPath();
    ctx.moveTo(INNER_LEFT + 4, DANGER_Y);
    ctx.lineTo(INNER_RIGHT - 4, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,100,100,' + (0.42 + pressure * 0.45) + ')';
    ctx.font = '700 7px "Bahnschrift", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('DANGER LINE', INNER_RIGHT - 7, DANGER_Y - 6);

    ctx.beginPath();
    ctx.moveTo(INNER_LEFT + 3, DANGER_Y - 3);
    ctx.lineTo(INNER_LEFT + 8, DANGER_Y);
    ctx.lineTo(INNER_LEFT + 3, DANGER_Y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBoard(now) {
    ctx.save();
    ctx.fillStyle = '#050805';
    ctx.fillRect(0, 0, W, H);

    const field = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    field.addColorStop(0, '#101b12');
    field.addColorStop(0.55, '#0b130e');
    field.addColorStop(1, '#080e0a');
    ctx.fillStyle = field;
    ctx.fillRect(INNER_LEFT, 0, INNER_RIGHT - INNER_LEFT, FLOOR_Y);

    const spot = ctx.createRadialGradient(W * 0.5, 26, 8, W * 0.5, 26, 330);
    spot.addColorStop(0, 'rgba(180,255,130,0.075)');
    spot.addColorStop(1, 'rgba(180,255,130,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(INNER_LEFT, 0, INNER_RIGHT - INNER_LEFT, FLOOR_Y);

    ctx.save();
    ctx.beginPath();
    ctx.rect(INNER_LEFT, 0, INNER_RIGHT - INNER_LEFT, FLOOR_Y);
    ctx.clip();
    ctx.strokeStyle = 'rgba(160,220,120,0.045)';
    ctx.lineWidth = 1;
    for (let y = 28; y < FLOOR_Y; y += 44) {
      ctx.beginPath();
      ctx.moveTo(INNER_LEFT, y);
      ctx.lineTo(INNER_RIGHT, y);
      ctx.stroke();
    }
    for (let x = INNER_LEFT + 16; x < INNER_RIGHT; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FLOOR_Y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.035;
    ctx.strokeStyle = '#c8ff5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 250);
    ctx.lineTo(W / 2 + 150, 540);
    ctx.lineTo(W / 2 - 150, 540);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, 320);
    ctx.lineTo(W / 2 + 90, 500);
    ctx.lineTo(W / 2 - 90, 500);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    drawSideWall(24);
    drawSideWall(422);
    drawRim();
    drawFloor();
    drawDangerLine(now);
    ctx.restore();
  }

  /* --------------------------- game draw ---------------------------- */

  function drawGuide() {
    if (!state.running || state.over || state.paused) return;
    if (state.memeUntil > performance.now()) return;
    const info = LEVELS[state.currentLevel - 1];
    const ready = performance.now() >= state.dropReadyAt;
    ctx.save();
    ctx.globalAlpha = ready ? 0.24 : 0.1;
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.moveTo(state.aimX, DROP_Y + info.r + 4);
    ctx.lineTo(state.aimX, FLOOR_Y - 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = ready ? 0.45 : 0.18;
    ctx.beginPath();
    ctx.moveTo(state.aimX - 9, FLOOR_Y - 4);
    ctx.lineTo(state.aimX + 9, FLOOR_Y - 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawBalls(now) {
    if (!state.running && !state.over) {
      drawBadgeOn(ctx, 2, 118, FLOOR_Y - 45, 32, 0.82, 1);
      drawBadgeOn(ctx, 3, 229, FLOOR_Y - 57, 42, 0.82, 1);
      drawBadgeOn(ctx, 4, 340, FLOOR_Y - 61, 54, 0.82, 1);
      return;
    }

    for (let i = 0; i < state.balls.length; i += 1) {
      const ball = state.balls[i];
      if (!ball.plugin || !ball.plugin.alive) continue;
      const time = clamp((now - ball.plugin.born) / 170, 0, 1);
      const scale = 0.62 + 0.38 * easeOutCubic(time);

      // Jelly squash-and-stretch: a fast decaying cosine gives the ball a
      // springy "duang" on merge and a softer wobble when it lands.
      let squashX = 1;
      let squashY = 1;
      const jellyAge = now - (ball.plugin.jellyAt || ball.plugin.born);
      if (jellyAge >= 0 && jellyAge < 780) {
        const decay = Math.exp(-jellyAge / 185);
        const wave = Math.cos(jellyAge / 46);
        const amp = ball.plugin.jellyAmp == null ? 0.16 : ball.plugin.jellyAmp;
        squashX = 1 + amp * decay * wave;
        squashY = 1 - amp * 0.92 * decay * wave;
      }

      if (ball.plugin.level === MAX_LEVEL) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, ball.circleRadius + 4, 0, TAU);
        ctx.strokeStyle = 'rgba(246,196,83,' + (0.22 + 0.12 * Math.sin(now / 300)) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
      drawBadgeOn(
        ctx,
        ball.plugin.level,
        ball.position.x,
        ball.position.y,
        ball.circleRadius,
        1,
        scale,
        squashX,
        squashY
      );
    }
  }

  function drawHeld(now) {
    if (!state.running || state.over || state.paused) return;
    if (state.memeUntil > now) return;
    const info = LEVELS[state.currentLevel - 1];
    const radius = info.r;
    const remaining = Math.max(0, state.dropReadyAt - now);
    const ready = remaining <= 0;

    ctx.save();
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(now / 300);
    ctx.beginPath();
    ctx.arc(state.aimX, DROP_Y, radius + 6, 0, TAU);
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    drawBadgeOn(ctx, state.currentLevel, state.aimX, DROP_Y, radius, ready ? 1 : 0.48, 1);

    if (!ready) {
      const progress = 1 - remaining / DROP_COOLDOWN;
      ctx.save();
      ctx.beginPath();
      ctx.arc(state.aimX, DROP_Y, radius + 9, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
      ctx.strokeStyle = info.color;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEffects() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < state.shockwaves.length; i += 1) {
      const wave = state.shockwaves[i];
      const t = 1 - wave.life / wave.maxLife;
      const radius = wave.maxR * easeOutCubic(t);
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, radius, 0, TAU);
      ctx.strokeStyle = hexToRgba(wave.color, (1 - t) * 0.55);
      ctx.lineWidth = 1 + (1 - t) * 2.5;
      ctx.stroke();
    }

    for (let i = 0; i < state.particles.length; i += 1) {
      const particle = state.particles[i];
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = hexToRgba(particle.color, alpha);
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }

    ctx.restore();

    for (let i = 0; i < state.floaters.length; i += 1) {
      const floater = state.floaters[i];
      const alpha = clamp(floater.life / floater.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 17px "Bahnschrift", "Microsoft YaHei", sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(4,8,5,0.75)';
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.restore();
    }
  }

  function drawDangerWarning(now) {
    const pressure = clamp(state.overLineMs / 1800, 0, 1);
    if (pressure <= 0.01) return;
    const blink = 0.55 + 0.45 * Math.sin(now / 105);

    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, DANGER_Y + 70);
    gradient.addColorStop(0, 'rgba(255,50,50,' + (0.17 * pressure) + ')');
    gradient.addColorStop(1, 'rgba(255,50,50,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(INNER_LEFT, 0, INNER_RIGHT - INNER_LEFT, DANGER_Y + 70);

    ctx.fillStyle = 'rgba(255,80,80,' + (0.25 + 0.25 * blink) + ')';
    ctx.fillRect(INNER_LEFT, 0, (INNER_RIGHT - INNER_LEFT) * pressure, 3);

    if (pressure > 0.12) {
      ctx.globalAlpha = 0.62 + 0.38 * blink;
      ctx.fillStyle = '#ff9292';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 12px "Bahnschrift", "Microsoft YaHei", sans-serif';
      ctx.fillText('防线告急 // FALLING BACK', W / 2, 26);
    }
    ctx.restore();
  }

  function render(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (state.shake > 0.1) {
      ctx.translate((Math.random() * 2 - 1) * state.shake * 0.7, (Math.random() * 2 - 1) * state.shake * 0.7);
    }

    drawBoard(now);

    ctx.save();
    ctx.beginPath();
    ctx.rect(INNER_LEFT, 0, INNER_RIGHT - INNER_LEFT, FLOOR_Y);
    ctx.clip();
    drawGuide();
    drawBalls(now);
    drawHeld(now);
    drawEffects();
    drawDangerWarning(now);
    ctx.restore();

    if (state.flash > 0.01) {
      ctx.fillStyle = 'rgba(190,245,255,' + (state.flash * 0.38) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  /* ---------------------------- physics ----------------------------- */

  const engine = Engine.create({
    positionIterations: 10,
    velocityIterations: 8,
    constraintIterations: 2,
    enableSleeping: false
  });
  engine.gravity.y = 1.12;

  const world = engine.world;

  const wallOptions = {
    isStatic: true,
    friction: 0.5,
    restitution: 0,
    render: { visible: false }
  };

  Composite.add(world, [
    Bodies.rectangle(31, FLOOR_Y / 2, 14, FLOOR_Y + 80, wallOptions),
    Bodies.rectangle(429, FLOOR_Y / 2, 14, FLOOR_Y + 80, wallOptions),
    Bodies.rectangle(W / 2, FLOOR_Y + 10, W + 80, 20, wallOptions)
  ]);

  const pendingMerges = [];

  Events.on(engine, 'collisionStart', function (event) {
    const pairs = event.pairs;
    const now = performance.now();
    for (let i = 0; i < pairs.length; i += 1) {
      const a = pairs[i].bodyA;
      const b = pairs[i].bodyB;
      const bodies = [a, b];
      for (let k = 0; k < bodies.length; k += 1) {
        const body = bodies[k];
        if (!body.plugin || !body.plugin.isBall || !body.plugin.alive) continue;
        const other = bodies[k === 0 ? 1 : 0];
        let impact = Math.hypot(body.velocity.x, body.velocity.y);
        if (body.plugin.stackLocked && other.plugin && other.plugin.isBall) {
          impact = Math.max(impact, Math.hypot(other.velocity.x, other.velocity.y) * 1.15);
        }
        if (impact > 2.1) {
          body.plugin.jellyAt = now;
          body.plugin.jellyAmp = Math.max(
            body.plugin.jellyAmp || 0,
            Math.min(0.22, impact * 0.018)
          );
        }
      }
      if (!a.plugin || !b.plugin || !a.plugin.isBall || !b.plugin.isBall) continue;
      if (!a.plugin.alive || !b.plugin.alive) continue;
      if (a.plugin.merging || b.plugin.merging) continue;
      if (a.plugin.level === FENGYI_LEVEL || b.plugin.level === FENGYI_LEVEL) continue;
      if (a.plugin.level !== b.plugin.level) continue;
      a.plugin.merging = true;
      b.plugin.merging = true;
      pendingMerges.push([a, b]);
    }
  });

  Events.on(engine, 'afterUpdate', function () {
    updateFengyiStacks(performance.now());
    if (!pendingMerges.length) return;
    const list = pendingMerges.splice(0);
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i][0];
      const b = list[i][1];
      if (a.plugin.alive && b.plugin.alive) mergeBalls(a, b);
    }
  });

  function addBall(x, y, level, options) {
    const info = LEVELS[level - 1];
    const opts = options || {};
    const isFengyi = level === FENGYI_LEVEL;
    const born = performance.now();
    const body = Bodies.circle(x, y, info.r, {
      restitution: isFengyi ? 0.04 : 0.08,
      friction: isFengyi ? 0.56 : 0.32,
      frictionStatic: isFengyi ? 0.8 : 0.62,
      frictionAir: isFengyi ? 0.012 : 0.006,
      density: 0.0011,
      slop: 0.02
    });
    if (isFengyi) {
      // Negative groups for matching levels mean two bee medics never collide
      // with each other, so they can be stacked into one wobbling pile.
      body.collisionFilter = {
        group: -FENGYI_LEVEL,
        category: 0x0001,
        mask: 0xFFFFFFFF
      };
    }
    body.plugin = {
      isBall: true,
      level: level,
      born: born,
      alive: true,
      merging: false,
      jellyAt: born,
      jellyAmp: opts.jellyAmp == null ? 0.12 : opts.jellyAmp,
      fengyi: isFengyi,
      home: null,
      stackAbove: null,
      anchorReady: false,
      stackLocked: false,
      settleAt: born + FENGYI_SETTLE_MS
    };
    Body.setInertia(body, Infinity);
    Body.setVelocity(body, { x: 0, y: opts.vy == null ? 1.4 : opts.vy });
    Body.setAngularVelocity(body, 0);
    Composite.add(world, body);
    state.balls.push(body);
    return body;
  }

  function removeBall(body) {
    if (!body || !body.plugin || !body.plugin.alive) return;
    body.plugin.alive = false;
    Composite.remove(world, body);
  }

  function addFengyi(x, y) {
    const info = LEVELS[FENGYI_LEVEL - 1];
    const existing = state.balls.filter(function (ball) {
      return ball.plugin && ball.plugin.alive && ball.plugin.level === FENGYI_LEVEL;
    });

    let home = null;
    let stackAbove = null;
    if (existing.length) {
      let top = existing[0];
      let topY = top.plugin.home ? top.plugin.home.y : top.position.y;
      for (let i = 1; i < existing.length; i += 1) {
        const candidate = existing[i];
        const candidateY = candidate.plugin.home ? candidate.plugin.home.y : candidate.position.y;
        if (candidateY < topY) {
          top = candidate;
          topY = candidateY;
        }
      }
      const anchor = top.plugin.home || { x: top.position.x, y: top.position.y };
      home = {
        x: clamp(anchor.x, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2),
        y: anchor.y - info.r * FENGYI_STACK_GAP
      };
      stackAbove = top;
    }

    const ball = addBall(
      clamp(x, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2),
      clamp(y, 46, FLOOR_Y - info.r - 6),
      FENGYI_LEVEL,
      { jellyAmp: 0.36, vy: 0.4 }
    );
    ball.plugin.born = performance.now() - 90;
    ball.plugin.jellyAt = performance.now();
    ball.plugin.jellyAmp = 0.36;
    ball.plugin.home = home;
    ball.plugin.stackAbove = stackAbove;
    ball.plugin.physicsAge = 0;
    ball.plugin.settleAt = performance.now() + 2600;
    if (home) {
      const dx = home.x - ball.position.x;
      Body.setVelocity(ball, {
        x: clamp(dx * 0.004, -1.6, 1.6),
        y: -1.2
      });
    }
    return ball;
  }

  function lockFengyi(ball, now) {
    if (!ball || !ball.plugin || ball.plugin.stackLocked) return;
    const home = ball.plugin.home || { x: ball.position.x, y: ball.position.y };
    Body.setPosition(ball, home);
    Body.setVelocity(ball, { x: 0, y: 0 });
    Body.setAngularVelocity(ball, 0);
    Body.setStatic(ball, true);
    ball.plugin.anchorReady = true;
    ball.plugin.stackLocked = true;
    ball.plugin.jellyAt = now;
    ball.plugin.jellyAmp = 0.24;
    burst(home.x, home.y + ball.circleRadius * 0.5, '#ffd166', 10, 0.7);
    shockwave(home.x, home.y, '#ffd166', ball.circleRadius * 1.8);
  }

  function updateFengyiStacks(now) {
    for (let i = 0; i < state.balls.length; i += 1) {
      const ball = state.balls[i];
      const p = ball.plugin;
      if (!p || !p.alive || !p.fengyi || p.stackLocked) continue;
      p.physicsAge = (p.physicsAge || 0) + STEP;

      if (p.stackAbove && p.stackAbove.plugin) {
        if (!p.stackAbove.plugin.alive) {
          p.stackAbove = null;
        } else if (!p.stackAbove.plugin.anchorReady || !p.stackAbove.plugin.home) {
          // Wait for the fengyi underneath to become the anchor. This matters
          // when two medics are created in quick succession: the second one
          // must not lock onto a temporary mid-air position.
          continue;
        } else {
          const targetX = clamp(
            p.stackAbove.plugin.home.x,
            INNER_LEFT + ball.circleRadius + 2,
            INNER_RIGHT - ball.circleRadius - 2
          );
          const targetY = p.stackAbove.plugin.home.y - ball.circleRadius * FENGYI_STACK_GAP;
          if (!p.home || Math.abs(p.home.x - targetX) > 0.5 || Math.abs(p.home.y - targetY) > 0.5) {
            p.home = { x: targetX, y: targetY };
            p.physicsAge = 0;
          }
          p.anchorReady = true;
        }
      }

      if (!p.home) {
        // The first bee medic gets to fall naturally, then becomes the anchor
        // of the pile. physicsAge pauses while the celebration overlay freezes
        // the board, so it can never lock in mid-air.
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
        const settled = p.physicsAge > FENGYI_SETTLE_MS && speed < 0.7;
        const timeout = p.physicsAge > FENGYI_SETTLE_MS * 3;
        if (settled || timeout) {
          p.home = {
            x: clamp(ball.position.x, INNER_LEFT + ball.circleRadius + 2, INNER_RIGHT - ball.circleRadius - 2),
            y: ball.position.y
          };
          lockFengyi(ball, now);
        }
        continue;
      }

      const dx = p.home.x - ball.position.x;
      const dy = p.home.y - ball.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 2.2 || p.physicsAge > 4200) {
        lockFengyi(ball, now);
        continue;
      }

      // Neutral buoyancy + a soft spring: the medic glides to its slot instead
      // of being teleported, and can pass through the rest of the pile.
      const mass = ball.mass || 1;
      Body.applyForce(ball, ball.position, {
        x: mass * 0.00006 * dx,
        y: mass * (0.00006 * dy - engine.gravity.y * engine.gravity.scale)
      });
      Body.setVelocity(ball, {
        x: ball.velocity.x * 0.975,
        y: ball.velocity.y * 0.975
      });
    }
  }

  function burst(x, y, color, count, speed) {
    const amount = count || 10;
    const force = speed || 1;
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * TAU;
      const velocity = (45 + Math.random() * 160) * force;
      const life = 420 + Math.random() * 480;
      state.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 30,
        life: life,
        maxLife: life,
        size: 1.5 + Math.random() * 3.2,
        color: color
      });
    }
    if (state.particles.length > 220) {
      state.particles.splice(0, state.particles.length - 220);
    }
  }

  function shockwave(x, y, color, maxR) {
    state.shockwaves.push({
      x: x,
      y: y,
      color: color,
      maxR: maxR,
      life: 460,
      maxLife: 460
    });
  }

  function addScore(points, x, y, color, combo) {
    state.score += points;
    scoreEl.textContent = formatScore(state.score);
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pop');

    if (state.score > state.best) {
      state.best = state.score;
      bestEl.textContent = formatScore(state.best);
    }

    const label = '+' + formatScore(points) + (combo > 1 ? '  ×' + combo : '');
    state.floaters.push({
      x: x,
      y: y,
      text: label,
      color: color || '#c8ff5e',
      life: 1000,
      maxLife: 1000
    });
    if (state.floaters.length > 14) state.floaters.shift();
  }

  function updateCombo() {
    if (state.combo > 1) {
      comboChipValue.textContent = '×' + state.combo;
      comboChip.classList.add('active');
      comboChip.classList.remove('pop');
      void comboChip.offsetWidth;
      comboChip.classList.add('pop');
    } else {
      comboChip.classList.remove('active');
    }
  }

  function mergeBalls(a, b) {
    if (!a.plugin.alive || !b.plugin.alive) return;

    const level = a.plugin.level;
    if (level === FENGYI_LEVEL) return;
    const midX = (a.position.x + b.position.x) / 2;
    const midY = (a.position.y + b.position.y) / 2;
    const avgVx = (a.velocity.x + b.velocity.x) * 0.25;
    const avgVy = (a.velocity.y + b.velocity.y) * 0.25;

    a.plugin.alive = false;
    b.plugin.alive = false;
    Composite.remove(world, a);
    Composite.remove(world, b);
    state.balls = state.balls.filter(function (ball) { return ball.plugin.alive; });

    const now = performance.now();
    if (now - state.lastMergeAt < 1100) {
      state.combo = Math.min(9, state.combo + 1);
    } else {
      state.combo = 1;
    }
    state.lastMergeAt = now;
    updateCombo();

    const multiplier = 1 + (state.combo - 1) * 0.25;

    if (level < WEILONG_LEVEL) {
      const nextLevel = level + 1;
      const info = LEVELS[nextLevel - 1];
      const newBall = addBall(
        clamp(midX, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2),
        clamp(midY, 26, FLOOR_Y - info.r - 2),
        nextLevel,
        { jellyAmp: 0.34 }
      );
      // A small pop upward sells the jelly merge. The new badge is already
      // mostly grown so the squash wave is visible immediately.
      Body.setVelocity(newBall, { x: avgVx * 0.7, y: avgVy - 1.15 });
      newBall.plugin.born = now - 110;
      newBall.plugin.jellyAt = now;
      newBall.plugin.jellyAmp = 0.34;

      const points = Math.round(MERGE_SCORE[nextLevel] * multiplier);
      addScore(points, midX, midY, info.color, state.combo);
      burst(midX, midY, info.color, 10 + nextLevel * 2, 1 + nextLevel * 0.1);
      shockwave(midX, midY, info.color, info.r * 2.6);
      state.shake = Math.min(9, 2 + nextLevel * 0.8);
      Sound.duang(0.75 + nextLevel * 0.06);
      Sound.merge(nextLevel);
      if (nextLevel === WEILONG_LEVEL) Sound.weilong();
    } else if (level === WEILONG_LEVEL) {
      // Two VYRONs make the one and only bee medic. From here on, medics are
      // fixed in place, never merge again, and pile onto each other.
      const points = Math.round((MAX_BONUS + state.balls.length * 80) * multiplier);
      addFengyi(midX, midY);
      addScore(points, W / 2, 300, '#ffe08a', state.combo);
      burst(midX, midY, '#ffe08a', 56, 2.5);
      shockwave(midX, midY, '#ffd166', 390);
      state.flash = 0.9;
      state.shake = 12;
      Sound.duang(1.5);
      showMeme(now, points);
    }
  }

  function showMeme(now, points) {
    state.memeUntil = now + MEME_DURATION;
    if (memePoints) {
      memePoints.textContent = '+' + formatScore(points) + (state.combo > 1 ? '  ×' + state.combo : '');
    }
    memeLayer.classList.remove('hidden');
    memeLayer.classList.remove('show');
    void memeLayer.offsetWidth;
    memeLayer.classList.add('show');
    window.clearTimeout(memeTimer);
    memeTimer = window.setTimeout(hideMeme, MEME_DURATION);
    Sound.fengyi();
  }

  function hideMeme() {
    state.memeUntil = 0;
    memeLayer.classList.remove('show');
    memeLayer.classList.add('hidden');
    accumulator = 0;
    lastTime = performance.now();
  }

  function scanMerges(now) {
    if (!state.running || state.over) return;
    if (now - lastScan < 220) return;
    lastScan = now;

    const list = state.balls.filter(function (ball) {
      return ball.plugin.alive && !ball.plugin.merging;
    });

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.plugin.level === FENGYI_LEVEL || b.plugin.level === FENGYI_LEVEL) continue;
        if (a.plugin.level !== b.plugin.level) continue;
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const reach = a.circleRadius + b.circleRadius + 1.5;
        if (dx * dx + dy * dy <= reach * reach) {
          a.plugin.merging = true;
          b.plugin.merging = true;
          pendingMerges.push([a, b]);
        }
      }
    }
  }

  function updateEffects(dt) {
    const seconds = dt / 1000;

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.vy += 760 * seconds;
      particle.vx *= 0.992;
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      floater.y -= 38 * seconds;
      floater.life -= dt;
      if (floater.life <= 0) state.floaters.splice(i, 1);
    }

    for (let i = state.shockwaves.length - 1; i >= 0; i -= 1) {
      state.shockwaves[i].life -= dt;
      if (state.shockwaves[i].life <= 0) state.shockwaves.splice(i, 1);
    }

    state.flash = Math.max(0, state.flash - dt / 380);
    state.shake = Math.max(0, state.shake - dt * 0.022);
  }

  function checkDanger(dt) {
    if (!state.running || state.over) return;

    if (pendingMerges.length) {
      state.overLineMs = Math.max(0, state.overLineMs - dt * 2);
      return;
    }

    const now = performance.now();
    let danger = false;

    for (let i = 0; i < state.balls.length; i += 1) {
      const ball = state.balls[i];
      if (!ball.plugin.alive || ball.plugin.merging) continue;
      if (ball.plugin.level === FENGYI_LEVEL) continue;
      if (now - ball.plugin.born < 950) continue;
      const top = ball.position.y - ball.circleRadius;
      const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
      if (top < DANGER_Y && speed < 2.4) {
        danger = true;
        break;
      }
    }

    if (danger) {
      state.overLineMs += dt;
    } else {
      state.overLineMs = Math.max(0, state.overLineMs - dt * 1.6);
    }

    if (state.overLineMs >= 1800) endGame();
  }

  /* ---------------------------- lifecycle --------------------------- */

  function clearBalls() {
    hideMeme();
    for (let i = 0; i < state.balls.length; i += 1) {
      const ball = state.balls[i];
      if (ball && ball.plugin) ball.plugin.alive = false;
      Composite.remove(world, ball);
    }
    state.balls = [];
    pendingMerges.length = 0;
  }

  function updateNext() {
    const next = LEVELS[state.nextLevel - 1];
    nextName.textContent = next.name;
    nextCode.textContent = next.code;
    nextNameMini.textContent = next.name;
    drawNext(nextCanvas, state.nextLevel, 84, 84, 64);
    drawNext(nextCanvasMini, state.nextLevel, 48, 48, 35);
  }

  function drawNext(target, level, cx, cy, radius) {
    const c = target.getContext('2d');
    c.clearRect(0, 0, target.width, target.height);
    drawBadgeOn(c, level, cx, cy, radius, 1, 1);
  }

  function resetState() {
    state.running = true;
    state.over = false;
    state.paused = false;
    state.score = 0;
    state.combo = 0;
    state.lastMergeAt = 0;
    state.overLineMs = 0;
    state.shake = 0;
    state.flash = 0;
    state.memeUntil = 0;
    state.particles = [];
    state.floaters = [];
    state.shockwaves = [];
    state.aimX = W / 2;
    state.dropReadyAt = 0;
    state.best = Leaderboard.getBest();
    bag = [];
    state.currentLevel = bagNext();
    state.nextLevel = bagNext();
    state.aimX = clamp(
      W / 2,
      INNER_LEFT + LEVELS[state.currentLevel - 1].r + 2,
      INNER_RIGHT - LEVELS[state.currentLevel - 1].r - 2
    );
    accumulator = 0;
    lastTime = performance.now();
    scoreEl.textContent = '0';
    bestEl.textContent = formatScore(state.best);
    updateCombo();
    updateNext();
    startOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    Sound.unlock();
    Sound.start();
  }

  function startGame() {
    clearBalls();
    resetState();
  }

  function endGame() {
    if (!state.running || state.over) return;
    hideMeme();
    state.running = false;
    state.over = true;
    const result = Leaderboard.submitScore(state.score);
    state.best = result.best;
    bestEl.textContent = formatScore(state.best);

    finalScore.textContent = formatScore(state.score);
    finalBest.textContent = formatScore(state.best);
    const rank = Leaderboard.getRank();
    finalRank.textContent = state.score > 0 ? '#' + String(rank).padStart(2, '0') : '--';
    newRecord.classList.toggle('hidden', !result.isNewBest);
    renderRanks();
    gameOverOverlay.classList.remove('hidden');
    Sound.over();
  }

  function tryDrop() {
    if (!state.running || state.over || state.paused) return;
    const now = performance.now();
    if (state.memeUntil > now) return;
    if (now < state.dropReadyAt) return;

    const info = LEVELS[state.currentLevel - 1];
    const x = clamp(state.aimX, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2);
    const ball = addBall(x, DROP_Y, state.currentLevel);
    Body.setVelocity(ball, { x: 0, y: 2.2 });
    ball.plugin.born = now;

    state.dropReadyAt = now + DROP_COOLDOWN;
    state.currentLevel = state.nextLevel;
    state.nextLevel = bagNext();
    updateNext();
    const nextInfo = LEVELS[state.currentLevel - 1];
    state.aimX = clamp(state.aimX, INNER_LEFT + nextInfo.r + 2, INNER_RIGHT - nextInfo.r - 2);
    Sound.drop();
  }

  function setAim(clientX) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const raw = ((clientX - rect.left) / rect.width) * W;
    const info = LEVELS[state.currentLevel - 1];
    state.aimX = clamp(raw, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2);
  }

  /* ----------------------------- rankings --------------------------- */

  function renderRanks() {
    const rows = Leaderboard.ranking();
    const top = rows.slice(0, 8);
    rankList.innerHTML = top.map(function (row, index) {
      const label = row.player ? (Leaderboard.getName() || '未命名干员') : row.name;
      return '<div class="rank-row' + (row.player ? ' is-player' : '') + '">' +
        '<span class="rank-no">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="rank-name" title="' + escapeHtml(label) + '">' + escapeHtml(label) +
        (row.player ? ' <em>你</em>' : '') + '</span>' +
        '<span class="rank-score">' + formatScore(row.score) + '</span>' +
        '</div>';
    }).join('');

    const player = rows.find(function (row) { return row.player; });
    const playerIndex = rows.indexOf(player);
    myRank.textContent = player.score > 0 ? '#' + String(playerIndex + 1).padStart(2, '0') : '--';
    myName.textContent = Leaderboard.getName() || '未命名干员';
    myScore.textContent = formatScore(player.score);
  }

  function refreshName() {
    const name = Leaderboard.getName() || '未命名干员';
    playerNameInput.value = Leaderboard.getName() || '';
    myName.textContent = name;
    renderRanks();
  }

  function beginFromOverlay() {
    let value = playerNameInput.value.trim();
    if (!value) value = defaultCallsign();
    const saved = Leaderboard.setName(value);
    playerNameInput.value = saved;
    renderRanks();
    Sound.unlock();
    startGame();
  }

  function openNameModal() {
    Sound.click();
    modalNameInput.value = Leaderboard.getName() || '';
    nameModal.classList.remove('hidden');
    window.setTimeout(function () {
      modalNameInput.focus();
      modalNameInput.select();
    }, 60);
  }

  function closeNameModal() {
    nameModal.classList.add('hidden');
  }

  function saveName() {
    let value = modalNameInput.value.trim();
    if (!value) value = Leaderboard.getName() || '未命名干员';
    const saved = Leaderboard.setName(value);
    playerNameInput.value = saved;
    closeNameModal();
    renderRanks();
    toast('昵称已更新');
    Sound.click();
  }

  function copyShareText() {
    const rank = Leaderboard.getRank();
    const text = '我在《三角洲合成行动》拿了 ' + formatScore(state.score) + ' 分，好友榜第 ' + rank + ' 名，来挑战我！';
    function fallback() {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (error) { /* ignore */ }
      document.body.removeChild(area);
      toast('战绩已复制，去发给好友吧');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('战绩已复制，去发给好友吧');
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ------------------------------ ladder ---------------------------- */

  function buildLadder() {
    ladderEl.innerHTML = '';
    LEVELS.forEach(function (info, index) {
      if (index > 0) {
        const sep = document.createElement('div');
        sep.className = 'ladder-sep';
        sep.innerHTML = '<span>×2</span>';
        ladderEl.appendChild(sep);
      }
      const row = document.createElement('div');
      row.className = 'ladder-item';
      row.style.setProperty('--c', info.color);
      row.innerHTML =
        '<span class="ladder-index">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="ladder-avatar" style="--c:' + info.color + '">' + info.name.charAt(0) + '</span>' +
        '<span class="ladder-meta"><strong>' + info.name + '</strong><small>' + info.code + '</small></span>' +
        '<span class="ladder-lv">' + (index === LEVELS.length - 1 ? 'MAX' : 'LV.' + (index + 1)) + '</span>';
      const avatar = row.querySelector('.ladder-avatar');
      const probe = new Image();
      probe.onload = function () {
        avatar.style.backgroundImage = 'url("' + info.img + '")';
        avatar.classList.add('has-img');
        avatar.textContent = '';
      };
      probe.src = info.img;
      ladderEl.appendChild(row);
    });
  }

  /* ------------------------------ loop ------------------------------ */

  function loop(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    if (state.running && !state.paused) {
      const inMeme = state.memeUntil > now;
      if (!inMeme) {
        accumulator += dt;
        let steps = 0;
        while (accumulator >= STEP && steps < 3) {
          Engine.update(engine, STEP);
          accumulator -= STEP;
          steps += 1;
        }
        if (steps >= 3) accumulator = 0;

        scanMerges(now);
        checkDanger(dt);
      } else {
        // Freeze the board for the guest appearance, but let the sparks and
        // screen shake finish their animation.
        accumulator = 0;
      }

      updateEffects(dt);

      if (!inMeme && state.combo > 0 && now - state.lastMergeAt > 1200) {
        state.combo = 0;
        updateCombo();
      }
    }

    render(now);
    window.requestAnimationFrame(loop);
  }

  /* ------------------------------ input ----------------------------- */

  canvas.addEventListener('pointerdown', function (event) {
    if (!state.running || state.over || state.paused) return;
    if (state.memeUntil > performance.now()) return;
    if (event.button != null && event.button !== 0) return;
    setAim(event.clientX);
    pointerActive = true;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    }
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', function (event) {
    if (!state.running || state.over || state.paused) return;
    if (pointerActive || event.pointerType === 'mouse') {
      setAim(event.clientX);
      event.preventDefault();
    }
  });

  canvas.addEventListener('pointerup', function (event) {
    if (!pointerActive) return;
    setAim(event.clientX);
    pointerActive = false;
    if (canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    }
    tryDrop();
    event.preventDefault();
  });

  canvas.addEventListener('pointercancel', function () {
    pointerActive = false;
  });

  canvas.addEventListener('contextmenu', function (event) {
    event.preventDefault();
  });

  window.addEventListener('keydown', function (event) {
    const tag = (event.target && event.target.tagName ? event.target.tagName : '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      if (event.key === 'Escape') closeNameModal();
      return;
    }

    if (!nameModal.classList.contains('hidden')) {
      if (event.key === 'Escape') closeNameModal();
      return;
    }

    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      const info = LEVELS[state.currentLevel - 1];
      state.aimX = clamp(state.aimX - 14, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2);
      event.preventDefault();
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      const info = LEVELS[state.currentLevel - 1];
      state.aimX = clamp(state.aimX + 14, INNER_LEFT + info.r + 2, INNER_RIGHT - info.r - 2);
      event.preventDefault();
    } else if (event.code === 'Space' || event.code === 'Enter') {
      if (state.running && !state.over && !state.paused && tag !== 'button') {
        event.preventDefault();
        tryDrop();
      }
    } else if (event.code === 'KeyR' && state.over) {
      startGame();
    } else if (event.key === 'Escape' && state.running && !state.over) {
      state.paused = true;
      pauseOverlay.classList.remove('hidden');
    }
  });

  /* ---------------------------- ui events --------------------------- */

  startBtn.addEventListener('click', beginFromOverlay);
  playerNameInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      beginFromOverlay();
    }
  });

  restartBtn.addEventListener('click', function () {
    Sound.unlock();
    if (state.running && !state.over && state.score > 0) {
      const result = Leaderboard.submitScore(state.score);
      state.best = result.best;
      bestEl.textContent = formatScore(state.best);
    }
    if (!state.running) {
      beginFromOverlay();
      return;
    }
    startGame();
  });

  againBtn.addEventListener('click', function () {
    startGame();
  });

  shareBtn.addEventListener('click', function () {
    Sound.click();
    copyShareText();
  });

  resumeBtn.addEventListener('click', function () {
    Sound.click();
    state.paused = false;
    accumulator = 0;
    lastTime = performance.now();
    pauseOverlay.classList.add('hidden');
  });

  soundBtn.addEventListener('click', function () {
    const nextEnabled = !Sound.enabled;
    Sound.setEnabled(nextEnabled);
    Leaderboard.setSound(nextEnabled);
    soundBtn.textContent = nextEnabled ? '音效：开' : '音效：关';
    soundBtn.classList.toggle('muted', !nextEnabled);
    if (nextEnabled) Sound.click();
  });

  editNameBtn.addEventListener('click', openNameModal);
  modalCancelBtn.addEventListener('click', closeNameModal);
  modalSaveBtn.addEventListener('click', saveName);
  modalClearBtn.addEventListener('click', function () {
    if (!window.confirm('确定清空本机的最高分和游玩场次吗？此操作不可撤销。')) return;
    Leaderboard.clearScore();
    state.best = 0;
    bestEl.textContent = '0';
    renderRanks();
    closeNameModal();
    toast('本机成绩已清空');
  });

  modalNameInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveName();
    } else if (event.key === 'Escape') {
      closeNameModal();
    }
  });

  nameModal.addEventListener('click', function (event) {
    if (event.target === nameModal) closeNameModal();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.running && !state.over) {
      state.paused = true;
      pauseOverlay.classList.remove('hidden');
    }
  });

  window.addEventListener('resize', function () {
    // Canvas logical coordinates are fixed; CSS handles the responsive scaling.
  });

  /* ------------------------------ init ------------------------------ */

  function init() {
    buildLadder();
    renderRanks();
    playerNameInput.value = Leaderboard.getName() || '';
    playerNameInput.placeholder = defaultCallsign();
    bestEl.textContent = formatScore(state.best);
    soundBtn.textContent = Sound.enabled ? '音效：开' : '音效：关';
    soundBtn.classList.toggle('muted', !Sound.enabled);
    state.nextLevel = 2;
    updateNext();
    updateCombo();
    render(performance.now());
    window.requestAnimationFrame(loop);
  }

  window.__deltaMergeDebug = {
    state: state,
    levels: LEVELS,
    addBall: addBall,
    addFengyi: addFengyi,
    bagNext: bagNext,
    mergeBalls: mergeBalls,
    tryDrop: tryDrop,
    showMeme: showMeme,
    hideMeme: hideMeme,
    checkDanger: checkDanger,
    render: render,
    engine: engine
  };

  init();
})();
