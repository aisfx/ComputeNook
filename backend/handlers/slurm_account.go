package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"hpc-backend/slurm"
)

// GetSlurmAccounts 获取所有 Slurm 账户
func GetSlurmAccounts(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockAccounts := []slurm.Account{
			{
				Name:         "root",
				Description:  "根账户",
				Organization: "THHPC",
				Coordinators: []string{"admin"},
			},
			{
				Name:         "research",
				Description:  "研究账户",
				Organization: "Research Dept",
				Coordinators: []string{"admin"},
			},
			{
				Name:         "test",
				Description:  "",
				Organization: "",
				Coordinators: []string{},
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockAccounts})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	accounts, err := client.GetAccounts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取账户列表失败: " + err.Error()})
		return
	}

	// 确保空值字段被正确处理
	for i := range accounts {
		if accounts[i].Coordinators == nil {
			accounts[i].Coordinators = []string{}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": accounts})
}

// GetSlurmAccount 获取单个 Slurm 账户
func GetSlurmAccount(c *gin.Context) {
	name := c.Param("name")

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockAccount := slurm.Account{
			Name:         name,
			Description:  "测试账户",
			Organization: "THHPC",
			Coordinators: []string{"admin"},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockAccount})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	account, err := client.GetAccount(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "账户不存在: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": account})
}

// CreateSlurmAccount 创建 Slurm 账户
func CreateSlurmAccount(c *gin.Context) {
	var account slurm.Account
	if err := c.ShouldBindJSON(&account); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 验证必填字段
	if account.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "账户名称不能为空"})
		return
	}

	// 设置默认值 - Slurm 要求必须有 description 和 organization
	if account.Description == "" {
		account.Description = account.Name
	}
	if account.Organization == "" {
		account.Organization = "Default"
	}
	if account.Coordinators == nil {
		account.Coordinators = []string{}
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "账户创建成功 (开发模式)", "data": account})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 先检查账户是否已存在
	existingAccount, err := client.GetAccount(account.Name)
	if err == nil && existingAccount != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "账户已存在"})
		return
	}

	// 1. 创建账户
	if err := client.CreateAccount(&account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建账户失败: " + err.Error()})
		return
	}

	// 2. 创建root用户到账户的关联
	// 这是 sacctmgr add account 的标准行为
	rootAssoc := &slurm.Association{
		Account: account.Name,
		User:    "root",
		Cluster: "cluster", // 使用默认集群名
	}
	
	if err := client.CreateAssociation(rootAssoc); err != nil {
		// root关联创建失败不影响账户创建成功
		// 只记录警告信息
		c.JSON(http.StatusCreated, gin.H{
			"message": "账户创建成功，但root用户关联创建失败: " + err.Error(),
			"data":    account,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "账户创建成功",
		"data":    account,
	})
}

// UpdateSlurmAccount 更新 Slurm 账户
func UpdateSlurmAccount(c *gin.Context) {
	name := c.Param("name")

	var account slurm.Account
	if err := c.ShouldBindJSON(&account); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "账户更新成功 (开发模式)"})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	if err := client.UpdateAccount(name, &account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新账户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "账户更新成功"})
}

// DeleteSlurmAccount 删除 Slurm 账户
func DeleteSlurmAccount(c *gin.Context) {
	name := c.Param("name")

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "账户删除成功 (开发模式)"})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	if err := client.DeleteAccount(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除账户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "账户删除成功"})
}

// GetSlurmUsers 获取所有 Slurm 用户
func GetSlurmUsers(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUsers := []slurm.SlurmUser{
			{
				Name:           "user1",
				DefaultAccount: "root",
				AdminLevel:     "None",
			},
			{
				Name:           "admin",
				DefaultAccount: "root",
				AdminLevel:     "Administrator",
			},
			{
				Name:           "user2",
				DefaultAccount: "research",
				AdminLevel:     "None",
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUsers})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	users, err := client.GetSlurmUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户列表失败: " + err.Error()})
		return
	}

	// 确保空值字段被正确处理
	for i := range users {
		if users[i].AdminLevel == "" {
			users[i].AdminLevel = "None"
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// GetSlurmUser 获取单个 Slurm 用户
func GetSlurmUser(c *gin.Context) {
	name := c.Param("name")

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockUser := slurm.SlurmUser{
			Name:           name,
			DefaultAccount: "root",
			AdminLevel:     "None",
		}
		c.JSON(http.StatusOK, gin.H{"data": mockUser})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	user, err := client.GetSlurmUser(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// CreateSlurmUser 创建 Slurm 用户
func CreateSlurmUser(c *gin.Context) {
	var user slurm.SlurmUser
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 验证必填字段
	if user.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名不能为空"})
		return
	}

	// 设置默认值
	if user.AdminLevel == "" {
		user.AdminLevel = "None"
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "用户创建成功 (开发模式)", "data": user})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 先检查用户是否已存在
	existingUser, err := client.GetSlurmUser(user.Name)
	if err == nil && existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "用户已存在"})
		return
	}

	// 创建用户
	if err := client.CreateSlurmUser(&user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建用户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "用户创建成功",
		"data":    user,
	})
}

