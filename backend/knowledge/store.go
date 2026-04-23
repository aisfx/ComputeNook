package knowledge

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

// QAPair 一条问答记录
type QAPair struct {
	ID        string
	Username  string
	Question  string
	Answer    string
	CreatedAt time.Time
}

// Store 知识库：负责写 Obsidian Markdown + 内存索引
type Store struct {
	mu      sync.RWMutex
	vaultDir string   // Obsidian Vault 根目录
	index   []QAPair // 内存索引，用于 RAG 检索
	maxIndex int
}

var (
	globalStore *Store
	once        sync.Once
)

// GetStore 获取全局知识库单例
func GetStore() *Store {
	once.Do(func() {
		vaultDir := os.Getenv("OBSIDIAN_VAULT_DIR")
		if vaultDir == "" {
			vaultDir = "./knowledge/vault"
		}
		globalStore = &Store{
			vaultDir: vaultDir,
			index:    make([]QAPair, 0, 2000),
			maxIndex: 5000,
		}
		os.MkdirAll(vaultDir, 0755)
		globalStore.loadIndex()
	})
	return globalStore
}

// Save 保存一条问答：写 Markdown 文件 + 加入内存索引
func (s *Store) Save(username, question, answer string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	id := fmt.Sprintf("%s-%d", now.Format("20060102150405"), len(s.index))

	qa := QAPair{
		ID:        id,
		Username:  username,
		Question:  question,
		Answer:    answer,
		CreatedAt: now,
	}

	// 写 Obsidian Markdown
	s.writeMarkdown(qa)

	// 加入内存索引
	s.index = append(s.index, qa)
	if len(s.index) > s.maxIndex {
		s.index = s.index[len(s.index)-s.maxIndex:]
	}
}

// Search 检索与 query 相关的历史问答，返回最多 topN 条
func (s *Store) Search(query string, topN int) []QAPair {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.index) == 0 {
		return nil
	}

	type scored struct {
		qa    QAPair
		score int
	}

	queryTokens := tokenize(query)
	if len(queryTokens) == 0 {
		return nil
	}

	results := make([]scored, 0, len(s.index))
	for _, qa := range s.index {
		score := matchScore(queryTokens, qa.Question) * 2 // 问题匹配权重更高
		score += matchScore(queryTokens, qa.Answer)
		if score > 0 {
			results = append(results, scored{qa, score})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	out := make([]QAPair, 0, topN)
	for i, r := range results {
		if i >= topN {
			break
		}
		out = append(out, r.qa)
	}
	return out
}

// writeMarkdown 写入 Obsidian Markdown 文件
// 目录结构：vault/用户名/YYYY-MM/YYYY-MM-DD.md
func (s *Store) writeMarkdown(qa QAPair) {
	dateDir := filepath.Join(s.vaultDir, qa.Username, qa.CreatedAt.Format("2006-01"))
	os.MkdirAll(dateDir, 0755)

	filePath := filepath.Join(dateDir, qa.CreatedAt.Format("2006-01-02")+".md")

	// 追加到当天文件
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	// 如果是新文件，写入 Obsidian frontmatter
	info, _ := f.Stat()
	if info.Size() == 0 {
		fmt.Fprintf(f, "---\ndate: %s\nuser: %s\ntags: [hpc, ai-chat]\n---\n\n# %s 问答记录\n\n",
			qa.CreatedAt.Format("2006-01-02"), qa.Username, qa.CreatedAt.Format("2006-01-02"))
	}

	// 写入问答条目
	fmt.Fprintf(f, "## %s\n\n**🙋 问：** %s\n\n**🐒 答：**\n\n%s\n\n---\n\n",
		qa.CreatedAt.Format("15:04:05"),
		qa.Question,
		qa.Answer,
	)
}

// loadIndex 启动时从 Vault 目录加载历史问答到内存索引
func (s *Store) loadIndex() {
	_ = filepath.Walk(s.vaultDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".md") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		pairs := parseMarkdown(string(data), path)
		s.index = append(s.index, pairs...)
		return nil
	})

	// 按时间排序，保留最新的
	sort.Slice(s.index, func(i, j int) bool {
		return s.index[i].CreatedAt.Before(s.index[j].CreatedAt)
	})
	if len(s.index) > s.maxIndex {
		s.index = s.index[len(s.index)-s.maxIndex:]
	}
}

// parseMarkdown 从 Markdown 文件解析问答对
func parseMarkdown(content, path string) []QAPair {
	// 从路径提取用户名：vault/username/2006-01/2006-01-02.md
	parts := strings.Split(filepath.ToSlash(path), "/")
	username := "unknown"
	for i, p := range parts {
		if p == "vault" && i+1 < len(parts) {
			username = parts[i+1]
			break
		}
	}

	var pairs []QAPair
	lines := strings.Split(content, "\n")
	var currentTime, currentQ, currentA string
	inAnswer := false

	for _, line := range lines {
		if strings.HasPrefix(line, "## ") {
			// 保存上一条
			if currentQ != "" && currentA != "" {
				pairs = append(pairs, QAPair{
					Username:  username,
					Question:  strings.TrimSpace(currentQ),
					Answer:    strings.TrimSpace(currentA),
					CreatedAt: parseTime(currentTime),
				})
			}
			currentTime = strings.TrimPrefix(line, "## ")
			currentQ, currentA = "", ""
			inAnswer = false
		} else if strings.HasPrefix(line, "**🙋 问：** ") {
			currentQ = strings.TrimPrefix(line, "**🙋 问：** ")
			inAnswer = false
		} else if strings.HasPrefix(line, "**🐒 答：**") {
			inAnswer = true
		} else if line == "---" {
			inAnswer = false
		} else if inAnswer && line != "" {
			currentA += line + "\n"
		}
	}
	// 最后一条
	if currentQ != "" && currentA != "" {
		pairs = append(pairs, QAPair{
			Username:  username,
			Question:  strings.TrimSpace(currentQ),
			Answer:    strings.TrimSpace(currentA),
			CreatedAt: parseTime(currentTime),
		})
	}
	return pairs
}

func parseTime(s string) time.Time {
	t, _ := time.Parse("15:04:05", strings.TrimSpace(s))
	return t
}

// tokenize 简单分词：按空格、标点切分，支持中文字符级分词
func tokenize(s string) []string {
	s = strings.ToLower(s)
	var tokens []string
	var cur strings.Builder

	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			cur.WriteRune(r)
		} else {
			if cur.Len() > 0 {
				tokens = append(tokens, cur.String())
				cur.Reset()
			}
		}
	}
	if cur.Len() > 0 {
		tokens = append(tokens, cur.String())
	}

	// 中文：额外做 2-gram 切分提高召回
	var result []string
	for _, t := range tokens {
		result = append(result, t)
		runes := []rune(t)
		if len(runes) > 2 {
			for i := 0; i < len(runes)-1; i++ {
				result = append(result, string(runes[i:i+2]))
			}
		}
	}
	return result
}

// matchScore 计算 query tokens 与文本的匹配分数
func matchScore(queryTokens []string, text string) int {
	textLower := strings.ToLower(text)
	score := 0
	for _, t := range queryTokens {
		if len(t) < 2 {
			continue
		}
		if strings.Contains(textLower, t) {
			score += len(t) // 长词权重更高
		}
	}
	return score
}
