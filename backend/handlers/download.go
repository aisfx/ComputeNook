package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// GET /download  客户端下载页面（公开）
func DownloadPage(c *gin.Context) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, downloadHTML)
}

// GET /api/download/:file  下载具体文件（需认证）
func DownloadClient(c *gin.Context) {
	file := c.Param("file")
	base := os.Getenv("CLIENT_DIST_DIR")
	if base == "" {
		// 优先用可执行文件同级目录下的 clients/，兼容任意工作目录
		exe, err := os.Executable()
		if err == nil {
			base = filepath.Join(filepath.Dir(exe), "clients")
		} else {
			base = "clients"
		}
	}
	fpath := filepath.Join(base, filepath.Base(file))
	if _, err := os.Stat(fpath); os.IsNotExist(err) {
		// fallback：尝试当前工作目录下的 clients/
		fpath = filepath.Join("clients", filepath.Base(file))
		if _, err2 := os.Stat(fpath); os.IsNotExist(err2) {
			c.JSON(http.StatusNotFound, gin.H{"error": "客户端文件尚未生成，请联系管理员运行 npm run release 编译客户端，默认输出目录：/opt/hpc-platform/clients"})
			return
		}
	}
	c.FileAttachment(fpath, filepath.Base(file))
}

const downloadHTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HPC 客户端下载</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:860px;margin:60px auto;padding:0 20px;color:#333}
  h1{font-size:28px;margin-bottom:8px}.subtitle{color:#666;margin-bottom:32px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-bottom:40px}
  .card{border:1px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center}
  .card .icon{font-size:44px;margin-bottom:10px}.card h3{margin:0 0 6px;font-size:17px}
  .card p{color:#666;font-size:13px;margin:0 0 16px}
  .btn{display:inline-block;padding:9px 22px;background:#6366f1;color:#fff;border-radius:8px;font-size:14px;cursor:pointer;border:none;margin:3px}
  .btn:hover{background:#4f46e5}.btn:disabled{background:#a5b4fc;cursor:not-allowed}
  .steps{background:#f9fafb;border-radius:12px;padding:24px;margin-bottom:24px}
  .steps h2{margin-top:0;font-size:18px}
  .step{display:flex;gap:14px;margin-bottom:16px;align-items:flex-start}
  .step-num{background:#6366f1;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
  .step-body{flex:1}.step-body strong{display:block;margin-bottom:4px}
  .step-body p{margin:0;color:#555;font-size:13px}
  pre{background:#1e1e1e;color:#d4d4d4;padding:12px 16px;border-radius:8px;font-size:13px;overflow-x:auto;margin:8px 0}
  .auth-tip{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:14px}
  .auth-tip a{color:#6366f1}
  .detected{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:10px 16px;margin-bottom:20px;font-size:14px}
</style>
</head>
<body>
  <h1>HPC 平台客户端</h1>
  <p class="subtitle">支持 RDP 远程桌面 + SSH 隧道，安装后网页一键连接</p>
  <div id="auth-tip" class="auth-tip" style="display:none">
    ⚠️ 下载需要登录平台。<a href="/">点击登录</a>，登录后返回此页面即可下载。
  </div>
  <div id="detected" class="detected" style="display:none"></div>
  <div class="cards" id="cards"></div>
  <div class="steps">
    <h2>安装步骤</h2>
    <div class="step"><div class="step-num">1</div><div class="step-body"><strong>下载客户端</strong><p>根据你的操作系统点击上方下载按钮</p></div></div>
    <div class="step"><div class="step-num">2</div><div class="step-body"><strong>运行安装命令（注册 hpcc:// 协议）</strong><div id="install-cmd"></div></div></div>
    <div class="step"><div class="step-num">3</div><div class="step-body"><strong>回到平台，点击"连接"按钮</strong><p>浏览器弹出确认框，允许后客户端自动启动并建立隧道，无需手动输入任何参数</p></div></div>
  </div>
<script>
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) document.getElementById('auth-tip').style.display = 'block';

  const ua = navigator.userAgent;
  let os = 'linux';
  if (ua.includes('Windows')) os = 'windows';
  else if (ua.includes('Mac')) os = 'darwin';

  const files = {
    windows:{name:'hpc-client-windows.exe',icon:'🪟',label:'Windows',desc:'Windows 10/11 x64',   disabled:false},
    darwin: {name:'hpc-client-mac',         icon:'🍎',label:'macOS',  desc:'Intel / Apple Silicon',disabled:true},
    linux:  {name:'hpc-client-linux',        icon:'🐧',label:'Linux',  desc:'x86_64',              disabled:true},
  };
  const installCmds = {
    windows:'<pre># 以管理员身份运行 PowerShell\n.\\hpc-client-windows.exe install</pre>',
    darwin: '<pre>chmod +x hpc-client-mac && ./hpc-client-mac install</pre>',
    linux:  '<pre>chmod +x hpc-client-linux && ./hpc-client-linux install</pre>',
  };

  const det = document.getElementById('detected');
  det.style.display = 'none';

  const cards = document.getElementById('cards');
  [os, ...Object.keys(files).filter(k=>k!==os)].forEach(k => {
    const f = files[k], cur = k===os;
    const btnDisabled = f.disabled || !token;
    const btnText = f.disabled ? '暂未开放' : '下载';
    cards.innerHTML += '<div class="card" style="'+(cur&&!f.disabled?'border-color:#6366f1;box-shadow:0 0 0 2px #e0e7ff':'')+(f.disabled?'opacity:0.45;background:#f3f4f6;':'')+'">'+
      '<div class="icon">'+f.icon+'</div>'+
      '<h3>'+f.label+(cur&&!f.disabled?' ⭐':'')+(f.disabled?' 🔜':'')+'</h3>'+
      '<p>'+f.desc+'</p>'+
      '<button class="btn" '+(btnDisabled?'disabled':'')+' onclick="dl(\''+f.name+'\')">'+btnText+'</button></div>';
  });
  document.getElementById('install-cmd').innerHTML = installCmds[os];

  function dl(filename) {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!t) { alert('请先登录平台'); window.location.href='/'; return; }
    fetch('/api/download/'+filename, {headers:{'Authorization':'Bearer '+t}})
      .then(r => {
        if (r.status===401) { alert('登录已过期，请重新登录'); window.location.href='/'; return null; }
        if (!r.ok) { alert('客户端文件尚未生成，请联系管理员运行 npm run release 编译客户端\n默认输出目录：/opt/hpc-platform/clients'); return null; }
        return r.blob();
      }).then(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url; a.download=filename; a.click();
        URL.revokeObjectURL(url);
      });
  }
</script>
</body>
</html>`