// UpdateSlurmUser 更新 Slurm 用户
func UpdateSlurmUser(c *gin.Context) {
	name := c.Param("name")

	var user slurm.SlurmUser
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "用户更新成功 (开发模式)"})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	if err := client.UpdateSlurmUser(name, &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新用户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "用户更新成功"})
}

// DeleteSlurmUser 删除 Slurm 用户
func DeleteSlurmUser(c *gin.Context) {
	name := c.Param("name")

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "用户删除成功 (开发模式)"})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	if err := client.DeleteSlurmUser(name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除用户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "用户删除成功"})
}

// GetAssociations 获取所有资源绑定
func GetAssociations(c *gin.Context) {
	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockAssociations := []slurm.Association{
			{
				Account:   "root",
				User:      "admin",
				Cluster:   "cluster1",
				Partition: "normal",
				QoS:       []string{"normal", "high"},
			},
			{
				Account:   "research",
				User:      "user1",
				Cluster:   "cluster1",
				Partition: "gpu",
				QoS:       []string{"normal"},
			},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockAssociations})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	associations, err := client.GetAssociations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取资源绑定列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": associations})
}

// GetAssociation 获取单个资源绑定
func GetAssociation(c *gin.Context) {
	account := c.Query("account")
	user := c.Query("user")
	cluster := c.Query("cluster")

	if account == "" || user == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "账户和用户参数不能为空"})
		return
	}

	// 开发模式：返回模拟数据
	if os.Getenv("DEV_MODE") == "true" {
		mockAssociation := slurm.Association{
			Account:   account,
			User:      user,
			Cluster:   cluster,
			Partition: "normal",
			QoS:       []string{"normal"},
		}
		c.JSON(http.StatusOK, gin.H{"data": mockAssociation})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	association, err := client.GetAssociation(account, user, cluster)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "资源绑定不存在: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": association})
}

// CreateAssociation 创建资源绑定
func CreateAssociation(c *gin.Context) {
	var assoc slurm.Association
	if err := c.ShouldBindJSON(&assoc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 验证必填字段
	if assoc.Account == "" || assoc.User == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "账户和用户不能为空"})
		return
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "资源绑定创建成功 (开发模式)", "data": assoc})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 1. 检查账户是否存在，如果不存在则创建
	_, err = client.GetAccount(assoc.Account)
	if err != nil {
		// 账户不存在，创建账户
		newAccount := &slurm.Account{
			Name:         assoc.Account,
			Description:  assoc.Account,
			Organization: "Default",
		}
		
		if err := client.CreateAccount(newAccount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "创建账户失败: " + err.Error()})
			return
		}
		
		// 为root用户创建到新账户的绑定
		rootAssoc := &slurm.Association{
			Account: assoc.Account,
			User:    "root",
			Cluster: assoc.Cluster,
		}
		if assoc.Cluster == "" {
			rootAssoc.Cluster = "cluster"
		}
		
		if err := client.CreateAssociation(rootAssoc); err != nil {
			// root绑定失败不影响后续操作，只记录日志
			c.JSON(http.StatusCreated, gin.H{
				"message": "账户创建成功，但root用户绑定失败: " + err.Error(),
			})
		}
	}

	// 2. 创建用户到账户的资源绑定
	if err := client.CreateAssociation(&assoc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建资源绑定失败: " + err.Error()})
		return
	}

	// 创建成功后，返回创建的数据
	c.JSON(http.StatusCreated, gin.H{
		"message": "资源绑定创建成功",
		"data": assoc,
	})
}

// UpdateAssociation 更新资源绑定
func UpdateAssociation(c *gin.Context) {
	account := c.Query("account")
	user := c.Query("user")
	cluster := c.Query("cluster")

	if account == "" || user == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "账户和用户参数不能为空"})
		return
	}

	var assoc slurm.Association
	if err := c.ShouldBindJSON(&assoc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "资源绑定更新成功 (开发模式)"})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	if err := client.UpdateAssociation(account, user, cluster, &assoc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新资源绑定失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "资源绑定更新成功"})
}

// DeleteAssociation 删除资源绑定
func DeleteAssociation(c *gin.Context) {
	account := c.Query("account")
	user := c.Query("user")
	cluster := c.Query("cluster")
	partition := c.Query("partition")

	if account == "" || user == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "账户和用户参数不能为空"})
		return
	}

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "资源绑定删除成功 (开发模式)"})
		return
	}

	client, err := slurm.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	if err := client.DeleteAssociation(account, user, cluster, partition); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除资源绑定失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "资源绑定删除成功"})
}
