# 前端开发指南

## 首次设置

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

浏览器访问 http://localhost:3000

## 项目状态

### 已完成的页面

#### 登录和认证
- ✅ 登录页面 (`/login`)
- ✅ MFA 设置页面 (`/mfa-setup`)
- ✅ 强制修改密码页面 (`/force-change-password`)

#### 用户端页面 (`/dashboard/*`)
- ✅ 仪表盘 (`/dashboard`)
- ✅ 作业管理 (`/dashboard/jobs`)
- ✅ Web Shell (`/dashboard/webshell`)
- ✅ 远程桌面 (`/dashboard/desktop`)
- ✅ 文件管理 (`/dashboard/files`)
- ✅ 集群监控 (`/dashboard/monitoring`)
- ✅ AI 助手 (`/dashboard/ai`)
- ✅ 个人信息 (`/dashboard/profile`)
- ✅ 客户端下载 (`/dashboard/download`)

#### 管理员页面 (`/admin/*`)
- ✅ 总览 (`/admin/overview`)
- ✅ 用户管理 (`/admin/users`)
- ✅ 用户组管理 (`/admin/groups`)
- ✅ Slurm 账户 (`/admin/slurm-accounts`)
- ✅ Slurm 用户 (`/admin/slurm-users`)
- ✅ QoS 管理 (`/admin/qos`)
- ✅ 资源绑定 (`/admin/associations`)
- ✅ 分区管理 (`/admin/partitions`)
- ✅ 机时管理 (`/admin/billing`)
- ✅ 存储配额 (`/admin/quota`)
- ✅ 审计日志 (`/admin/audit`)

### 待安装的依赖

在构建前需要安装以下额外依赖：

```bash
npm install xterm xterm-addon-fit
```

这些包用于 Web Shell 终端功能。

## 构建生产版本

### 完整构建流程

```bash
# 1. 确保已安装所有依赖
npm install

# 2. 安装 xterm 相关包（如果尚未安装）
npm install xterm xterm-addon-fit

# 3. 构建
npm run build
```

构建产物会输出到 `../backend/static/` 目录。

### 验证构建

```bash
# 预览构建结果
npm run preview
```

## 已知问题和待办事项

### 需要修复
1. **TypeScript 类型错误**: 某些 Ant Design Table 的 `ColumnsType` 导入需要改为 `TableColumnsType`
2. **缺失依赖**: 需要手动安装 `xterm` 和 `xterm-addon-fit`

### 功能增强
1. **监控页面**: 可以考虑使用 ECharts 替代 @ant-design/plots（减少依赖）
2. **错误边界**: 添加 React Error Boundary 组件
3. **单元测试**: 添加 Jest 和 React Testing Library
4. **E2E 测试**: 使用 Playwright 或 Cypress

### 性能优化
1. **代码分割**: 已实现基础的路由懒加载
2. **图片优化**: 添加 WebP 格式支持
3. **CDN**: 考虑将大型库（如 ECharts）从 CDN 加载

## 开发建议

### 代码风格
- 使用 ESLint 和 Prettier 保持代码一致性
- 遵循 React Hooks 最佳实践
- 组件保持单一职责原则

### 状态管理
- 简单状态使用 useState
- 跨组件共享使用 Context API
- 表单状态使用 Ant Design Form

### API 调用
- 统一使用 axios
- 错误处理已在 `utils/auth.ts` 中配置拦截器
- 401 错误自动跳转登录页

### 样式
- 使用 Ant Design 主题系统
- 支持亮色/暗色主题切换
- 避免内联样式，使用 CSS 模块或 styled-components

## 调试技巧

### 查看 API 请求
打开浏览器开发者工具 → Network 标签页

### React DevTools
安装 React Developer Tools 浏览器扩展

### Vite 热更新
保存文件后浏览器自动刷新，保持开发效率

### 代理配置
开发环境下，`/api` 请求会代理到 `http://localhost:8080`
配置文件：`vite.config.ts`

## 部署检查清单

- [ ] 运行 `npm run build` 确保无错误
- [ ] 检查 `backend/static/` 目录有生成文件
- [ ] 验证环境变量配置
- [ ] 测试生产环境下的 API 连接
- [ ] 检查静态资源路径是否正确
- [ ] 测试亮色/暗色主题切换
- [ ] 验证所有路由正常工作
- [ ] 测试登录和权限控制

## 常见问题

### Q: npm install 卡住？
A: 尝试使用国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
```

### Q: 构建时内存不足？
A: 增加 Node.js 内存限制：
```bash
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

### Q: TypeScript 编译错误？
A: 确保 `tsconfig.json` 配置正确，检查类型导入

### Q: 开发环境 API 404？
A: 确保后端服务在 8080 端口运行

## 资源链接

- [React 文档](https://react.dev/)
- [Ant Design 文档](https://ant.design/)
- [Vite 文档](https://vitejs.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Axios 文档](https://axios-http.com/)
- [ECharts 文档](https://echarts.apache.org/)

## 联系和支持

遇到问题？

1. 查看项目 Issues
2. 加入 QQ 群：2168069924
3. 联系项目维护者

---

**祝开发愉快！** 🚀
