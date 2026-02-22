package slurm

import (
	"encoding/json"
	"fmt"
)

// Account Slurm 账户
type Account struct {
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	Organization string   `json:"organization,omitempty"`
	Coordinators []string `json:"coordinators,omitempty"`
	Parent       string   `json:"parent,omitempty"`
}

// SlurmUser Slurm 用户
type SlurmUser struct {
	Name           string   `json:"name"`
	DefaultAccount string   `json:"default_account,omitempty"` // 用于前端显示
	AdminLevel     string   `json:"admin_level,omitempty"` // 用于前端显示
	
	// Slurm API 原始字段 - 使用指针以便 omitempty 正确工作
	Default *struct {
		Account string `json:"account,omitempty"`
		Wckey   string `json:"wckey,omitempty"`
	} `json:"default,omitempty"`
	AdministratorLevel []string      `json:"administrator_level,omitempty"`
	Associations       []interface{} `json:"associations,omitempty"`
	Coordinators       []string      `json:"coordinators,omitempty"`
	Flags              []string      `json:"flags,omitempty"`
	Wckeys             []string      `json:"wckeys,omitempty"`
}

// Association Slurm 关联
type Association struct {
	Account   string   `json:"account"`
	Cluster   string   `json:"cluster,omitempty"`
	Partition string   `json:"partition,omitempty"`
	User      string   `json:"user"`
	QoS       []string `json:"qos,omitempty"`
	IsDefault bool     `json:"is_default,omitempty"`
}

// AssociationsResponse Slurm 关联列表响应
type AssociationsResponse struct {
	Associations []Association `json:"associations"`
	Errors       []Error       `json:"errors"`
}

// AccountsResponse Slurm 账户列表响应
type AccountsResponse struct {
	Accounts []Account `json:"accounts"`
	Errors   []Error   `json:"errors"`
}

// UsersResponse Slurm 用户列表响应
type UsersResponse struct {
	Users  []SlurmUser `json:"users"`
	Errors []Error     `json:"errors"`
}

// GetAccounts 获取所有账户
func (c *Client) GetAccounts() ([]Account, error) {
	respBody, err := c.doRequest("GET", c.buildAPIPath("/accounts"), nil)
	if err != nil {
		return nil, err
	}

	var response AccountsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse accounts response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return response.Accounts, nil
}

// GetAccount 获取单个账户
func (c *Client) GetAccount(name string) (*Account, error) {
	path := c.buildAPIPath(fmt.Sprintf("/account/%s", name))
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response AccountsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse account response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	if len(response.Accounts) == 0 {
		return nil, fmt.Errorf("account not found")
	}

	return &response.Accounts[0], nil
}

// CreateAccount 创建账户
// 注意：此方法只创建账户，不创建关联
// 要创建关联，需要单独调用 CreateAssociation
func (c *Client) CreateAccount(account *Account) error {
	if account.Name == "" {
		return fmt.Errorf("account name is required")
	}

	// 设置默认值
	if account.Coordinators == nil {
		account.Coordinators = []string{}
	}
	
	// 如果没有指定父账户，默认使用 root
	if account.Parent == "" {
		account.Parent = "root"
	}

	// 如果没有指定 organization，使用默认值
	if account.Organization == "" {
		account.Organization = "Default"
	}

	// 只创建账户，不创建关联
	// 这样可以保证兼容所有API版本
	body := map[string]interface{}{
		"accounts": []Account{*account},
	}

	respBody, err := c.doRequest("POST", c.buildAPIPath("/accounts"), body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response AccountsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w (response: %s)", err, string(respBody))
	}

	if len(response.Errors) > 0 {
		errMsg := response.Errors[0].Error
		errNum := response.Errors[0].ErrorNumber
		return fmt.Errorf("slurm API error (code %d): %s", errNum, errMsg)
	}

	return nil
}

