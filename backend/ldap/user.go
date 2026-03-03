package ldap

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/go-ldap/ldap/v3"
	"hpc-backend/models"
)

// GetUsers 获取所有用户
func (c *Client) GetUsers() ([]*models.User, error) {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")

	searchRequest := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0, 0, false,
		"(objectClass=posixAccount)",
		[]string{"uid", "uidNumber", "gidNumber", "cn", "displayName", "sn", "mail", "telephoneNumber", "loginShell", "homeDirectory", "description", "shadowLastChange", "shadowExpire"},
		nil,
	)

	sr, err := c.conn.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}

	users := make([]*models.User, 0, len(sr.Entries))
	for _, entry := range sr.Entries {
		// 优先使用 displayName，如果没有则使用 cn，最后使用 sn
		cnName := entry.GetAttributeValue("displayName")
		if cnName == "" {
			cnName = entry.GetAttributeValue("cn")
		}
		if cnName == "" {
			cnName = entry.GetAttributeValue("sn")
		}
		if cnName == "" {
			cnName = entry.GetAttributeValue("uid")
		}
		
		user := &models.User{
			Username: entry.GetAttributeValue("uid"),
			CNName:   cnName,
			Email:    entry.GetAttributeValue("mail"),
			Phone:    entry.GetAttributeValue("telephoneNumber"),
			Shell:    entry.GetAttributeValue("loginShell"),
			HomeDir:  entry.GetAttributeValue("homeDirectory"),
		}

		if uidStr := entry.GetAttributeValue("uidNumber"); uidStr != "" {
			user.UID, _ = strconv.Atoi(uidStr)
		}
		if gidStr := entry.GetAttributeValue("gidNumber"); gidStr != "" {
			user.GID, _ = strconv.Atoi(gidStr)
		}

		// 检查是否被禁用
		// 使用 shadowExpire 属性：如果设置为 1，表示账户已过期（1970-01-02，即已过期）
		shadowExpire := entry.GetAttributeValue("shadowExpire")
		user.Disabled = (shadowExpire == "1")

		// 检查是否需要修改密码
		shadowLastChange := entry.GetAttributeValue("shadowLastChange")
		user.PasswordMustChange = (shadowLastChange == "0")

		// 检查是否是管理员
		user.IsAdmin = c.isUserAdmin(user.Username)

		users = append(users, user)
	}

	return users, nil
}

// GetUser 获取单个用户
func (c *Client) GetUser(username string) (*models.User, error) {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")

	searchRequest := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0, 0, false,
		fmt.Sprintf("(&(objectClass=posixAccount)(uid=%s))", ldap.EscapeFilter(username)),
		[]string{"uid", "uidNumber", "gidNumber", "cn", "displayName", "sn", "mail", "telephoneNumber", "loginShell", "homeDirectory", "description", "shadowLastChange", "shadowExpire"},
		nil,
	)

	sr, err := c.conn.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to search user: %w", err)
	}

	if len(sr.Entries) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	entry := sr.Entries[0]
	
	// 优先使用 displayName，如果没有则使用 cn，最后使用 sn
	cnName := entry.GetAttributeValue("displayName")
	if cnName == "" {
		cnName = entry.GetAttributeValue("cn")
	}
	if cnName == "" {
		cnName = entry.GetAttributeValue("sn")
	}
	if cnName == "" {
		cnName = entry.GetAttributeValue("uid")
	}
	
	user := &models.User{
		Username: entry.GetAttributeValue("uid"),
		CNName:   cnName,
		Email:    entry.GetAttributeValue("mail"),
		Phone:    entry.GetAttributeValue("telephoneNumber"),
		Shell:    entry.GetAttributeValue("loginShell"),
		HomeDir:  entry.GetAttributeValue("homeDirectory"),
	}

	if uidStr := entry.GetAttributeValue("uidNumber"); uidStr != "" {
		user.UID, _ = strconv.Atoi(uidStr)
	}
	if gidStr := entry.GetAttributeValue("gidNumber"); gidStr != "" {
		user.GID, _ = strconv.Atoi(gidStr)
	}

	// 检查是否被禁用
	// 使用 shadowExpire 属性：如果设置为 1，表示账户已过期（1970-01-02，即已过期）
	shadowExpire := entry.GetAttributeValue("shadowExpire")
	user.Disabled = (shadowExpire == "1")

	// 检查是否需要修改密码
	shadowLastChange := entry.GetAttributeValue("shadowLastChange")
	user.PasswordMustChange = (shadowLastChange == "0")

	user.IsAdmin = c.isUserAdmin(user.Username)

	return user, nil
}

