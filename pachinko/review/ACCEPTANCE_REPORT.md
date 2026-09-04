# AUTOMATED ACCEPTANCE REPORT

実行スクリプト(セッション内): `accept.js` / `destructive2.js` / `final-check.js` / `electron-v5.js`
対象: `pachinko/index.html`(V5)

## 1. 起動・資産・外部通信(9件)

| 検証 | 結果 |
|---|---|
| 起動してチュートリアルが出る | PASS |
| コンソールエラー 0 | PASS |
| 実行時の外部リクエスト 0 | PASS |
| 壊れた資産参照 0 | PASS |
| ホールアートの読み込み | PASS |
| DOM識別子70件の保持(P-30) | PASS |
| グローバル公開3件の保持(P-29) | PASS |
| Webフォント参照なし | PASS |
| safe-area / reduced-motion の記述 | PASS |

## 2. 既存機能の到達性(22件)

4領域+実績の切替 / 設定1〜6 / 新台購入 / カタログ試打 / 設置台試打 / 売却(確認あり) /
スタッフ雇用・解雇 / 広告設定 / 交換率変更 / 借入・返済 / 店舗拡張 / セーブ /
1営業日の実行と当日結果 / 台別収支 / 損益推移グラフ / 営業成績一覧 / 実績一覧(15件) /
常時ステータス / 週次レポート生成 — **すべて PASS**

## 3. レスポンシブ / タップ(12件)

| 幅 | 横スクロール | 44px未満のタップ対象 | 主要CTA | 過大アイコン |
|---|---|---|---|---|
| 360×800 | 0 | 0件 | 56px | 0件 |
| 390×844 | 0 | 0件 | 56px | 0件 |
| 430×932 | 0 | 0件 | 56px | 0件 |

## 4. reduced motion(3件)

- 1営業日が完了する / 演出が600ms未満に短縮 / カーテン演出を出さない — PASS

## 5. セーブ互換・オフライン(6件)

- リロードで状態復元(既存 `sanitizeState` の uid 正規化を除き完全一致) / 保存キー /
  22キースキーマ / SW登録 / **オフライン起動** / オフラインでもアート表示 — PASS

**合計: 54 PASS / 0 FAIL**

## 6. 破壊的検証(27件)

セーブ改竄12 / UI乱打4 / 試打の破壊5 / 倒産後のゾンビ操作4 / 極限状態2 → **27 PASS / 0 FAIL**

主な内容: 壊れたJSON・machines:null・不正機種ID・設定99・資金が文字列・null/Infinity・
負の日数・trend名とnoteへのHTML注入・500台・day99999 / 営業開始5連打で1日のみ・結果表示中の連打無効 /
試打の回転中クローズ・全ボタン乱打・オート中クローズ / 倒産後の売却と営業の封鎖・倒産モーダルは閉じられない /
台0での営業とsimulateDay直呼び。

## 7. デスクトップ(Electron)

```
BOOT   {"title":"パチスロ帝国 〜ホール経営シミュレーション〜","hasState":true,"tutorial":true,
        "art":true,"externals":0,"globals":true}
AFTER  {"day":2,"result":true,"saved":true,"overflow":0}
PAGEERR (none)
```

sandbox 有効・contextIsolation 有効・nodeIntegration 無効のまま、
起動→チュートリアル→1営業日→結果→保存まで動作。
