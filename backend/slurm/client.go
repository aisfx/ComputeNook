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
}

// NewClient 创建新的 Slurm 客户端
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

// buildAPIPath 构建带版本的API路径
func (c *Client) buildAPIPath(endpoint string) string {
	return fmt.Sprintf("/slurmdb/%s%s", c.apiVersion, endpoint)
}
