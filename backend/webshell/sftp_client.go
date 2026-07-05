package webshell

import (
	"io"
	"os"

	"github.com/pkg/sftp"
	gossh "golang.org/x/crypto/ssh"
)

// SFTPClient SFTP客户端封装
type SFTPClient struct {
	client *sftp.Client
}

// NewSFTPClient 创建新的SFTP客户端
func NewSFTPClient(sshClient *gossh.Client) (*SFTPClient, error) {
	client, err := sftp.NewClient(sshClient)
	if err != nil {
		return nil, err
	}
	
	return &SFTPClient{
		client: client,
	}, nil
}

// ReadDir 列出目录内容
func (s *SFTPClient) ReadDir(path string) ([]os.FileInfo, error) {
	return s.client.ReadDir(path)
}

// Upload 上传文件
func (s *SFTPClient) Upload(src io.Reader, dstPath string) error {
	// 创建远程文件
	dstFile, err := s.client.Create(dstPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()
	
	// 复制内容
	_, err = io.Copy(dstFile, src)
	return err
}

// Download 下载文件
func (s *SFTPClient) Download(remotePath string) ([]byte, error) {
	// 打开远程文件
	file, err := s.client.Open(remotePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	
	// 读取全部内容
	return io.ReadAll(file)
}

// Remove 删除文件或目录
func (s *SFTPClient) Remove(path string) error {
	// 先尝试删除文件
	err := s.client.Remove(path)
	if err != nil {
		// 如果失败，可能是目录，尝试删除目录
		return s.client.RemoveDirectory(path)
	}
	return nil
}

// Close 关闭SFTP客户端
func (s *SFTPClient) Close() error {
	return s.client.Close()
}
