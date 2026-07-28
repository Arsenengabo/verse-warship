package com.arsenengabo.versewarship.wallpaper

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ListenableWorker.Result as WorkResult

/**
 * Runs on the schedule set from the app (see VerseWallpaperPlugin.schedule).
 * WorkManager persists this across reboots and app kills — this is what makes
 * "works even when the app is closed" true for the wallpaper feature, same as
 * the push notifications already cover the "closed app gets notified" case.
 */
class VerseWallpaperWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): WorkResult {
        VerseWallpaperRenderer.supabaseUrl = inputData.getString(KEY_SUPABASE_URL) ?: VerseWallpaperRenderer.supabaseUrl
        VerseWallpaperRenderer.supabaseAnonKey = inputData.getString(KEY_SUPABASE_ANON_KEY) ?: VerseWallpaperRenderer.supabaseAnonKey

        val success = VerseWallpaperRenderer.refreshAndApply(applicationContext)
        // Retry rather than fail outright — next scheduled run will also just try again either way,
        // but retry gives a faster recovery if this was a transient network blip.
        return if (success) WorkResult.success() else WorkResult.retry()
    }

    companion object {
        const val KEY_SUPABASE_URL = "supabase_url"
        const val KEY_SUPABASE_ANON_KEY = "supabase_anon_key"
    }
}