// CreateUser 创建用户
func (c *Client) CreateUser(user *models.User, password string) error {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	dn := fmt.Sprintf("uid=%s,%s", user.Username, baseDN)

	addRequest := ldap.NewAddRequest(dn, nil)
	addRequest.Attribute("objectClass", []string{"top", "posixAccount", "shadowAccount", "inetOrgPerson"})
	addRequest.Attribute("uid", []string{user.Username})
	addRequest.Attribute("cn", []string{user.CNName})
	addRequest.Attribute("sn", []string{user.CNName})
	addRequest.Attribute("uidNumber", []string{strconv.Itoa(user.UID)})
	addRequest.Attribute("gidNumber", []string{strconv.Itoa(user.GID)})
	addRequest.Attribute("homeDirectory", []string{user.HomeDir})
	addRequest.Attribute("loginShell", []string{user.Shell})
	addRequest.Attribute("userPassword", []string{password})

	if user.Email != "" {
		addRequest.Attribute("mail", []string{user.Email})
	}
	if user.Phone != "" {
		addRequest.Attribute("telephoneNumber", []string{user.Phone})
	}

	if err := c.conn.Add(addRequest); err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// UpdateUser 更新用户
func (c *Client) UpdateUser(username string, user *models.User) error {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	dn := fmt.Sprintf("uid=%s,%s", username, baseDN)

	// 先获取当前用户信息，检查哪些属性存在
	currentUser, err := c.GetUser(username)
	if err != nil {
		return fmt.Errorf("failed to get current user: %w", err)
	}

	modifyRequest := ldap.NewModifyRequest(dn, nil)
	modifyRequest.Replace("cn", []string{user.CNName})
	modifyRequest.Replace("sn", []string{user.CNName})
	modifyRequest.Replace("gidNumber", []string{strconv.Itoa(user.GID)})
	modifyRequest.Replace("homeDirectory", []string{user.HomeDir})
	modifyRequest.Replace("loginShell", []string{user.Shell})

	// 邮箱处理
	if user.Email != "" {
		// 有新值，直接替换
		modifyRequest.Replace("mail", []string{user.Email})
	} else if currentUser.Email != "" {
		// 新值为空，但原来有值，则删除
		modifyRequest.Delete("mail", []string{})
	}
	// 如果新值为空且原来也没有值，则不做任何操作
	
	// 电话处理
	if user.Phone != "" {
		// 有新值，直接替换
		modifyRequest.Replace("telephoneNumber", []string{user.Phone})
	} else if currentUser.Phone != "" {
		// 新值为空，但原来有值，则删除
		modifyRequest.Delete("telephoneNumber", []string{})
	}
	// 如果新值为空且原来也没有值，则不做任何操作

	if err := c.conn.Modify(modifyRequest); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// DeleteUser 删除用户
func (c *Client) DeleteUser(username string) error {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	dn := fmt.Sprintf("uid=%s,%s", username, baseDN)

	deleteRequest := ldap.NewDelRequest(dn, nil)
	if err := c.conn.Del(deleteRequest); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// ResetPassword 重置密码
func (c *Client) ResetPassword(username, newPassword string) error {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	dn := fmt.Sprintf("uid=%s,%s", username, baseDN)

	modifyRequest := ldap.NewModifyRequest(dn, nil)
	// LDAP 会自动处理密码加密，直接传入明文即可
	// 如果需要特定格式，可以使用 {SSHA}、{MD5} 等前缀
	modifyRequest.Replace("userPassword", []string{newPassword})
	
	// 修改密码后，清除强制修改密码标记
	// 计算当前日期（从 1970-01-01 开始的天数）
	days := int(time.Now().Unix() / 86400)
	modifyRequest.Replace("shadowLastChange", []string{strconv.Itoa(days)})

	if err := c.conn.Modify(modifyRequest); err != nil {
		return fmt.Errorf("failed to reset password: %w", err)
	}

	return nil
}

// Authenticate 验证用户登录
func (c *Client) Authenticate(username, password string) (*models.User, error) {
	// 先获取用户信息
	user, err := c.GetUser(username)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// 尝试用用户凭据绑定
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	userDN := fmt.Sprintf("uid=%s,%s", username, baseDN)

	err = c.conn.Bind(userDN, password)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	// 重新绑定管理员账户
	bindDN := os.Getenv("LDAP_BIND_DN")
	bindPassword := os.Getenv("LDAP_BIND_PASSWORD")
	c.conn.Bind(bindDN, bindPassword)

	return user, nil
}

// isUserAdmin 检查用户是否是管理员
func (c *Client) isUserAdmin(username string) bool {
	groupBaseDN := os.Getenv("LDAP_GROUP_BASE_DN")
	adminGroups := []string{"admin", "wheel", "sudo"}

	for _, groupName := range adminGroups {
		searchRequest := ldap.NewSearchRequest(
			groupBaseDN,
			ldap.ScopeWholeSubtree,
			ldap.NeverDerefAliases,
			0, 0, false,
			fmt.Sprintf("(&(objectClass=posixGroup)(cn=%s)(memberUid=%s))", groupName, ldap.EscapeFilter(username)),
			[]string{"cn"},
			nil,
		)

		sr, err := c.conn.Search(searchRequest)
		if err == nil && len(sr.Entries) > 0 {
			return true
		}
	}

	return false
}

// GetNextAvailableUID 获取下一个可用的 UID
func (c *Client) GetNextAvailableUID() (int, error) {
	uidMin, _ := strconv.Atoi(os.Getenv("UID_MIN"))
	uidMax, _ := strconv.Atoi(os.Getenv("UID_MAX"))
	
	if uidMin == 0 {
		uidMin = 1000
	}
	if uidMax == 0 {
		uidMax = 65000
	}

	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	searchRequest := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0, 0, false,
		"(objectClass=posixAccount)",
		[]string{"uidNumber"},
		nil,
	)

	sr, err := c.conn.Search(searchRequest)
	if err != nil {
		return 0, fmt.Errorf("failed to search users: %w", err)
	}

	// 收集所有已使用的 UID
	usedUIDs := make(map[int]bool)
	for _, entry := range sr.Entries {
		if uidStr := entry.GetAttributeValue("uidNumber"); uidStr != "" {
			if uid, err := strconv.Atoi(uidStr); err == nil {
				usedUIDs[uid] = true
			}
		}
	}

	// 找到第一个未使用的 UID
	for uid := uidMin; uid <= uidMax; uid++ {
		if !usedUIDs[uid] {
			return uid, nil
		}
	}

	return 0, fmt.Errorf("no available UID in range %d-%d", uidMin, uidMax)
}

// GetNextAvailableGID 获取下一个可用的 GID
func (c *Client) GetNextAvailableGID() (int, error) {
	gidMin, _ := strconv.Atoi(os.Getenv("GID_MIN"))
	gidMax, _ := strconv.Atoi(os.Getenv("GID_MAX"))
	
	if gidMin == 0 {
		gidMin = 1000
	}
	if gidMax == 0 {
		gidMax = 65000
	}

	baseDN := os.Getenv("LDAP_GROUP_BASE_DN")
	searchRequest := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0, 0, false,
		"(objectClass=posixGroup)",
		[]string{"gidNumber"},
		nil,
	)

	sr, err := c.conn.Search(searchRequest)
	if err != nil {
		return 0, fmt.Errorf("failed to search groups: %w", err)
	}

	// 收集所有已使用的 GID
	usedGIDs := make(map[int]bool)
	for _, entry := range sr.Entries {
		if gidStr := entry.GetAttributeValue("gidNumber"); gidStr != "" {
			if gid, err := strconv.Atoi(gidStr); err == nil {
				usedGIDs[gid] = true
			}
		}
	}

	// 找到第一个未使用的 GID
	for gid := gidMin; gid <= gidMax; gid++ {
		if !usedGIDs[gid] {
			return gid, nil
		}
	}

	return 0, fmt.Errorf("no available GID in range %d-%d", gidMin, gidMax)
}

// SetUserDisabled 禁用/启用用户
func (c *Client) SetUserDisabled(username string, disabled bool) error {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	dn := fmt.Sprintf("uid=%s,%s", username, baseDN)

	modifyRequest := ldap.NewModifyRequest(dn, nil)
	
	if disabled {
		// 禁用用户：设置 shadowExpire 为 1（1970-01-02，表示账户已过期）
		modifyRequest.Replace("shadowExpire", []string{"1"})
	} else {
		// 启用用户：删除 shadowExpire 属性或设置为很大的值
		// 删除属性表示账户永不过期
		modifyRequest.Delete("shadowExpire", []string{})
	}

	if err := c.conn.Modify(modifyRequest); err != nil {
		return fmt.Errorf("failed to set user disabled status: %w", err)
	}

	return nil
}

// SetPasswordMustChange 设置用户首次登录必须修改密码
func (c *Client) SetPasswordMustChange(username string, mustChange bool) error {
	baseDN := os.Getenv("LDAP_USER_BASE_DN")
	dn := fmt.Sprintf("uid=%s,%s", username, baseDN)

	modifyRequest := ldap.NewModifyRequest(dn, nil)
	
	if mustChange {
		// 设置 shadowLastChange 为 0（表示密码已过期，必须修改）
		modifyRequest.Replace("shadowLastChange", []string{"0"})
	} else {
		// 计算当前日期（从 1970-01-01 开始的天数）
		days := int(time.Now().Unix() / 86400)
		modifyRequest.Replace("shadowLastChange", []string{strconv.Itoa(days)})
	}

	if err := c.conn.Modify(modifyRequest); err != nil {
		return fmt.Errorf("failed to set password must change: %w", err)
	}

	return nil
}