// UpdateAccount 更新账户
func (c *Client) UpdateAccount(name string, account *Account) error {
	body := map[string]interface{}{
		"accounts": []Account{*account},
	}

	respBody, err := c.doRequest("POST", c.buildAPIPath("/accounts"), body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response AccountsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}

// DeleteAccount 删除账户
func (c *Client) DeleteAccount(name string) error {
	path := c.buildAPIPath(fmt.Sprintf("/account/%s", name))
	respBody, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response AccountsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}

// GetSlurmUsers 获取所有 Slurm 用户
func (c *Client) GetSlurmUsers() ([]SlurmUser, error) {
	respBody, err := c.doRequest("GET", c.buildAPIPath("/users"), nil)
	if err != nil {
		return nil, err
	}

	var response UsersResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse users response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	// 获取所有关联以提取默认账户
	associations, err := c.GetAssociations()
	if err != nil {
		// 如果获取关联失败，仍然返回用户列表，只是没有默认账户信息
		associations = []Association{}
	}

	// 创建用户到账户的映射
	userAccountMap := make(map[string]string)
	for _, assoc := range associations {
		if assoc.User != "" {
			// 使用第一个找到的账户作为默认账户
			if _, exists := userAccountMap[assoc.User]; !exists {
				userAccountMap[assoc.User] = assoc.Account
			}
		}
	}

	// 转换数据：将嵌套字段提取到顶层
	for i := range response.Users {
		user := &response.Users[i]
		
		// 优先使用 default.account，如果为空则从 associations 中查找
		if user.Default != nil && user.Default.Account != "" {
			user.DefaultAccount = user.Default.Account
		} else if account, exists := userAccountMap[user.Name]; exists {
			user.DefaultAccount = account
		}
		
		// 提取 administrator_level 数组的第一个元素到 admin_level
		if len(user.AdministratorLevel) > 0 {
			user.AdminLevel = user.AdministratorLevel[0]
		} else {
			user.AdminLevel = "None"
		}
	}

	return response.Users, nil
}

// GetSlurmUser 获取单个 Slurm 用户
func (c *Client) GetSlurmUser(name string) (*SlurmUser, error) {
	path := c.buildAPIPath(fmt.Sprintf("/user/%s", name))
	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response UsersResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse user response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	if len(response.Users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	user := &response.Users[0]
	
	// 转换数据：将嵌套字段提取到顶层
	if user.Default != nil && user.Default.Account != "" {
		user.DefaultAccount = user.Default.Account
	}
	if len(user.AdministratorLevel) > 0 {
		user.AdminLevel = user.AdministratorLevel[0]
	} else {
		user.AdminLevel = "None"
	}

	return user, nil
}

// CreateSlurmUser 创建 Slurm 用户
func (c *Client) CreateSlurmUser(user *SlurmUser) error {
	if user.Name == "" {
		return fmt.Errorf("user name is required")
	}

	// 转换数据：将扁平结构转换为 Slurm API 需要的嵌套结构
	// 注意：default.account 不能通过用户API设置，需要通过 associations 管理
	if user.AdminLevel != "" {
		user.AdministratorLevel = []string{user.AdminLevel}
	} else {
		user.AdministratorLevel = []string{"None"}
	}

	body := map[string]interface{}{
		"users": []SlurmUser{*user},
	}

	respBody, err := c.doRequest("POST", c.buildAPIPath("/users"), body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response UsersResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w (response: %s)", err, string(respBody))
	}

	if len(response.Errors) > 0 {
		errMsg := response.Errors[0].Error
		errNum := response.Errors[0].ErrorNumber
		return fmt.Errorf("slurm API error (code %d): %s", errNum, errMsg)
	}

	return nil
}

// UpdateSlurmUser 更新 Slurm 用户
func (c *Client) UpdateSlurmUser(name string, user *SlurmUser) error {
	// 只更新 administrator_level，不发送其他字段
	// 这样可以避免"移除默认账户"的错误
	updateUser := &SlurmUser{
		Name: user.Name,
	}
	
	if user.AdminLevel != "" {
		updateUser.AdministratorLevel = []string{user.AdminLevel}
	} else {
		updateUser.AdministratorLevel = []string{"None"}
	}

	body := map[string]interface{}{
		"users": []SlurmUser{*updateUser},
	}

	respBody, err := c.doRequest("POST", c.buildAPIPath("/users"), body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response UsersResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}

// DeleteSlurmUser 删除 Slurm 用户
func (c *Client) DeleteSlurmUser(name string) error {
	path := c.buildAPIPath(fmt.Sprintf("/user/%s", name))
	respBody, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response UsersResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}

// GetAssociations 获取所有关联
func (c *Client) GetAssociations() ([]Association, error) {
	respBody, err := c.doRequest("GET", c.buildAPIPath("/associations"), nil)
	if err != nil {
		return nil, err
	}

	var response AssociationsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse associations response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	// 获取所有用户以标记默认账户
	// 注意：这里直接调用 API 而不是 GetSlurmUsers，避免循环依赖
	usersRespBody, err := c.doRequest("GET", c.buildAPIPath("/users"), nil)
	if err != nil {
		// 如果获取用户失败，仍然返回关联列表，只是没有默认账户标记
		return response.Associations, nil
	}

	var usersResponse UsersResponse
	if err := json.Unmarshal(usersRespBody, &usersResponse); err != nil {
		// 解析失败也返回关联列表
		return response.Associations, nil
	}

	// 创建用户默认账户映射
	defaultAccountMap := make(map[string]string)
	for _, user := range usersResponse.Users {
		// 从 default.account 字段提取默认账户
		if user.Default != nil && user.Default.Account != "" {
			defaultAccountMap[user.Name] = user.Default.Account
		}
	}

	// 标记默认账户
	for i := range response.Associations {
		assoc := &response.Associations[i]
		if defaultAccount, exists := defaultAccountMap[assoc.User]; exists {
			assoc.IsDefault = (assoc.Account == defaultAccount)
		}
	}

	return response.Associations, nil
}

// GetAssociation 获取单个关联
func (c *Client) GetAssociation(account, user, cluster string) (*Association, error) {
	path := c.buildAPIPath(fmt.Sprintf("/association?account=%s&user=%s", account, user))
	if cluster != "" {
		path += fmt.Sprintf("&cluster=%s", cluster)
	}

	respBody, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var response AssociationsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse association response: %w", err)
	}

	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	if len(response.Associations) == 0 {
		return nil, fmt.Errorf("association not found")
	}

	return &response.Associations[0], nil
}

// CreateAssociation 创建关联
func (c *Client) CreateAssociation(assoc *Association) error {
	if assoc.Account == "" || assoc.User == "" {
		return fmt.Errorf("account and user are required")
	}

	body := map[string]interface{}{
		"associations": []Association{*assoc},
	}

	respBody, err := c.doRequest("POST", c.buildAPIPath("/associations"), body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response AssociationsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w (response: %s)", err, string(respBody))
	}

	if len(response.Errors) > 0 {
		errMsg := response.Errors[0].Error
		errNum := response.Errors[0].ErrorNumber
		return fmt.Errorf("slurm API error (code %d): %s", errNum, errMsg)
	}

	return nil
}

// UpdateAssociation 更新关联
func (c *Client) UpdateAssociation(account, user, cluster string, assoc *Association) error {
	if assoc.Account == "" || assoc.User == "" {
		return fmt.Errorf("account and user are required")
	}

	body := map[string]interface{}{
		"associations": []Association{*assoc},
	}

	respBody, err := c.doRequest("POST", c.buildAPIPath("/associations"), body)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response AssociationsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}

// DeleteAssociation 删除关联
func (c *Client) DeleteAssociation(account, user, cluster, partition string) error {
	// 构建查询参数，必须提供足够的参数来唯一标识一个association
	path := c.buildAPIPath(fmt.Sprintf("/association?account=%s&user=%s", account, user))
	
	// cluster 是必需的，如果为空则使用默认值
	if cluster == "" {
		cluster = "cluster"
	}
	path += fmt.Sprintf("&cluster=%s", cluster)
	
	// 如果提供了 partition，也加入查询参数
	if partition != "" {
		path += fmt.Sprintf("&partition=%s", partition)
	}

	respBody, err := c.doRequest("DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("API request failed: %w", err)
	}

	var response AssociationsResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("slurm API error: %s", response.Errors[0].Error)
	}

	return nil
}
