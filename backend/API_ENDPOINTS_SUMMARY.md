# Slurm API 端点总结

## 创建账户和用户

### 使用的API端点
```
POST /slurmdb/{version}/accounts/associations
```

### 创建账户请求格式
```json
{
  "accounts": [
    {
      "name": "test",
      "description": "Test Account",
      "organization": "org"
    }
  ],
  "associations": [
    {
      "account": "test",
      "cluster": "cluster"
    }
  ]
}
```

### 创建用户请求格式
```json
{
  "users": [
    {
      "name": "bob",
      "administrator_level": ["None"]
    }
  ],
  "associations": [
    {
      "user": "bob",
      "account": "test",
      "cluster": "cluster"
    }
  ]
}
```

## 关键点

1. **统一端点**: 账户和用户创建都使用 `/accounts/associations` 端点
2. **必需字段**: 
   - 账户: `account` + `cluster`
   - 用户: `user` + `account` + `cluster`
3. **原子操作**: 账户/用户和关联在一个API调用中创建
4. **API版本**: 通过 `.env` 中的 `SLURM_API_VERSION` 配置

## 代码位置

- `backend/slurm/account.go` - CreateAccount, CreateSlurmUserWithAssociation
- `backend/handlers/slurm_account.go` - HTTP handlers
- `backend/.env` - SLURM_API_VERSION 配置
