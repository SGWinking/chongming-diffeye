const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const express = require("express");
const multer = require("multer");
const { compare } = require("odiff-bin");

const pkg = require("./package.json");

/* ------------------------------------------------------------------ 系列常量
   大云壁画工具箱 · 重明 DiffEye
   版本号唯一来源：package.json 的 "version"（SERIES-SPEC §3）。 */

const SERIES_NAME = "大云壁画工具箱";
const TOOL_ID = "diffeye";
const TOOL_CN = "重明";
const TOOL_EN = "DiffEye";
const APP_VERSION = pkg.version;
const HOST = "127.0.0.1";           // S7：只监听本机回环，不再绑 0.0.0.0

const MAX_UPLOAD_MB = 120;

const app = express();
const port = Number(process.env.PORT || 5055);
const rootDir = __dirname;
const runsDir = path.join(rootDir, "runs");
const historyPath = path.join(rootDir, "image-history.json");

const bundledPython = path.join(rootDir, "runtime", "python", "python.exe");
const pythonPath = process.env.PYTHON310
  || process.env.PYTHON
  || (fs.existsSync(bundledPython) ? bundledPython : "python");

/* 运行目录保留天数。
 *
 * 注意这里没有用 `Number(process.env.X || 7)`：那样写的话环境变量设成 "0"
 * 会被当成假值而回退成 7，用户以为关掉了清理、其实没关。
 * 现在 0 或负数 = 明确关掉自动清理（不会删任何东西）。
 *
 * 为什么需要这个开关：cleanupOldRuns() 在服务**每次启动**时都会跑。
 * 如果你把一个备份目录里的 server.js 启动起来做实验，它会把这个备份的
 * runs/ 一起清掉 —— 备份就废了。要跑备份副本，先设 RUNS_MAX_AGE_DAYS=0。 */
const RUNS_RETENTION_RAW = process.env.RUNS_MAX_AGE_DAYS;
const RUNS_MAX_AGE_DAYS = (RUNS_RETENTION_RAW === undefined || RUNS_RETENTION_RAW === "")
  ? 7
  : Number(RUNS_RETENTION_RAW);
const RUNS_CLEANUP_ENABLED = Number.isFinite(RUNS_MAX_AGE_DAYS) && RUNS_MAX_AGE_DAYS > 0;

fs.mkdirSync(runsDir, { recursive: true });

/* ------------------------------------------------------------- 统一错误结构
   SERIES-SPEC §7：{ error: { code, message, field?, detail? } }
   message 是可直接展示给用户的中文。 */

function apiError(res, status, code, message, field, detail) {
  const error = { code, message };
  if (field) error.field = field;
  if (detail) error.detail = String(detail);
  return res.status(status).json({ error });
}

/* ------------------------------------------------------------- CORS / OPTIONS
   S2：只对本机来源回 Access-Control-Allow-Origin，其它来源一个 CORS 头都不发。
   放行名单与 toolkit_core.origin_allowed 保持一致：
     http://127.0.0.1:*  /  http://localhost:*  /  Origin: null */

const ALLOWED_ORIGIN_HOSTS = new Set(["127.0.0.1", "localhost"]);

function originAllowed(origin) {
  if (!origin) return false;
  if (origin === "null") return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && ALLOWED_ORIGIN_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (originAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

// 所有响应都先过一遍 CORS 判定（Origin 不允许时只是不发头）
app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

/* ---------------------------------------------------------------- 运行目录清理 */

function cleanupOldRuns() {
  let entries = [];
  try { entries = fs.readdirSync(runsDir, { withFileTypes: true }); } catch { return 0; }

  if (!RUNS_CLEANUP_ENABLED) {
    console.log(`[cleanup] 已关闭（RUNS_MAX_AGE_DAYS=${RUNS_MAX_AGE_DAYS}），runs/ 里 ${entries.length} 项全部保留。`);
    return 0;
  }

  const cutoff = Date.now() - RUNS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const doomed = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      if (fs.statSync(path.join(runsDir, entry.name)).mtimeMs < cutoff) doomed.push(entry.name);
    } catch {}
  }

  // 先说要删什么，再动手 —— 万一 runs/ 指错了地方，日志里看得见
  if (doomed.length === 0) {
    console.log(`[cleanup] runs/ 里 ${entries.length} 项都在 ${RUNS_MAX_AGE_DAYS} 天内，无需清理。`);
    return 0;
  }
  console.log(`[cleanup] 将清理 ${doomed.length} 个超过 ${RUNS_MAX_AGE_DAYS} 天的运行目录：${doomed.slice(0, 5).join(", ")}${doomed.length > 5 ? " …" : ""}`);

  let removed = 0;
  for (const name of doomed) {
    try {
      fs.rmSync(path.join(runsDir, name), { recursive: true, force: true });
      removed += 1;
    } catch {}
  }
  console.log(`[cleanup] 已清理 ${removed} 个运行目录。想保留请设 RUNS_MAX_AGE_DAYS=0 再启动。`);
  return removed;
}

