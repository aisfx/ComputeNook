package ldap

import (
	"crypto/tls"
	"fmt"
	"os"

	"github.com/go-ldap/ldap/v3"
)

type Client struct {
	conn *ldap.Conn
}

// NewClient 创建新的 LDAP 客户端
func NewClient() (*Client, error) {
	host := os.Getenv("LDAP_HOST")
	port := os.Getenv("LDAP_PORT")
	if port == "" {
		port = "389"
	}

	if host == "" {
		return nil, fmt.Errorf("LDAP_HOST is not set")
	}

	useSSL := os.Getenv("LDAP_USE_SSL") == "true"
	skipVerify := os.Getenv("LDAP_SKIP_VERIFY") == "true"

	var conn *ldap.Conn
	var err error

	if useSSL {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: skipVerify,
			ServerName:         host,
		}
		conn, err = ldap.DialTLS("tcp", fmt.Sprintf("%s:%s", host, port), tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to LDAPS: %w", err)
		}
	} else {
		conn, err = ldap.Dial("tcp", fmt.Sprintf("%s:%s", host, port))
		if err != nil {
			return nil, fmt.Errorf("failed to connect to LDAP: %w", err)
		}
	}

	// 绑定管理员账户
	bindDN := os.Getenv("LDAP_BIND_DN")
	bindPassword := os.Getenv("LDAP_BIND_PASSWORD")

	if bindDN == "" || bindPassword == "" {
		conn.Close()
		return nil, fmt.Errorf("LDAP_BIND_DN and LDAP_BIND_PASSWORD must be set")
	}

	err = conn.Bind(bindDN, bindPassword)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to bind to LDAP: %w", err)
	}

	return &Client{conn: conn}, nil
}

// Close 关闭连接
func (c *Client) Close() {
	if c.conn != nil {
		c.conn.Close()
	}
}
