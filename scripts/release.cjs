#!/usr/bin/env node
/**
 * release.cjs - 打包前端 + 后端为 zip 发布产物
 *
 * 用法:
 *   npm run release              # 默认 x86 (linux/amd64)
 *   npm run release -- --arch=arm   # ARM (linux/arm64)
 *
 * 产物:
 *   release/computenook.zip
 *
 * zip 内部结构:
 *   hpc-platform-v0.1/
 *   ├── hpc-backend       # 后端（含文件管理）
 *   ├── static/           # 前端静态文件
 *   ├── .env.example      # 配置示例
 *   ├── nginx.conf        # nginx 配置
 *   └── install.sh        # 安装脚本
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

// ── 解析参数 ──────────────────────────────────────────────
const args = process.argv.slice(2)
const archArg = args.find(a => a.startsWith('--arch='))
const archInput = archArg ? archArg.split('=')[1].toLowerCase() : 'x86'

const ARCH_MAP = {
  x86:   { GOARCH: 'amd64', GOOS: 'linux', label: 'linux-amd64' },
  amd64: { GOARCH: 'amd64', GOOS: 'linux', label: 'linux-amd64' },
  arm:   { GOARCH: 'arm64', GOOS: 'linux', label: 'linux-arm64' },
  arm64: { GOARCH: 'arm64', GOOS: 'linux', label: 'linux-arm64' },
}

const target = ARCH_MAP[archInput]
if (!target) {
  console.error(`❌ 不支持的架构: ${archInput}，可选: x86, arm`)
  process.exit(1)
}

// ── 常量 ──────────────────────────────────────────────────
const VERSION = 'v0.1'
const ROOT = path.resolve(__dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')
const PKG_NAME = `computenook-${VERSION}-${target.label}`
const STAGE_DIR = path.join(RELEASE_DIR, PKG_NAME)
const ZIP_PATH = path.join(RELEASE_DIR, 'computenook.zip')

// ── 工具函数 ──────────────────────────────────────────────
function run(cmd, cwd = ROOT, env = {}) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d)
  }
}

function zipDir(sourceDir, zipPath, innerFolder) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, innerFolder)
    archive.finalize()
  })
}

// ── 主流程 ────────────────────────────────────────────────
;(async () => {
  console.log(`\n🚀 开始构建 ${PKG_NAME}`)
  console.log(`   架构: ${target.GOOS}/${target.GOARCH}`)

  // 1. 清理
  console.log('\n📦 清理旧产物...')
  if (fs.existsSync(STAGE_DIR)) fs.rmSync(STAGE_DIR, { recursive: true, force: true })
  if (fs.existsSync(ZIP_PATH)) fs.rmSync(ZIP_PATH)
  fs.mkdirSync(STAGE_DIR, { recursive: true })

  // 2. 构建前端
  console.log('\n🎨 构建前端...')
  run('npm run build')

  // 3. 构建后端
  console.log('\n🔧 构建后端 (computenook)...')
  const backendOut = path.join(STAGE_DIR, 'computenook')
  run(
    `go build -o "${backendOut}" .`,
    path.join(ROOT, 'backend'),
    { GOOS: target.GOOS, GOARCH: target.GOARCH, CGO_ENABLED: '0' }
  )

  // 3.5 构建客户端（三平台）
  console.log('\n🖥️  构建 hpc-client（Linux / Windows / macOS）...')
  const clientSrc = path.join(ROOT, 'backend', 'tools', 'rdp-tunnel')
  const clientsDir = path.join(STAGE_DIR, 'clients')
  // 同时写到后端 clients/ 目录，供 /download 接口提供下载
  const backendClientsDir = path.join(ROOT, 'backend', 'clients')
  fs.mkdirSync(clientsDir, { recursive: true })
  fs.mkdirSync(backendClientsDir, { recursive: true })

  const clientTargets = [
    { GOOS: 'linux',   GOARCH: 'amd64', out: 'hpc-client-linux'       },
    { GOOS: 'windows', GOARCH: 'amd64', out: 'hpc-client-windows.exe' },
    { GOOS: 'darwin',  GOARCH: 'amd64', out: 'hpc-client-mac-amd64'   },
    { GOOS: 'darwin',  GOARCH: 'arm64', out: 'hpc-client-mac-arm64'   },
  ]

  // 先 go mod tidy
  run('go mod tidy', clientSrc)

  for (const ct of clientTargets) {
    const outPath = path.join(clientsDir, ct.out)
    console.log(`   → ${ct.GOOS}/${ct.GOARCH}: ${ct.out}`)
    // Windows 加 -H windowsgui 避免弹出 cmd 窗口
    const ldflags = ct.GOOS === 'windows'
      ? '"-s -w -H windowsgui"'
      : '"-s -w"'
    run(
      `go build -ldflags=${ldflags} -o "${outPath}" .`,
      clientSrc,
      { GOOS: ct.GOOS, GOARCH: ct.GOARCH, CGO_ENABLED: '0' }
    )
    // 同步到 backend/clients/
    fs.copyFileSync(outPath, path.join(backendClientsDir, ct.out))
  }

  // macOS universal binary: 合并 amd64 + arm64（仅 macOS 上有 lipo 工具）
  console.log('\n🍎 处理 macOS binary...')
  const macAmd64 = path.join(clientsDir, 'hpc-client-mac-amd64')
  const macArm64 = path.join(clientsDir, 'hpc-client-mac-arm64')
  const macUniversal = path.join(clientsDir, 'hpc-client-mac')
  if (fs.existsSync(macAmd64) && fs.existsSync(macArm64)) {
    if (process.platform === 'darwin') {
      run(`lipo -create -output "${macUniversal}" "${macAmd64}" "${macArm64}"`)
      fs.unlinkSync(macAmd64)
      fs.unlinkSync(macArm64)
      fs.copyFileSync(macUniversal, path.join(backendClientsDir, 'hpc-client-mac'))
      console.log('   → hpc-client-mac (universal)')
    } else {
      // 非 macOS 平台没有 lipo，保留两个单架构文件
      fs.copyFileSync(macAmd64, path.join(backendClientsDir, 'hpc-client-mac-amd64'))
      fs.copyFileSync(macArm64, path.join(backendClientsDir, 'hpc-client-mac-arm64'))
      console.warn('   ⚠ 非 macOS 平台，跳过 lipo 合并，保留 hpc-client-mac-amd64 / hpc-client-mac-arm64')
    }
  } else {
    console.warn('   ⚠ macOS 编译产物不完整，跳过')
  }

  // 4. 复制前端产物
  console.log('\n📁 复制前端产物...')
  copyDir(path.join(ROOT, 'dist'), path.join(STAGE_DIR, 'static'))

  // 4.5 复制 noVNC 到 static/novnc（供后端提供 VNC 网页客户端）
  console.log('\n🖥️  复制 noVNC...')
  const novncSrc = path.join(ROOT, 'node_modules', '@novnc', 'novnc')
  const novncDst = path.join(STAGE_DIR, 'static', 'novnc')
  if (fs.existsSync(novncSrc)) {
    copyDir(novncSrc, novncDst)
    console.log('   → noVNC copied to static/novnc')
  } else {
    console.warn('   ⚠ noVNC not found in node_modules, skipping')
  }

  // 5. 复制配置文件
  console.log('\n⚙️  复制配置文件...')
  const envExampleSrc = path.join(ROOT, '.env.example')
  const envSrc = path.join(ROOT, '.env')
  const writeCleaned = (src, dest) => {
    let content = fs.readFileSync(src, 'utf8')
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
    content = content.replace(/\r\n/g, '\n')
    fs.writeFileSync(dest, content, { encoding: 'utf8' })
  }
  if (fs.existsSync(envExampleSrc)) {
    writeCleaned(envExampleSrc, path.join(STAGE_DIR, '.env.example'))
    console.log('   → .env.example copied')
  } else if (fs.existsSync(envSrc)) {
    writeCleaned(envSrc, path.join(STAGE_DIR, '.env.example'))
    console.log('   → .env copied as .env.example')
  } else {
    console.warn('   ⚠ .env.example not found, skipping')
  }

  // 复制 app-templates.toml
  const appTemplatesSrc = path.join(ROOT, 'backend', 'app-templates.toml')
  if (fs.existsSync(appTemplatesSrc)) {
    fs.copyFileSync(appTemplatesSrc, path.join(STAGE_DIR, 'app-templates.toml'))
    console.log('   → app-templates.toml copied')
  } else {
    console.warn('   ⚠ app-templates.toml not found, skipping')
  }

  // 6. 复制安装脚本
  console.log('\n📝 复制安装脚本...')
  const copyScript = (name) => {
    const src = path.join(ROOT, 'scripts', name)
    if (!fs.existsSync(src)) return
    let content = fs.readFileSync(src, 'utf8')
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)
    content = content.replace(/\r\n/g, '\n')
    const dest = path.join(STAGE_DIR, name)
    fs.writeFileSync(dest, content, { encoding: 'utf8', flag: 'w' })
    fs.chmodSync(dest, 0o755)
    console.log(`   → ${name} copied`)
  }
  copyScript('install.sh')
  copyScript('init_ldap.sh')
  const nginxSrc = path.join(ROOT, 'scripts', 'nginx.conf')
  if (fs.existsSync(nginxSrc)) fs.copyFileSync(nginxSrc, path.join(STAGE_DIR, 'nginx.conf'))

  // 7. 打包 zip
  console.log(`\n🗜️  打包 zip: ${ZIP_PATH}`)
  await zipDir(STAGE_DIR, ZIP_PATH, PKG_NAME)

  // 8. 清理 stage 目录
  fs.rmSync(STAGE_DIR, { recursive: true, force: true })

  const zipSize = (fs.statSync(ZIP_PATH).size / 1024 / 1024).toFixed(2)
  console.log(`\n✅ 构建完成!`)
  console.log(`   ${path.basename(ZIP_PATH)}  (${zipSize} MB)`)
  console.log(`   客户端已同步到 backend/clients/（供 /download 接口提供下载）`)
  console.log(`\n使用方法:`)
  console.log(`  unzip ${PKG_NAME}.zip`)
  console.log(`  cd ${PKG_NAME}`)
  console.log(`  sudo ./install.sh`)
})()
