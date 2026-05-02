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
  /**
   * Primary / brand tone from the host or app. App-shell uses this for the default tab active
   * pill fill and FAB container when it contrasts the tab strip background.
   */
  primary?: string
  /** Material 3 primary container (Android dynamic maps this from `primaryDark`). */
  primaryDark?: string
  /** M3 primary-container — FAB and tonal button container. */
  primaryContainer?: string
  /** M3 on-primary-container — icon/label on primary-container. */
  onPrimaryContainer?: string
  onPrimary?: string
  background?: string
  surface?: string
  surfaceContainer?: string
  /** M3 surface-container-low — elevated button, drawer surface. */
  surfaceContainerLow?: string
  /** M3 surface-container-high — FAB menu item surface. */
  surfaceContainerHigh?: string
  /** M3 surface-container-highest — progress track. */
  surfaceContainerHighest?: string
  onSurface?: string
  /** M3 on-surface-variant — inactive nav icons/labels on the bar. */
  onSurfaceVariant?: string
  /** M3 secondary container — bottom nav active pill fill (e.g. Google Phone). */
  secondaryContainer?: string
  /** M3 on-secondary-container — icon on that pill. */
  onSecondaryContainer?: string
  /** M3 outline — button borders, dividers. */
  outline?: string
  /** M3 outline-variant — subtle dividers. */
  outlineVariant?: string
  /** M3 error — error state color. */
  error?: string
  onError?: string
  isDark?: boolean
}

/**
 * Light-theme primary when native `ThemeColors.primary` is missing. Matches the dev launcher
 * Connect button background (`LIGHT_FALLBACK` in `@tamer4lynx/tamer-dev-client`).
 */
export const FALLBACK_PRIMARY_LIGHT = '#007aff'

function mod() {
  return (typeof NativeModules !== 'undefined' ? NativeModules : undefined)?.SystemUIModule
}

function getLynxGlobalProps(): Record<string, unknown> | null {
  try {
    const lynx = (globalThis as unknown as { lynx?: { __globalProps?: unknown } }).lynx
    const gp = lynx?.__globalProps
    if (gp != null && typeof gp === 'object' && !Array.isArray(gp)) {
      return gp as Record<string, unknown>
    }
  } catch {
    // ignore
  }
  return null
}

function pickStr(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function pickBool(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key]
  if (typeof v === 'boolean') return v
  if (v === 1) return true
  if (v === 0) return false
  return undefined
}

export function hasThemePayload(c: ThemeColors | null | undefined): boolean {
  if (c == null) return false
  return (
    c.background != null ||
    c.surface != null ||
    c.surfaceContainer != null ||
    c.onSurface != null
  )
}

/**
 * Coerce a host / `__globalProps` / native callback value into `ThemeColors`.
 */
export function normalizeThemeColors(raw: unknown): ThemeColors | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const t: ThemeColors = {
    primary: pickStr(o, 'primary'),
    primaryDark: pickStr(o, 'primaryDark'),
    primaryContainer: pickStr(o, 'primaryContainer'),
    onPrimaryContainer: pickStr(o, 'onPrimaryContainer'),
    onPrimary: pickStr(o, 'onPrimary'),
    background: pickStr(o, 'background'),
    surface: pickStr(o, 'surface'),
    surfaceContainer: pickStr(o, 'surfaceContainer'),
    surfaceContainerLow: pickStr(o, 'surfaceContainerLow'),
    surfaceContainerHigh: pickStr(o, 'surfaceContainerHigh'),
    surfaceContainerHighest: pickStr(o, 'surfaceContainerHighest'),
    onSurface: pickStr(o, 'onSurface'),
    onSurfaceVariant: pickStr(o, 'onSurfaceVariant'),
    secondaryContainer: pickStr(o, 'secondaryContainer'),
    onSecondaryContainer: pickStr(o, 'onSecondaryContainer'),
    outline: pickStr(o, 'outline'),
    outlineVariant: pickStr(o, 'outlineVariant'),
    error: pickStr(o, 'error'),
    onError: pickStr(o, 'onError'),
    isDark: pickBool(o, 'isDark'),
  }
  return hasThemePayload(t) ? t : null
}

/**
 * Reads `themeColors` / `tamerThemeColors` from `lynx.__globalProps` (JSON string or object).
 * Hosts can inject the same payload native uses so the first frame matches system UI.
 */
export function readBootstrapThemeColors(): ThemeColors | null {
  const gp = getLynxGlobalProps()
  if (!gp) return null
  const raw = gp.themeColors ?? gp.tamerThemeColors ?? gp.systemUiTheme
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return normalizeThemeColors(JSON.parse(raw) as unknown)
    } catch {
      return null
    }
  }
  return normalizeThemeColors(raw)
}

/**
 * Theme for the first React paint: `__globalProps` first, then a **synchronous**
 * `SystemUIModule.getThemeColors` callback (native must invoke on the main thread immediately).
 */
export function readInitialThemeColors(): ThemeColors | null {
  const boot = readBootstrapThemeColors()
  if (boot && hasThemePayload(boot)) return boot
  let native: ThemeColors | null = null
  try {
    const m = mod()
    if (m?.getThemeColors) {
      m.getThemeColors((c: ThemeColors) => {
        native = normalizeThemeColors(c)
      })
    }
  } catch {
    // ignore
  }
  return native && hasThemePayload(native) ? native : null
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

function setRootBackground(options: { color: string }): void {
  mod()?.setRootBackground?.(options.color)
}

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
    a.onPrimaryContainer === b.onPrimaryContainer &&
    a.background === b.background &&
    a.surface === b.surface &&
    a.surfaceContainer === b.surfaceContainer &&
    a.surfaceContainerLow === b.surfaceContainerLow &&
    a.surfaceContainerHigh === b.surfaceContainerHigh &&
    a.surfaceContainerHighest === b.surfaceContainerHighest &&
    a.onSurface === b.onSurface &&
    a.onSurfaceVariant === b.onSurfaceVariant &&
    a.secondaryContainer === b.secondaryContainer &&
    a.onSecondaryContainer === b.onSecondaryContainer &&
    a.isDark === b.isDark
}

export function useThemeColors(): ThemeColors | null {
  const [colors, setColors] = useState<ThemeColors | null>(() => readInitialThemeColors())
  useEffect(() => {
    let mounted = true
    const apply = (next: ThemeColors | null) => {
      if (!mounted || next == null) return
      setColors((prev) => sameTheme(prev, next) ? prev : next)
    }
    const refetch = () => {
      getThemeColorsAsync().then((c) => {
        const n = normalizeThemeColors(c ?? {})
        if (n && hasThemePayload(n)) apply(n)
      }).catch(() => {})
    }
    refetch()
    const events = lynx?.getJSModule?.('GlobalEventEmitter')
    const onThemeChanged = (...args: unknown[]) => {
      const event = args[0] as { payload?: string } | undefined
      try {
        const payload = normalizeThemeColors(JSON.parse(event?.payload ?? '{}') as unknown)
        if (payload && hasThemePayload(payload)) {
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
