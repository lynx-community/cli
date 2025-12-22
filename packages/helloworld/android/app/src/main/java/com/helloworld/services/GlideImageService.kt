package com.helloworld.services

import android.content.Context
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import android.text.TextUtils
import android.util.Log
import android.view.View
import android.util.Base64
import androidx.annotation.Keep
import androidx.annotation.NonNull
import androidx.annotation.Nullable
import com.bumptech.glide.Glide
import com.bumptech.glide.load.DataSource
import com.bumptech.glide.load.engine.GlideException
import com.bumptech.glide.load.resource.gif.GifDrawable
import com.bumptech.glide.request.RequestListener
import com.bumptech.glide.request.target.CustomTarget
import com.bumptech.glide.request.target.Target
import com.bumptech.glide.request.transition.Transition
import com.lynx.tasm.behavior.ui.background.BackgroundLayerDrawable
import com.lynx.tasm.image.ImageContent
import com.lynx.tasm.image.ImageErrorCodeUtils
import com.lynx.tasm.image.model.AnimationListener
import com.lynx.tasm.image.model.ImageInfo
import com.lynx.tasm.image.model.ImageLoadListener
import com.lynx.tasm.image.model.ImageRequestInfo
import com.lynx.tasm.service.ILynxImageService

@Keep
class GlideImageService : ILynxImageService {

    companion object {
        private var instance: GlideImageService? = null

        fun getInstance(): GlideImageService {
            if (instance == null) {
                instance = GlideImageService()
            }
            return instance!!
        }
    }

    // Keep strong references to targets to prevent garbage collection
    private val activeTargets = mutableSetOf<Target<*>>()
    private val targetsByRequest = mutableMapOf<ImageRequestInfo, Target<*>>()

    private fun resolveGlideModel(url: String, context: Context): Any {
        return when {
            url.startsWith("asset://") -> {
                val assetPath = url.removePrefix("asset://")
                Uri.parse("file:///android_asset/$assetPath")
            }
            url.startsWith("data:") -> {
                try {
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
                } catch (e: Exception) {
                    url
                }
            }
            else -> {
                url
            }
        }
    }

    override fun fetchImage(
        @NonNull imageRequestInfo: ImageRequestInfo,
        @NonNull loadListener: ImageLoadListener,
        @Nullable animationListener: AnimationListener?,
        @NonNull context: Context
    ) {
        val originalUrl = imageRequestInfo.url
        val url = originalUrl?.trim()?.removeSuffix("]")
        Log.d("GlideImageService", "fetchImage called for $url (original: $originalUrl)")
        if (url.isNullOrEmpty()) {
            Log.e("GlideImageService", "URL is null or empty")
            loadListener.onFailure(
                ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                IllegalArgumentException("URL is null or empty")
            )
            return
        }
        try {
            val target = object : CustomTarget<Drawable>(Target.SIZE_ORIGINAL, Target.SIZE_ORIGINAL) {
                override fun onResourceReady(
                    @NonNull resource: Drawable,
                    @Nullable transition: Transition<in Drawable>?
                ) {
                    Log.d("GlideImageService", "Image loaded successfully for $url")
                    val isAnimated = resource is GifDrawable
                    // Create a safe drawable copy to prevent recycling
                    val safeDrawable = when (resource) {
                        is android.graphics.drawable.BitmapDrawable -> {
                            val bitmap = resource.bitmap
                            if (bitmap != null) {
                                val copiedBitmap = bitmap.copy(bitmap.config ?: Bitmap.Config.ARGB_8888, true)
                                android.graphics.drawable.BitmapDrawable(context.resources, copiedBitmap)
                            } else {
                                resource
                            }
                        }
                        else -> resource
                    }
                    loadListener.onSuccess(
                        ImageContent(safeDrawable),
                        imageRequestInfo,
                        ImageInfo(safeDrawable.intrinsicWidth, safeDrawable.intrinsicHeight, isAnimated)
                    )
                    // Remove from active targets after success
                    activeTargets.remove(this)
                }

                override fun onLoadCleared(@Nullable placeholder: Drawable?) {
                    // Remove from active targets when cleared
                    activeTargets.remove(this)
                }

                override fun onLoadFailed(@Nullable errorDrawable: Drawable?) {
                    Log.e("GlideImageService", "Image load failed for $url")
                    loadListener.onFailure(
                        ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                        GlideException("Load failed")
                    )
                    // Remove from active targets after failure
                    activeTargets.remove(this)
                }
            }

            // Keep strong reference to prevent GC
            activeTargets.add(target)
            targetsByRequest[imageRequestInfo] = target

            val model = resolveGlideModel(url ?: "", context)
            Glide.with(context)
                .load(model)
                .into(target)
        } catch (e: Exception) {
            loadListener.onFailure(
                ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                e
            )
        }
    }

    override fun startAnimation(@NonNull animatable: Drawable): Boolean {
        return if (animatable is GifDrawable) {
            animatable.start()
            true
        } else {
            false
        }
    }

    override fun resumeAnimation(@NonNull animatable: Drawable): Boolean {
        return if (animatable is GifDrawable) {
            animatable.start()
            true
        } else {
            false
        }
    }

    override fun pauseAnimation(@NonNull animatable: Drawable): Boolean {
        return if (animatable is GifDrawable) {
            animatable.stop()
            true
        } else {
            false
        }
    }

    override fun stopAnimation(@NonNull animatable: Drawable): Boolean {
        return if (animatable is GifDrawable) {
            animatable.stop()
            true
        } else {
            false
        }
    }

    override fun prefetchImage(
        @NonNull uri: String,
        @Nullable callerContext: Any?,
        @Nullable params: Map<String, Any>?
    ) {
        prefetchImage(uri, callerContext, params, null)
    }

