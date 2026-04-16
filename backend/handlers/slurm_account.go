package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"hpc-backend/ldap"
	"hpc-backend/models"
	"hpc-backend/slurm"
)

// GetSlurmAccounts 获取所有 Slurm 账户
func GetSlurmAccounts(c *gin.Context) {
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

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

	// 使用当前用户的JWT token创建Slurm客户端
	client, err := slurm.NewClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	accounts, err := client.GetAccounts()
	if err != nil {
		// 检查是否是数据库连接错误
		if strings.Contains(err.Error(), "Unable to connect to database") || 
		   strings.Contains(err.Error(), "slurmdbd connection") {
			// 返回友好的错误信息，提示用户slurmdbd未配置
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "Slurm数据库服务(slurmdbd)未配置或不可用。账户管理功能需要slurmdbd支持。",
				"detail": "请联系系统管理员配置slurmdbd服务，或使用sacctmgr命令行工具管理账户。",
				"code": "SLURMDBD_UNAVAILABLE",
			})
			return
		}
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

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
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
// CreateSlurmAccount 创建 Slurm 账户
// 使用已存在的 LDAP 用户组名称
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

	// 创建 LDAP 客户端，验证组是否存在
	ldapClient, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 LDAP: " + err.Error()})
		return
	}
	defer ldapClient.Close()

	// 验证 LDAP 组是否存在
	groups, err := ldapClient.GetGroups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取 LDAP 组列表失败: " + err.Error()})
		return
	}

	groupExists := false
	var ldapGroup *models.Group
	for _, g := range groups {
		if g.GroupName == account.Name {
			groupExists = true
			ldapGroup = g
			break
		}
	}

	if !groupExists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "LDAP 用户组不存在，请先在用户组管理中创建: " + account.Name})
		return
	}

	// 使用管理员客户端执行写操作
	slurmClient, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 检查 Slurm 账户是否已存在
	existingAccount, err := slurmClient.GetAccount(account.Name)
	if err == nil && existingAccount != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Slurm 账户已存在"})
		return
	}

	// 创建 Slurm 账户
	if err := slurmClient.CreateAccount(&account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建 Slurm 账户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Slurm 账户创建成功（已关联到 LDAP 用户组）",
		"data": gin.H{
			"slurm_account": account,
			"ldap_group": gin.H{
				"name": ldapGroup.GroupName,
				"gid":  ldapGroup.GID,
			},
		},
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

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
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

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
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
	// 获取当前用户信息
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

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

	client, err := GetSlurmClientForUser(username.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	users, err := client.GetSlurmUsers()
	if err != nil {
		// 检查是否是数据库连接错误
		if strings.Contains(err.Error(), "Unable to connect to database") || 
		   strings.Contains(err.Error(), "slurmdbd connection") {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "Slurm数据库服务(slurmdbd)未配置或不可用。用户管理功能需要slurmdbd支持。",
				"detail": "请联系系统管理员配置slurmdbd服务，或使用sacctmgr命令行工具管理用户。",
				"code": "SLURMDBD_UNAVAILABLE",
			})
			return
		}
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

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
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
// 使用已存在的 LDAP 系统用户
func CreateSlurmUser(c *gin.Context) {
	var req struct {
		Name           string `json:"name"`
		AdminLevel     string `json:"admin_level"`
		DefaultAccount string `json:"default_account"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 验证必填字段
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名不能为空"})
		return
	}

	// 设置默认值
	if req.AdminLevel == "" {
		req.AdminLevel = "None"
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "用户创建成功 (开发模式)"})
		return
	}

	// 创建 LDAP 客户端，验证用户是否存在
	ldapClient, err := ldap.NewClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 LDAP: " + err.Error()})
		return
	}
	defer ldapClient.Close()

	// 验证 LDAP 用户是否存在
	ldapUser, err := ldapClient.GetUser(req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "LDAP 用户不存在，请先在用户管理中创建: " + req.Name})
		return
	}

	// 使用管理员客户端执行写操作
	slurmClient, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 检查 Slurm 用户是否已存在
	existingSlurmUser, err := slurmClient.GetSlurmUser(req.Name)
	if err == nil && existingSlurmUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Slurm 用户已存在"})
		return
	}

	// 创建 Slurm 用户
	slurmUser := &slurm.SlurmUser{
		Name:           req.Name,
		AdminLevel:     req.AdminLevel,
		DefaultAccount: req.DefaultAccount,
	}

	if err := slurmClient.CreateSlurmUser(slurmUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建 Slurm 用户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Slurm 用户创建成功（已关联到 LDAP 系统用户）",
		"data": gin.H{
			"slurm_user": slurmUser,
			"ldap_user": gin.H{
				"username": ldapUser.Username,
				"uid":      ldapUser.UID,
				"gid":      ldapUser.GID,
				"cn_name":  ldapUser.CNName,
			},
		},
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

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
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

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
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

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
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

	// 获取当前用户
	username, _ := c.Get("username")
	
	client, err := GetSlurmClientForUser(username.(string))
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

	// 设置默认 cluster
	if assoc.Cluster == "" {
		assoc.Cluster = "cluster"
	}

	// 开发模式：模拟创建成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusCreated, gin.H{"message": "资源绑定创建成功 (开发模式)", "data": assoc})
		return
	}

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法连接到 Slurm API: " + err.Error()})
		return
	}

	// 1. 检查用户是否存在于 Slurm 中
	_, err = client.GetSlurmUser(assoc.User)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户不存在于 Slurm 中，请先创建 Slurm 用户: " + assoc.User})
		return
	}

	// 2. 检查账户是否存在，如果不存在则创建
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
		
		if err := client.CreateAssociation(rootAssoc); err != nil {
			// root绑定失败不影响后续操作，只记录日志
			// 继续创建用户的绑定
		}
	}

	// 3. 创建用户到账户的资源绑定
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

	// 设置默认 cluster
	if cluster == "" {
		cluster = "cluster"
	}

	var assoc slurm.Association
	if err := c.ShouldBindJSON(&assoc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据格式错误: " + err.Error()})
		return
	}

	// 确保 body 中的字段与查询参数一致
	assoc.Account = account
	assoc.User = user
	assoc.Cluster = cluster

	// 开发模式：模拟更新成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "资源绑定更新成功 (开发模式)"})
		return
	}

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
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

	// 添加详细的参数日志
	fmt.Printf("DeleteAssociation called with: account='%s', user='%s', cluster='%s', partition='%s'\n", 
		account, user, cluster, partition)

	if account == "" || user == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("账户和用户参数不能为空 - account: '%s', user: '%s'", account, user)})
		return
	}

	// 开发模式：模拟删除成功
	if os.Getenv("DEV_MODE") == "true" {
		c.JSON(http.StatusOK, gin.H{"message": "资源绑定删除成功 (开发模式)"})
		return
	}

	// 使用管理员客户端执行写操作
	client, err := GetSlurmAdminClient()
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
