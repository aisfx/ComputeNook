package models

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"
	"hpc-backend/logger"
)

var DB *sql.DB

// InitDatabase 初始化数据库连接
func InitDatabase() error {
	dbType := os.Getenv("DB_TYPE")
	if dbType == "" {
		dbType = "sqlite" // 默认使用 SQLite
	}

	var err error
	switch dbType {
	case "mysql":
		err = initMySQL()
	case "sqlite":
		err = initSQLite()
	default:
		return fmt.Errorf("unsupported database type: %s", dbType)
	}

	if err != nil {
		return err
	}

	// 创建表
	if err := createTables(); err != nil {
		return err
	}

	// 创建充值记录表
	if err := CreateBillingRechargeTable(); err != nil {
		logger.Warn("Failed to create billing_recharge table: %v", err)
	}

	logger.Info("Database initialized successfully (type: %s)", dbType)
	return nil
}

// initMySQL 初始化 MySQL 连接
func initMySQL() error {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	database := os.Getenv("DB_NAME")

	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "3306"
	}
	if database == "" {
		database = "computenook"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		user, password, host, port, database)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to MySQL: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping MySQL: %w", err)
	}

	logger.Info("Connected to MySQL: %s:%s/%s", host, port, database)
	return nil
}

// initSQLite 初始化 SQLite 连接
func initSQLite() error {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/hpc_platform.db"
	}

	// 确保目录存在
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to connect to SQLite: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping SQLite: %w", err)
	}

	logger.Info("Connected to SQLite: %s", dbPath)
	return nil
}

// createTables 创建数据库表
func createTables() error {
	dbType := os.Getenv("DB_TYPE")
	if dbType == "" {
		dbType = "sqlite"
	}

	var createAppTemplatesSQL string
	if dbType == "mysql" {
		createAppTemplatesSQL = `
		CREATE TABLE IF NOT EXISTS app_templates (
			id INT PRIMARY KEY AUTO_INCREMENT,
			name VARCHAR(255) NOT NULL,
			icon VARCHAR(50),
			category VARCHAR(50),
			app_type VARCHAR(100),
			job_type VARCHAR(20) DEFAULT 'normal',
			description TEXT,
			nodes INT DEFAULT 1,
			cpus INT DEFAULT 1,
			gpus INT DEFAULT 0,
			memory INT DEFAULT 1,
			time INT DEFAULT 1,
			partition VARCHAR(100),
			module_load VARCHAR(255),
			executable VARCHAR(255),
			input_file VARCHAR(255),
			container_image VARCHAR(512),
			app_params JSON,
			owner VARCHAR(255) DEFAULT '',
			is_public BOOLEAN DEFAULT false,
			show_in_quick BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`
	} else {
		createAppTemplatesSQL = `
		CREATE TABLE IF NOT EXISTS app_templates (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			icon TEXT,
			category TEXT,
			app_type TEXT,
			job_type TEXT DEFAULT 'normal',
			description TEXT,
			nodes INTEGER DEFAULT 1,
			cpus INTEGER DEFAULT 1,
			gpus INTEGER DEFAULT 0,
			memory INTEGER DEFAULT 1,
			time INTEGER DEFAULT 1,
			partition TEXT,
			module_load TEXT,
			executable TEXT,
			input_file TEXT,
			container_image TEXT,
			app_params TEXT,
			owner TEXT DEFAULT '',
			is_public INTEGER DEFAULT 0,
			show_in_quick INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		`
	}

	if _, err := DB.Exec(createAppTemplatesSQL); err != nil {
		return fmt.Errorf("failed to create app_templates table: %w", err)
	}

	// 对已有数据库做迁移：补充新列（忽略已存在错误）
	migrations := []string{
		`ALTER TABLE app_templates ADD COLUMN job_type TEXT DEFAULT 'normal'`,
		`ALTER TABLE app_templates ADD COLUMN container_image TEXT`,
		`ALTER TABLE app_templates ADD COLUMN owner TEXT DEFAULT ''`,
		`ALTER TABLE app_templates ADD COLUMN is_public INTEGER DEFAULT 0`,
	}
	if dbType == "mysql" {
		migrations = []string{
			`ALTER TABLE app_templates ADD COLUMN job_type VARCHAR(20) DEFAULT 'normal'`,
			`ALTER TABLE app_templates ADD COLUMN container_image VARCHAR(512)`,
			`ALTER TABLE app_templates ADD COLUMN owner VARCHAR(255) DEFAULT ''`,
			`ALTER TABLE app_templates ADD COLUMN is_public BOOLEAN DEFAULT false`,
		}
	}
	for _, m := range migrations {
		DB.Exec(m) // 忽略"列已存在"错误
	}

	logger.Info("Database tables created successfully")
	return nil
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