cleanupOldRuns();

/* ------------------------------------------------------------------ 上传管线
   S4：单张上限 120MB，仅 image/*，文件名清洗。这一段沿用原有实现，未改判定逻辑。 */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const runId = req.runId || crypto.randomUUID();
    req.runId = runId;
    const dir = path.join(runsDir, runId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_");
    const prefix = file.fieldname === "base" ? "base" : "compare";
    cb(null, `${prefix}-${safeName}`);
  }
});

const NOT_AN_IMAGE = "只能上传图片文件。";

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error(NOT_AN_IMAGE));
      return;
    }
    cb(null, true);
  }
});

function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(historyPath, "utf8"));
  } catch {
    return [];
  }
}

function writeHistory(items) {
  fs.writeFileSync(historyPath, JSON.stringify(items.slice(0, 160), null, 2), "utf8");
}

function isInsideRuns(filePath) {
  const relative = path.relative(runsDir, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function urlForStoredPath(filePath) {
  const relative = path.relative(runsDir, filePath).split(path.sep).join("/");
  return `/runs/${relative}`;
}

function addToHistory(files) {
  const existing = readHistory();
  const now = new Date().toISOString();
  const next = [];

  for (const file of files) {
    if (!file?.path || !fs.existsSync(file.path) || !isInsideRuns(file.path)) continue;
    next.push({
      id: crypto.randomUUID(),
      name: file.originalname || path.basename(file.path),
      storedName: path.basename(file.path),
      path: file.path,
      url: urlForStoredPath(file.path),
      addedAt: now
    });
  }

  const seen = new Set(next.map((item) => item.path));
  for (const item of existing) {
    if (!item.path || seen.has(item.path) || !fs.existsSync(item.path) || !isInsideRuns(item.path)) continue;
    seen.add(item.path);
    next.push(item);
  }

  writeHistory(next);
}

function resolveHistoryPath(value) {
  if (!value) return null;
  const fullPath = path.resolve(value);
  if (!isInsideRuns(fullPath) || !fs.existsSync(fullPath)) return null;
  return fullPath;
}

function detectImageExtension(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return ".webp";
    if (
      (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
    ) {
      return ".tiff";
    }
    return path.extname(filePath).toLowerCase();
  } finally {
    fs.closeSync(fd);
  }
}

function normalizeImageExtension(file) {
  const actualExt = detectImageExtension(file.path);
  const currentExt = path.extname(file.path);
  if (!actualExt || actualExt === currentExt.toLowerCase()) return file;

  const nextPath = path.join(
    path.dirname(file.path),
    `${path.basename(file.path, currentExt)}${actualExt}`
  );
  fs.renameSync(file.path, nextPath);
  file.path = nextPath;
  file.filename = path.basename(nextPath);
  return file;
}

/* 数值参数夹取。上下界与改造前完全一致，只补一个 NaN/Infinity 兜底：
   Number("abc") 是 NaN，而 Math.max(1, Math.min(95, NaN)) 还是 NaN，
   再 String(NaN) 传给 Python 就会变成 int('NaN') → 500。
   非数字输入现在退回默认值，而不是把算法层炸掉。 */
function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  const base = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, base));
}

/* Python 引擎失败时 stderr 里是一整段 traceback。直接把 stderr 当 message 返回，
   用户会看到一屏 Python 栈和本机绝对路径。这里只取最后一行异常信息当人话提示，
   完整 traceback 留给 detail 供排查。 */
function pythonErrorMessage(stderr, stdout, fallback) {
  const raw = String(stderr || stdout || "").trim();
  if (!raw) return fallback;
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || "";
  const friendly = last.replace(/^\w*(?:Error|Exception|Exit|Interrupt|Warning):\s*/, "").trim();
  return friendly || last || fallback;
}

function runMuralCompareOnce(
  basePath,
  comparePath,
  outDir,
  sensitivity,
  minArea,
  maxRegions,
  edgeMethod,
  maxAreaPercent,
  tolerancePixels,
  enableAlign
) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(rootDir, "mural_compare.py");
    execFile(
      pythonPath,
      [
        scriptPath,
        basePath,
        comparePath,
        outDir,
        String(sensitivity),
        String(minArea),
        String(maxRegions),
        edgeMethod,
        String(maxAreaPercent),
        String(tolerancePixels),
        enableAlign ? "1" : "0"
      ],
      {
        cwd: rootDir,
        timeout: 180000,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10,
        // 中文 Windows 上 Python 默认用 cp936 写 stderr，Node 按 UTF-8 解码就会得到
        // 一串 U+FFFD 乱码 ——「宽高比例不一致」这类中文提示会整个烂掉。
        // 强制子进程 stdio 走 UTF-8，和 Node 的解码方式对齐。
        env: { ...process.env, PYTHONIOENCODING: "utf-8" }
      },
      (error, stdout, stderr) => {
        if (error) {
          const friendly = pythonErrorMessage(stderr, stdout, error.message);
          const wrapped = new Error(friendly);
          wrapped.pythonTrace = String(stderr || stdout || "").trim().slice(0, 4000);
          reject(wrapped);
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error(`纹样比对结果解析失败：${stdout || stderr}`));
        }
      }
    );
  });
}

