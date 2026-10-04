import Capacitor
import StoreKit

/// Only verified StoreKit transactions can grant access. No JS-writable unlock flag.
@objc(PachiBillingPlugin)
public class PachiBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PachiBillingPlugin"
    public let jsName = "PachiBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]
    private let productID = "pachinko_full_version"
    private var updates: Task<Void, Never>?
    private var purchasing = false
    private var owned = false
    private var pending = false

    public override func load() {
        updates = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                guard case .verified(let transaction) = result, transaction.productID == self.productID else { continue }
                await self.refreshEntitlement()
                await transaction.finish()
            }
        }
    }
    deinit { updates?.cancel() }

    @MainActor private func value(_ status: String) -> [String: Any] {
        ["productId": productID, "owned": owned, "pending": pending, "status": status]
    }
    @MainActor private func refreshEntitlement() async {
        var found = false
        // StoreKit caches signed current entitlements, including while offline.
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  transaction.productID == productID,
                  transaction.productType == .nonConsumable,
                  transaction.revocationDate == nil else { continue }
            found = true
        }
        owned = found
        if found { pending = false }
        notifyListeners("entitlementChanged", data: value("updated"))
    }
    @objc func getState(_ call: CAPPluginCall) { refresh(call) }
    @objc func refresh(_ call: CAPPluginCall) {
        Task { @MainActor in
            await refreshEntitlement()
            call.resolve(value("current"))
        }
    }
    @MainActor private func product() async throws -> Product {
        guard let product = try await Product.products(for: [productID]).first,
              product.id == productID, product.type == .nonConsumable, product.price > 0 else {
            throw BillingError.productUnavailable
        }
        if product.priceFormatStyle.currencyCode == "JPY" && product.price != Decimal(300) {
            throw BillingError.productUnavailable
        }
        return product
    }
    @objc func getProduct(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let p = try await product()
                call.resolve(["productId": productID, "price": p.displayPrice,
                              "amount": NSDecimalNumber(decimal: p.price).doubleValue,
                              "currency": p.priceFormatStyle.currencyCode])
            } catch { call.reject("PRODUCT_UNAVAILABLE", "PRODUCT_UNAVAILABLE") }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !purchasing else { call.reject("PURCHASE_IN_PROGRESS", "PURCHASE_IN_PROGRESS"); return }
            purchasing = true
            defer { purchasing = false }
            do {
                await refreshEntitlement()
                if owned { call.resolve(value("purchased")); return }
                let p = try await product()
                switch try await p.purchase() {
                case .success(let result):
                    guard case .verified(let transaction) = result,
                          transaction.productID == productID,
                          transaction.productType == .nonConsumable,
                          transaction.revocationDate == nil else {
                        call.reject("PURCHASE_NOT_VERIFIED", "PURCHASE_NOT_VERIFIED"); return
                    }
                    owned = true; pending = false
                    notifyListeners("entitlementChanged", data: value("purchased"))
                    await transaction.finish()
                    call.resolve(value("purchased"))
                case .userCancelled: call.resolve(value("cancelled"))
                case .pending:
                    pending = true
                    call.resolve(value("pending"))
                @unknown default: call.reject("PURCHASE_NOT_CONFIRMED", "PURCHASE_NOT_CONFIRMED")
                }
            } catch { call.reject("PURCHASE_NOT_CONFIRMED", "PURCHASE_NOT_CONFIRMED") }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                // A sync can prompt for authentication, so only a user tap calls it.
                try await AppStore.sync()
                await refreshEntitlement()
                call.resolve(value(owned ? "purchased" : "not_owned"))
            } catch { call.reject("RESTORE_FAILED", "RESTORE_FAILED") }
        }
    }
    private enum BillingError: Error { case productUnavailable }
}

class PachiBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PachiBillingPlugin())
    }
}
