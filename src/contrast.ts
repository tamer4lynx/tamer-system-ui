/**
 * WCAG 2.x contrast helpers.
 *
 * - `relativeLuminance(hex)` — sRGB relative luminance (0–1)
 * - `contrastRatio(a, b)` — WCAG contrast ratio (1–21)
 * - `meetsContrast(fg, bg, minRatio?)` — true if pair >= minRatio (default 4.5 = AA body)
 * - `pickContrastColor(bg, [...], minRatio?)` — first candidate meeting min, else last
 * - `ensureContrast(preferred, bg, opts?)` — returns preferred if it meets min, otherwise
 *   the dark/light fallback that does (chosen by bg luminance)
 */

/** Parse hex / rgb() / rgba() css color into {r,g,b} (0–255). Returns null if unparseable. */
function parseColor(input: string): { r: number; g: number; b: number } | null {
  if (!input) return null
  const s = input.trim().toLowerCase()

  // Hex
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16)
      const g = parseInt(hex[1] + hex[1], 16)
      const b = parseInt(hex[2] + hex[2], 16)
      return Number.isFinite(r + g + b) ? { r, g, b } : null
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return Number.isFinite(r + g + b) ? { r, g, b } : null
    }
    return null
  }

  // rgb()/rgba() — minimal parser
  const m = s.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
  }
  return null
}

function channelToLinear(c: number): number {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(color: string): number {
  const c = parseColor(color)
  if (!c) return 0
  const r = channelToLinear(c.r)
  const g = channelToLinear(c.g)
  const b = channelToLinear(c.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function meetsContrast(fg: string, bg: string, minRatio = 4.5): boolean {
  return contrastRatio(fg, bg) >= minRatio
}

/**
 * Pick the first candidate that meets `minRatio` against `bg`.
 * If none meet, return whichever has the highest contrast ratio.
 */
export function pickContrastColor(
  bg: string,
  candidates: ReadonlyArray<string>,
  minRatio = 4.5,
): string {
  if (candidates.length === 0) return '#000'
  let best = candidates[0]
  let bestRatio = contrastRatio(best, bg)
  for (const c of candidates) {
    const r = contrastRatio(c, bg)
    if (r >= minRatio) return c
    if (r > bestRatio) {
      best = c
      bestRatio = r
    }
  }
  return best
}

export interface EnsureContrastOptions {
  /** Used when bg is light (luminance > 0.5) and `preferred` fails. Default: '#000'. */
  darkFallback?: string
  /** Used when bg is dark (luminance ≤ 0.5) and `preferred` fails. Default: '#fff'. */
  lightFallback?: string
  /** Default: 4.5 (WCAG AA for body text). Use 3 for large text / non-text. */
  minRatio?: number
}

/**
 * Return `preferred` if it meets the contrast requirement against `bg`. Otherwise
 * fall back to a black/white-ish color picked by bg luminance.
 */
export function ensureContrast(
  preferred: string,
  bg: string,
  opts: EnsureContrastOptions = {},
): string {
  const minRatio = opts.minRatio ?? 4.5
  if (meetsContrast(preferred, bg, minRatio)) return preferred
  const bgIsLight = relativeLuminance(bg) > 0.5
  const fallback = bgIsLight
    ? (opts.darkFallback ?? '#000')
    : (opts.lightFallback ?? '#fff')
  // If even the fallback fails (rare — e.g. mid-gray bg), pick whichever of the two contrasts more.
  if (meetsContrast(fallback, bg, minRatio)) return fallback
  const black = '#000'
  const white = '#fff'
  return contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white
}
