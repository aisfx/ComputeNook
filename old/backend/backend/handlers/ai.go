package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"hpc-backend/knowledge"
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

// AIChat 代理 AI 问答请求（普通用户小助手，system prompt 由后端固定，不允许前端覆盖）
func AIChat(c *gin.Context) {
	apiURL := os.Getenv("AI_API_URL")
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
		systemPrompt = "你是一个 HPC 高性能计算集群的应用助手，专门帮助用户解答并行计算（MPI/OpenMP）、科学软件使用（Python/R/MATLAB/GROMACS/VASP等）、编程环境配置、作业脚本编写等问题。回答简洁专业，用中文回答。不涉及集群运维管理内容。"
	}
	// 注入大圣人设
	systemPrompt += knowledge.WukongSystemPromptAddon()

	var req AIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误"})
		return
	}

	// 过滤掉前端传入的 system 角色消息，防止 prompt 注入
	filtered := make([]AIMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		if m.Role != "system" {
			filtered = append(filtered, m)
		}
	}
	req.Messages = filtered

	doAIChat(c, apiURL, apiKey, model, systemPrompt, req.Messages, true)
}

// AIAdminChat 管理员 AI 诊断接口，允许前端传入包含集群数据的 system prompt
func AIAdminChat(c *gin.Context) {
	apiURL := os.Getenv("AI_API_URL")
	apiKey := os.Getenv("AI_API_KEY")
	model := os.Getenv("AI_MODEL")

	if apiURL == "" || apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI 服务未配置，请联系管理员"})
		return
	}
	if model == "" {
		model = "gpt-3.5-turbo"
	}

	var req AIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误"})
		return
	}

	// 管理员接口：提取前端传入的 system prompt（含集群数据），其余消息正常传递
	systemPrompt := ""
	filtered := make([]AIMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		if m.Role == "system" {
			systemPrompt = m.Content
		} else {
			filtered = append(filtered, m)
		}
	}
	if systemPrompt == "" {
		systemPrompt = "你是一个专业的 HPC 集群监控分析 AI，请用中文回答。"
	}

	doAIChat(c, apiURL, apiKey, model, systemPrompt, filtered, false)
}

// doAIChat 公共 AI 请求逻辑
func doAIChat(c *gin.Context, apiURL, apiKey, model, systemPrompt string, userMessages []AIMessage, saveToKnowledge bool) {
	// 提取本次用户问题（最后一条 user 消息）
	userQuestion := ""
	for i := len(userMessages) - 1; i >= 0; i-- {
		if userMessages[i].Role == "user" {
			userQuestion = userMessages[i].Content
			break
		}
	}

	// RAG：从知识库检索相关历史问答，注入 system prompt（仅普通用户小助手）
	if saveToKnowledge {
		store := knowledge.GetStore()
		if userQuestion != "" {
			var sb strings.Builder
			sb.WriteString(systemPrompt)

			scene := knowledge.DetectScene(userQuestion)
			if quote := knowledge.GetWukongQuote(scene); quote != "" {
				sb.WriteString(fmt.Sprintf("\n\n【本次场景参考台词，可融入回答风格】\n\"%s\"", quote))
			}

			similar := store.Search(userQuestion, 3)
			if len(similar) > 0 {
				sb.WriteString("\n\n【参考历史问答 - 仅供参考，以实际情况为准】\n")
				for _, qa := range similar {
					sb.WriteString(fmt.Sprintf("\nQ: %s\nA: %s\n", qa.Question, qa.Answer))
				}
			}
			systemPrompt = sb.String()
		}
	}

	messages := append([]AIMessage{{Role: "system", Content: systemPrompt}}, userMessages...)

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

	answer := apiResp.Choices[0].Message.Content

	// 仅普通用户小助手保存问答到知识库
	if saveToKnowledge && userQuestion != "" && answer != "" {
		username := "anonymous"
		if u, exists := c.Get("username"); exists {
			username = u.(string)
		}
		store := knowledge.GetStore()
		go store.Save(username, userQuestion, answer)
	}

	c.JSON(http.StatusOK, gin.H{"content": answer})
}
