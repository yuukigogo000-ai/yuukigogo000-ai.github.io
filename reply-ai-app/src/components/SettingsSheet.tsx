import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function SettingsSheet({
  open,
  onOpenChange,
  apiKey,
  setApiKey,
  remember,
  setRemember,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl border border-line bg-surface pb-[max(20px,env(safe-area-inset-bottom))]"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-3.5">
            <Dialog.Title className="text-[15px] font-bold">設定</Dialog.Title>
            <Dialog.Close
              id="sheetClose"
              aria-label="閉じる"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-2"
            >
              <X size={18} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="space-y-6 px-5 pt-5">
            <section>
              <label className="label" htmlFor="apiKey">
                Anthropic APIキー
              </label>
              <input
                type="password"
                id="apiKey"
                className="field"
                placeholder="sk-ant-..."
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <label className="mt-3 flex items-center gap-2.5 text-[13.5px]">
                <input
                  type="checkbox"
                  id="rememberKey"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                このブラウザに記憶する
              </label>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-muted">
                現在は検証版のため、ご自身のAPIキーを使用します。キーはこのブラウザからAnthropicへ直接送信され、
                他のサーバーには保存されません(このサイトにサーバーはありません)。キーの取得は{' '}
                <a
                  className="text-brand underline underline-offset-2"
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener"
                >
                  console.anthropic.com
                </a>
                。
              </p>
            </section>

            <section>
              <h3 className="text-[13px] font-bold text-ink-muted">このアプリの方針</h3>
              <ul className="mt-2 space-y-2 text-[13px] leading-relaxed">
                <li>
                  <b>別人を演じさせない。</b>
                  あなたの文体を再現するだけで、話を盛る提案はしません。会って剥がれる嘘は作りません。
                </li>
                <li>
                  <b>理由を見せる。</b>
                  すべての案に根拠を添えます。使うほど自分の会話力が上がる設計です。
                </li>
                <li>
                  <b>自動送信はしない。</b>
                  提案までがこのアプリの仕事で、送るかどうかは常にあなたが決めます。
                </li>
              </ul>
            </section>

            <section className="border-t border-line pt-4 text-[11.5px] leading-relaxed text-ink-faint">
              <p>
                提案は参考情報です。各サービスの利用規約を守ってご利用ください。スクショはAI処理のためAnthropicにのみ送信されます。
              </p>
              <p className="mt-1.5">
                LINEはLINEヤフー株式会社の登録商標です。本アプリは同社およびマッチングアプリ各社とは関係ありません。
              </p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
