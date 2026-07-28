package com.arsenengabo.versewarship.wallpaper

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Point
import android.graphics.Typeface
import android.os.Build
import android.util.Log
import android.view.WindowManager

/**
 * Fetches the current/next verse straight from Supabase (same table the web app reads)
 * and renders it as a wallpaper bitmap sized to the ACTUAL device screen (not a fixed
 * resolution), then applies it to home screen, lock screen, or both via WallpaperManager.
 *
 * Works even if the app has been fully closed, as long as WorkManager wakes the
 * scheduled job. Requires network to fetch a *new* verse; falls back to the last
 * cached verse (SharedPreferences) if offline, so it still refreshes on schedule
 * even without connectivity.
 */
object VerseWallpaperRenderer {
    private const val TAG = "VerseWallpaper"
    private const val PREFS = "verse_wallpaper_prefs"
    private const val KEY_LAST_TEXT = "last_verse_text"
    private const val KEY_LAST_REF = "last_verse_ref"

    // Filled in by the app on first run from capacitor.config.json values (see plugin's setConfig).
    var supabaseUrl: String = ""
    var supabaseAnonKey: String = ""

    enum class Target { HOME, LOCK, BOTH }

    fun refreshAndApply(context: Context, target: Target = Target.BOTH): Boolean {
        val (reference, text) = fetchRandomVerse(context) ?: getCachedVerse(context) ?: return false
        val bitmap = renderVerseBitmap(context, reference, text)
        return applyWallpaper(context, bitmap, target)
    }

    private fun fetchRandomVerse(context: Context): Pair<String, String>? {
        if (supabaseUrl.isBlank() || supabaseAnonKey.isBlank()) {
            Log.w(TAG, "Supabase URL/key not configured yet")
            return null
        }
        return try {
            val url = java.net.URL("$supabaseUrl/rest/v1/verses?select=reference,text&limit=50")
            val conn = url.openConnection() as java.net.HttpURLConnection
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

    /** Real, full screen size — including areas under notches/cutouts, since wallpaper spans the whole display. */
    private fun getScreenSize(context: Context): Point {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = wm.currentWindowMetrics.bounds
            Point(bounds.width(), bounds.height())
        } else {
            @Suppress("DEPRECATION")
            val display = wm.defaultDisplay
            val point = Point()
            @Suppress("DEPRECATION")
            display.getRealSize(point)
            point
        }
    }

    private fun renderVerseBitmap(context: Context, reference: String, text: String): Bitmap {
        val screen = getScreenSize(context)
        // Guard against absurd values on rare/unusual devices (foldables mid-fold, etc.)
        val width = screen.x.coerceIn(480, 2160)
        val height = screen.y.coerceIn(800, 3840)

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.parseColor("#1B1330"))

        // Reserve space top/bottom so text never collides with the lock screen clock
        // widget (top ~22% of screen) or the home screen dock/gesture bar (bottom ~12%).
        val topSafeMargin = height * 0.24f
        val bottomSafeMargin = height * 0.14f
        val horizontalMargin = width * 0.09f
        val maxTextWidth = width - horizontalMargin * 2
        val maxTextHeight = height - topSafeMargin - bottomSafeMargin

        val fitted = fitTextToBounds(text, maxTextWidth, maxTextHeight)

        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = fitted.fontSizePx
            typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
            textAlign = Paint.Align.CENTER
        }
        val refPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#C9B8FF")
            textSize = (fitted.fontSizePx * 0.72f).coerceAtLeast(width * 0.03f)
            typeface = Typeface.create(Typeface.SERIF, Typeface.ITALIC)
            textAlign = Paint.Align.CENTER
        }

        val lineHeight = fitted.fontSizePx * 1.35f
        val totalTextHeight = lineHeight * fitted.lines.size
        // Center within the safe vertical band, not the full screen, so it clears the clock/dock.
        var y = topSafeMargin + (maxTextHeight - totalTextHeight) / 2f + fitted.fontSizePx

        for (line in fitted.lines) {
            canvas.drawText(line, width / 2f, y, bodyPaint)
            y += lineHeight
        }
        canvas.drawText("— $reference", width / 2f, y + lineHeight * 0.5f, refPaint)

        return bitmap
    }

    private data class FittedText(val lines: List<String>, val fontSizePx: Float)

    /**
     * Starts from a font size proportional to screen width, then shrinks in a loop until
     * the wrapped text fits within maxHeight — guarantees no overflow regardless of verse
     * length or how small/large/differently-shaped the physical screen is.
     */
    private fun fitTextToBounds(text: String, maxWidth: Float, maxHeight: Float): FittedText {
        var fontSize = maxWidth * 0.11f
        val minFontSize = maxWidth * 0.045f
        val measurePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
        }

        var lines: List<String>
        while (true) {
            measurePaint.textSize = fontSize
            lines = wrapText(text, measurePaint, maxWidth)
            val totalHeight = fontSize * 1.35f * lines.size
            if (totalHeight <= maxHeight || fontSize <= minFontSize) break
            fontSize *= 0.92f
        }
        return FittedText(lines, fontSize)
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

    private fun applyWallpaper(context: Context, bitmap: Bitmap, target: Target): Boolean {
        return try {
            val wm = WallpaperManager.getInstance(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val flags = when (target) {
                    Target.HOME -> WallpaperManager.FLAG_SYSTEM
                    Target.LOCK -> WallpaperManager.FLAG_LOCK
                    Target.BOTH -> WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
                }
                wm.setBitmap(bitmap, null, true, flags)
            } else {
                // Pre-N devices have no separate lock screen wallpaper API — this sets the one shared wallpaper.
                wm.setBitmap(bitmap)
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set wallpaper: ${e.message}")
            false
        }
    }
}
