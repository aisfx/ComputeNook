<template>
  <div class="accounts-improved">
    <div class="page-header">
      <h3>📊 账户组管理</h3>
      <button class="btn-primary" @click="openCreateAccountDialog">
        + 创建账户组
      </button>
    </div>

    <div class="filters-bar">
      <input 
        v-model="searchQuery" 
        placeholder="🔍 搜索账户名称..." 
        class="search-input"
      />
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    
    <div v-else class="accounts-grid">
      <div v-for="account in filteredAccounts" :key="account.name" class="account-card">
        <div class="card-header">
          <div class="account-info">
            <h4>📁 {{ account.name }}</h4>
            <p class="description">{{ account.description || '无描述' }}</p>
          </div>
          <div class="card-actions">
            <button class="btn-icon" @click="editAccount(account)" title="编辑">
              ✏️
            </button>
            <button class="btn-icon danger" @click="deleteAccount(account.name)" title="删除">
              🗑️
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- 组织信息 -->
          <div class="info-row">
            <span class="label">组织：</span>
            <span class="value">{{ account.organization || '-' }}</span>
          </div>

          <!-- 协调员 -->
          <div class="info-row">
            <span class="label">协调员：</span>
            <div class="tags">
              <span v-for="coord in account.coordinators" :key="coord" class="tag">
                {{ coord }}
              </span>
              <span v-if="!account.coordinators || account.coordinators.length === 0" class="text-muted">
                无
              </span>
            </div>
          </div>

          <!-- 关联用户 -->
          <div class="info-row">
            <span class="label">关联用户：</span>
            <div class="tags">
              <span v-for="user in getAccountUsers(account.name)" :key="user" class="tag tag-user">
                👤 {{ user }}
              </span>
              <span v-if="getAccountUsers(account.name).length === 0" class="text-muted">
                无
              </span>
            </div>
          </div>

          <!-- QoS 配置 -->
          <div class="info-row">
            <span class="label">可用 QoS：</span>
            <div class="tags">
              <span v-for="qos in getAccountQosList(account)" :key="qos" class="tag tag-qos">
                {{ qos }}
              </span>
            </div>
          </div>

          <div class="info-row">
            <span class="label">默认 QoS：</span>
            <span v-if="formatValue(account.default_qos)" class="badge badge-primary">
              {{ formatValue(account.default_qos) }}
            </span>
            <span v-else class="text-muted">未设置</span>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn-link" @click="manageUsers(account)">
            👥 管理用户
          </button>
          <button class="btn-link" @click="manageQoS(account)">
            ⚡ 配置 QoS
          </button>
        </div>
      </div>

      <div v-if="filteredAccounts.length === 0" class="empty-state">
        <p>暂无账户数据</p>
      </div>
    </div>

    <!-- 创建/编辑账户对话框 -->
    <div v-if="showAccountDialog" class="modal-overlay" @click.self="closeDialogs">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>{{ isEditMode ? '编辑账户组' : '创建账户组' }}</h3>
          <button class="btn-close" @click="closeDialogs">×</button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <h4>基本信息</h4>
            <div class="form-group">
              <label>账户名称 *</label>
              <input 
                v-model="accountForm.name" 
                :disabled="isEditMode"
                placeholder="例如: research"
              />
            </div>
            <div class="form-group">
              <label>描述</label>
              <input 
                v-model="accountForm.description" 
                placeholder="账户描述"
              />
            </div>
            <div class="form-group">
              <label>组织</label>
              <input 
                v-model="accountForm.organization" 
                placeholder="组织名称"
              />
            </div>
            <div class="form-group">
              <label>协调员</label>
              <textarea 
                v-model="coordinatorsText" 
                rows="3"
                placeholder="每行一个用户名"
              ></textarea>
            </div>
          </div>

          <div class="form-section">
            <h4>QoS 配置</h4>
            <div class="form-group">
              <label>可用 QoS 列表</label>
              <div class="qos-selector">
                <label v-for="qos in availableQosList" :key="qos" class="checkbox-label">
                  <input 
                    type="checkbox" 
                    :value="qos"
                    v-model="selectedQosList"
                  />
                  {{ qos }}
                </label>
              </div>
            </div>
            <div class="form-group">
              <label>默认 QoS</label>
              <select v-model="accountForm.default_qos">
                <option value="">无</option>
                <option v-for="qos in selectedQosList" :key="qos" :value="qos">
                  {{ qos }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDialogs">取消</button>
          <button class="btn-primary" @click="saveAccount" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 管理用户对话框 -->
    <div v-if="showUsersDialog" class="modal-overlay" @click.self="closeDialogs">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>管理账户用户 - {{ selectedAccount?.name }}</h3>
          <button class="btn-close" @click="closeDialogs">×</button>
        </div>
        <div class="modal-body">
          <div class="users-management">
            <div class="section">
              <h4>当前用户</h4>
              <div class="user-list">
                <div v-for="user in getAccountUsers(selectedAccount?.name)" :key="user" class="user-item">
                  <span>👤 {{ user }}</span>
                  <button class="btn-link danger" @click="removeUserFromAccount(user)">
                    移除
                  </button>
                </div>
                <div v-if="getAccountUsers(selectedAccount?.name).length === 0" class="empty-text">
                  暂无用户
                </div>
              </div>
            </div>

            <div class="section">
              <h4>添加用户</h4>
              <div class="form-group">
                <label>选择用户</label>
                <select v-model="newUserToAdd">
                  <option value="">请选择...</option>
                  <option v-for="user in availableUsers" :key="user" :value="user">
                    {{ user }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>队列/分区</label>
                <input v-model="newUserPartition" placeholder="留空表示所有分区" />
              </div>
              <button class="btn-primary" @click="addUserToAccount" :disabled="!newUserToAdd">
                添加用户
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDialogs">关闭</button>
        </div>
      </div>
    </div>

    <!-- 配置 QoS 对话框 -->
    <div v-if="showQoSDialog" class="modal-overlay" @click.self="closeDialogs">
      <div class="modal">
        <div class="modal-header">
          <h3>配置 QoS - {{ selectedAccount?.name }}</h3>
          <button class="btn-close" @click="closeDialogs">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>可用 QoS 列表</label>
            <div class="qos-selector">
              <label v-for="qos in availableQosList" :key="qos" class="checkbox-label">
                <input 
                  type="checkbox" 
                  :value="qos"
                  v-model="accountQoSList"
                />
                {{ qos }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>默认 QoS</label>
            <select v-model="accountDefaultQoS">
              <option value="">无</option>
              <option v-for="qos in accountQoSList" :key="qos" :value="qos">
                {{ qos }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDialogs">取消</button>
          <button class="btn-primary" @click="saveAccountQoS" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
