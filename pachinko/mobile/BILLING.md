# Native full version purchase

Accepted specification (2026-10-04): free download; each playthrough includes DAY 1–30; one permanent non-consumable purchase unlocks DAY 31 onward. Japan price is JPY 300. No subscription or automatic charge. The user must press the purchase button and confirm in Apple's/Google's purchase sheet.

## Product configuration

| Setting | Value |
| --- | --- |
| App / bundle ID | `com.yuukigogo000.pachiteikoku` |
| Product ID, both stores | `pachinko_full_version` |
| Product name | 完全版 |
| Japanese description | 31営業日目以降も、同じセーブで経営を続けられます。買い切りです。 |
| Apple type | Non-Consumable |
| Google type | One-time product, Buy option, never consumed |
| App download | Free |
| Japan purchase price | JPY 300 |

The code does not create products or change store prices. Register this exact product in both consoles and select JPY 300 for Japan before distribution. Other storefronts show the store's localized price. Empty product metadata or a JPY price other than 300 disables purchase. Restore remains available without product metadata. Do not create subscriptions.

## Persistence and boundaries

- Existing `pachi-teikoku-save-v1` and its schema are unchanged. Entitlement is separate from the game save. Purchasing does not advance the day or replace progress.
- `runDay` checks the native gate before RNG, money, debt, history or save changes. DAY 30 can finish; DAY 31 is blocked until ownership is confirmed. Missing native bridge fails closed after DAY 30.
- New games restart the demo at DAY 1. An existing purchase remains owned; existing saves beyond DAY 30 are preserved and can continue after purchase/restore.
- The build script injects the requirement only into the native bundle. Public Web/PWA remains unchanged in availability and is not deployed by these changes.
- iOS uses verified StoreKit 2 current entitlements and transaction updates. Explicit Restore calls `AppStore.sync()`; pending/unverified/revoked transactions do not grant access.
- Android uses the Google Play Billing service, matching package/product and PURCHASED state, with acknowledgement before entitlement. It never consumes the purchase. Private no-backup native storage caches confirmed ownership for offline launch; successful online reconciliation clears revoked/missing ownership. Errors retain prior confirmed ownership. No receipt/token is exposed to JS or saved in the game data.
- This is client-side entitlement handling, not a purchase-verification backend. Offline Android cache cannot learn refunds until a successful store refresh. Rooted/modified clients are outside its tamper-resistance boundary.
- Store accounts and purchases are separate between Apple and Google. Restore restores the purchase in the same store, not the game save or ownership across stores.

## Verification and release gates

`npm test` covers boundary/controller failures and existing mobile contracts. `python tests/billing-browser.py REPO OUTPUT` runs actual game/UI acceptance in Chromium and WebKit using a test-only store double; it cannot prove actual store purchases.

Before distribution: authenticated console configuration; free-download setting; sandbox/license-tester purchase, cancel, pending approval, restore, reinstall, offline purchased launch, refund/revocation on physical devices; updated screenshots/privacy/store declarations against the final binaries. Do not treat mock-store tests or old candidate QA as real-store/device passes. No new payments, subscriptions, secrets or publication are authorized by this document.
