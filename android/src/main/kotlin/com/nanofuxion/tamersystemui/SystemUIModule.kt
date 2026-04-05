package com.nanofuxion.tamersystemui

import android.app.Activity
import android.app.Application
import android.content.ComponentCallbacks
import android.content.res.Configuration
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.View
import androidx.annotation.RequiresApi
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.toArgb
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyMap
import org.json.JSONObject

class SystemUIModule(context: Context) : LynxModule(context) {
    private data class ThemeColors(
        val primary: String,
        val primaryDark: String,
        val onPrimaryContainer: String,
        val background: String,
        val surface: String,
        val surfaceContainer: String,
        val surfaceContainerLow: String,
        val surfaceContainerHigh: String,
        val surfaceContainerHighest: String,
        val onSurface: String,
        val isDark: Boolean,
        val onSurfaceVariant: String,
        val secondaryContainer: String,
        val onSecondaryContainer: String,
    )

    companion object {
        @Volatile
        private var instance: SystemUIModule? = null
        @Volatile
        private var hostView: View? = null
        @Volatile
        private var cachedTheme: ThemeColors? = null

        fun attachHostView(view: View?) {
            hostView = view
            instance?.onHostViewChanged(view)
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var registeredApp: Application? = null
    private var lastUiMode: Int = -1
    private val configCallbacks = object : ComponentCallbacks {
        override fun onConfigurationChanged(newConfig: Configuration) {
            val mode = newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK
            if (mode == lastUiMode) return
            lastUiMode = mode
            refreshThemeAndNotify()
        }
        override fun onLowMemory() {}
    }

    init {
        instance = this
        mainHandler.post { onHostViewChanged(hostView) }
    }

    private fun onHostViewChanged(view: View?) {
        val app = (view?.context?.applicationContext as? Application)
        if (registeredApp !== app) {
            registeredApp?.unregisterComponentCallbacks(configCallbacks)
            registeredApp = app
            registeredApp?.registerComponentCallbacks(configCallbacks)
        }
        if (view != null) refreshThemeAndNotify()
    }

    private fun withController(block: (WindowInsetsControllerCompat) -> Unit) {
        mainHandler.post {
            val view = hostView ?: return@post
            val activity = view.context as? Activity ?: return@post
            val window = activity.window ?: return@post
            WindowCompat.setDecorFitsSystemWindows(window, false)
            block(WindowInsetsControllerCompat(window, window.decorView))
        }
    }

    @LynxMethod
    fun setStatusBar(style: String) {
        withController { controller ->
            controller.isAppearanceLightStatusBars = style == "dark"
        }
    }

    @LynxMethod
    fun setNavigationBar(color: String, style: String) {
        mainHandler.post {
            val view = hostView ?: return@post
            val activity = view.context as? Activity ?: return@post
            val window = activity.window ?: return@post
            WindowCompat.setDecorFitsSystemWindows(window, false)
            try {
                window.navigationBarColor = Color.parseColor(color)
            } catch (_: Exception) {}
            WindowInsetsControllerCompat(window, window.decorView)
                .isAppearanceLightNavigationBars = style == "dark"
        }
    }

    @LynxMethod
    fun getThemeColors(callback: Callback) {
        mainHandler.post {
            val view = hostView
            if (cachedTheme == null && view != null) {
                cachedTheme = buildThemeColors(view.context)
            }
            val map = cachedTheme?.toMap() ?: JavaOnlyMap()
            try {
                callback.invoke(map)
            } catch (e: Exception) {
                callback.invoke(JavaOnlyMap())
            }
        }
    }

    private fun refreshThemeAndNotify() {
        val view = hostView ?: return
        val next = buildThemeColors(view.context)
        if (next == cachedTheme) return
        cachedTheme = next
        emitThemeChanged(next)
    }

    private fun composeColorToHex(c: androidx.compose.ui.graphics.Color): String {
        val argb = c.toArgb()
        return String.format("#%02x%02x%02x", Color.red(argb), Color.green(argb), Color.blue(argb))
    }

    private fun buildThemeColors(ctx: Context): ThemeColors {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemDynamicColors(ctx)
        } else {
            getThemeAttributeColors(ctx)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun getSystemDynamicColors(ctx: Context): ThemeColors {
        val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val scheme = if (isDark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        return ThemeColors(
            primary = composeColorToHex(scheme.primary),
            primaryDark = composeColorToHex(scheme.primaryContainer),
            onPrimaryContainer = composeColorToHex(scheme.onPrimaryContainer),
            surface = composeColorToHex(scheme.surface),
            surfaceContainer = composeColorToHex(scheme.surfaceContainer),
            surfaceContainerLow = composeColorToHex(scheme.surfaceContainerLow),
            surfaceContainerHigh = composeColorToHex(scheme.surfaceContainerHigh),
            surfaceContainerHighest = composeColorToHex(scheme.surfaceContainerHighest),
            background = composeColorToHex(scheme.background),
            onSurface = composeColorToHex(scheme.onSurface),
            isDark = isDark,
            onSurfaceVariant = composeColorToHex(scheme.onSurfaceVariant),
            secondaryContainer = composeColorToHex(scheme.secondaryContainer),
            onSecondaryContainer = composeColorToHex(scheme.onSecondaryContainer),
        )
    }

    private fun getThemeAttributeColors(ctx: Context): ThemeColors {
        val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val scheme = if (isDark) darkColorScheme() else lightColorScheme()
        val activity = ctx as? Activity
        if (activity == null) {
            return themeFromStaticScheme(scheme, isDark)
        }
        val theme = activity.theme ?: return themeFromStaticScheme(scheme, isDark)
        val out = TypedValue()
        fun resolve(attr: Int, fallback: Int): Int {
            return if (theme.resolveAttribute(attr, out, true)) out.data else fallback
        }
        return ThemeColors(
            primary = colorToHex(resolve(android.R.attr.colorPrimary, Color.BLACK)),
            primaryDark = colorToHex(resolve(android.R.attr.colorPrimaryDark, Color.DKGRAY)),
            onPrimaryContainer = composeColorToHex(scheme.onPrimaryContainer),
            background = colorToHex(resolve(android.R.attr.colorBackground, Color.WHITE)),
            surface = composeColorToHex(scheme.surface),
            surfaceContainer = composeColorToHex(scheme.surfaceContainer),
            surfaceContainerLow = composeColorToHex(scheme.surfaceContainerLow),
            surfaceContainerHigh = composeColorToHex(scheme.surfaceContainerHigh),
            surfaceContainerHighest = composeColorToHex(scheme.surfaceContainerHighest),
            onSurface = colorToHex(resolve(android.R.attr.colorForeground, Color.WHITE)),
            isDark = isDark,
            onSurfaceVariant = composeColorToHex(scheme.onSurfaceVariant),
            secondaryContainer = composeColorToHex(scheme.secondaryContainer),
            onSecondaryContainer = composeColorToHex(scheme.onSecondaryContainer),
        )
    }

    private fun themeFromStaticScheme(
        scheme: androidx.compose.material3.ColorScheme,
        isDark: Boolean
    ): ThemeColors {
        return ThemeColors(
            primary = composeColorToHex(scheme.primary),
            primaryDark = composeColorToHex(scheme.primaryContainer),
            onPrimaryContainer = composeColorToHex(scheme.onPrimaryContainer),
            background = composeColorToHex(scheme.background),
            surface = composeColorToHex(scheme.surface),
            surfaceContainer = composeColorToHex(scheme.surfaceContainer),
            surfaceContainerLow = composeColorToHex(scheme.surfaceContainerLow),
            surfaceContainerHigh = composeColorToHex(scheme.surfaceContainerHigh),
            surfaceContainerHighest = composeColorToHex(scheme.surfaceContainerHighest),
            onSurface = composeColorToHex(scheme.onSurface),
            isDark = isDark,
            onSurfaceVariant = composeColorToHex(scheme.onSurfaceVariant),
            secondaryContainer = composeColorToHex(scheme.secondaryContainer),
            onSecondaryContainer = composeColorToHex(scheme.onSecondaryContainer),
        )
    }

    private fun ThemeColors.toMap(): JavaOnlyMap {
        return JavaOnlyMap().apply {
            putString("primary", primary)
            putString("primaryDark", primaryDark)
            putString("onPrimaryContainer", onPrimaryContainer)
            putString("background", background)
            putString("surface", surface)
            putString("surfaceContainer", surfaceContainer)
            putString("surfaceContainerLow", surfaceContainerLow)
            putString("surfaceContainerHigh", surfaceContainerHigh)
            putString("surfaceContainerHighest", surfaceContainerHighest)
            putString("onSurface", onSurface)
            putString("onSurfaceVariant", onSurfaceVariant)
            putString("secondaryContainer", secondaryContainer)
            putString("onSecondaryContainer", onSecondaryContainer)
            putBoolean("isDark", isDark)
        }
    }

    private fun emitThemeChanged(theme: ThemeColors) {
        mainHandler.post {
            val view = hostView ?: return@post
            if (!view.isAttachedToWindow) return@post
            val lynxView = view as? com.lynx.tasm.LynxView ?: return@post
            val lynxContext = lynxView.lynxContext ?: return@post
            try {
                val payload = JSONObject().apply {
                    put("primary", theme.primary)
                    put("primaryDark", theme.primaryDark)
                    put("onPrimaryContainer", theme.onPrimaryContainer)
                    put("background", theme.background)
                    put("surface", theme.surface)
                    put("surfaceContainer", theme.surfaceContainer)
                    put("surfaceContainerLow", theme.surfaceContainerLow)
                    put("surfaceContainerHigh", theme.surfaceContainerHigh)
                    put("surfaceContainerHighest", theme.surfaceContainerHighest)
                    put("onSurface", theme.onSurface)
                    put("onSurfaceVariant", theme.onSurfaceVariant)
                    put("secondaryContainer", theme.secondaryContainer)
                    put("onSecondaryContainer", theme.onSecondaryContainer)
                    put("isDark", theme.isDark)
                }.toString()
                val params = JavaOnlyArray().apply {
                    pushMap(JavaOnlyMap().apply { putString("payload", payload) })
                }
                lynxContext.sendGlobalEvent("system-ui:themeChanged", params)
            } catch (_: Exception) {}
        }
    }

    private fun colorToHex(color: Int): String {
        val r = Color.red(color)
        val g = Color.green(color)
        val b = Color.blue(color)
        return String.format("#%02x%02x%02x", r, g, b)
    }

    @LynxMethod
    fun setRootBackground(@Suppress("UNUSED_PARAMETER") color: String) {}
}
