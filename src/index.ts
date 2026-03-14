import { useState, useEffect } from '@lynx-js/react'

export type StatusBarStyle = 'light' | 'dark' | 'auto'

export interface StatusBarOptions {
  /** Background color the bar sits over — used when style is 'auto'. */
  color?: string
  /** 'light' | 'dark' | 'auto'. When 'auto', derives from color. */
  style?: StatusBarStyle
}

export interface NavigationBarOptions {
  color: string
  /** 'light' | 'dark' | 'auto'. When 'auto', derives from color. */
  style?: StatusBarStyle
}

export interface ThemeColors {
  primary?: string
  primaryDark?: string
  background?: string
  surface?: string
  surfaceContainer?: string
  onSurface?: string
  isDark?: boolean
}

declare const NativeModules: {
  SystemUIModule?: {
    setStatusBar(style: string): void
    setNavigationBar(color: string, style: string): void
    getThemeColors?(callback: (colors: ThemeColors) => void): void
  }
} | undefined

function mod() {
  return (typeof NativeModules !== 'undefined' ? NativeModules : undefined)?.SystemUIModule
}

/**
 * Returns 'light' (white icons) for dark backgrounds, 'dark' (dark icons) for light backgrounds.
 * Uses WCAG relative luminance with the 0.179 threshold.
 */
function contrastStyle(hex: string): 'light' | 'dark' {
  const c = hex.replace(/^#/, '')
  const full = c.length === 3
    ? c.split('').map(x => x + x).join('')
    : c.slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const linearize = (v: number) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  const L = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  return L > 0.179 ? 'dark' : 'light'
}

function resolveStyle(color: string | undefined, override: StatusBarStyle | undefined): 'light' | 'dark' {
  if (override === 'light') return 'light'
  if (override === 'dark') return 'dark'
  if (color) return contrastStyle(color)
  return 'light'
}

function setStatusBar(options: StatusBarOptions): void {
  mod()?.setStatusBar(resolveStyle(options.color, options.style))
}

function setNavigationBar(options: NavigationBarOptions): void {
  mod()?.setNavigationBar(options.color, resolveStyle(options.color, options.style))
}

function setRootBackground(_options: { color: string }): void {}

export function getThemeColors(callback: (colors: ThemeColors) => void): void {
  mod()?.getThemeColors?.(callback)
}

export function getThemeColorsAsync(): Promise<ThemeColors> {
  return new Promise((resolve) => {
    const m = mod()
    if (!m?.getThemeColors) {
      resolve({})
      return
    }
    m.getThemeColors((colors) => resolve(colors ?? {}))
  })
}

export function useSystemUI(): {
  setStatusBar: (options: StatusBarOptions) => void
  setNavigationBar: (options: NavigationBarOptions) => void
  setRootBackground: (options: { color: string }) => void
  getThemeColors: (callback: (colors: ThemeColors) => void) => void
  getThemeColorsAsync: () => Promise<ThemeColors>
} {
  return { setStatusBar, setNavigationBar, setRootBackground, getThemeColors, getThemeColorsAsync }
}

function sameTheme(a: ThemeColors | null, b: ThemeColors | null): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return a.primary === b.primary &&
    a.primaryDark === b.primaryDark &&
    a.background === b.background &&
    a.surface === b.surface &&
    a.surfaceContainer === b.surfaceContainer &&
    a.onSurface === b.onSurface &&
    a.isDark === b.isDark
}

export function useThemeColors(): ThemeColors | null {
  const [colors, setColors] = useState<ThemeColors | null>(null)
  useEffect(() => {
    let mounted = true
    const apply = (next: ThemeColors | null) => {
      if (!mounted || next == null) return
      setColors((prev) => sameTheme(prev, next) ? prev : next)
    }
    const refetch = () => {
      getThemeColorsAsync().then((c) => {
        if (c && (c.surface != null || c.surfaceContainer != null || c.onSurface != null)) apply(c)
      }).catch(() => {})
    }
    refetch()
    const events = lynx?.getJSModule?.('GlobalEventEmitter')
    const onThemeChanged = (...args: unknown[]) => {
      const event = args[0] as { payload?: string } | undefined
      try {
        const payload = JSON.parse(event?.payload ?? '{}') as ThemeColors
        if (payload && (payload.surface != null || payload.surfaceContainer != null || payload.onSurface != null)) {
          apply(payload)
          return
        }
      } catch {}
      refetch()
    }
    events?.addListener?.('system-ui:themeChanged', onThemeChanged)
    return () => {
      mounted = false
      events?.removeListener?.('system-ui:themeChanged', onThemeChanged)
    }
  }, [])
  return colors
}
