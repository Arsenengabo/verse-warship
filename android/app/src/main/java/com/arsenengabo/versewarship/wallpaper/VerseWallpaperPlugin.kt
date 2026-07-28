package com.arsenengabo.versewarship.wallpaper

import android.content.Context
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
 * Exposed to the web app as `Capacitor.Plugins.VerseWallpaper` (or via the
 * @capacitor/core registerPlugin call on the JS side — see wallpaper-plugin.ts).
 *
 * Minimum WorkManager periodic interval is 15 minutes (Android platform floor —
 * this cannot go lower even for a "1 minute" rotation setting; the UI should
 * clamp/label this honestly rather than promise sub-15-minute wallpaper changes).
 */
@CapacitorPlugin(name = "VerseWallpaper")
class VerseWallpaperPlugin : Plugin() {
    private val WORK_NAME = "verse_wallpaper_periodic"

    @PluginMethod
    fun schedule(call: PluginCall) {
        val minutes = call.getInt("intervalMinutes", 60) ?: 60
        val supabaseUrl = call.getString("supabaseUrl") ?: ""
        val supabaseAnonKey = call.getString("supabaseAnonKey") ?: ""
        val clampedMinutes = minutes.coerceAtLeast(15) // Android platform minimum

        val inputData = Data.Builder()
            .putString(VerseWallpaperWorker.KEY_SUPABASE_URL, supabaseUrl)
            .putString(VerseWallpaperWorker.KEY_SUPABASE_ANON_KEY, supabaseAnonKey)
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
        VerseWallpaperRenderer.supabaseUrl = supabaseUrl
        VerseWallpaperRenderer.supabaseAnonKey = supabaseAnonKey

        Thread {
            val success = VerseWallpaperRenderer.refreshAndApply(context)
            val result = JSObject()
            result.put("applied", success)
            call.resolve(result)
        }.start()
    }
}