function isDexinedAvailable() {
  const modelPy = path.join(rootDir, "third_party", "DexiNed", "model.py");
  const checkpoint = path.join(rootDir, "third_party", "DexiNed", "checkpoints", "BIPED", "10", "10_model.pth");
  return fs.existsSync(modelPy) && fs.existsSync(checkpoint);
}

async function runMuralCompare(
  basePath,
  comparePath,
  outDir,
  sensitivity,
  minArea,
  maxRegions,
  edgeMethod,
  maxAreaPercent,
  tolerancePixels,
  enableAlign
) {
  if (edgeMethod === "dexined" && !isDexinedAvailable()) {
    throw new Error("DexiNed 不可用：缺少 model.py 或模型权重 10_model.pth。请检查 third_party/DexiNed/ 目录。");
  }
  return runMuralCompareOnce(
    basePath, comparePath, outDir, sensitivity, minArea, maxRegions,
    edgeMethod, maxAreaPercent, tolerancePixels, enableAlign
  );
}

/* ------------------------------------------------------------------ 静态资源
   S6：express.static 本身是流式（send）传输，不存在 readFileSync 整份塞响应。 */

app.use(express.static(path.join(rootDir, "public")));
app.use("/runs", express.static(runsDir));

/* ---------------------------------------------------------------- 健康检查 */

function healthPayload() {
  const address = server && server.address();
  const actualPort = address && typeof address === "object" ? address.port : port;
  return {
    ok: true,
    status: "ok",
    series: SERIES_NAME,
    tool: TOOL_ID,
    version: APP_VERSION,
    port: actualPort,
    name: TOOL_CN,
    nameEn: TOOL_EN,
    runsCleanupEnabled: RUNS_CLEANUP_ENABLED,
    runsMaxAgeDays: RUNS_MAX_AGE_DAYS,
    host: HOST,
    address: `http://${HOST}:${actualPort}`,
    // 以下三个字段沿用重明原有语义，工具箱启动台与前端仍可使用
    python: fs.existsSync(pythonPath) ? pythonPath : "system",
    bundledPython: fs.existsSync(bundledPython),
    dexinedAvailable: isDexinedAvailable(),
    uptime: process.uptime(),
    maxUploadMB: MAX_UPLOAD_MB
  };
}

const sendHealth = (req, res) => res.json(healthPayload());

app.get("/api/health", sendHealth);
app.get("/health", sendHealth);   // 工具箱启动台按 /health 探活，保留

/* ------------------------------------------------------------------ 历史记录 */

app.get("/history", (req, res) => {
  const raw = readHistory();
  const items = raw.filter((item) => item.path && fs.existsSync(item.path) && isInsideRuns(item.path));
  if (items.length !== raw.length) writeHistory(items);
  res.json({ items });
});

app.delete("/history", (req, res) => {
  let deletedRuns = 0;
  try {
    const entries = fs.readdirSync(runsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      fs.rmSync(path.join(runsDir, entry.name), { recursive: true, force: true });
      deletedRuns += 1;
    }
  } catch {}
  writeHistory([]);
  res.json({ ok: true, deletedRuns });
});

/* -------------------------------------------------------------------- 比对 */

