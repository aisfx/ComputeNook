import { useState, useCallback, useEffect } from 'react'
import { theme as antTheme } from 'antd'

export type ThemeMode = 'light' | 'dark' | 'ocean'

const THEME_KEY = 'cn_theme'

function getStoredTheme(): ThemeMode {
  return 'light'
}

// 全局主题状态（模块级，避免重复定义）
let _themeMode: ThemeMode = getStoredTheme()
let _listeners: Array<(mode: ThemeMode) => void> = []

function setGlobalTheme(mode: ThemeMode) {
  _themeMode = mode
  localStorage.setItem(THEME_KEY, mode)
  document.documentElement.setAttribute('data-theme', mode)
  _listeners.forEach((fn) => fn(mode))
}

// 初始化
document.documentElement.setAttribute('data-theme', _themeMode)

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(_themeMode)

  // 订阅主题变化
  useEffect(() => {
    const listener = (newMode: ThemeMode) => {
      setMode(newMode)
    }
    _listeners.push(listener)
    return () => {
      _listeners = _listeners.filter(fn => fn !== listener)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    // 只有light主题，不做切换
    setGlobalTheme('light')
  }, [])

  const setTheme = useCallback((m: ThemeMode) => {
    setGlobalTheme(m)
  }, [])

  return { mode, toggleTheme, setTheme }
}

export function useThemeToken() {
  const { mode } = useTheme()

  const token = {
    algorithm: antTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#6366f1',
      borderRadius: 8,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    },
    components: {
      Layout: {
        siderBg: '#fff',
        headerBg: '#fff',
        bodyBg: '#f5f7fb',
      },
      Menu: {
        itemBg: '#fff',
      },
    },
  }

  return { token, mode }
}
