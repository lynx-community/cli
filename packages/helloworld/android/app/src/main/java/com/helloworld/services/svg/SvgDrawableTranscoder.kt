package com.helloworld.services.svg

import android.graphics.Picture
import android.graphics.drawable.PictureDrawable
import com.bumptech.glide.load.Options
import com.bumptech.glide.load.engine.Resource
import com.bumptech.glide.load.resource.SimpleResource
import com.bumptech.glide.load.resource.transcode.ResourceTranscoder
import com.caverock.androidsvg.SVG

/**
 * Convert the [SVG]'s internal representation to an Android-compatible one ([Picture]).
 */
class SvgDrawableTranscoder : ResourceTranscoder<SVG, PictureDrawable> {
    override fun transcode(
        toTranscode: Resource<SVG>,
        options: Options
    ): Resource<PictureDrawable>? {
        val svg = toTranscode.get()
        
        // Handle SVGs that don't have an explicit width or height by using the viewBox
        if (svg.documentWidth < 0 && svg.documentViewBox != null) {
            svg.documentWidth = svg.documentViewBox.width()
        }
        if (svg.documentHeight < 0 && svg.documentViewBox != null) {
            svg.documentHeight = svg.documentViewBox.height()
        }

        val picture = svg.renderToPicture()
        val drawable = PictureDrawable(picture)
        return SimpleResource(drawable)
    }
}
