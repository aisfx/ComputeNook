package handlers

import (
	"archive/zip"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"hpc-backend/logger"
)

// FileInfo 文件信息
type FileInfo struct {
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	Size         int64     `json:"size"`
	IsDir        bool      `json:"is_dir"`
	ModTime      time.Time `json:"mod_time"`
	Permissions  string    `json:"permissions"`
	Owner        string    `json:"owner,omitempty"`
	Group        string    `json:"group,omitempty"`
}

// ListDirectory 列出目录内容
func ListDirectory(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		path = "/home/" + username.(string)
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("ListDirectory: user=%s, path=%s", username, path)

	// 读取目录
	entries, err := os.ReadDir(path)
	if err != nil {
		logger.Error("Failed to read directory %s: %v", path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取目录失败: " + err.Error()})
		return
	}

	// 构建文件列表
	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			logger.Warn("Failed to get file info for %s: %v", entry.Name(), err)
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		
		fileInfo := FileInfo{
			Name:        entry.Name(),
			Path:        fullPath,
			Size:        info.Size(),
			IsDir:       entry.IsDir(),
			ModTime:     info.ModTime(),
			Permissions: info.Mode().String(),
		}

		files = append(files, fileInfo)
	}

	logger.Info("Listed %d files in directory %s", len(files), path)
	c.JSON(http.StatusOK, gin.H{
		"path":  path,
		"files": files,
	})
}

// ReadFile 读取文件内容
func ReadFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("ReadFile: user=%s, path=%s", username, path)

	// 检查文件是否存在
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取文件信息失败: " + err.Error()})
		}
		return
	}

	// 检查是否是目录
	if info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不能读取目录"})
		return
	}

	// 检查文件大小（限制为 10MB）
	if info.Size() > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件太大，无法读取（最大 10MB）"})
		return
	}

	// 读取文件内容
	content, err := os.ReadFile(path)
	if err != nil {
		logger.Error("Failed to read file %s: %v", path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取文件失败: " + err.Error()})
		return
	}

	logger.Info("Read file %s (%d bytes)", path, len(content))
	c.JSON(http.StatusOK, gin.H{
		"path":    path,
		"content": string(content),
		"size":    len(content),
	})
}

// DownloadFile 下载文件
func DownloadFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("DownloadFile: user=%s, path=%s", username, path)

	// 检查文件是否存在
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取文件信息失败: " + err.Error()})
		}
		return
	}

	// 检查是否是目录
	if info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不能下载目录"})
		return
	}

	// 设置响应头
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", "attachment; filename="+filepath.Base(path))
	c.Header("Content-Type", "application/octet-stream")

	// 发送文件
	c.File(path)
	logger.Info("Downloaded file %s", path)
}

// WriteFile 写入文件
func WriteFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(req.Path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("WriteFile: user=%s, path=%s, size=%d", username, req.Path, len(req.Content))

	// 写入文件
	err := os.WriteFile(req.Path, []byte(req.Content), 0644)
	if err != nil {
		logger.Error("Failed to write file %s: %v", req.Path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入文件失败: " + err.Error()})
		return
	}

	logger.Info("Wrote file %s (%d bytes)", req.Path, len(req.Content))
	c.JSON(http.StatusOK, gin.H{
		"message": "文件写入成功",
		"path":    req.Path,
		"size":    len(req.Content),
	})
}

// UploadFile 上传文件
func UploadFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取目标路径
	targetPath := c.PostForm("path")
	if targetPath == "" {
		targetPath = "/home/" + username.(string)
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(targetPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "获取上传文件失败: " + err.Error()})
		return
	}

	logger.Debug("UploadFile: user=%s, filename=%s, size=%d, target=%s", 
		username, file.Filename, file.Size, targetPath)

	// 构建完整路径
	fullPath := filepath.Join(targetPath, file.Filename)

	// 保存文件
	if err := c.SaveUploadedFile(file, fullPath); err != nil {
		logger.Error("Failed to save uploaded file %s: %v", fullPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败: " + err.Error()})
		return
	}

	logger.Info("Uploaded file %s (%d bytes)", fullPath, file.Size)
	c.JSON(http.StatusOK, gin.H{
		"message": "文件上传成功",
		"path":    fullPath,
		"size":    file.Size,
	})
}

// DeleteFile 删除文件或目录
func DeleteFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	// 安全检查：不允许删除根目录和重要系统目录
	if path == "/" || path == "/home" || path == "/etc" || path == "/usr" || path == "/var" {
		c.JSON(http.StatusForbidden, gin.H{"error": "不允许删除系统目录"})
		return
	}

	logger.Debug("DeleteFile: user=%s, path=%s", username, path)

	// 检查文件是否存在
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取文件信息失败: " + err.Error()})
		}
		return
	}

	// 删除文件或目录
	if info.IsDir() {
		err = os.RemoveAll(path)
	} else {
		err = os.Remove(path)
	}

	if err != nil {
		logger.Error("Failed to delete %s: %v", path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败: " + err.Error()})
		return
	}

	logger.Info("Deleted %s", path)
	c.JSON(http.StatusOK, gin.H{
		"message": "删除成功",
		"path":    path,
	})
}

