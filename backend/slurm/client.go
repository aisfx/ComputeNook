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

// NewClient 创建新的 Slurm 客户端（使用默认token）
func NewClient() (*Client, error) {
	baseURL := os.Getenv("SLURM_REST_URL")
	if baseURL == "" {
		baseURL = "http://localhost:6820" // 默认 slurmrestd 端口
	}

	token := os.Getenv("SLURM_REST_TOKEN")
	// Token 可以为空，某些配置下不需要认证

	apiVersion := os.Getenv("SLURM_API_VERSION")
	if apiVersion == "" {
		apiVersion = "v0.0.40" // 默认版本
	}

	return &Client{
		baseURL:    baseURL,
		token:      token,
		apiVersion: apiVersion,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// NewClientForUser 为指定用户创建 Slurm 客户端（动态生成token）
func NewClientForUser(username string) (*Client, error) {
	baseURL := os.Getenv("SLURM_REST_URL")
	if baseURL == "" {
		baseURL = "http://localhost:6820"
	}

	apiVersion := os.Getenv("SLURM_API_VERSION")
	if apiVersion == "" {
		apiVersion = "v0.0.40"
	}

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
			Timeout: 30 * time.Second,
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
		// 添加调试日志
		if c.username != "" {
			fmt.Printf("[DEBUG] Slurm API Request for user: %s\n", c.username)
		}
		fmt.Printf("[DEBUG] Token length: %d bytes\n", len(c.token))
		fmt.Printf("[DEBUG] Token (first 50): %s...\n", c.token[:min(50, len(c.token))])
		fmt.Printf("[DEBUG] Token (last 50): ...%s\n", c.token[max(0, len(c.token)-50):])
		fmt.Printf("[DEBUG] Request: %s %s\n", method, url)
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
