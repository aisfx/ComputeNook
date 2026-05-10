.PHONY: run build clean test install create-user migrate-templates

# 运行服务（自动查找 .env 或 ../.env）
run:
	go run .

# 编译（Linux amd64）
build:
	GOOS=linux GOARCH=amd64 go build -o computenook .

# 清理
clean:
	rm -f computenook

# 安装依赖
install:
	go mod download
	go mod tidy

# 迁移 TOML 模板到数据库
migrate-templates:
	@echo "迁移作业模板到数据库..."
	cd tools && go run migrate_templates.go ../app-templates.toml
	@echo "迁移完成！"
