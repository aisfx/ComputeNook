#!/usr/bin/env node
/**
 * release.cjs - 打包前端 + 后端为 zip 发布产物
 *
 * 用法:
 *   npm run release              # 默认 x86 (linux/amd64)
 *   npm run release -- --arch=arm   # ARM (linux/arm64)
 *
 * 产物:
 *   release/hpc-platform-v0.1-linux-amd64.zip
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
const PKG_NAME = `hpc-platform-${VERSION}-${target.label}`
const STAGE_DIR = path.join(RELEASE_DIR, PKG_NAME)
const ZIP_PATH = path.join(RELEASE_DIR, `${PKG_NAME}.zip`)

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
  console.log('\n🔧 构建后端 (hpc-backend)...')
  const backendOut = path.join(STAGE_DIR, 'hpc-backend')
  run(
    `go build -o "${backendOut}" .`,
    path.join(ROOT, 'backend'),
    { GOOS: target.GOOS, GOARCH: target.GOARCH, CGO_ENABLED: '0' }
  )

  // 4. 复制前端产物
  console.log('\n📁 复制前端产物...')
  copyDir(path.join(ROOT, 'dist'), path.join(STAGE_DIR, 'static'))

  // 5. 复制配置文件
  console.log('\n⚙️  复制配置文件...')
  const rootEnv = path.join(ROOT, '.env')
  if (fs.existsSync(rootEnv)) fs.copyFileSync(rootEnv, path.join(STAGE_DIR, '.env.example'))

  // 6. 复制 install.sh 和 nginx.conf
  console.log('\n📝 复制安装脚本...')
  const installSrc = path.join(ROOT, 'scripts', 'install.sh')
  if (fs.existsSync(installSrc)) {
    fs.copyFileSync(installSrc, path.join(STAGE_DIR, 'install.sh'))
    fs.chmodSync(path.join(STAGE_DIR, 'install.sh'), 0o755)
  }
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
  console.log(`\n使用方法:`)
  console.log(`  unzip ${PKG_NAME}.zip`)
  console.log(`  cd ${PKG_NAME}`)
  console.log(`  sudo ./install.sh`)
})()
