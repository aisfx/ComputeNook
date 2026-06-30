#!/usr/bin/env bash

# Slurm REST API JWT Token Generator
# 浣跨敤鏂规硶: ./generate_token.sh [username] [lifespan_seconds] [key_file]

# 榛樿鍙傛暟
USERNAME="${1:-root}"
LIFESPAN="${2:-3600}"
KEY_FILE="${3:-/etc/slurm/jwt_hs256.key}"

# 妫€鏌ュ瘑閽ユ枃浠舵槸鍚﹀瓨鍦?if [ ! -f "$KEY_FILE" ]; then
    echo "Error: Key file not found: $KEY_FILE"
    echo "Usage: $0 [username] [lifespan_seconds] [key_file]"
    echo "Example: $0 sunfx 86400 /etc/slurm/jwt_hs256.key"
    exit 1
fi

# 璇诲彇瀵嗛挜
SECRET=$(cat "$KEY_FILE" | tr -d '\n\r ')

# 褰撳墠鏃堕棿鎴?IAT=$(date +%s)
EXP=$((IAT + LIFESPAN))

# 鍒涘缓Header (Base64 URL缂栫爜)
HEADER='{"alg":"HS256","typ":"JWT"}'
HEADER_B64=$(echo -n "$HEADER" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')

# 鍒涘缓Payload (Base64 URL缂栫爜)
PAYLOAD="{\"exp\":$EXP,\"iat\":$IAT,\"sun\":\"$USERNAME\"}"
PAYLOAD_B64=$(echo -n "$PAYLOAD" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')

# 鍒涘缓绛惧悕
MESSAGE="${HEADER_B64}.${PAYLOAD_B64}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')

# 鐢熸垚瀹屾暣鐨凧WT token
TOKEN="${MESSAGE}.${SIGNATURE}"

# 杈撳嚭缁撴灉
echo "========================================"
echo "JWT Token Generated Successfully"
echo "========================================"
echo "Username:  $USERNAME"
echo "Issued At: $(date -r $IAT '+%Y-%m-%d %H:%M:%S')"
echo "Expires:   $(date -r $EXP '+%Y-%m-%d %H:%M:%S')"
echo "Lifespan:  $LIFESPAN seconds ($((LIFESPAN / 3600)) hours)"
echo "========================================"
echo "Token:"
echo "$TOKEN"
echo "========================================"
echo ""
echo "To use this token, update your .env file:"
echo "SLURM_REST_TOKEN=$TOKEN"
echo "========================================"
