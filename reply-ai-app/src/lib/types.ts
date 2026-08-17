/** 生成処理の共通ラッパ。段階表示・エラー表示・ボタンの無効化をまとめて面倒を見る。 */
export type Runner = (stages: string[], fn: () => Promise<void>) => Promise<void>;
