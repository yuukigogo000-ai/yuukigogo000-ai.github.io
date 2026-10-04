package com.yuukigogo000.pachiteikoku;

import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/** One non-consumable. Purchase data/tokens never cross the JS bridge or enter logs. */
@CapacitorPlugin(name = "PachiBilling")
public class PachiBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    public static final String PRODUCT_ID = "pachinko_full_version";
    private final Handler main = new Handler(Looper.getMainLooper());
    private BillingClient client;
    private boolean connecting, owned, pending;
    private PluginCall purchaseCall;
    private File cache;
    private final List<Runnable> waiting = new ArrayList<>();
    private final List<Consumer<String>> failures = new ArrayList<>();

    @Override public void load() {
        cache = new File(getContext().getNoBackupFilesDir(), "pachinko-entitlement-v1");
        try { owned = "owned".equals(new String(Files.readAllBytes(cache.toPath()), StandardCharsets.UTF_8)); }
        catch (Exception ignored) { owned = false; }
        client = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    private JSObject state(String status) {
        JSObject out = new JSObject();
        out.put("productId", PRODUCT_ID); out.put("owned", owned); out.put("pending", pending);
        out.put("status", status); return out;
    }
    private void setOwned(boolean value) {
        owned = value;
        try {
            if (value) Files.write(cache.toPath(), "owned".getBytes(StandardCharsets.UTF_8));
            else Files.deleteIfExists(cache.toPath());
        } catch (Exception ignored) { /* Store query remains authoritative if local persistence fails. */ }
        notifyListeners("entitlementChanged", state("updated"));
    }
    private void connected(Runnable task, Consumer<String> failure) {
        if (client.isReady()) { task.run(); return; }
        waiting.add(task); failures.add(failure);
        if (connecting) return;
        connecting = true;
        Runnable deadline = () -> connectionFinished(false);
        main.postDelayed(deadline, 20000);
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                main.post(() -> { main.removeCallbacks(deadline); connectionFinished(result.getResponseCode() == BillingClient.BillingResponseCode.OK); });
            }
            @Override public void onBillingServiceDisconnected() { /* automatic reconnect is enabled */ }
        });
    }
    private void connectionFinished(boolean ok) {
        connecting = false;
        List<Runnable> tasks = new ArrayList<>(waiting);
        List<Consumer<String>> errors = new ArrayList<>(failures);
        waiting.clear(); failures.clear();
        if (ok) for (Runnable task : tasks) task.run();
        else for (Consumer<String> failure : errors) failure.accept("STORE_UNAVAILABLE");
    }
    @PluginMethod public void getState(PluginCall call) { main.post(() -> call.resolve(state("cached"))); }
    @PluginMethod public void refresh(PluginCall call) {
        main.post(() -> connected(() -> queryOwned(s -> call.resolve(s), code -> call.reject(code, code)), code -> call.reject(code, code)));
    }
    @PluginMethod public void restore(PluginCall call) { refresh(call); }

    private void queryOwned(Consumer<JSObject> done, Consumer<String> fail) {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> main.post(() -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail.accept("STORE_UNAVAILABLE"); return; }
                process(purchases, done, fail);
            }));
    }
    private void process(List<Purchase> purchases, Consumer<JSObject> done, Consumer<String> fail) {
        pending = false;
        Purchase match = null;
        if (purchases != null) for (Purchase p : purchases) {
            if (!p.getProducts().contains(PRODUCT_ID) || !getContext().getPackageName().equals(p.getPackageName())) continue;
            if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) match = p;
        }
        if (match == null) { setOwned(false); done.accept(state(pending ? "pending" : "not_owned")); return; }
        if (match.isAcknowledged()) { setOwned(true); done.accept(state("purchased")); return; }
        // Never consume the purchase: the store must retain it for restore.
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(match.getPurchaseToken()).build(), result -> main.post(() -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { fail.accept("ACKNOWLEDGEMENT_PENDING"); return; }
            setOwned(true); done.accept(state("purchased"));
        }));
    }
    private void product(Consumer<ProductDetails> done, Consumer<String> fail) {
        QueryProductDetailsParams.Product p = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_ID).setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(p)).build(),
            (result, details) -> main.post(() -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (ProductDetails d : details.getProductDetailsList()) {
                        ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                        if (PRODUCT_ID.equals(d.getProductId()) && offer != null && offer.getPriceAmountMicros() > 0 &&
                            (!"JPY".equals(offer.getPriceCurrencyCode()) || offer.getPriceAmountMicros() == 300_000_000L)) {
                            done.accept(d); return;
                        }
                    }
                }
                fail.accept("PRODUCT_UNAVAILABLE");
            }));
    }
    @PluginMethod public void getProduct(PluginCall call) {
        main.post(() -> connected(() -> product(d -> {
            ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
            JSObject out = new JSObject(); out.put("productId", PRODUCT_ID); out.put("price", offer.getFormattedPrice());
            out.put("amount", offer.getPriceAmountMicros() / 1_000_000.0); out.put("currency", offer.getPriceCurrencyCode());
            call.resolve(out);
        }, code -> call.reject(code, code)), code -> call.reject(code, code)));
    }
    @PluginMethod public void purchase(PluginCall call) {
        main.post(() -> {
            if (purchaseCall != null) { call.reject("PURCHASE_IN_PROGRESS", "PURCHASE_IN_PROGRESS"); return; }
            purchaseCall = call;
            connected(() -> queryOwned(s -> {
                if (owned) { completePurchase(s); return; }
                if (pending) { completePurchase(state("pending")); return; }
                product(d -> {
                    BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d);
                    String token = d.getOneTimePurchaseOfferDetails().getOfferToken();
                    if (token != null) item.setOfferToken(token);
                    BillingResult launched = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(item.build())).build());
                    if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) rejectPurchase("STORE_UNAVAILABLE");
                }, this::rejectPurchase);
            }, this::rejectPurchase), this::rejectPurchase);
        });
    }
    private void completePurchase(JSObject value) {
        PluginCall call = purchaseCall; purchaseCall = null;
        if (call != null) call.resolve(value);
    }
    private void rejectPurchase(String code) {
        PluginCall call = purchaseCall; purchaseCall = null;
        if (call != null) call.reject(code, code);
    }
    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        main.post(() -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) { completePurchase(state("cancelled")); return; }
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK ||
                result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                // Query the complete current set, including purchases approved outside the app.
                connected(() -> queryOwned(this::completePurchase, this::rejectPurchase), this::rejectPurchase);
            } else rejectPurchase("PURCHASE_NOT_CONFIRMED");
        });
    }
    @Override protected void handleOnDestroy() {
        main.post(() -> { if (client != null) client.endConnection(); });
    }
}
