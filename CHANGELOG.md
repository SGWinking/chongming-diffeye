# 更新日志 · 重明 DiffEye

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的写法，版本号遵循语义化版本。

---

## [1.2.0] — 2026-09-23

**重明 DiffEye 正式加入「大云壁画工具箱」系列。** 仓库结构、命名、端口、视觉语言、
启动行为、安全基线、开源协议全部对齐 SERIES-SPEC v1.0。
这是自 1.0.0 以来的首次系列化交付，版本号按 §3 走次版本位（含整体视觉改版）。

### 变更

- **开源协议 AGPL-3.0 → MIT**（用户已批准，SERIES-SPEC §9）。
  合规检查结论：全部直接依赖都是宽松协议，没有 GPL/AGPL 传染。
  共**六处**改动：`LICENSE`（整份换成 MIT 全文）、`package.json` 的 `"license"`、
  `package-lock.json` 的 `"license"`（最容易漏的一处）、`COPYRIGHT`、`NOTICE`、
  `THIRD_PARTY_NOTICES.md` 的开头声明；另有 `docs/USAGE.md` 第 10 节的部署说明同步改写。
- **整体换肤：视觉基准改为「相柳网格」（SERIES-SPEC §4）。**

  | | 改前 | 改后 |
  |---|---|---|
  | 页面底色 | `#f4f6f8` 浅灰（接近白） | `#f3f6f8` **冷灰蓝** `--bg`，白色只留给 `--panel` |
  | 主色 | `#0f766e` 青色（与系列任何工具都不同源） | **琥珀金 `#7a4f0d`**（重明的颜色身份，§4.1.1） |
  | 卡片 | `border-radius: 8px` 圆角 | `1px solid var(--line)` + `0 10px 28px var(--shadow)`，直角 |
  | 主按钮 | 任意位置的 6px 圆角实心按钮 | 琥珀金**实心**直角块，高 50px，字重 800 |
  | 次级按钮 | `#202733` 近黑实心小按钮 | `--panel-2` **实底** + 描边，高 46px（小号 38px） |
  | 浅色元素 | 部分透明压白底 | 一律给实底（`--panel-2` / `--field-2`）+ 描边 |
  | 圆角 | 2–999px 混用 | 0（直角），层级靠边线与阴影建立 |
  | 页头 | 「DiffEye \| 重明 \| 图像比对工具 V0.4」+ 一排按钮 | Logo → 系列名 → 工具名 → 版本号；右侧状态点 + 端口 |

- **确立重明的颜色身份：琥珀金 `#7a4f0d`**（深色 `#8a5c14`）。
  四个工具从此共用同一套骨架 token，各自只换 accent 五个值。
- **accent 的派生色收敛成变量**：新增 `--accent-line`（描边）与 `--accent-press`（按下态），
  不再把派生色硬编码在 CSS 里。
- **新增 `public/assets/logo.svg`**：圆形朱文印风格，朱砂红 `#b23a2c`，
  中间是双目各带双瞳的重明（「重明」＝每目双瞳），顶上一簇火苗（衔火带来光明）。
  朱色只走线，只有四个瞳孔是小面积实心填充，没有大面积深色填充。
  原先的 `chongming-logo.png` **保留未删**。
- **页头改为系列固定顺序**：Logo → 「大云壁画工具箱」→「重明 DiffEye」→ 版本号；
  右侧是服务状态点 + 端口 + 深浅主题切换。**版本号与端口在运行时从 `/api/health` 取**，
  页面里不再硬编码。
- **新增页头流程标签**（1 选图 / 2 参数 / 3 审查），点击滚动定位到对应区块。
- **版本号从 `1.0.0` 收敛为 `1.2.0`。** 唯一来源是 `package.json` 的 `"version"`，
  `server.js` 直接 `require("./package.json")` 读取，四处（`package.json` /
  `README.md` / `CHANGELOG.md` / 页面显示）完全一致。
