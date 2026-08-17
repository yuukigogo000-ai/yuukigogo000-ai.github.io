import { useRef, useState } from 'react';
import { AlertCircle, Settings } from 'lucide-react';
import { FirstRun } from './components/FirstRun';
import { InstallHint } from './components/InstallHint';
import { ProfileTab } from './components/ProfileTab';
import { ReplyTab } from './components/ReplyTab';
import { SettingsSheet } from './components/SettingsSheet';
import { ONBOARD_KEY, addAdopted, clearAdopted, getAdopted, loadKey, saveKey } from './lib/storage';

export default function App() {
  const [tab, setTab] = useState<'reply' | 'profile'>('reply');
  const [apiKey, setApiKey] = useState(loadKey);
  const [remember, setRemember] = useState(() => loadKey() !== '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [toast, setToast] = useState('');
  const [adopted, setAdopted] = useState<string[]>(getAdopted);
  const [adoptedPersisted, setAdoptedPersisted] = useState(true);
  const [showFirstRun, setShowFirstRun] = useState(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1900);
  }

  function requireKey(): string | null {
    const k = apiKey.trim();
    if (!k) {
      setError('設定からAnthropicのAPIキーを入力してください。');
      setSettingsOpen(true);
      return null;
    }
    saveKey(k, remember);
    return k;
  }

  /** 生成処理の共通ラッパ:段階表示・エラー表示・ボタン無効化 */
  async function run(stages: string[], fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setStage(stages[0]);
    let i = 0;
    const timer = window.setInterval(() => {
      i = Math.min(i + 1, stages.length - 1);
      setStage(stages[i]);
    }, 4500);
    try {
      await fn();
    } catch (err) {
      setError('エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      window.clearInterval(timer);
      setBusy(false);
      setStage('');
    }
  }

  function onAdopt(texts: string[], copied: boolean) {
    if (!copied) {
      setError('コピーできませんでした。文面を長押し(または選択)して手動でコピーしてください。');
      return;
    }
    let list = adopted;
    let persisted = true;
    for (const t of texts) {
      const r = addAdopted(t);
      list = r.list;
      persisted = persisted && r.persisted;
    }
    setAdopted(list);
    setAdoptedPersisted(persisted);
    showToast(
      persisted
        ? texts.length > 1
          ? 'コピーしました(改行区切り)'
          : 'コピーしました'
        : 'コピーしました(履歴は保存できませんでした)',
    );
  }

  const tabBtn = (active: boolean) =>
    `flex-1 rounded-[9px] px-3 py-2 text-[13.5px] font-bold transition-colors ${
      active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.07)]' : 'text-ink-muted'
    }`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pb-6">
      <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-[16px] font-bold tracking-tight">Replier</h1>
          <p className="text-[11.5px] text-ink-muted">あなたの文体のまま、次の一通を作る</p>
        </div>
        <button
          type="button"
          id="btnSettings"
          aria-label="設定"
          onClick={() => setSettingsOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-2"
        >
          <Settings size={19} strokeWidth={1.8} />
        </button>
      </header>

      <div role="tablist" aria-label="機能" className="mt-3 flex gap-1 rounded-xl bg-surface-2 p-1">
        <button
          type="button"
          id="tabBtnReply"
          role="tab"
          aria-selected={tab === 'reply'}
          aria-controls="tabReply"
          className={tabBtn(tab === 'reply')}
          onClick={() => {
            setTab('reply');
            setError('');
          }}
        >
          返信提案
        </button>
        <button
          type="button"
          id="tabBtnProfile"
          role="tab"
          aria-selected={tab === 'profile'}
          aria-controls="tabProfile"
          className={tabBtn(tab === 'profile')}
          onClick={() => {
            setTab('profile');
            setError('');
          }}
        >
          プロフィール添削
        </button>
      </div>

      <div
        id="error"
        role="alert"
        hidden={!error}
        className="mt-3 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger-soft px-3.5 py-3 text-[13px] leading-relaxed text-danger"
      >
        {error ? <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" /> : null}
        {error}
      </div>

      <p id="spinner" role="status" aria-live="polite" className="sr-only">
        {busy ? stage : ''}
      </p>

      {showFirstRun && (
        <FirstRun
          hasKey={apiKey.trim() !== ''}
          onClose={() => setShowFirstRun(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <main className="mt-3 flex-1">
        <ReplyTab
          hidden={tab !== 'reply'}
          busy={busy}
          stage={stage}
          run={run}
          requireKey={requireKey}
          setError={setError}
          adopted={adopted}
          adoptedPersisted={adoptedPersisted}
          onAdopt={onAdopt}
          onClearAdopted={() => {
            clearAdopted();
            setAdopted([]);
            setAdoptedPersisted(true);
          }}
        />
        <ProfileTab
          hidden={tab !== 'profile'}
          busy={busy}
          stage={stage}
          run={run}
          requireKey={requireKey}
          setError={setError}
        />
      </main>

      <InstallHint />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        apiKey={apiKey}
        setApiKey={setApiKey}
        remember={remember}
        setRemember={(v) => {
          setRemember(v);
          saveKey(apiKey.trim(), v);
        }}
      />

      <div
        id="toast"
        role="status"
        hidden={!toast}
        className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-canvas"
      >
        {toast}
      </div>
    </div>
  );
}
