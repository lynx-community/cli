package com.helloworld

import android.app.Activity
import android.os.Bundle
import com.helloworld.providers.GenericResourceFetcher
import com.helloworld.providers.TemplateProvider
import com.helloworld.services.ImageUI
import com.lynx.tasm.LynxBooleanOption
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.xelement.XElementBehaviors

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        var uri = "http://10.63.106.9:3001/main.lynx.bundle?fullscreen=true"
//        uri = if (BuildConfig.DEBUG == true) {
//            "http://10.63.106.9:3000/main.lynx.bundle?fullscreen=true"
//        } else {
//            "main.lynx.bundle"
//        }

        val lynxView: LynxView = buildLynxView()
        setContentView(lynxView)

        lynxView.renderTemplateUrl(uri, "")
    }
    
    private fun buildLynxView(): LynxView {
        val viewBuilder: LynxViewBuilder = LynxViewBuilder()
        viewBuilder.addBehaviors(XElementBehaviors().create())

        viewBuilder.addBehavior(object : Behavior("image") {
            override fun createUI(context: com.lynx.tasm.behavior.LynxContext): LynxUI<*> {
                return ImageUI(context)
            }
        })

        viewBuilder.setTemplateProvider(TemplateProvider(this))
        viewBuilder.isEnableGenericResourceFetcher = LynxBooleanOption.TRUE
        viewBuilder.setGenericResourceFetcher(GenericResourceFetcher())

        return viewBuilder.build(this)
    }
}