    override fun prefetchImage(
        @NonNull uri: String,
        @Nullable callerContext: Any?,
        @Nullable params: Map<String, Any>?,
        @Nullable loadListener: ImageLoadListener?
    ) {
        val trimmedUri = uri.trim().removeSuffix("]")
        try {
            val context = when (callerContext) {
                is Context -> callerContext
                else -> return
            }

            Glide.with(context)
                .downloadOnly()
                .load(trimmedUri)
                .listener(object : RequestListener<java.io.File> {
                    override fun onLoadFailed(
                        e: GlideException?,
                        model: Any?,
                        target: Target<java.io.File>,
                        isFirstResource: Boolean
                    ): Boolean {
                        loadListener?.onFailure(
                            ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                            e ?: Exception("Prefetch failed")
                        )
                        return false
                    }

                    override fun onResourceReady(
                        resource: java.io.File,
                        model: Any,
                        target: Target<java.io.File>?,
                        dataSource: DataSource,
                        isFirstResource: Boolean
                    ): Boolean {
                        // Prefetch success - no callback needed
                        return false
                    }
                })
                .preload()
        } catch (e: Exception) {
            loadListener?.onFailure(
                ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                e
            )
        }
    }

    override fun decodeImage(
        @NonNull imageRequestInfo: ImageRequestInfo,
        @NonNull listener: ImageLoadListener
    ) {
        try {
            val context = when (imageRequestInfo.callerContext) {
                is Context -> imageRequestInfo.callerContext as Context
                else -> {
                    listener.onFailure(
                        ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                        IllegalArgumentException("Context required")
                    )
                    return
                }
            }

            val target = object : CustomTarget<Bitmap>(Target.SIZE_ORIGINAL, Target.SIZE_ORIGINAL) {
                override fun onResourceReady(
                    @NonNull resource: Bitmap,
                    @Nullable transition: Transition<in Bitmap>?
                ) {
                    val copiedBitmap = resource.copy(resource.config ?: Bitmap.Config.ARGB_8888, true)
                    val drawable = android.graphics.drawable.BitmapDrawable(context.resources, copiedBitmap)
                    listener.onSuccess(
                        ImageContent(drawable),
                        imageRequestInfo,
                        ImageInfo(copiedBitmap.width, copiedBitmap.height, false)
                    )
                    // Remove from active targets after success
                    activeTargets.remove(this)
                    targetsByRequest.remove(imageRequestInfo)
                }

                override fun onLoadCleared(@Nullable placeholder: Drawable?) {
                    // Remove from active targets when cleared
                    activeTargets.remove(this)
                    targetsByRequest.remove(imageRequestInfo)
                }

                override fun onLoadFailed(@Nullable errorDrawable: Drawable?) {
                    listener.onFailure(
                        ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                        GlideException("Decode failed")
                    )
                    // Remove from active targets after failure
                    activeTargets.remove(this)
                    targetsByRequest.remove(imageRequestInfo)
                }
            }

            // Keep strong reference to prevent GC
            activeTargets.add(target)
            targetsByRequest[imageRequestInfo] = target

            val model = resolveGlideModel(imageRequestInfo.url, context)
            Glide.with(context)
                .asBitmap()
                .load(model)
                .into(target)
        } catch (e: Exception) {
            listener.onFailure(
                ImageErrorCodeUtils.LYNX_IMAGE_UNKNOWN_EXCEPTION,
                e
            )
        }
    }

    override fun releaseImage(@NonNull imageRequestInfo: ImageRequestInfo) {
        // Glide handles memory automatically
        // Clear any active targets if needed
        val target = targetsByRequest.remove(imageRequestInfo)
        if (target != null) {
            val context = (imageRequestInfo.callerContext as? Context) ?: return
            Glide.with(context).clear(target)
            activeTargets.remove(target)
        }
    }

    override fun releaseAnimDrawable(@NonNull drawable: Drawable) {
        if (drawable is GifDrawable) {
            drawable.stop()
        }
    }

    override fun canParseUrl(@NonNull url: String): Boolean {
        return !TextUtils.isEmpty(url) &&
                (url.startsWith("http") || url.startsWith("https") ||
                        url.startsWith("file://") || url.startsWith("content://") ||
                        url.startsWith("asset://") || url.startsWith("data:") ||
                        url.startsWith("android.resource://"))
    }

    @Nullable
     fun createBackgroundImageDrawable(
    ): BackgroundLayerDrawable? {
        // Not implemented for Glide - return null
        return null
    }



    // Deprecated methods - use Object instead of Any to match Java interface
    @Deprecated("Deprecated method")
    override fun setCustomImageDecoder(@NonNull builder: Any) {
        // Deprecated - no implementation needed
    }

    @Deprecated("Deprecated method")
    @Nullable
    override fun getImageSRPostProcessor(): Any? {
        return null // Deprecated - return null
    }

    @Deprecated("Deprecated method")
    override fun setImageSRSize(@NonNull request: Any, @NonNull view: View) {
        // Deprecated - no implementation needed
    }

    @Deprecated("Deprecated method")
    override fun setImageCacheChoice(@NonNull cacheChoice: String, @NonNull builder: Any) {
        // Deprecated - no implementation needed
    }

    @Deprecated("Deprecated method")
    override fun setImagePlaceHolderHash(
        @NonNull hierarchy: Any,
        @NonNull request: Any,
        @NonNull scaleType: Any,
        @NonNull hash: String,
        @Nullable metaData: String?,
        width: Int,
        height: Int,
        radius: Int,
        iterations: Int,
        isPreView: Boolean
    ) {
        // Deprecated - no implementation needed
    }
}
