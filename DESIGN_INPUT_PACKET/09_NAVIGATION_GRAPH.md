# 09_NAVIGATION_GRAPH

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

実装上の遷移のみを列挙した。存在しない画面や下部ナビゲーション等を追加していない。

## 遷移一覧

| FROM | ACTION | TO | RELATED_CODE |
|---|---|---|---|
| (起動: セーブ不在) | ― | SCR-06 modal:tutorial | `pachinko/index.html:1850-1856` |
| (起動: セーブ有効) | ― | SCR-01+SCR-02(hall既定) | `pachinko/index.html:1850-1853` |
| (起動: セーブが倒産状態) | ― | SCR-08 modal:bankrupt | `pachinko/index.html:1854` |
| SCR-06 | 難易度選択(ACT-24) | SCR-01+SCR-02 | `pachinko/index.html:1752-1758` |
| SCR-01 | ホール(ACT-02) | SCR-02 | `pachinko/index.html:1779-1786` |
| SCR-01 | 新台購入(ACT-03) | SCR-03 | `pachinko/index.html:1779-1786` |
| SCR-01 | 経営(ACT-04) | SCR-04 | `pachinko/index.html:1779-1786` |
| SCR-01 | 帳簿(ACT-05) | SCR-05 | `pachinko/index.html:1779-1786` |
| SCR-01 | 営業開始(ACT-01) / 台0台 | SCR-09 modal:no-machine | `pachinko/index.html:1791-1795` |
| SCR-01 | 営業開始(ACT-01) / 倒産中 | SCR-08 modal:bankrupt | `pachinko/index.html:1789` |
| SCR-01 | 営業開始(ACT-01) / 通常 | SCR-07 modal:day-result | `pachinko/index.html:1798-1799` |
| SCR-07 | 閉じる(ACT-21) / 背景操作(ACT-25) | 直前の機能領域(SCR-02〜05) | `pachinko/index.html:1290-1298,1333` |
| SCR-07 | 倒産時: やり直す(ACT-23) | SCR-06 modal:tutorial | `pachinko/index.html:1314,1744-1750` |
| SCR-07 | 閉じる操作(倒産中) | SCR-08 modal:bankrupt(閉じられない) | `pachinko/index.html:1293` |
| SCR-08 | やり直す(ACT-23) | SCR-06 modal:tutorial | `pachinko/index.html:1281,1744-1750` |
| SCR-09 | わかった(ACT-22) | 直前の機能領域 | `pachinko/index.html:1794` |
| SCR-02 | 試打(ACT-07) / S型機種 | SCR-10 modal:trial-slot | `pachinko/index.html:1340-1345` |
| SCR-02 | 試打(ACT-07) / P型機種 | SCR-11 modal:trial-pachinko | `pachinko/index.html:1340-1345` |
| SCR-03 | 試打(ACT-09) / S型機種 | SCR-10 modal:trial-slot | `pachinko/index.html:1081-1083` |
| SCR-03 | 試打(ACT-09) / P型機種 | SCR-11 modal:trial-pachinko | `pachinko/index.html:1081-1083` |
| SCR-10 | 試打を終える(ACT-30) / 背景操作 | 直前の機能領域 | `pachinko/index.html:1389,1290-1298` |
| SCR-11 | 試打を終える(ACT-30) / 背景操作 | 直前の機能領域 | `pachinko/index.html:1533,1290-1298` |
| SCR-04 | やり直す(ACT-20, 確認後) | SCR-06 modal:tutorial | `pachinko/index.html:1840-1842` |
| (任意の画面) | 実績条件の成立 | SCR-12 overlay:toast(重畳。遷移ではない) | `pachinko/index.html:698-712` |

## 構造

```
起動
 ├ セーブなし ──────────→ SCR-06 tutorial ─(難易度)→ SCR-01 + SCR-02
 ├ セーブあり ──────────→ SCR-01 + SCR-02(hall既定)
 └ セーブが倒産状態 ────→ SCR-08 bankrupt(やり直しのみ)

SCR-01 SHELL(常時: 7指標 + 領域切替 + 営業開始)
 ├ 領域切替 ─→ SCR-02 hall / SCR-03 shop / SCR-04 mgmt / SCR-05 ledger  (相互に自由)
 └ 営業開始 ─┬ 台0台 ──→ SCR-09 no-machine ─(わかった)→ 直前の領域
             ├ 倒産中 ──→ SCR-08 bankrupt
             └ 通常 ────→ SCR-07 day-result ─┬(閉じる/背景)→ 直前の領域
                                              └(倒産時)→ やり直し → SCR-06

SCR-02 hall / SCR-03 shop ─(試打)→ SCR-10 trial-slot | SCR-11 trial-pachinko
                                     └(試打を終える/背景)→ 直前の領域
SCR-04 mgmt ─(やり直し+確認)→ SCR-06 tutorial
SCR-12 toast は任意画面に重畳(遷移ではない。3500msで自動消滅)
```

## Modal / Overlay の実装事実

- ブラウザの戻る操作に対応する履歴操作は実装されていない(history.pushState等の出現数0)。モーダルは #modalBg の show クラスで単一スロットに描画され、スタックは持たない(pachinko/index.html:1285-1289)。
- モーダル背景の操作で閉じる経路が存在する(pachinko/index.html:1297)。ただし倒産時は closeModal 側で拒否される(pachinko/index.html:1293)。
- 下部固定の営業開始バーは常時表示であり、機能領域の切替とは独立している(pachinko/index.html:109-118,367-370)。
- 画面下部固定要素のためのスクロール余白は body 側の padding-bottom で確保されている(pachinko/index.html:32)。

## Back 挙動

- ブラウザの戻る操作に対応する履歴操作は **未実装**(history API の出現数0)。
- モーダルからの復帰は閉じる操作または背景操作のみ(倒産時は不可)。
- 領域切替に履歴は積まれないため、戻る操作で前の領域へは戻らない。

TOTAL_EDGES: 24
