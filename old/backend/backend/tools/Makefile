.PHONY: help token token-1h token-24h token-7d token-30d build clean

# 默认密钥文件路径
KEY_FILE ?= /etc/slurm/jwt_hs256.key
# 默认用户名
USERNAME ?= root

help:
	@echo "Slurm REST API Token Generator"
	@echo ""
	@echo "Usage:"
	@echo "  make token              - Generate token with default settings (1 hour)"
	@echo "  make token-1h           - Generate token valid for 1 hour"
	@echo "  make token-24h          - Generate token valid for 24 hours"
	@echo "  make token-7d           - Generate token valid for 7 days"
	@echo "  make token-30d          - Generate token valid for 30 days"
	@echo "  make build              - Build Go version"
	@echo "  make clean              - Clean build artifacts"
	@echo ""
	@echo "Environment variables:"
	@echo "  USERNAME=<user>         - Set username (default: root)"
	@echo "  KEY_FILE=<path>         - Set key file path (default: /etc/slurm/jwt_hs256.key)"
	@echo ""
	@echo "Examples:"
	@echo "  make token USERNAME=sunfx"
	@echo "  make token-24h USERNAME=sunfx KEY_FILE=/path/to/key"

token: token-1h

token-1h:
	@./generate_token.sh $(USERNAME) 3600 $(KEY_FILE)

token-24h:
	@./generate_token.sh $(USERNAME) 86400 $(KEY_FILE)

token-7d:
	@./generate_token.sh $(USERNAME) 604800 $(KEY_FILE)

token-30d:
	@./generate_token.sh $(USERNAME) 2592000 $(KEY_FILE)

build:
	@echo "Building Go version..."
	@go build -o generate_token generate_token.go
	@echo "Done! Run: ./generate_token -help"

clean:
	@rm -f generate_token
	@echo "Cleaned build artifacts"
