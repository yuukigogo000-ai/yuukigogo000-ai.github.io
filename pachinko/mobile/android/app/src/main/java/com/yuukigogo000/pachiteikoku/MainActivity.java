package com.yuukigogo000.pachiteikoku;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PachiBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
