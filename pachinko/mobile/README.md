# パチスロ帝国 Android候補

既存の `pachinko/index.html` と全アートを、Capacitor 8.5.2 のAndroid WebViewへ同梱する最小シェルです。
ゲームロジック、`pachi-teikoku-save-v1`、保存形式は変更しません。ネイティブ用ビルドだけService Workerを除外します。

Node 22以上で `pachinko/mobile` から実行します。

```text
npm ci --ignore-scripts --no-fund --no-audit
npm test
npm run doctor
npm run android:rc
```

`android:rc` は現在ソースから同期し、clean Android debug APK、unsigned release APK、unsigned release AABを生成後、同梱runtime全ファイルをバイト単位で照合します。

Androidの戻る操作は、自前確認ダイアログ、通常モーダル、ホール画面への復帰、アプリ最小化の順で処理します。端末でのオフライン起動、OSによる再起動後のセーブ復元、戻る操作、safe areaは実機確認が必要です。
