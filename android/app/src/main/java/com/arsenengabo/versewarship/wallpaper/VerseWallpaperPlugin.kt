package com.arsenengabo.versewarship.wallpaper

import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.TimeUnit

/**
 * Exposed to the web app as `Capacitor.Plugins.VerseWallpaper` (see src/lib/wallpaper.ts).
 *
 * Minimum WorkManager periodic interval is 15 minutes (Android platform floor —
 * cannot go lower even for a "1 minute" rotation setting; the UI clamps/labels this).
 *
 * `target` accepts "home", "lock", or "both" (default "both") — sets the wallpaper
 * independently for the home screen, lock screen, or both at once.
 */
@CapacitorPlugin(name = "VerseWallpaper")
class VerseWallpaperPlugin : Plugin() {
    private val WORK_NAME = "verse_wallpaper_periodic"

    private fun parseTarget(raw: String?): VerseWallpaperRenderer.Target = when (raw?.lowercase()) {
        "home" -> VerseWallpaperRenderer.Target.HOME
        "lock" -> VerseWallpaperRenderer.Target.LOCK
        else -> VerseWallpaperRenderer.Target.BOTH
    }

    @PluginMethod
    fun schedule(call: PluginCall) {
        val minutes = call.getInt("intervalMinutes", 60) ?: 60
        val supabaseUrl = call.getString("supabaseUrl") ?: ""
        val supabaseAnonKey = call.getString("supabaseAnonKey") ?: ""
        val target = parseTarget(call.getString("target"))
        val clampedMinutes = minutes.coerceAtLeast(15) // Android platform minimum

        val inputData = Data.Builder()
            .putString(VerseWallpaperWorker.KEY_SUPABASE_URL, supabaseUrl)
            .putString(VerseWallpaperWorker.KEY_SUPABASE_ANON_KEY, supabaseAnonKey)
            .putString(VerseWallpaperWorker.KEY_TARGET, target.name)
            .build()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED) // renderer falls back to cache if offline
            .build()

        val request = PeriodicWorkRequestBuilder<VerseWallpaperWorker>(clampedMinutes.toLong(), TimeUnit.MINUTES)
            .setInputData(inputData)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.LINEAR, 15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )

        val result = JSObject()
        result.put("scheduled", true)
        result.put("effectiveIntervalMinutes", clampedMinutes)
        call.resolve(result)
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        val result = JSObject()
        result.put("cancelled", true)
        call.resolve(result)
    }

    @PluginMethod
    fun applyNow(call: PluginCall) {
        val supabaseUrl = call.getString("supabaseUrl") ?: ""
        val supabaseAnonKey = call.getString("supabaseAnonKey") ?: ""
        val target = parseTarget(call.getString("target"))
        VerseWallpaperRenderer.supabaseUrl = supabaseUrl
        VerseWallpaperRenderer.supabaseAnonKey = supabaseAnonKey

        Thread {
            val success = VerseWallpaperRenderer.refreshAndApply(context, target)
            val result = JSObject()
            result.put("applied", success)
            call.resolve(result)
        }.start()
    }
}
