package com.arsenengabo.versewarship.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Fetches the current/next verse straight from Supabase (same table the web app reads)
 * and renders it as a lock screen wallpaper bitmap, then applies it via WallpaperManager.
 *
 * This runs independently of the web app / WebView — it works even if the app has
 * been fully closed, as long as the OS wakes the scheduled WorkManager job (see
 * VerseWallpaperWorker.kt). Requires network to fetch a *new* verse; falls back to
 * the last cached verse (SharedPreferences) if offline, so it still refreshes the
 * wallpaper on schedule even without connectivity.
 */
object VerseWallpaperRenderer {
    private const val TAG = "VerseWallpaper"
    private const val PREFS = "verse_wallpaper_prefs"
    private const val KEY_LAST_TEXT = "last_verse_text"
    private const val KEY_LAST_REF = "last_verse_ref"

    // Filled in by the app on first run from capacitor.config.json values (see plugin's setConfig).
    var supabaseUrl: String = ""
    var supabaseAnonKey: String = ""

    fun refreshAndApply(context: Context): Boolean {
        val (reference, text) = fetchRandomVerse(context) ?: getCachedVerse(context) ?: return false
        val bitmap = renderVerseBitmap(context, reference, text)
        return applyToLockScreen(context, bitmap)
    }

    private fun fetchRandomVerse(context: Context): Pair<String, String>? {
        if (supabaseUrl.isBlank() || supabaseAnonKey.isBlank()) {
            Log.w(TAG, "Supabase URL/key not configured yet")
            return null
        }
        return try {
            val url = URL("$supabaseUrl/rest/v1/verses?select=reference,text&limit=50")
            val conn = url.openConnection() as HttpURLConnection
            conn.setRequestProperty("apikey", supabaseAnonKey)
            conn.setRequestProperty("Authorization", "Bearer $supabaseAnonKey")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            val body = conn.inputStream.bufferedReader().readText()
            conn.disconnect()

            val arr = org.json.JSONArray(body)
            if (arr.length() == 0) return null
            val pick = arr.getJSONObject((0 until arr.length()).random())
            val reference = pick.getString("reference")
            val text = pick.getString("text")

            // cache for offline fallback next time
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_LAST_REF, reference)
                .putString(KEY_LAST_TEXT, text)
                .apply()

            reference to text
        } catch (e: Exception) {
            Log.w(TAG, "Fetch failed, will fall back to cache: ${e.message}")
            null
        }
    }

    private fun getCachedVerse(context: Context): Pair<String, String>? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ref = prefs.getString(KEY_LAST_REF, null) ?: return null
        val text = prefs.getString(KEY_LAST_TEXT, null) ?: return null
        return ref to text
    }

    private fun renderVerseBitmap(context: Context, reference: String, text: String): Bitmap {
        val dm: DisplayMetrics = context.resources.displayMetrics
        val width = dm.widthPixels.coerceAtLeast(1080)
        val height = dm.heightPixels.coerceAtLeast(1920)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Background — solid deep indigo, matching the web app's dark theme.
        canvas.drawColor(Color.parseColor("#1B1330"))

        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = width * 0.062f
            typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
            textAlign = Paint.Align.CENTER
        }
        val refPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#C9B8FF")
            textSize = width * 0.045f
            typeface = Typeface.create(Typeface.SERIF, Typeface.ITALIC)
            textAlign = Paint.Align.CENTER
        }

        val maxTextWidth = width * 0.82f
        val lines = wrapText(text, bodyPaint, maxTextWidth)
        val lineHeight = bodyPaint.textSize * 1.35f
        val totalTextHeight = lineHeight * lines.size
        var y = height / 2f - totalTextHeight / 2f

        for (line in lines) {
            canvas.drawText(line, width / 2f, y, bodyPaint)
            y += lineHeight
        }
        canvas.drawText("— $reference", width / 2f, y + lineHeight * 0.6f, refPaint)

        return bitmap
    }

    private fun wrapText(text: String, paint: Paint, maxWidth: Float): List<String> {
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var current = StringBuilder()
        for (word in words) {
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (paint.measureText(candidate) > maxWidth && current.isNotEmpty()) {
                lines.add(current.toString())
                current = StringBuilder(word)
            } else {
                current = StringBuilder(candidate)
            }
        }
        if (current.isNotEmpty()) lines.add(current.toString())
        return lines
    }

    private fun applyToLockScreen(context: Context, bitmap: Bitmap): Boolean {
        return try {
            val wm = WallpaperManager.getInstance(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK)
            } else {
                // Pre-N devices only support a single wallpaper target (no separate lock screen API).
                wm.setBitmap(bitmap)
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set wallpaper: ${e.message}")
            false
        }
    }
}
