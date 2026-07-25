# ArkTS UI Visualizer 启动脚本
# 双击 start.bat 运行，或直接在 PowerShell 中运行：powershell -ExecutionPolicy Bypass -File start.ps1

# 切到 UTF-8 控制台，避免中文乱码
try { chcp 65001 > $null } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$appDir = Join-Path $root 'app'

Write-Host ''
Write-Host '================================' -ForegroundColor Cyan
Write-Host '  ArkTS 可视化编辑器 Pro 启动中' -ForegroundColor Cyan
Write-Host '================================' -ForegroundColor Cyan
Write-Host ''

# 1. 检查 Node.js
try {
    $nodeVer = node --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'node not found' }
    Write-Host "[OK] Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host '[FAIL] 未检测到 Node.js，请先安装: https://nodejs.org' -ForegroundColor Red
    Read-Host '按回车退出'
    exit 1
}

# 2. 检查 app 目录
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'package.json'))) {
    Write-Host "[FAIL] 未找到 app\package.json" -ForegroundColor Red
    Write-Host "请确认脚本位于项目根目录（与 app\ 同级）" -ForegroundColor Gray
    Read-Host '按回车退出'
    exit 1
}

# 3. 检查依赖
$nm = Join-Path $appDir 'node_modules'
if (-not (Test-Path -LiteralPath $nm)) {
    Write-Host '[INFO] 首次运行，正在安装依赖 (npm install)...' -ForegroundColor Yellow
    Push-Location $appDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
    } finally {
        Pop-Location
    }
    Write-Host '[OK] 依赖安装完成' -ForegroundColor Green
} else {
    Write-Host '[OK] 依赖已就绪' -ForegroundColor Green
}

# 4. 启动开发服务器
Write-Host ''
Write-Host '[INFO] 启动 Vite 开发服务器...' -ForegroundColor Yellow
Write-Host '      默认地址: http://localhost:5173' -ForegroundColor Gray
Write-Host '      按 Ctrl+C 停止' -ForegroundColor Gray
Write-Host ''

Push-Location $appDir
try {
    npm run dev
} finally {
    Pop-Location
}
