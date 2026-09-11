package com.beardrive.formosa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BearDriveNavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
