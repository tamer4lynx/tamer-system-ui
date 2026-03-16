# tamer-system-ui

Status bar and navigation bar control for Lynx.

## Installation

```bash
npm install tamer-system-ui
```

Add to your app's dependencies and run `t4l link`.

## Usage

```tsx
import { useSystemUI, useThemeColors } from 'tamer-system-ui'

function App() {
  const { setStatusBar, setNavigationBar, setRootBackground, getThemeColorsAsync } = useSystemUI()
  const themeColors = useThemeColors()

  useEffect(() => {
    setStatusBar({ color: '#1a1a1a', style: 'light' })
    setNavigationBar({ color: '#2a2a2a', style: 'light' })
  }, [])

  return <view>...</view>
}
```

## API

| Method | Description |
|--------|-------------|
| `setStatusBar(options)` | Options: `color?`, `style?: 'light' \| 'dark' \| 'auto'` |
| `setNavigationBar(options)` | Options: `color`, `style?` |
| `setRootBackground(options)` | Options: `color` |
| `getThemeColors(callback)` | Callback receives `ThemeColors` |
| `getThemeColorsAsync()` | Returns `Promise<ThemeColors>` |

| Hook | Returns | Description |
|------|---------|-------------|
| `useSystemUI()` | `{ setStatusBar, setNavigationBar, setRootBackground, getThemeColors, getThemeColorsAsync }` | System UI control |
| `useThemeColors()` | `ThemeColors \| null` | Reactive theme colors from host |

**ThemeColors:** `primary`, `primaryDark`, `background`, `surface`, `surfaceContainer`, `onSurface`, `isDark`

## Platform

Uses **lynx.ext.json**. Run `t4l link` after adding to your app. Requires `SystemUIModule` native module.
