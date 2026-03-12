export type StatusBarStyle = 'light' | 'dark'

export interface StatusBarOptions {
  /** Background color the bar sits over — used to auto-derive icon style. */
  color?: string
  /** Override the auto-derived style. */
  style?: StatusBarStyle
}

export interface NavigationBarOptions {
  color: string
  /** Override the auto-derived style. */
  style?: StatusBarStyle
}

declare const NativeModules: {
  SystemUIModule?: {
    setStatusBar(style: string): void
    setNavigationBar(color: string, style: string): void
  }
} | undefined

function mod() {
  return (typeof NativeModules !== 'undefined' ? NativeModules : undefined)?.SystemUIModule
}

/**
 * Returns 'light' (white icons) for dark backgrounds, 'dark' (dark icons) for light backgrounds.
 * Uses WCAG relative luminance with the 0.179 threshold.
 */
function contrastStyle(hex: string): StatusBarStyle {
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

function resolveStyle(color: string | undefined, override: StatusBarStyle | undefined): StatusBarStyle {
  if (override) return override
  if (color) return contrastStyle(color)
  return 'light'
}

function setStatusBar(options: StatusBarOptions): void {
  mod()?.setStatusBar(resolveStyle(options.color, options.style))
}

function setNavigationBar(options: NavigationBarOptions): void {
  mod()?.setNavigationBar(options.color, resolveStyle(options.color, options.style))
}

// stub — no native implementation yet
function setRootBackground(_options: { color: string }): void {}

export function useSystemUI() {
  return { setStatusBar, setNavigationBar, setRootBackground }
}
