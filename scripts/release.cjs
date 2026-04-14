#!/usr/bin/env node
/**
 * release.cjs - 打包前后端为一个发布产物
 *
 * 产物结构:
 *   release/
 *   ├── hpc-backend        # Go 编译的二进制
 *   ├── static/            # 前端构建产物 (dist/)
 *   ├── .env.example       # 环境变量示例
 *   └── start.sh           # 一键启动脚本
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')

function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

// 1. 清理旧的 release 目录
console.log('\n📦 清理旧的 release 目录...')
if (fs.existsSync(RELEASE_DIR)) {
  fs.rmSync(RELEASE_DIR, { recursive: true, force: true })
}
fs.mkdirSync(RELEASE_DIR, { recursive: true })

// 2. 构建前端
console.log('\n🎨 构建前端...')
run('npm run build')

// 3. 构建后端
console.log('\n🔧 构建后端...')
run('go build -o ../release/hpc-backend main.go', path.join(ROOT, 'backend'))

// 4. 复制前端产物到 release/static
console.log('\n📁 复制前端产物...')
copyDir(path.join(ROOT, 'dist'), path.join(RELEASE_DIR, 'static'))

// 5. 复制配置文件
console.log('\n⚙️  复制配置文件...')
const envExample = path.join(ROOT, 'backend', '.env')
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, path.join(RELEASE_DIR, '.env.example'))
}

// 6. 生成启动脚本
console.log('\n📝 生成启动脚本...')
const startScript = `#!/bin/bash
# HPC Platform 启动脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 加载环境变量
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

echo "🚀 启动 HPC Platform..."
echo "   后端监听: http://0.0.0.0:\${PORT:-8080}"
echo "   前端静态文件: $SCRIPT_DIR/static"

exec "$SCRIPT_DIR/hpc-backend"
`
fs.writeFileSync(path.join(RELEASE_DIR, 'start.sh'), startScript, { mode: 0o755 })

// 7. 打印结果
console.log('\n✅ Release 构建完成!')
console.log(`   输出目录: ${RELEASE_DIR}`)
console.log('   文件列表:')
for (const f of fs.readdirSync(RELEASE_DIR)) {
  const stat = fs.statSync(path.join(RELEASE_DIR, f))
  const size = stat.isDirectory() ? '(dir)' : `${(stat.size / 1024).toFixed(1)}KB`
  console.log(`     ${f.padEnd(20)} ${size}`)
}
console.log('\n使用方法:')
console.log('  cd release')
console.log('  cp .env.example .env  # 编辑配置')
console.log('  ./start.sh')
