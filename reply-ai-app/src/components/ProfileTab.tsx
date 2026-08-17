import { useRef, useState } from 'react';
import { Camera, Check, Copy } from 'lucide-react';
import { AutoTextarea } from './AutoTextarea';
import { Chips, type ChipOption } from './Chips';
import { Dropzone } from './Dropzone';
import { Meter } from './Meter';
import { callClaude, type ProfileResult } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { imageBlocks, type PickedImage } from '../lib/images';
import { PROFILE_SCHEMA, PROFILE_SYSTEM } from '../lib/prompts';
import type { Runner } from '../lib/types';

const MODES: ChipOption[] = [
  { id: 'pm1', value: 'review', label: '今のプロフィールを診断' },
  { id: 'pm2', value: 'create', label: 'ゼロから作る' },
];

const STAGES = ['プロフィールを読み取っています', '女性側の目線で採点しています', '改善案を作っています'];

function BioCard({
  index,
  text,
  why,
  onCopyFailed,
}: {
  index: number;
  text: string;
  why: string;
  onCopyFailed: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="card p-3.5">
      <div className="num">改善案 {index + 1}</div>
      <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-wrap">{text}</p>
      <p className="mt-3 border-l-2 border-line pl-2.5 text-[12.5px] leading-relaxed text-ink-muted">
        {why}
      </p>
      <button
        type="button"
        className="btn-ghost mt-3 flex w-full items-center justify-center gap-1.5"
        onClick={() => {
          void copyText(text).then((ok) => {
            if (!ok) {
              onCopyFailed();
              return;
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? (
          <>
            <Check size={15} strokeWidth={2.5} className="text-brand" />
            コピーしました
          </>
        ) : (
          <>
            <Copy size={15} strokeWidth={2} />
            コピー
          </>
        )}
      </button>
    </article>
  );
}

export function ProfileTab({
  hidden,
  busy,
  stage,
  run,
  requireKey,
  setError,
}: {
  hidden: boolean;
  busy: boolean;
  stage: string;
  run: Runner;
  requireKey: () => string | null;
  setError: (msg: string) => void;
}) {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [bioText, setBioText] = useState('');
  const [basicInfo, setBasicInfo] = useState('');
  const [targetInfo, setTargetInfo] = useState('');
  const [mode, setMode] = useState(MODES[0].value);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [imagesBusy, setImagesBusy] = useState(false);
  const reqIdRef = useRef(0);

  async function generate() {
    const key = requireKey();
    if (!key) return;
    if (mode === 'review' && !bioText.trim() && images.length === 0) {
      setError(
        '診断するには、プロフィールのスクショを追加するか自己紹介文を貼り付けてください(ゼロから作る場合は「ゼロから作る」を選択)。',
      );
      return;
    }
    if (!basicInfo.trim()) {
      setError('「自分の基本情報」を入力してください(改善案の材料になります)。');
      return;
    }
    if (imagesBusy) {
      setError('スクショを読み込み中です。少し待ってからもう一度押してください。');
      return;
    }
    // 前回の診断結果は捨ててから始める(失敗時に別プロフィールの結果が残らないように)
    setResult(null);

    const userPrompt =
      (images.length
        ? `## 現在のプロフィール(添付スクショ${images.length}枚。写真とbioを読み取ること)\n\n`
        : '') +
      (bioText.trim() ? `## 現在の自己紹介文\n${bioText.trim()}\n\n` : '') +
      `## 本人の基本情報(改善案はこの事実だけを使うこと)\n${basicInfo.trim()}\n\n` +
      (targetInfo.trim() ? `## 刺さりたい相手のイメージ\n${targetInfo.trim()}\n\n` : '') +
      (mode === 'create'
        ? `## 依頼\n自己紹介文をゼロから作ってください。scoreとweaknessesは「現状の素材」に対する評価として書いてください。`
        : `## 依頼\n現在のプロフィールを診断し、改善版を提案してください。`);

    const content = [...imageBlocks(images), { type: 'text' as const, text: userPrompt }];

    const reqId = ++reqIdRef.current;

    await run(STAGES, async () => {
      const res = await callClaude<ProfileResult>(key, PROFILE_SYSTEM, PROFILE_SCHEMA, content);
      if (reqId !== reqIdRef.current) return;
      const bios = (res.improved_bios ?? []).filter((b) => String(b?.text || '').trim() !== '');
      if (bios.length === 0) {
        throw new Error('改善案が返ってきませんでした。もう一度お試しください。');
      }
      setResult({ ...res, improved_bios: bios });
      window.requestAnimationFrame(() =>
        document.getElementById('profAnalysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    });
  }

  return (
    <div id="tabProfile" hidden={hidden} role="tabpanel" aria-labelledby="tabBtnProfile">
      <section className="card p-4">
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-ink-muted">
          自分のプロフィールを読み込む
        </h2>
        <Dropzone
          dropId="profDrop"
          fileId="profFile"
          thumbsId="profThumbs"
          title="プロフィール画面のスクショを追加"
          hint="写真と自己紹介文が写っているとベスト / 最大6枚"
          images={images}
          setImages={setImages}
          onError={setError}
          onBusyChange={setImagesBusy}
        />

        <div className="mt-4">
          <label className="label" htmlFor="bioText">
            自己紹介文(新規作成なら空欄でOK)
          </label>
          <AutoTextarea
            id="bioText"
            minHeight={96}
            placeholder="今使っている自己紹介文をそのまま貼り付け"
            value={bioText}
            onChange={setBioText}
          />
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="basicInfo">
            自分の基本情報(年齢・職業・趣味・性格)
          </label>
          <AutoTextarea
            id="basicInfo"
            minHeight={76}
            placeholder="29歳 IT企業勤務 サウナ・キャンプ・ラーメン屋巡り 人見知りだが慣れると喋る"
            value={basicInfo}
            onChange={setBasicInfo}
          />
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="targetInfo">
            どんな相手に刺さりたいか(任意)
          </label>
          <input
            type="text"
            id="targetInfo"
            className="field"
            placeholder="20代後半 落ち着いた人 / 一緒に飲みに行ける人"
            value={targetInfo}
            onChange={(e) => setTargetInfo(e.target.value)}
          />
        </div>
      </section>

      <section className="card mt-3 p-4">
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-ink-muted">やってほしいこと</h2>
        <Chips name="profMode" options={MODES} value={mode} onChange={setMode} ariaLabel="やってほしいこと" />
      </section>

      <div id="profAnalysis" className="card mt-4 scroll-mt-20 p-4" hidden={!result}>
        <p id="profImpression" className="mb-3 text-[13.5px] leading-relaxed">
          {result?.first_impression ?? ''}
        </p>
        <Meter
          barId="profMeterBar"
          pctId="profMeterPct"
          label="プロフ得点"
          value={result?.score ?? 0}
          suffix="点"
        />
        <h3 className="mt-4 text-[12.5px] font-bold text-brand">良い点</h3>
        <ul id="profStrengths" className="mt-1 list-disc space-y-1 pl-5 text-[13.5px]">
          {(result?.strengths ?? []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <h3 className="mt-3 text-[12.5px] font-bold text-ink-muted">直すべき点</h3>
        <ul id="profWeaknesses" className="mt-1 list-disc space-y-1 pl-5 text-[13.5px]">
          {(result?.weaknesses ?? []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      {result && result.improved_bios.length < 2 && !busy && (
        <p id="bioShortfallNote" className="mt-3 px-1 text-[12px] text-ink-muted">
          改善案が{result.improved_bios.length}件しか返りませんでした。もう一度実行すると2案出ることがあります。
        </p>
      )}
      <div id="profResults" className="mt-3 space-y-3" hidden={!result || busy}>
        {(result?.improved_bios ?? []).map((b, i) => (
          <BioCard
            key={i}
            index={i}
            text={b.text}
            why={b.why}
            onCopyFailed={() =>
              setError(
                'コピーできませんでした。文面を長押し(または選択)して手動でコピーしてください。',
              )
            }
          />
        ))}
      </div>

      <div
        id="profPhotoAdvice"
        className="mt-3 rounded-xl border-l-[3px] border-brand bg-brand-soft px-4 py-3.5"
        hidden={!result}
      >
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink-muted">
          <Camera size={14} strokeWidth={2} />
          写真アドバイス
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed">{result?.photo_advice ?? ''}</p>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-5 border-t border-line bg-canvas/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          id="profGenerate"
          className="btn-primary"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? stage : mode === 'create' ? 'プロフィールを作る' : 'プロフィールを診断する'}
        </button>
      </div>
    </div>
  );
}
