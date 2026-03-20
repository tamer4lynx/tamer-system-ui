declare var NativeModules: {
  SystemUIModule?: {
    setStatusBar(style: string): void
    setNavigationBar(color: string, style: string): void
    setRootBackground?(color: string): void
    getThemeColors?(callback: (colors: {
      primary?: string
      primaryDark?: string
      background?: string
      surface?: string
      surfaceContainer?: string
      onSurface?: string
      isDark?: boolean
    }) => void): void
  }
}