- **新增 `requirements.txt`**：按 `mural_compare.py` 与 `dexined_edges.py` 的实际 import
  写成 `opencv-python` / `numpy` / `Pillow`；`torch` / `torchvision` 只在 DexiNed
  模式下需要，以注释形式标注，不列入安装清单。
- **`.gitignore` 重写**，按 SERIES-SPEC §1.2 基线补齐，明确覆盖
  `node_modules/` `runtime/` `runs/` `third_party/` `image-history.json`
  `__pycache__/` `*.log`。
- **启动脚本统一。** 删除 `start-tool.bat` 与 `启动DiffEye.bat`（两个在做同一件事），
  新建 `run.bat`（纯 ASCII）+ `run.ps1`（UTF-8 带 BOM）。
  `install.bat` 与 `setup-dexined.bat` 保留。

### 新增

- **`GET /api/health` 统一响应。** 返回 `series`（大云壁画工具箱）/ `tool`（diffeye）/
  `name`（重明）/ `nameEn`（DiffEye）/ `version` / `port` / `host` / `address`，
  并保留原有的 `python` / `bundledPython` / `dexinedAvailable` 三个字段，
  另外补 `uptime` 与 `maxUploadMB`。`run.ps1` 与工具箱启动台靠它探活。
  **`/health` 保留**（启动台现在按 `/health` 探活），返回完全相同的结构。
- **受限 CORS + `OPTIONS` 预检（S2）。** 只放行 `http://127.0.0.1:*`、`http://localhost:*`
  与 `Origin: null`；其它来源一条 `Access-Control-Allow-*` 头都不发。
  所有响应带 `Vary: Origin`。判定逻辑与 `toolkit_core.origin_allowed` 对齐。
- **统一错误结构**（SERIES-SPEC §7）：`{"error":{"code","message","field","detail"}}`，
  `message` 一律是能直接显示给用户的中文。前端 `app.js` 同步兼容旧的字符串形式。
- **启动横幅**改成系列模板：系列名 + 工具名 + 版本（读 `package.json`）+ 监听地址。
- **深色主题（`body.dark`）新增。** 与「相柳网格」「白泽评审」同一套深色色板，
  只替换 accent 为琥珀金的深色版（`#8a5c14` / `#a26e1a` / `#2a2418` / `#4a3c22` / `#6e4a10`）。
  页头一个 `theme-toggle` 按钮，选择记在 `localStorage`，**默认浅色**。

  > 重明原本只有一套粗糙的暗色（`:root.dark`，另起一套青绿色板），与系列 token 不同源。
  > 本次不是「删掉深色」，而是**把它重写成系列口径的深色主题**。
  > SERIES-SPEC §4.2 那四条视觉纪律只约束浅色主题，深色主题是系列的一部分。

### 修复

- **运行目录自动清理有两个会丢数据的坑，已修掉。** 原来写的是
  `Number(process.env.RUNS_MAX_AGE_DAYS || 7)`：环境变量设成 `0` 会被当成假值而回退成 7
  （你以为关掉了，其实没关）；设成**负数**更糟 —— 截止时间跑到未来，**整个 `runs/` 会被清空**。
  现在 `0` 或负数明确表示「关掉清理，一个都不删」；启动时先打印**将要清理哪些目录**再动手，
  日志里看得见它究竟动了什么；`/api/health` 也把 `runsCleanupEnabled` 与 `runsMaxAgeDays` 报出来。
- **文档里写明了 `runs/` 的清理语义与备份陷阱。** `runs/` 是设计上可丢弃的中间产物缓存
  （默认保留 7 天），服务每次启动都会执行清理，因此**切勿把备份目录里的 `server.js`
  启动起来做实验** —— 那会把这份备份自己的 `runs/` 一起清掉。

