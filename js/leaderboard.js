(function () {
  'use strict';

  const STORAGE_KEY = 'deltaMerge.save.v1';
  const MAX_NAME = 12;

  const FRIENDS = Object.freeze([
    { name: '长弓溪谷扛把子', score: 22480 },
    { name: '红狼单推人', score: 18320 },
    { name: '乌鲁鲁救我', score: 15260 },
    { name: '零号大坝保安', score: 11940 },
    { name: '摸金校尉', score: 8760 },
    { name: '撤离失败', score: 6240 },
    { name: '哈夫克打工人', score: 4180 },
    { name: '三角洲新兵', score: 2360 }
  ]);

  const DEFAULTS = Object.freeze({
    name: '',
    best: 0,
    plays: 0,
    sound: true
  });

  function clampName(value) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return Array.from(text).slice(0, MAX_NAME).join('');
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        name: clampName(parsed.name),
        best: Math.max(0, Number(parsed.best) || 0),
        plays: Math.max(0, Number(parsed.plays) || 0),
        sound: parsed.sound !== false
      };
    } catch (error) {
      return Object.assign({}, DEFAULTS);
    }
  }

  let state = load();

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* storage can be unavailable in private mode; the game still works */
    }
  }

  function ranking() {
    const list = FRIENDS.map(function (friend) {
      return { name: friend.name, score: friend.score, player: false };
    });
    list.push({
      name: state.name || '未命名干员',
      score: state.best,
      player: true
    });
    list.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.player !== b.player) return a.player ? 1 : -1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return list;
  }

  function getPlayerRank() {
    const rows = ranking();
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].player) return i + 1;
    }
    return rows.length;
  }

  function submitScore(score) {
    const value = Math.max(0, Math.floor(Number(score) || 0));
    const previousBest = state.best;
    const isNewBest = value > previousBest && value > 0;
    if (value > state.best) state.best = value;
    state.plays += 1;
    persist();
    return {
      best: state.best,
      isNewBest: isNewBest,
      previousBest: previousBest
    };
  }

  window.Leaderboard = {
    MAX_NAME: MAX_NAME,
    getName: function () { return state.name; },
    setName: function (name) {
      state.name = clampName(name);
      persist();
      return state.name;
    },
    getBest: function () { return state.best; },
    getPlays: function () { return state.plays; },
    getSound: function () { return state.sound; },
    setSound: function (enabled) {
      state.sound = Boolean(enabled);
      persist();
    },
    getRank: getPlayerRank,
    ranking: ranking,
    submitScore: submitScore,
    clearScore: function () {
      state.best = 0;
      state.plays = 0;
      persist();
    },
    clampName: clampName
  };
})();
