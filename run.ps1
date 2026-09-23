# 大云壁画工具箱 · 重明 DiffEye —— 统一启动脚本
# 规范见 SERIES-SPEC v1.0 §6：定位运行时 → 检查依赖 → 启动 → 健康检查 → 开浏览器
#
# 【重要】本文件必须保存为 UTF-8 **带 BOM**。
#   Windows PowerShell 5.1（run.bat 调用的就是它）在没有 BOM 时
#   会按 GBK 解码 .ps1，中文全部变乱码，而且会直接造成语法错误
#   ——脚本根本跑不起来。改这个文件之后务必确认 BOM 还在。
#
# 【重要】本文件禁止中文弯引号（U+201C / U+201D / U+2018 / U+2019）。
#   PowerShell 把它们当字符串定界符，外层字符串会提前闭合。中文引号一律用直角引号「」。
#
# 由 run.bat 双击调用，也可以直接在 PowerShell 里运行：.\run.ps1
#   .\run.ps1              正常启动，并自动打开浏览器
#   .\run.ps1 -NoBrowser   只起服务、不开浏览器（自动化测试用）

param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# 单独运行本脚本（不经过 run.bat）时也要把控制台切到 UTF-8
try { chcp 65001 | Out-Null } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

$ToolCN = "重明"
$ToolEN = "DiffEye"
$Port = 5055
$AppUrl = "http://127.0.0.1:$Port/"
$HealthUrl = "http://127.0.0.1:$Port/api/health"

# 版本号唯一来源：package.json 的 "version"（SERIES-SPEC §3）。此处绝不硬编码版本。
$Version = "unknown"
try {
    $pkg = Get-Content -LiteralPath (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
    if ($pkg.version) { $Version = $pkg.version }
} catch { }

Write-Host ("=" * 44)
Write-Host ("  大云壁画工具箱 · {0} {1} v{2}" -f $ToolCN, $ToolEN, $Version)
Write-Host ("=" * 44)
Write-Host ("  地址：{0}" -f $AppUrl)
Write-Host "  关闭此窗口即停止工具。"
Write-Host ""

# ---------------------------------------------------------------- [1/4] Node.js
Write-Host "[1/4] 检查 Node.js ... " -NoNewline
$nodeExe = $null
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) { $nodeExe = $nodeCmd.Source }

if (-not $nodeExe) {
    Write-Host "失败"
    Write-Host ""
    Write-Host ("  {0} 需要 Node.js 18 或更高版本，但没有找到 node 命令。" -f $ToolCN)
    Write-Host "  请先安装 Node.js LTS："
    Write-Host "    https://nodejs.org/"
    Write-Host "  安装后重新双击 run.bat。"
    Write-Host ""
    exit 1
}

$nodeVer = ""
try { $nodeVer = (& $nodeExe --version 2>$null | Select-Object -Last 1) } catch { }
if (-not $nodeVer) { $nodeVer = "unknown" }
Write-Host ("OK   Node {0}" -f $nodeVer.Trim())

# ------------------------------------------------- 已经在跑就不再启动第二个
try {
    $existing = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
    if ($existing.StatusCode -eq 200) {
        Write-Host ""
        Write-Host ("  检测到 {0} 已经在运行，直接打开页面。" -f $ToolCN)
        if (-not $NoBrowser) { Start-Process $AppUrl }
        exit 0
    }
} catch { }

# ---------------------------------------------------------------- [2/4] 依赖
Write-Host "[2/4] 检查依赖 ... " -NoNewline

$requiredModules = @("express", "multer", "odiff-bin")
$missingModules = @()
foreach ($module in $requiredModules) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root ("node_modules\" + $module)))) {
        $missingModules += $module
    }
}

if ($missingModules.Count -gt 0) {
    Write-Host "缺少 Node 依赖"
    Write-Host ""
    Write-Host ("  缺少：{0}" -f ($missingModules -join "、"))
    Write-Host "  这是第一次运行，或者 node_modules 被删掉了。"
    Write-Host "  请先双击运行 install.bat（等价于在本目录执行 npm install），"
    Write-Host "  装完再回来双击 run.bat。"
    Write-Host ""
    exit 1
}

# Python 只影响「壁画纹样」比对；「像素差异」模式由 Node 侧的 odiff 完成。
$bundledPython = Join-Path $Root "runtime\python\python.exe"
$pythonExe = $null
$pythonArgs = @()
if (Test-Path -LiteralPath $bundledPython) {
    $pythonExe = $bundledPython
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
    $pythonArgs = @("-3")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = "python"
}

$pythonOk = $false
$pythonVer = ""
if ($pythonExe) {
    try {
        $pythonVer = (& $pythonExe @pythonArgs -c "import sys;print('%d.%d'%sys.version_info[:2])" 2>$null | Select-Object -Last 1)
        & $pythonExe @pythonArgs -c "import cv2, numpy" 2>$null
        if ($LASTEXITCODE -eq 0) { $pythonOk = $true }
    } catch { }
}

Write-Host "OK"
if ($pythonOk) {
    Write-Host ("      Python {0}（opencv-python / numpy 就绪）" -f $pythonVer.Trim())
} else {
    Write-Host "      提醒：没有检测到可用的 Python + opencv-python + numpy。"
    Write-Host "      「壁画纹样」模式会不可用；请运行 install.bat 补齐，"
    Write-Host "      或在系统里执行：py -3 -m pip install -r requirements.txt"
}

# ---------------------------------------------------------------- [3/4] 启动
Write-Host "[3/4] 启动服务 ... " -NoNewline

$proc = Start-Process -FilePath $nodeExe -ArgumentList "server.js" `
    -WorkingDirectory $Root -PassThru -NoNewWindow

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if ($proc.HasExited) { break }
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}

if (-not $ready) {
    Write-Host "失败"
    Write-Host ""
    if ($proc.HasExited) {
        Write-Host ("  服务启动后立刻退出了（退出码 {0}），上面应有具体报错。" -f $proc.ExitCode)
    } else {
        Write-Host ("  等待 30 秒仍未就绪，端口 {0} 可能被别的程序占用。" -f $Port)
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
    exit 1
}
Write-Host "OK"

# ---------------------------------------------------------------- [4/4] 浏览器
if ($NoBrowser) {
    Write-Host "[4/4] 跳过打开浏览器（-NoBrowser）"
} else {
    Write-Host "[4/4] 打开浏览器 ... " -NoNewline
    Start-Process $AppUrl
    Write-Host "OK"
}
Write-Host ""
Write-Host ("  {0} {1} v{2} 正在运行。按 Ctrl+C 或直接关闭本窗口即可停止。" -f $ToolCN, $ToolEN, $Version)
Write-Host "  服务只监听 127.0.0.1，局域网内其它机器访问不到。"
Write-Host ""

try { Wait-Process -Id $proc.Id } catch { }
Write-Host "  服务已停止。"
