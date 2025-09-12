package com.lynx.kotlinemptyproject

import android.app.Activity
import android.os.Bundle
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.TemplateData
import java.io.IOException

class SwitchActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val lynxView = buildLynxView()
        setContentView(lynxView)
        try {
            val array = this.assets.open("devtool_switch/switchPage/devtoolSwitch.lynx.bundle").readBytes()
            lynxView.renderTemplateWithBaseUrl(
                array,
                TemplateData.empty(),
                "devtool_switch/switchPage/devtoolSwitch.lynx.bundle"
            )
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }

    private fun buildLynxView(): LynxView {
        val viewBuilder = LynxViewBuilder()
        viewBuilder.setTemplateProvider(DemoTemplateProvider(this))
        return viewBuilder.build(this)
    }
}