- **服务监听了全网卡（S7，真实安全漏洞）。** 旧版 `app.listen(port, ...)` 没有指定 host，
  等于绑定 `0.0.0.0` —— 同一个局域网里任何机器都能打开你的重明、翻 `runs\` 里的壁画扫描图。
  现在改为 `app.listen(port, "127.0.0.1", ...)`，并把实际监听地址写进 `/api/health` 与启动横幅。
  已实测：从本机局域网 IP 连 5055 连接失败。
- **`OPTIONS /compare` 返回 404（S2）。** 旧版完全没有 `OPTIONS` 处理，
  预检请求会掉进 express 的 404；现在返回 204 + 预检头。
- **上传非图片返回 500。** 旧版 `fileFilter` 抛出的 `Error` 一路走到通用错误处理器，
  用户拿到的是 500 而不是 400；现在按语义返回 **400** + 中文提示。
- **上传超限返回 500。** multer 的 `LIMIT_FILE_SIZE` 同样落到通用处理器；
  现在返回 **413** + 「单张图片不能超过 120 MB，请先压缩或裁切后再上传。」
- **错误响应没有机器可读的 code。** 旧版只有一句 `{"error": "字符串"}`；
  现在每个错误都有 `code`（`NOT_AN_IMAGE` / `UPLOAD_TOO_LARGE` / `MISSING_IMAGES` /
  `COMPARE_FAILED` …），前端展示仍用中文 `message`。
- **端口被占用时静默崩溃。** 旧版没有监听 `error` 事件，`EADDRINUSE` 会直接抛栈；
  现在打印「端口 5055 已被占用，无法启动。」并以退出码 1 结束。
- **`THIRD_PARTY_NOTICES.md` 里的硬编码老路径** `D:\DIFF\third_party\...`
  改成相对路径 `third_party\DexiNed\...`。
- **`install.bat` 的失效指引。** 装着装着提示「Run start-tool.bat」，而那个脚本本次已删除；
  改为指向 `run.bat`，并把 `python -m pip install opencv-python pillow numpy` 换成
  `-r requirements.txt`，同时优先使用 `py -3`。
- **中文错误提示全是乱码（真实缺陷，改造前就存在）。** 中文 Windows 上 Python 默认用
  cp936 写 stderr，Node 的 `execFile` 按 UTF-8 解码，于是「两张图片宽高比例不一致，无法比对。」
  这类中文提示传到前端时整句都变成 `U+FFFD` 替换字符 —— 用户看到的就是一串问号方块。
  现在给子进程加了 `PYTHONIOENCODING=utf-8`，实测 `has_U+FFFD=False`。这同时也消掉了
  stdout 用 cp936 输出时的潜在 `UnicodeEncodeError`。
- **Python 失败时把整段 traceback 当错误消息返回。** 用户会看到一屏 Python 栈和本机绝对路径。
  现在只取最后一行异常信息当 `message`（能直接读的中文），完整 traceback 放进
  `error.detail` 供排查。
- **主按钮在宽屏下被拉高到 114px。** `.controls` 是 grid 且 `align-items: stretch`，
  1600px 视口下主按钮被同一行更高的 `.modebar` 撑到 114px，违反 §4.4「主按钮高 50px」。
  现在钉死 `height: 50px` + `align-self: end`，实测各视口均为 50px。
- **`body { overflow-x: hidden }` 把真实溢出藏起来了。** 这是本次自查时自己引入又撤掉的一条：
  它不阻止溢出，只是把超出部分剪掉，连带 `scrollWidth` 一起变小，导致"量出来不溢出、
  截图却明显被裁"。已删除，改为用 CDP 逐元素找出真正越界的元素再修。
- **空状态下画布上悬着一个琥珀色半圆。** 还没选图时 `.zoom-layer` 宽高都是 0，
  对比滑块的圆头被画成一个孤零零的色块；现在图片 load 之前不显示滑块。
- **「聚焦区域」面板初始是一片空白。** 现在有一句「还没有比对结果。选好两张图，点「开始比较」。」
- **非数字数值参数会把算法层炸成 500。** `Number("abc")` 是 `NaN`，
  而 `Math.max(1, Math.min(95, NaN))` 还是 `NaN`，`String(NaN)` 传给 Python 就是
  `int('NaN')` → 500。现在加了 `clampNumber()` 兜底：**上下界一字未改**，
  只让 `NaN`/`Infinity` 退回默认值。实测 `abc`/`NaN`/`Infinity`/`1e309` 全部从 500 变成 200。

### 保留（算法一行未改）

本次改造**只动 HTTP 外壳、安全层、错误处理、前端与文档**。
`mural_compare.py` 与 `dexined_edges.py` 的**算法逻辑一行未改**：

- `mural_compare.py` —— `imread_unicode` / `imwrite_unicode` / `fit_to_max` /
  `check_aspect_ratio` / `normalize_gray` / `align_to_base` / `adaptive_edges` /
  `dexined_edges_batch` / `extract_edges` / `build_region_crop` / `overlap_ratio` /
  `remove_nested_regions` / `compare_mural` / `main`，函数体逐行保留。
- `dexined_edges.py` —— 整个文件未改。
- 保留未动的数值与判定：
  长边上限 `2048`；宽高比容差 `0.03`；对齐质量门限（`inlier_ratio < 0.25`、
  `|det| < 0.05`、`|det| > 20.0`、角点跨度 0.3×–3.0×）；
  `adaptive_edges` 的 sigma 公式 `0.34 - sensitivity * 0.012`；
  偏移最小值 `max(2, round(tolerance * 0.45))`；
  聚合核 `max(9, 12 + sensitivity * 2)`（Canny）/ `max(5, 6 + sensitivity)`（DexiNed）；
  候选过滤 `area < min_area or area > max_area` 与 `mask_area < max(20, min_area * 0.08)`；
  嵌套区域剔除阈值 `0.82 / 2.2 / 0.92 / 0.35`；
  三色着色 `shifted (0,220,255)` / `missing (255,80,0)` / `new (0,0,255)`，
  以及输出文件名清单。
- 服务端参数 clamp 的上下界全部原样保留：
  灵敏度 1–10、最小区域 40–5000、检测数量 20–300、最大区域% 1–95、容错px 1–30；
  上传单张上限 120 MB；`image/*` 过滤；文件名清洗正则
  `[^\w.\-()\u4e00-\u9fa5]` → `_`；`isInsideRuns()` 仍用 `path.relative` 做真路径包含判断。
- `runs\` 自动清理保留 7 天（`RUNS_MAX_AGE_DAYS`），`image-history.json` 上限 160 条。

### 已知取舍

- **「线条模式」下拉框仍默认选中「精细 DexiNed」。** 这是旧版既有行为，本次未改
  （改它会动到默认比对质量）。但 README 已写清：**没装模型的人请切到「快速 Canny」**，
  它不需要任何模型文件。服务端在 DexiNed 不可用时会明确拒绝并给出中文提示，不会静默失败。
- **`chongming-logo.png`（85 KB）保留未删。** 页面已改用系列风格的 `logo.svg`，
  但 PNG 是旧版品牌资源，删除属于破坏性动作，本次不动它。
- **`public/assets/logo.svg` 是本次新画的**，与「相柳网格」沿用作者自有 PNG 的做法不同；
  白泽评审同样使用 SVG，重明跟随白泽。
- **`/compare` 的错误结构改成 §7 统一对象**，前端同步做了兼容。
  这是接口语义的变化（虽然对用户可见的文案没变），因此走次版本位。
- **深色主题是新增的，不是必然需求。** 重明原本那套暗色与系列 token 不同源，
  本次按 §4.1 附录重写；如果你只想要浅色，删掉 `body.dark` 与页头按钮即可，
  但**不建议**——相柳与白泽都带深色。

### 验收（全部为本机实测，不是代码阅读）

**语法与完整性**

| 项 | 命令 | 结果 |
|---|---|---|
| Node 语法 | `node --check server.js` / `node --check public/app.js` | 均通过（退出码 0） |
| Python 语法 | `py -3 -m py_compile mural_compare.py dexined_edges.py` | 通过 |
| JSON 有效性 | `JSON.parse` 读 `package.json` / `package-lock.json` | 通过 |
| **算法未改** | `md5sum` 与 `D:\vibecodingtool-archive\00-原始快照\diffeye\` 比对 | `mural_compare.py` = `144c485d17442aae58d19554da39ff52`，`dexined_edges.py` = `4112a35a437dfb8134c0343585ebd07a`，**逐字节一致** |

**真跑一次比对**（服务在 `D:\vibecodingtool\diffeye` 原地启动，端口 5055）

输入用真实素材：`xiangliu-grid\inputs\` 里那张 24162×7051 的壁画扫描件，
裁一块 1600×1200 当基准图，再用程序做三处结构性改动（一块纹理整体下移 18px、
一块区域高斯模糊、凭空加两笔线条）当第二张图。

```text
POST /compare  mode=mural  sensitivity=5  minArea=2048  maxRegions=120
               edgeMethod=canny  maxAreaPercent=60  tolerancePixels=10  enableAlign=1
→ HTTP 200
   match=false  reason=pattern-diff
   diffCount=16134     diffPercentage=0.8403%
   regionCount=2       alignment={aligned:true, method:"homography", inliers:500, inlierRatio:1}
   scale=1             edgeMethod=canny
```

返回的 **13 个产物 URL 全部 200 且 `Content-Type: image/png`**：

```text
baseUrl              3580231 B    processedBaseUrl     4035636 B
compareUrl           3393049 B    diffUrl              3989550 B
diffBaseUrl          3965929 B    maskUrl                17343 B
edgesUrl              849325 B    alignedCompareUrl    3846246 B
diffLayers.new         10875 B    diffLayers.missing     35863 B
diffLayers.shifted     26463 B    region1.cropUrl       389768 B
region2.cropUrl       208571 B        失败数：0
```

另外通过**真实前端**（页头历史下拉框 → 点「开始比较」，用 CDP 驱动）跑了一遍完整 UI 路径：
`发现差异 / 45,841 边缘差异像素 / 2.3876% / homography 已对齐 / 11 个聚焦区域`，
右侧 11 张区域卡片和差异图上的 1–11 号黄框都正常渲染。

**安全基线实测**

| # | 用例 | 改前 | 改后 |
|---|---|---|---|
| S1 | `--path-as-is` 打 14 种越界写法（`/..%2f..%2fserver.js`、`/..%5c..%5cserver.js`、`/%2e%2e%2fserver.js`、`/%252e%252e%252fserver.js`、`/runs/..%2f..%2fserver.js`、`/..%2fmural_compare.py`、`/..%2fimage-history.json` …） | — | **全部 404**，响应体不含 `apiError`/`SERIES_NAME`/`app.listen` 等任何源码片段；`/index.html` `/styles.css` `/app.js` `/assets/logo.svg` 对照 200 |
| S2 | `OPTIONS /compare` | **404** | **204** |
| S2 | `OPTIONS` + `Origin: http://127.0.0.1:8700` | 无 CORS 头 | 204 + `ACAO: http://127.0.0.1:8700` + `Allow-Methods` + `Allow-Headers` + `Max-Age: 600` + `Vary: Origin` |
| S2 | `OPTIONS` + `Origin: http://localhost:3000` | — | 204 + `ACAO: http://localhost:3000` |
| S2 | `OPTIONS` + `Origin: http://evil.example.com` | — | 204，**只有 `Vary: Origin`，没有任何 `Access-Control-Allow-*`** |
| S2 | `GET /api/health` + `Origin: http://evil.example.com` | — | 200，同样不发 ACAO |
| S2 | `GET /api/health` + `Origin: null` | — | 200 + `ACAO: null` |
| S3 | JSON 请求体 | 服务端**没有 `express.json()`**，任何接口都不解析 JSON body，所以不存在无上限 JSON 读取 | 保持（未新增 JSON 接口） |
| S4 | 上传 `text/plain` | **500** | **400** `{"code":"NOT_AN_IMAGE","message":"只能上传图片文件。"}` |
| S4 | 两个字段都不给 | 400 | 400 `MISSING_IMAGES` |
| S4 | 字段名写成 `foo` | — | 400 `UNEXPECTED_FIELD` |
| S4 | **真传 125 MB**（上限 120 MB） | **500** | **413** `UPLOAD_TOO_LARGE`，「单张图片不能超过 120 MB，请先压缩或裁切后再上传。」；实测 `runs\` 下**只留下一个空目录，超限文件没有落盘** |
| S5 | 参数超上限 `999/99999/9999/999/999` | 200（clamp） | 200，回显 `maxAreaPercent=95 tolerancePixels=30` |
| S5 | 参数低于下限 `-5/-9/-100/-9/-9` | 200（clamp） | 200，回显 `maxAreaPercent=1 tolerancePixels=1` |
| S5 | **非数字 `abc` / `NaN` / `Infinity` / `1e309`** | **500**（`int('NaN')` 炸在算法层） | **200**，退回默认值 `60 / 10` |
| S5 | `edgeMethod=bogus` | 200（回退 canny） | 200（白名单回退 canny） |
| S6 | 静态传输 | `express.static` 走 `send`，本来就是流式 | 保持；全仓无 `readFileSync` 进响应的路径（`readHistory` 读的是小 JSON，不计） |
| S7 | **监听地址** | `netstat`：`0.0.0.0:5099 LISTENING`，且 `curl http://192.168.31.194:5099/health` → **HTTP 200**（局域网可达） | `netstat`：`127.0.0.1:5055 LISTENING`；`192.168.31.194:5055` → **ECONNREFUSED**（Node）/ WinError 10061（Python）；`127.0.0.1:5055` → 200 |

**启动脚本**

`cmd /c run.bat -NoBrowser` 实际输出：

```text
============================================
  大云壁画工具箱 · 重明 DiffEye v1.2.0
============================================
  地址：http://127.0.0.1:5055/
  关闭此窗口即停止工具。

[1/4] 检查 Node.js ... OK   Node v24.15.0
[2/4] 检查依赖 ... OK
      Python 3.10（opencv-python / numpy 就绪）
[3/4] 启动服务 ... OK
[4/4] 跳过打开浏览器（-NoBrowser）
```

版本号 `v1.2.0` 是从 `package.json` 读出来的，脚本里没有硬编码。
`runtime\python\python.exe` 被优先使用（它报的是 3.10）。

**编码**

```text
[OK] run.ps1        UTF-8 with BOM, no smart quotes   (1763 个非 ASCII 字节，BOM 在)
[OK] run.bat        pure ASCII                        (0 个非 ASCII 字节)
[OK] install.bat    pure ASCII
[OK] setup-dexined.bat  pure ASCII
All files OK.
```

**版本号四处一致**

`package.json` `"version": "1.2.0"` ＝ `server.js` 运行时读到的 `/api/health.version`
＝ `README.md` 的 `**Version:** \`1.2.0\`` ＝ `CHANGELOG.md` 首条 `## [1.2.0] — 2026-09-23`。
页面页头显示的 `v1.2.0` 由 JS 从 `/api/health` 取，实测 CDP 读到 `version=v1.2.0`。

**`.gitignore` 真的生效**

```text
$ git init && git add -A && git ls-files | wc -l
23
$ git check-ignore -v node_modules runtime runs third_party image-history.json __pycache__
node_modules       .gitignore:14:node_modules/
runtime            .gitignore:15:runtime/
runs               .gitignore:6:runs/
third_party        .gitignore:16:third_party/
image-history.json .gitignore:11:*history*.json
__pycache__        .gitignore:19:__pycache__/
```

被跟踪的 23 个文件全部是源码 / 文档 / 品牌资源，**没有任何运行产物**。

**视觉验收（Chrome 153 无头，`read_image` 逐张人眼复核）**

| 截图 | 视口 | 复核结论 |
|---|---|---|
| `_shots\70-diffeye-1600.png` | 1600×1000 | 底色冷灰蓝非纯白；页头 Logo→大云壁画工具箱→重明 DiffEye v1.2.0→流程标签→●正常 :5055 深色；主按钮琥珀金实心直角 50px、次级按钮白底描边 46px，一眼可分；无横向溢出 |
| `_shots\71-diffeye-1280.png` | 1280×800 | 同上；`开始比较` 变成整行琥珀金横条，height 仍为 50px |
| `_shots\72-diffeye-390.png` | 390×844 | 单列堆叠，页头折行，三个标签完整可见，无裁切、无横向溢出 |
| `_shots\73-diffeye-dark.png` | 1600×1000，`body.dark` | 页面底色 `rgb(23,23,25)`、卡片 `#202124`、主按钮 `rgb(138,92,20)`，确认是深色页 |
| `_shots\74-diffeye-result-1600.png` | 1600×1000 | 真实比对结果页：11 个聚焦区域、差异图上 1–11 号黄框、右侧区域卡片带三栏缩略图、指标 45,841 / 2.3876% / homography 已对齐 |

计算样式实测（CDP `Runtime.evaluate`，非目测）：

```text
1600×1000  body bg=rgb(243,246,248)  overflowX=0
           主按钮 h=50px bg=rgb(122,79,13) radius=0px weight=800 color=rgb(255,255,255)
           次按钮 h=46px bg=rgb(247,249,251) radius=0px border=1px rgb(217,224,231)
           卡片 radius=0px shadow=rgba(15,23,42,.08) 0px 10px 28px 0px
1600×1000  (body.dark) body bg=rgb(23,23,25) 主按钮 bg=rgb(138,92,20) over=0
1280×800   overflowX=0
390×844    innerWidth=390  docScrollWidth=390  overflowX=0  越界元素计数=0
```

> 两个坑值得记下来：① `--window-size=390,844` 在 Windows 上受"最小窗口宽度"限制，
> 实际按 ~500 宽布局再裁成 390，看着像溢出其实不是 —— 窄屏必须用 CDP
> `Emulation.setDeviceMetricsOverride`；② 我一度给 `body` 加了 `overflow-x: hidden`，
> 结果把真实溢出藏起来了（`scrollWidth` 也跟着变小，量不出来）。已删掉，
> 改成找出真正溢出的元素逐个修。

**协议合规复查**

```text
$ grep -rn -i -E "AGPL|Affero" .（排除 node_modules/runtime/third_party/runs）
CHANGELOG.md      「AGPL-3.0 → MIT」的变更记录本身
docs/USAGE.md     「自 1.2.0 起改用 MIT（此前的版本是 AGPL-3.0）」
README.md         「关于协议的变更」说明段
```

**没有一处把当前协议写成 AGPL 的表述残留。** 剩下这些是刻意保留的历史/合规说明。
`package-lock.json` 里那处 `"license": "AGPL-3.0-only"`（六处中的最后一处，容易漏）已改成 `"MIT"`。
搜 `BSD`/`GPL` 命中的是 numpy 与 torch 的第三方协议名和上述变更说明，
`THIRD_PARTY_NOTICES.md` 的 **8 条**第三方说明（odiff-bin / express / multer /
opencv-python / Pillow / numpy / DexiNed / torch）**一条没删，全部保持准确**；
硬编码的 `D:\DIFF\third_party\...` 已改成相对路径 `third_party\DexiNed\...`。

---

## [1.0.0]

首个公开版本：DiffEye 视觉复核台，Node + Python 双栈，支持壁画纹样比对与像素比对、
自动对齐、三色差异图、聚焦区域、三栏局部审查、人工标记与报告导出。
使用 AGPL-3.0 发布。
