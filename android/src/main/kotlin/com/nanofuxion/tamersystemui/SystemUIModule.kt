package com.nanofuxion.tamersystemui

import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

class SystemUIModule(context: Context) : LynxModule(context) {

    companion object {
        @Volatile
        private var hostView: View? = null

        fun attachHostView(view: View?) {
            hostView = view
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())

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

    // stub — not yet implemented
    @LynxMethod
    fun setRootBackground(@Suppress("UNUSED_PARAMETER") color: String) {}
}
