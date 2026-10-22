# 三角洲合成行动 · DELTA MERGE

三角洲二创版「合成大西瓜」。纯前端，无构建步骤、无外部依赖。

## 启动

- 双击 `start.bat`：自动起本地服务（监听 `0.0.0.0:8000`）并打开浏览器
- 手动：在本目录执行 `py -m http.server 8000 --bind 0.0.0.0`

## 访问地址

| 场景 | 地址 |
|---|---|
| 本机 | <http://127.0.0.1:8000/> |
| 手机 / 同 Wi-Fi 的其他设备 | `http://<电脑局域网IP>:8000/`（本机当前为 172.22.21.78） |
| 外网 / 异地朋友 | 需要公网部署，本地服务做不到 |

**不要直接双击 `index.html`**：页面用 `fetch()` 加载音效，`file://` 协议会被浏览器按 CORS 拦截，音效会失效。
必须通过 http 服务打开。

手机连不上时依次检查：

1. 服务是否监听 `0.0.0.0`（`netstat -ano | findstr :8000` 应显示 `0.0.0.0:8000`）；
2. Windows 防火墙是否放行 Python 的 8000 端口，管理员执行：
   `netsh advfirewall firewall add rule name="DeltaMerge 8000" dir=in action=allow protocol=TCP localport=8000`
3. 手机和电脑是否真在同一网段；公司/校园 Wi-Fi 常开「客户端隔离」，此时同 Wi-Fi 也互 ping 不通，改用手机热点。

## 玩法

| 等级 | 角色 | 代号 |
|---|---|---|
| 1 | 乌鲁鲁 | — |
| 2 | 麦晓雯 | HACKCLAW |
| 3 | 露娜 | — |
| 4 | 疾风 | — |
| 5 | 红狼 | — |
| 6 | 威龙 | — |
| 7 | 蜂医 | MAX |

- 只投放前三级，比例 6 : 3 : 1。
- 两个威龙合成蜂医（MAX），之后蜂医固定叠放、可互相重叠，不再互相合成。
- 分数累计 + 本地好友榜（数据存 localStorage，键 `deltaMerge.save.v1`）。
- 操作：鼠标/触屏移动瞄准、松手投放；`R` 重开；`Esc` 暂停。
- 音效：合成威龙播放粤语片段 `assets/meme/weilong_voice.m4a`；合成蜂医播放 `assets/meme/fengyi_clip.m4a`。

## 目录

```
index.html        页面结构
styles.css        样式（含手机适配）
js/game.js        游戏主逻辑（Matter.js 物理 + Canvas 绘制）
js/leaderboard.js 分数与本地好友榜
vendor/           Matter.js 等第三方库
assets/characters 7 个角色头像
assets/meme       音效片段（及可重切的原始音频）
tools/            开发期抓图/裁图脚本（不参与运行）
```

## 素材说明

- 开发期收集的参考图（约 245MB）已移到同级目录 `../delta-squash-dev/refs/`，不参与运行；需要换头像时可去那里找，用户提供的原图 `fengyi_source.webp` 也在其中。
- 原始音频 `cantonese_audio.m4a`、`fengyi_audio.m4a` 保留在 `assets/meme/`，方便重新切片段。

## 待确认

1. 两段音效是否满意（粤语 3.35s–9.0s；蜂医 0–5s），不满意可重切。
2. 麦晓雯 / 露娜 / 红狼 / 威龙 四张头像是否定稿。
3. 完整玩一局做最终验收。
