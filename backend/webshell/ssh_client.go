package webshell

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHClient SSH客户端
type SSHClient struct {
	Host       string
	Port       int
	Username   string
	PrivateKey string
	Password   string // 新增密码字段
	client     *ssh.Client
	session    *ssh.Session
}

// SSHConfig SSH连接配置
type SSHConfig struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	PrivateKey string `json:"private_key,omitempty"` // 可选，如果为空则使用密码
	Password   string `json:"password,omitempty"`    // 可选，如果私钥为空则使用密码
}

// NewSSHClient 创建新的SSH客户端
func NewSSHClient(config SSHConfig) *SSHClient {
	return &SSHClient{
		Host:       config.Host,
		Port:       config.Port,
		Username:   config.Username,
		PrivateKey: config.PrivateKey,
		Password:   config.Password,
	}
}

// Connect 连接到SSH服务器
func (c *SSHClient) Connect() error {
	var authMethods []ssh.AuthMethod
	
	// 优先使用私钥认证
	if c.PrivateKey != "" {
		key, err := ssh.ParsePrivateKey([]byte(c.PrivateKey))
		if err != nil {
			return fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(key))
	}
	
	// 如果没有私钥或私钥认证失败，使用密码认证
	if c.Password != "" {
		authMethods = append(authMethods, ssh.Password(c.Password))
	}
	
	// 至少需要一种认证方式
	if len(authMethods) == 0 {
		return fmt.Errorf("no authentication method provided (need private key or password)")
	}

	// SSH客户端配置
	config := &ssh.ClientConfig{
		User:            c.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // 注意：生产环境应该验证主机密钥
		Timeout:         30 * time.Second,
	}

	// 连接SSH服务器
	addr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return fmt.Errorf("failed to connect to SSH server: %w", err)
	}

	c.client = client
	return nil
}

// CreateSession 创建SSH会话
func (c *SSHClient) CreateSession() error {
	if c.client == nil {
		return fmt.Errorf("SSH client not connected")
	}

	session, err := c.client.NewSession()
	if err != nil {
		return fmt.Errorf("failed to create SSH session: %w", err)
	}

	c.session = session
	return nil
}

// RequestPty 请求伪终端
func (c *SSHClient) RequestPty(term string, height, width int) error {
	if c.session == nil {
		return fmt.Errorf("SSH session not created")
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,     // 启用回显
		ssh.TTY_OP_ISPEED: 14400, // 输入速度
		ssh.TTY_OP_OSPEED: 14400, // 输出速度
	}

	return c.session.RequestPty(term, height, width, modes)
}

// Shell 启动交互式shell
func (c *SSHClient) Shell() error {
	if c.session == nil {
		return fmt.Errorf("SSH session not created")
	}

	return c.session.Shell()
}

// SetStdin 设置标准输入
func (c *SSHClient) SetStdin(stdin io.Reader) {
	if c.session != nil {
		c.session.Stdin = stdin
	}
}

// SetStdout 设置标准输出
func (c *SSHClient) SetStdout(stdout io.Writer) {
	if c.session != nil {
		c.session.Stdout = stdout
	}
}

// SetStderr 设置标准错误输出
func (c *SSHClient) SetStderr(stderr io.Writer) {
	if c.session != nil {
		c.session.Stderr = stderr
	}
}

// Wait 等待会话结束
func (c *SSHClient) Wait() error {
	if c.session == nil {
		return fmt.Errorf("SSH session not created")
	}

	return c.session.Wait()
}

// Close 关闭连接
func (c *SSHClient) Close() error {
	var err error
	if c.session != nil {
		err = c.session.Close()
		c.session = nil
	}
	if c.client != nil {
		if clientErr := c.client.Close(); clientErr != nil && err == nil {
			err = clientErr
		}
		c.client = nil
	}
	return err
}

// ResizeWindow 调整终端窗口大小
func (c *SSHClient) ResizeWindow(height, width int) error {
	if c.session == nil {
		return fmt.Errorf("SSH session not created")
	}

	return c.session.WindowChange(height, width)
}

// LoadPrivateKeyFromFile 从文件加载私钥
func LoadPrivateKeyFromFile(keyPath string) (string, error) {
	// 展开用户目录
	if keyPath[0] == '~' {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to get user home directory: %w", err)
		}
		keyPath = filepath.Join(homeDir, keyPath[1:])
	}

	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return "", fmt.Errorf("failed to read private key file: %w", err)
	}

	return string(keyBytes), nil
}

// TestConnection 测试SSH连接
func TestConnection(config SSHConfig) error {
	client := NewSSHClient(config)
	
	if err := client.Connect(); err != nil {
		return err
	}
	defer client.Close()

	if err := client.CreateSession(); err != nil {
		return err
	}

	// 执行简单命令测试连接
	output, err := client.session.Output("echo 'connection test'")
	if err != nil {
		return fmt.Errorf("failed to execute test command: %w", err)
	}

	if string(output) != "connection test\n" {
		return fmt.Errorf("unexpected test output: %s", string(output))
	}

	return nil
}