// CreateDirectory 创建目录
func CreateDirectory(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	var req struct {
		Path string `json:"path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(req.Path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("CreateDirectory: user=%s, path=%s", username, req.Path)

	// 创建目录
	err := os.MkdirAll(req.Path, 0755)
	if err != nil {
		logger.Error("Failed to create directory %s: %v", req.Path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目录失败: " + err.Error()})
		return
	}

	logger.Info("Created directory %s", req.Path)
	c.JSON(http.StatusOK, gin.H{
		"message": "目录创建成功",
		"path":    req.Path,
	})
}

// RenameFile 重命名文件或目录
func RenameFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	var req struct {
		OldPath string `json:"old_path"`
		NewPath string `json:"new_path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(req.OldPath, "..") || strings.Contains(req.NewPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("RenameFile: user=%s, old=%s, new=%s", username, req.OldPath, req.NewPath)

	// 重命名
	err := os.Rename(req.OldPath, req.NewPath)
	if err != nil {
		logger.Error("Failed to rename %s to %s: %v", req.OldPath, req.NewPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "重命名失败: " + err.Error()})
		return
	}

	logger.Info("Renamed %s to %s", req.OldPath, req.NewPath)
	c.JSON(http.StatusOK, gin.H{
		"message":  "重命名成功",
		"old_path": req.OldPath,
		"new_path": req.NewPath,
	})
}

// CopyFile 复制文件
func CopyFile(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	var req struct {
		SourcePath string `json:"source_path"`
		TargetPath string `json:"target_path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(req.SourcePath, "..") || strings.Contains(req.TargetPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("CopyFile: user=%s, source=%s, target=%s", username, req.SourcePath, req.TargetPath)

	// 打开源文件
	sourceFile, err := os.Open(req.SourcePath)
	if err != nil {
		logger.Error("Failed to open source file %s: %v", req.SourcePath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "打开源文件失败: " + err.Error()})
		return
	}
	defer sourceFile.Close()

	// 创建目标文件
	targetFile, err := os.Create(req.TargetPath)
	if err != nil {
		logger.Error("Failed to create target file %s: %v", req.TargetPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目标文件失败: " + err.Error()})
		return
	}
	defer targetFile.Close()

	// 复制内容
	written, err := io.Copy(targetFile, sourceFile)
	if err != nil {
		logger.Error("Failed to copy file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "复制文件失败: " + err.Error()})
		return
	}

	logger.Info("Copied %s to %s (%d bytes)", req.SourcePath, req.TargetPath, written)
	c.JSON(http.StatusOK, gin.H{
		"message":     "复制成功",
		"source_path": req.SourcePath,
		"target_path": req.TargetPath,
		"size":        written,
	})
}

// GetFileInfo 获取文件信息
func GetFileInfo(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	// 安全检查：确保路径不包含 ..
	if strings.Contains(path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	logger.Debug("GetFileInfo: user=%s, path=%s", username, path)

	// 获取文件信息
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取文件信息失败: " + err.Error()})
		}
		return
	}

	fileInfo := FileInfo{
		Name:        info.Name(),
		Path:        path,
		Size:        info.Size(),
		IsDir:       info.IsDir(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
	}

	logger.Info("Got file info for %s", path)
	c.JSON(http.StatusOK, gin.H{"data": fileInfo})
}

// CompressDownload 将文件或目录打包为 zip 并下载
func CompressDownload(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}
	if strings.Contains(path, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法路径"})
		return
	}

	info, err := os.Stat(path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "路径不存在: " + err.Error()})
		return
	}

	logger.Debug("CompressDownload: user=%s, path=%s", username, path)

	zipName := filepath.Base(path) + ".zip"
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename="+zipName)

	zw := zip.NewWriter(c.Writer)
	defer zw.Close()

	baseName := filepath.Base(path)

	if info.IsDir() {
		err = filepath.Walk(path, func(filePath string, fi os.FileInfo, walkErr error) error {
			if walkErr != nil {
				return nil // 跳过无权限文件
			}
			rel, _ := filepath.Rel(filepath.Dir(path), filePath)
			rel = filepath.ToSlash(rel)
			if fi.IsDir() {
				if rel != baseName {
					_, e := zw.Create(rel + "/")
					return e
				}
				return nil
			}
			w, e := zw.Create(rel)
			if e != nil {
				return e
			}
			f, e := os.Open(filePath)
			if e != nil {
				return nil // 跳过无法打开的文件
			}
			defer f.Close()
			_, e = io.Copy(w, f)
			return e
		})
	} else {
		w, e := zw.Create(baseName)
		if e == nil {
			f, e2 := os.Open(path)
			if e2 == nil {
				defer f.Close()
				io.Copy(w, f)
			}
		}
		err = e
	}

	if err != nil {
		logger.Error("CompressDownload error: %v", err)
	}
}
