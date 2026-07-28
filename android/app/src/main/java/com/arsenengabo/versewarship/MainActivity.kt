package com.arsenengabo.versewarship

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.arsenengabo.versewarship.wallpaper.VerseWallpaperPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(VerseWallpaperPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
