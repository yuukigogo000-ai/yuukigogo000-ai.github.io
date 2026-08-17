# パチスロ帝国 デスクトップ版

ゲーム本体(`../index.html`)をそのまま包む Electron アプリ。セーブデータはアプリ内の localStorage に保存される。

## 開発起動

```bash
cd pachinko/desktop
npm install
npm start
```

## インストーラのビルド

```bash
npm run dist   # 実行したOS向けのインストーラが dist/ にできる
```

- Windows: `dist/PachiSlotTeikoku Setup *.exe` (NSIS ワンクリックインストーラ)
- macOS: `dist/PachiSlotTeikoku-*.dmg`
- Linux: `dist/PachiSlotTeikoku-*.AppImage`

## GitHub Actions での3OS一括ビルド

タグ `pachinko-desktop-v*`(例: `pachinko-desktop-v1.0.0`)を push するか、Actions タブから
`Pachinko Desktop Build` ワークフローを手動実行すると、Windows / macOS / Linux の
インストーラがビルドされ Artifacts としてダウンロードできる。

## ブラウザから入れる軽量版(PWA)

Electron を使わなくても、公開ページ(`https://<user>.github.io/pachinko/`)を
Chrome / Edge で開きアドレスバーの「インストール」アイコンを押せば、
独立ウィンドウ+オフライン動作のデスクトップアプリとしてインストールされる。