app.post(
  "/compare",
  upload.fields([
    { name: "base", maxCount: 1 },
    { name: "compare", maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const uploadedBase = req.files?.base?.[0];
      const uploadedTarget = req.files?.compare?.[0];
      const baseHistoryPath = resolveHistoryPath(req.body.baseHistoryPath);
      const compareHistoryPath = resolveHistoryPath(req.body.compareHistoryPath);

      const base = uploadedBase || (baseHistoryPath ? { path: baseHistoryPath, originalname: path.basename(baseHistoryPath) } : null);
      const target = uploadedTarget || (compareHistoryPath ? { path: compareHistoryPath, originalname: path.basename(compareHistoryPath) } : null);

      if (!base || !target) {
        apiError(res, 400, "MISSING_IMAGES", "请同时选择两张图片，或者从历史记录里选择。");
        return;
      }

      if (uploadedBase) normalizeImageExtension(base);
      if (uploadedTarget) normalizeImageExtension(target);
      addToHistory([base, target]);

      const runId = req.runId || crypto.randomUUID();
      const runDir = path.join(runsDir, runId);
      fs.mkdirSync(runDir, { recursive: true });

      const mode = req.body.mode === "pixel" ? "pixel" : "mural";
      const baseUrl = urlForStoredPath(base.path);
      const compareUrl = urlForStoredPath(target.path);

      if (mode === "mural") {
        // S5：所有数值参数都在服务端 clamp，越界不会穿透到算法层
        const sensitivity = clampNumber(req.body.sensitivity || 5, 1, 10, 5);
        const minArea = clampNumber(req.body.minArea || 2048, 40, 5000, 2048);
        const maxRegions = clampNumber(req.body.maxRegions || 120, 20, 300, 120);
        const edgeMethod = req.body.edgeMethod === "dexined" ? "dexined" : "canny";
        const maxAreaPercent = clampNumber(req.body.maxAreaPercent || 60, 1, 95, 60);
        const tolerancePixels = clampNumber(req.body.tolerancePixels || 10, 1, 30, 10);
        const enableAlign = req.body.enableAlign !== "0";
        const result = await runMuralCompare(
          base.path,
          target.path,
          runDir,
          sensitivity,
          minArea,
          maxRegions,
          edgeMethod,
          maxAreaPercent,
          tolerancePixels,
          enableAlign
        );

        res.json({
          mode,
          ...result,
          baseUrl,
          processedBaseUrl: `/runs/${runId}/${result.outputs.base}`,
          compareUrl,
          diffUrl: `/runs/${runId}/${result.outputs.overlay}`,
          diffBaseUrl: `/runs/${runId}/${result.outputs.overlayBase}`,
          diffLayers: {
            new: `/runs/${runId}/${result.outputs.layerNew}`,
            missing: `/runs/${runId}/${result.outputs.layerMissing}`,
            shifted: `/runs/${runId}/${result.outputs.layerShifted}`
          },
          maskUrl: `/runs/${runId}/${result.outputs.mask}`,
          edgesUrl: `/runs/${runId}/${result.outputs.edges}`,
          alignedCompareUrl: `/runs/${runId}/${result.outputs.alignedCompare}`,
          regions: result.regions.map((region) => ({
            ...region,
            cropUrl: `/runs/${runId}/${region.cropUrl}`
          }))
        });
        return;
      }

      const diffPath = path.join(runDir, "diff.png");
      const result = await compare(base.path, target.path, diffPath, {
        antialiasing: true,
        diffOverlay: true
      });

      res.json({
        mode,
        ...result,
        baseUrl,
        processedBaseUrl: baseUrl,
        compareUrl,
        alignedCompareUrl: compareUrl,
        diffUrl: fs.existsSync(diffPath) ? `/runs/${runId}/diff.png` : null,
        regions: []
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ------------------------------------------------------------------ 错误出口 */

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  // S4：上传超限与非图片文件给明确的中文提示和正确的状态码
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      apiError(res, 413, "UPLOAD_TOO_LARGE",
        `单张图片不能超过 ${MAX_UPLOAD_MB} MB，请先压缩或裁切后再上传。`,
        error.field, error.code);
      return;
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      apiError(res, 400, "UNEXPECTED_FIELD",
        "上传字段不正确：只接受 base 与 compare 两个图片字段。",
        error.field, error.code);
      return;
    }
    apiError(res, 400, "UPLOAD_ERROR", `上传失败：${error.message}`, error.field, error.code);
    return;
  }

  if (error?.message === NOT_AN_IMAGE) {
    apiError(res, 400, "NOT_AN_IMAGE", NOT_AN_IMAGE, "base/compare", "mimetype is not image/*");
    return;
  }

  console.error(error);
  if (error?.pythonTrace) console.error(error.pythonTrace);
  apiError(res, 500, "COMPARE_FAILED", error?.message || "比较失败。", null, error?.pythonTrace);
});

/* -------------------------------------------------------------------- 启动 */

const server = app.listen(port, HOST, () => {
  const address = server.address();
  const actualPort = address && typeof address === "object" ? address.port : port;
  console.log("=".repeat(44));
  console.log(`  ${SERIES_NAME} · ${TOOL_CN} ${TOOL_EN} v${APP_VERSION}`);
  console.log("=".repeat(44));
  console.log(`  监听：http://${HOST}:${actualPort}  （仅本机可访问）`);
  console.log(`  Python: ${pythonPath}`);
  console.log(RUNS_CLEANUP_ENABLED
    ? `  runs/ 自动清理：超过 ${RUNS_MAX_AGE_DAYS} 天的会删（要保留请设 RUNS_MAX_AGE_DAYS=0）`
    : `  runs/ 自动清理：已关闭，不会删除任何内容`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${port} 已被占用，无法启动。`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n[${signal}] shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
