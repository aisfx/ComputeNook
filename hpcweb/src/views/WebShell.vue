<template>
  <div class="card webshell">
    <div class="shell-header">
      <h3>💻 Web Shell</h3>
      <div class="shell-controls">
        <button class="btn-secondary" @click="clearTerminal">清空</button>
        <button class="btn-secondary" @click="reconnect">重连</button>
      </div>
    </div>

    <div class="terminal" ref="terminalRef">
      <div v-for="(line, index) in output" :key="index" class="terminal-line">
        {{ line }}
      </div>
      <div class="terminal-input-line">
        <span class="prompt">{{ prompt }}</span>
        <input 
          v-model="currentCommand" 
          @keyup.enter="executeCommand"
          class="terminal-input"
          ref="inputRef"
          placeholder="输入命令..."
        />
      </div>
    </div>

    <div class="shell-info">
      <span>连接状态: <span class="status-online">已连接</span></span>
      <span>节点: node001</span>
      <span>用户: admin</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const terminalRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const currentCommand = ref('')
const prompt = ref('admin@node001:~$ ')

const output = ref([
  'Welcome to HPC Web Shell',
  'Type "help" for available commands',
  ''
])

const executeCommand = () => {
  if (!currentCommand.value.trim()) return
  
  output.value.push(`${prompt.value}${currentCommand.value}`)
  
  // 模拟命令执行
  if (currentCommand.value === 'help') {
    output.value.push('Available commands: ls, pwd, squeue, sinfo, help, clear')
  } else if (currentCommand.value === 'clear') {
    clearTerminal()
    currentCommand.value = ''
    return
  } else if (currentCommand.value === 'squeue') {
    output.value.push('JOBID  PARTITION  NAME  USER  ST  TIME  NODES')
    output.value.push('12345  compute    sim   user  R   2:15  4')
  } else {
    output.value.push(`Command executed: ${currentCommand.value}`)
  }
  
  output.value.push('')
  currentCommand.value = ''
  
  // 滚动到底部
  setTimeout(() => {
    if (terminalRef.value) {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight
    }
  }, 0)
}

const clearTerminal = () => {
  output.value = []
}

const reconnect = () => {
  output.value.push('Reconnecting...')
  setTimeout(() => {
    output.value.push('Connected to node001')
    output.value.push('')
  }, 500)
}

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<style scoped>
.webshell {
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.shell-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.shell-controls {
  display: flex;
  gap: 0.5rem;
}

.terminal {
  flex: 1;
  background: #1e1e1e;
  color: #00ff00;
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.terminal-line {
  margin-bottom: 0.25rem;
  white-space: pre-wrap;
}

.terminal-input-line {
  display: flex;
  align-items: center;
}

.prompt {
  color: #00ff00;
  margin-right: 0.5rem;
}

.terminal-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  outline: none;
}

.terminal-input::placeholder {
  color: #006600;
}

.shell-info {
  display: flex;
  gap: 2rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
