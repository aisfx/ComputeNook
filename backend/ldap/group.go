package ldap

import (
	"fmt"
	"os"
	"strconv"

	"github.com/go-ldap/ldap/v3"
	"hpc-backend/models"
)

// GetGroups 获取所有用户组
func (c *Client) GetGroups() ([]*models.Group, error) {
	baseDN := os.Getenv("LDAP_GROUP_BASE_DN")

	searchRequest := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0, 0, false,
		"(objectClass=posixGroup)",
		[]string{"cn", "gidNumber", "memberUid"},
		nil,
	)

	sr, err := c.conn.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to search groups: %w", err)
	}

	groups := make([]*models.Group, 0, len(sr.Entries))
	for _, entry := range sr.Entries {
		group := &models.Group{
			GroupName: entry.GetAttributeValue("cn"),
			Members:   entry.GetAttributeValues("memberUid"),
		}

		if gidStr := entry.GetAttributeValue("gidNumber"); gidStr != "" {
			group.GID, _ = strconv.Atoi(gidStr)
		}

		groups = append(groups, group)
	}

	return groups, nil
}

// GetGroup 获取单个用户组
func (c *Client) GetGroup(gid int) (*models.Group, error) {
	baseDN := os.Getenv("LDAP_GROUP_BASE_DN")

	searchRequest := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0, 0, false,
		fmt.Sprintf("(&(objectClass=posixGroup)(gidNumber=%d))", gid),
		[]string{"cn", "gidNumber", "memberUid"},
		nil,
	)

	sr, err := c.conn.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to search group: %w", err)
	}

	if len(sr.Entries) == 0 {
		return nil, fmt.Errorf("group not found")
	}

	entry := sr.Entries[0]
	group := &models.Group{
		GroupName: entry.GetAttributeValue("cn"),
		Members:   entry.GetAttributeValues("memberUid"),
	}

	if gidStr := entry.GetAttributeValue("gidNumber"); gidStr != "" {
		group.GID, _ = strconv.Atoi(gidStr)
	}

	return group, nil
}

// CreateGroup 创建用户组
func (c *Client) CreateGroup(group *models.Group) error {
	baseDN := os.Getenv("LDAP_GROUP_BASE_DN")
	dn := fmt.Sprintf("cn=%s,%s", group.GroupName, baseDN)

	addRequest := ldap.NewAddRequest(dn, nil)
	addRequest.Attribute("objectClass", []string{"top", "posixGroup"})
	addRequest.Attribute("cn", []string{group.GroupName})
	addRequest.Attribute("gidNumber", []string{strconv.Itoa(group.GID)})

	if len(group.Members) > 0 {
		addRequest.Attribute("memberUid", group.Members)
	}

	if err := c.conn.Add(addRequest); err != nil {
		return fmt.Errorf("failed to create group: %w", err)
	}

	return nil
}

// UpdateGroup 更新用户组
func (c *Client) UpdateGroup(gid int, group *models.Group) error {
	baseDN := os.Getenv("LDAP_GROUP_BASE_DN")

	// 先查找组的 DN
	oldGroup, err := c.GetGroup(gid)
	if err != nil {
		return err
	}

	dn := fmt.Sprintf("cn=%s,%s", oldGroup.GroupName, baseDN)

	modifyRequest := ldap.NewModifyRequest(dn, nil)
	modifyRequest.Replace("memberUid", group.Members)

	if err := c.conn.Modify(modifyRequest); err != nil {
		return fmt.Errorf("failed to update group: %w", err)
	}

	return nil
}

// DeleteGroup 删除用户组
func (c *Client) DeleteGroup(gid int) error {
	baseDN := os.Getenv("LDAP_GROUP_BASE_DN")

	// 先查找组的 DN
	group, err := c.GetGroup(gid)
	if err != nil {
		return err
	}

	dn := fmt.Sprintf("cn=%s,%s", group.GroupName, baseDN)

	deleteRequest := ldap.NewDelRequest(dn, nil)
	if err := c.conn.Del(deleteRequest); err != nil {
		return fmt.Errorf("failed to delete group: %w", err)
	}

	return nil
}
