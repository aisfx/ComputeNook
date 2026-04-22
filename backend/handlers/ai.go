package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AIChatRequest struct {
	Messages []AIMessage `json:"messages"`
}

type AIAPIRequest struct {
	Model    string      `json:"model"`
	Messages []AIMessage `json:"messages"`
	Stream   bool        `json:"stream"`
}

type AIAPIResponse struct {
	Choices []struct {
		Message AIMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// AIChat 代理 AI 问答请求
func AIChat(c *gin.Context) {	apiURL := os.Getenv("AI_API_URL")
	apiKey := os.Getenv("AI_API_KEY")
	model := os.Getenv("AI_MODEL")
	systemPrompt := os.Getenv("AI_SYSTEM_PROMPT")

	if apiURL == "" || apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI 服务未配置，请联系管理员"})
		return
	}
	if model == "" {
		model = "gpt-3.5-turbo"
	}
	if systemPrompt == "" {
		systemPrompt = "你是一个 HPC 高性能计算集群的应用助手，专门帮助用户解答并行计算（MPI/OpenMP）、科学软件使用（Python/R/MATLAB/GROMACS等）、编程环境配置、作业脚本编写等问题。回答简洁专业，用中文回答。不涉及集群运维管理内容。"
	}

	var req AIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误"})
		return
	}

	// 构建带 system prompt 的消息列表
	messages := append([]AIMessage{{Role: "system", Content: systemPrompt}}, req.Messages...)

	apiReq := AIAPIRequest{
		Model:    model,
		Messages: messages,
		Stream:   false,
	}

	body, _ := json.Marshal(apiReq)
	httpReq, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建请求失败"})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI 服务请求失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var apiResp AIAPIResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析响应失败"})
		return
	}

	if apiResp.Error != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": apiResp.Error.Message})
		return
	}

	if len(apiResp.Choices) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI 返回空响应"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"content": apiResp.Choices[0].Message.Content,
	})
}
