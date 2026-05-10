import { useState, useEffect } from '@lynx-js/react'

export {
  relativeLuminance,
  contrastRatio,
  meetsContrast,
  pickContrastColor,
  ensureContrast,
  type EnsureContrastOptions,
} from './contrast.js'
import { ensureContrast, relativeLuminance } from './contrast.js'

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
 *
 * Auto-validates each (container, on-container) pair through `ensureContrast`
 * so consumers can use `theme.onPrimary` etc. directly and get a color that
 * actually contrasts the matching container — even when the host injects a
 * theme with poorly-paired tokens.
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
  if (!hasThemePayload(t)) return null
  return validateContrastPairs(t)
}

/**
 * Walk known M3 (container, on-container) pairs and replace each on-color with
 * one that meets contrast against its container. If both sides exist and already
 * contrast at the requested ratio, return as-is.
 *
 * Bg-only colors (no on-color in `ThemeColors`) get a derived on-color filled in
 * so consumers can read e.g. `onSurfaceContainer` without doing math.
 */
export function validateContrastPairs(theme: ThemeColors): ThemeColors {
  const out: ThemeColors = { ...theme }
  // (containerKey, onKey, fallbackOnKey, minRatio)
  // minRatio 4.5 = WCAG AA body text. Drop to 3 for non-text containers (e.g. inverseSurface).
  // M3: `onSurface` is the shared on-color for the whole surface tonal family
  // (`surface`, `surfaceContainer*`, `background`). Validating once against
  // `surface` is enough because the tonal shifts within the family are small.
  const pairs: Array<[keyof ThemeColors, keyof ThemeColors, keyof ThemeColors | null, number]> = [
    ['primary', 'onPrimary', null, 4.5],
    ['primaryContainer', 'onPrimaryContainer', 'onPrimary', 4.5],
    ['secondaryContainer', 'onSecondaryContainer', 'onSurface', 4.5],
    ['surface', 'onSurface', null, 4.5],
    ['error', 'onError', null, 4.5],
  ]
  for (const [bgKey, onKey, fallbackKey, minRatio] of pairs) {
    const bg = (out as Record<string, unknown>)[bgKey as string]
    if (typeof bg !== 'string' || !bg) continue
    const preferred =
      (typeof (out as Record<string, unknown>)[onKey as string] === 'string'
        ? ((out as Record<string, unknown>)[onKey as string] as string)
        : null) ??
      (fallbackKey != null && typeof (out as Record<string, unknown>)[fallbackKey as string] === 'string'
        ? ((out as Record<string, unknown>)[fallbackKey as string] as string)
        : null) ??
      '#000'
    const corrected = ensureContrast(preferred, bg, {
      darkFallback: '#000',
      lightFallback: '#fff',
      minRatio,
    })
    ;(out as Record<string, unknown>)[onKey as string] = corrected
  }
  // onSurfaceVariant: lower contrast (3:1) for secondary text — still validate.
  if (typeof out.surface === 'string' && typeof out.onSurfaceVariant === 'string') {
    out.onSurfaceVariant = ensureContrast(out.onSurfaceVariant, out.surface, {
      darkFallback: '#3a3940',
      lightFallback: '#dcd9e0',
      minRatio: 3,
    })
  }
  return out
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
 * Uses WCAG relative luminance with the 0.179 threshold (matches Material 3 surface tone split).
 */
function contrastStyle(hex: string): 'light' | 'dark' {
  return relativeLuminance(hex) > 0.179 ? 'dark' : 'light'
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
