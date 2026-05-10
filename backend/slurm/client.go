package slurm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Client Slurm REST API 客户端
type Client struct {
	baseURL    string
	token      string
	apiVersion string
	httpClient *http.Client
	username   string // 当前用户名，用于动态生成token
}

// defaultSlurmAPIVersion 返回默认 Slurm API 版本，优先读取环境变量
func defaultSlurmAPIVersion() string {
	if v := os.Getenv("SLURM_API_VERSION"); v != "" {
		return v
	}
	return "v0.0.43" // 内置兜底版本，建议在 .env 中明确配置
}

// defaultSlurmBaseURL 返回 Slurm REST URL，优先读取环境变量
func defaultSlurmBaseURL() string {
	if u := os.Getenv("SLURM_REST_URL"); u != "" {
		return u
	}
	return "http://localhost:6820" // 默认 slurmrestd 端口
}

// NewClient 创建新的 Slurm 客户端（使用默认token）
func NewClient() (*Client, error) {
	baseURL := defaultSlurmBaseURL()
	token := os.Getenv("SLURM_REST_TOKEN")
	apiVersion := defaultSlurmAPIVersion()
	adminUser := os.Getenv("SLURM_ADMIN_USER")
	if adminUser == "" {
		adminUser = "root"
	}

	return &Client{
		baseURL:    baseURL,
		token:      token,
		apiVersion: apiVersion,
		username:   adminUser,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// NewClientForUser 为指定用户创建 Slurm 客户端（动态生成token）
func NewClientForUser(username string) (*Client, error) {
	baseURL := defaultSlurmBaseURL()
	apiVersion := defaultSlurmAPIVersion()

	// 获取用户的token（动态生成）
	token, err := GetSlurmTokenForUser(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get Slurm token for user %s: %w", username, err)
	}

	return &Client{
		baseURL:    baseURL,
		token:      token,
		apiVersion: apiVersion,
		username:   username,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// doRequest 执行 HTTP 请求
func (c *Client) doRequest(method, path string, body interface{}) ([]byte, error) {
	url := c.baseURL + path

	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("X-SLURM-USER-TOKEN", c.token)
	}
	if c.username != "" {
		req.Header.Set("X-SLURM-USER-NAME", c.username)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// 尝试解析 Slurm API 错误响应
		var errorResp struct {
			Errors []struct {
				Error       string `json:"error"`
				Description string `json:"description"`
			} `json:"errors"`
		}
		if json.Unmarshal(respBody, &errorResp) == nil && len(errorResp.Errors) > 0 {
			return nil, fmt.Errorf("slurm API error (status %d): %s - %s", 
				resp.StatusCode, errorResp.Errors[0].Error, errorResp.Errors[0].Description)
		}
		return nil, fmt.Errorf("slurm API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// RawRequest 暴露原始 HTTP 请求，用于调试
func (c *Client) RawRequest(method, path string, body interface{}) ([]byte, error) {
	return c.doRequest(method, path, body)
}

// buildAPIPath 构建带版本的API路径
func (c *Client) buildAPIPath(endpoint string) string {
	return fmt.Sprintf("/slurmdb/%s%s", c.apiVersion, endpoint)
}


// min 返回两个整数中的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// max 返回两个整数中的较大值
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
