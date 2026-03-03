package main

import (
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// FileInfo 文件信息
type FileInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	IsDir       bool   `json:"is_dir"`
	ModTime     string `json:"mod_time"`
	Permissions string `json:"permissions"`
}

// getBasePath 获取基础路径
func getBasePath() string {
	basePath := os.Getenv("FILEMANAGER_BASE_PATH")
	if basePath == "" {
		basePath = "/home"
	}
	return basePath
}

// validatePath 验证路径安全性
func validatePath(path string) error {
	// 检查路径是否包含 ..
	if strings.Contains(path, "..") {
		return &PathError{Message: "非法路径：不允许使用 .."}
	}
	
	// 获取绝对路径
	absPath, err := filepath.Abs(path)
	if err != nil {
		return &PathError{Message: "无效的路径"}
	}
	
	// 检查路径是否在允许的基础路径下
	basePath := getBasePath()
	if !strings.HasPrefix(absPath, basePath) {
		return &PathError{Message: "访问被拒绝：路径超出允许范围"}
	}
	
	return nil
}

// PathError 路径错误
type PathError struct {
	Message string
}

func (e *PathError) Error() string {
	return e.Message
}

// ListDirectory 列出目录内容
func ListDirectory(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		path = getBasePath()
	}

	log.Printf("ListDirectory: path=%s", path)

	// 验证路径
	if err := validatePath(path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 读取目录
	entries, err := os.ReadDir(path)
	if err != nil {
		log.Printf("Failed to read directory %s: %v", path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取目录失败: " + err.Error()})
		return
	}

	// 构建文件列表
	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			log.Printf("Failed to get file info for %s: %v", entry.Name(), err)
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		
		fileInfo := FileInfo{
			Name:        entry.Name(),
			Path:        fullPath,
			Size:        info.Size(),
			IsDir:       entry.IsDir(),
			ModTime:     info.ModTime().Format("2006-01-02 15:04:05"),
			Permissions: info.Mode().String(),
		}

		files = append(files, fileInfo)
	}

	log.Printf("Listed %d files in directory %s", len(files), path)
	c.JSON(http.StatusOK, gin.H{
		"path":  path,
		"files": files,
	})
}

