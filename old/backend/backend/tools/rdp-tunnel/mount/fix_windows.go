//go:build windows

package mount

// FixWebClient 修复 WebClient 注册表（需要管理员权限，由提权子进程调用）
func FixWebClient() error {
	return fixWebClientRegistry()
}
