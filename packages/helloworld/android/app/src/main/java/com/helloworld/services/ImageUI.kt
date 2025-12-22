package com.helloworld.services

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.widget.ImageView
import com.bumptech.glide.Glide
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.ui.LynxUI

class ImageUI(context: LynxContext) : LynxUI<ImageView>(context) {

    override fun createView(context: Context): ImageView {
        return ImageView(context)
    }

    @LynxProp(name = "src")
    fun setSrc(url: String?) {
        if (url.isNullOrEmpty()) return
        val trimmedUrl = url.trim().removeSuffix("]")
        val model = resolveModel(trimmedUrl)
        Glide.with(mView.context).load(model).into(mView)
    }

    private fun resolveModel(url: String): Any {
        return when {
            url.startsWith("asset://") -> {
                val assetPath = url.removePrefix("asset://")
                Uri.parse("file:///android_asset/$assetPath")
            }
            url.startsWith("android.resource://") -> {
                Uri.parse(url)
            }
            url.startsWith("data:") -> {
                val commaIndex = url.indexOf(',')
                if (commaIndex > 0) {
                    val meta = url.substring(0, commaIndex)
                    val dataPart = url.substring(commaIndex + 1)
                    val isBase64 = meta.contains(";base64")
                    if (isBase64) {
                        Base64.decode(dataPart, Base64.DEFAULT)
                    } else {
                        Uri.decode(dataPart).toByteArray()
                    }
                } else {
                    url
                }
            }
            else -> url
        }
    }
}