// ReadFile 读取文件内容
func ReadFile(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	log.Printf("ReadFile: path=%s", path)

	// 验证路径
	if err := validatePath(path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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
		log.Printf("Failed to read file %s: %v", path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取文件失败: " + err.Error()})
		return
	}

	log.Printf("Read file %s (%d bytes)", path, len(content))
	c.JSON(http.StatusOK, gin.H{
		"path":    path,
		"content": string(content),
		"size":    len(content),
	})
}

// DownloadFile 下载文件
func DownloadFile(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	log.Printf("DownloadFile: path=%s", path)

	// 验证路径
	if err := validatePath(path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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
	log.Printf("Downloaded file %s", path)
}

// WriteFile 写入文件
func WriteFile(c *gin.Context) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	log.Printf("WriteFile: path=%s, size=%d", req.Path, len(req.Content))

	// 验证路径
	if err := validatePath(req.Path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 写入文件
	err := os.WriteFile(req.Path, []byte(req.Content), 0644)
	if err != nil {
		log.Printf("Failed to write file %s: %v", req.Path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入文件失败: " + err.Error()})
		return
	}

	log.Printf("Wrote file %s (%d bytes)", req.Path, len(req.Content))
	c.JSON(http.StatusOK, gin.H{
		"message": "文件写入成功",
		"path":    req.Path,
		"size":    len(req.Content),
	})
}

// UploadFile 上传文件
func UploadFile(c *gin.Context) {
	// 获取目标路径
	targetPath := c.PostForm("path")
	if targetPath == "" {
		targetPath = getBasePath()
	}

	// 验证路径
	if err := validatePath(targetPath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "获取上传文件失败: " + err.Error()})
		return
	}

	log.Printf("UploadFile: filename=%s, size=%d, target=%s", file.Filename, file.Size, targetPath)

	// 构建完整路径
	fullPath := filepath.Join(targetPath, file.Filename)

	// 验证完整路径
	if err := validatePath(fullPath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 保存文件
	if err := c.SaveUploadedFile(file, fullPath); err != nil {
		log.Printf("Failed to save uploaded file %s: %v", fullPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败: " + err.Error()})
		return
	}

	log.Printf("Uploaded file %s (%d bytes)", fullPath, file.Size)
	c.JSON(http.StatusOK, gin.H{
		"message": "文件上传成功",
		"path":    fullPath,
		"size":    file.Size,
	})
}

// DeleteFile 删除文件或目录
func DeleteFile(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	log.Printf("DeleteFile: path=%s", path)

	// 验证路径
	if err := validatePath(path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 安全检查：不允许删除根目录和重要系统目录
	if path == "/" || path == "/home" || path == "/etc" || path == "/usr" || path == "/var" {
		c.JSON(http.StatusForbidden, gin.H{"error": "不允许删除系统目录"})
		return
	}

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
		log.Printf("Failed to delete %s: %v", path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败: " + err.Error()})
		return
	}

	log.Printf("Deleted %s", path)
	c.JSON(http.StatusOK, gin.H{
		"message": "删除成功",
		"path":    path,
	})
}

// CreateDirectory 创建目录
func CreateDirectory(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	log.Printf("CreateDirectory: path=%s", req.Path)

	// 验证路径
	if err := validatePath(req.Path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 创建目录
	err := os.MkdirAll(req.Path, 0755)
	if err != nil {
		log.Printf("Failed to create directory %s: %v", req.Path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目录失败: " + err.Error()})
		return
	}

	log.Printf("Created directory %s", req.Path)
	c.JSON(http.StatusOK, gin.H{
		"message": "目录创建成功",
		"path":    req.Path,
	})
}

// RenameFile 重命名文件或目录
func RenameFile(c *gin.Context) {
	var req struct {
		OldPath string `json:"old_path"`
		NewPath string `json:"new_path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	log.Printf("RenameFile: old=%s, new=%s", req.OldPath, req.NewPath)

	// 验证路径
	if err := validatePath(req.OldPath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "源路径错误: " + err.Error()})
		return
	}
	if err := validatePath(req.NewPath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "目标路径错误: " + err.Error()})
		return
	}

	// 重命名
	err := os.Rename(req.OldPath, req.NewPath)
	if err != nil {
		log.Printf("Failed to rename %s to %s: %v", req.OldPath, req.NewPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "重命名失败: " + err.Error()})
		return
	}

	log.Printf("Renamed %s to %s", req.OldPath, req.NewPath)
	c.JSON(http.StatusOK, gin.H{
		"message":  "重命名成功",
		"old_path": req.OldPath,
		"new_path": req.NewPath,
	})
}

// CopyFile 复制文件
func CopyFile(c *gin.Context) {
	var req struct {
		SourcePath string `json:"source_path"`
		TargetPath string `json:"target_path"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	log.Printf("CopyFile: source=%s, target=%s", req.SourcePath, req.TargetPath)

	// 验证路径
	if err := validatePath(req.SourcePath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "源路径错误: " + err.Error()})
		return
	}
	if err := validatePath(req.TargetPath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "目标路径错误: " + err.Error()})
		return
	}

	// 打开源文件
	sourceFile, err := os.Open(req.SourcePath)
	if err != nil {
		log.Printf("Failed to open source file %s: %v", req.SourcePath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "打开源文件失败: " + err.Error()})
		return
	}
	defer sourceFile.Close()

	// 创建目标文件
	targetFile, err := os.Create(req.TargetPath)
	if err != nil {
		log.Printf("Failed to create target file %s: %v", req.TargetPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目标文件失败: " + err.Error()})
		return
	}
	defer targetFile.Close()

	// 复制内容
	written, err := io.Copy(targetFile, sourceFile)
	if err != nil {
		log.Printf("Failed to copy file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "复制文件失败: " + err.Error()})
		return
	}

	log.Printf("Copied %s to %s (%d bytes)", req.SourcePath, req.TargetPath, written)
	c.JSON(http.StatusOK, gin.H{
		"message":     "复制成功",
		"source_path": req.SourcePath,
		"target_path": req.TargetPath,
		"size":        written,
	})
}

// GetFileInfo 获取文件信息
func GetFileInfo(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "路径参数不能为空"})
		return
	}

	log.Printf("GetFileInfo: path=%s", path)

	// 验证路径
	if err := validatePath(path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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
		ModTime:     info.ModTime().Format("2006-01-02 15:04:05"),
		Permissions: info.Mode().String(),
	}

	log.Printf("Got file info for %s", path)
	c.JSON(http.StatusOK, gin.H{"data": fileInfo})
}
