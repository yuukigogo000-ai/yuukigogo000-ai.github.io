import { useRef, useState } from 'react';
import { Compass, RefreshCw, Trash2 } from 'lucide-react';
import { AutoTextarea } from './AutoTextarea';
import { Chips, type ChipOption } from './Chips';
import { Dropzone } from './Dropzone';
import { Meter } from './Meter';
import { ReplyCard } from './ReplyCard';
import { CanceledError, callClaude, type ReplyResult } from '../lib/api';
import { imageBlocks, type PickedImage } from '../lib/images';
import { REPLY_SCHEMA, REPLY_SYSTEM } from '../lib/prompts';
import { SAMPLES } from '../lib/samples';
import type { Runner } from '../lib/types';

export const GOALS: ChipOption[] = [
  { id: 'g1', value: '会話を自然に盛り上げて距離を縮める', label: '会話を盛り上げる' },
  { id: 'g2', value: '自然な流れでデート(食事やカフェ)に誘う', label: 'デートに誘う' },
  {
    id: 'g3',
    value: '返信が来なくなりかけているので、重くならずに会話を復活させる',
    label: '既読スルー対策',
  },
  { id: 'g4', value: 'マッチ直後の初回メッセージで返信率を最大化する', label: '初回メッセージ' },
  {
    id: 'g5',
    value: 'デートの誘いにOKをもらえたので、日程・時間・場所をスムーズに確定させる',
    label: '日程調整',
  },
  {
    id: 'g6',
    value:
      'デートの前日〜当日。リマインドや軽い一言で当日を盛り上げ、ドタキャンされない空気を作る',
    label: 'デート前日・当日',
  },
  { id: 'g7', value: 'デート後のお礼と、重くならずに次に繋げる一言', label: 'デート後お礼' },
  {
    id: 'g8',
    value: 'アプリ内の会話からLINE交換を自然に切り出す(相手に抵抗感を与えないタイミングと理由で)',
    label: 'LINE交換',
  },
];

const TONES: ChipOption[] = [
  { id: 't0', value: 'auto', label: '自分の文体に合わせる' },
  { id: 't1', value: '丁寧で誠実', label: '丁寧・誠実' },
  { id: 't2', value: 'フレンドリーで軽快', label: 'フレンドリー' },
  { id: 't3', value: 'ユーモアがあって遊び心のある', label: 'ユーモア' },
];

/** 吹き出しの分け方。場によって正解が違う(アプリ内は1通・LINEは連投が普通)ので人が選べるようにする */
const SPLITS: ChipOption[] = [
  { id: 'b0', value: 'auto', label: 'おまかせ' },
  { id: 'b1', value: 'single', label: '1通にまとめる' },
  { id: 'b2', value: 'multi', label: '分けて送る' },
];

const SPLIT_PROMPT: Record<string, string> = {
  auto: '会話の場(LINEかアプリ内か)と相手の吹き出し数から判断する',
  single: '3案とも1通にまとめる(bubblesは必ず1要素だけにする)',
  multi: '2〜3通に分ける案を中心にする。ただし3案すべてを同じ通数にはしない',
};

const STAGES = ['会話を読み取っています', '文体を分析しています', '返信案を作っています'];

/** bubbles(新) と text(旧) の両方を受ける */
function normalizeBubbles(r: ReplyResult['replies'][number]): string[] {
  const b = Array.isArray(r.bubbles) ? r.bubbles.map((x) => String(x).trim()).filter(Boolean) : [];
  if (b.length) return b.slice(0, 3);
  return [String(r.text || '').trim()].filter(Boolean);
}

export function ReplyTab({
  hidden,
  busy,
  stage,
  run,
  requireKey,
  setError,
  adopted,
  adoptedPersisted,
  onAdopt,
  onClearAdopted,
}: {
  hidden: boolean;
  busy: boolean;
  stage: string;
  run: Runner;
  requireKey: () => string | null;
  setError: (msg: string) => void;
  adopted: string[];
  adoptedPersisted: boolean;
  onAdopt: (texts: string[], copied: boolean) => void;
  onClearAdopted: () => void;
}) {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [conversation, setConversation] = useState('');
  const [partnerProfile, setPartnerProfile] = useState('');
  const [goal, setGoal] = useState(GOALS[0].value);
  const [tone, setTone] = useState(TONES[0].value);
  const [extra, setExtra] = useState('');
  const [styleSample, setStyleSample] = useState('');
  const [split, setSplit] = useState(SPLITS[0].value);
  const [sample, setSample] = useState('');
  const [imagesEpoch, setImagesEpoch] = useState(0);
  const [imagesBusy, setImagesBusy] = useState(false);
  /** 送信ごとの通し番号。古い応答が新しい入力の結果として表示されるのを防ぐ */
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  /** 送信内容の指紋。応答が返った時点で入力が変わっていたら、その結果は使わない */
  const inputsRef = useRef('');
  inputsRef.current = JSON.stringify([
    conversation,
    partnerProfile,
    goal,
    tone,
    extra,
    styleSample,
    split,
    imagesEpoch,
    images.map((im) => im.id),
  ]);

  function cancelInFlight() {
    reqIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
  }
  const [result, setResult] = useState<ReplyResult | null>(null);
  /** その結果を作った時の入力指紋。今の入力と違えば、その結果は古い */
  const [resultSig, setResultSig] = useState('');
  const [lastReplies, setLastReplies] = useState<string[]>([]);

  function loadSample(value: string) {
    setSample(value);
    const sm = SAMPLES[Number(value)];
    if (!sm) return;
    // サンプルは別の会話。前の会話のスクショ・結果・既出案を残すと混ざる
    cancelInFlight(); // 実行中の生成は打ち切る(待ち続けてボタンが戻らないのを防ぐ)
    setImagesEpoch((e) => e + 1);
    setImages([]);
    setResult(null);
    setLastReplies([]);
    setConversation(sm.conversation);
    setPartnerProfile(sm.profile);
    setStyleSample(sm.style);
    setExtra('');
    const g = GOALS.find((o) => o.id === sm.goal);
    if (g) setGoal(g.value);
    setTone(TONES[0].value);
    setError('');
  }

  async function generate(keepHistory: boolean) {
    const key = requireKey();
    if (!key) return;
    if (imagesBusy) {
      setError('スクショを読み込み中です。少し待ってからもう一度押してください。');
      return;
    }
    // 初回メッセージは「まだ会話がない」状態が正常。相手の情報か自分の文体があれば作れる
    const isFirstMessage = goal === GOALS[3].value;
    const hasSeed = conversation.trim() !== '' || images.length > 0;
    if (!hasSeed && !(isFirstMessage && (partnerProfile.trim() || styleSample.trim()))) {
      setError(
        isFirstMessage
          ? '相手のプロフィール(または自分の文体サンプル)を入れてください。初回メッセージはそこから作ります。'
          : 'トーク画面のスクショを追加するか、やり取りを貼り付けてください。',
      );
      return;
    }
    const history = keepHistory ? lastReplies : [];
    if (!keepHistory) {
      // 新規生成は前回の結果を捨ててから始める(失敗時に別の会話の案が残らないように)
      setResult(null);
      setLastReplies([]);
    }

    const toneText =
      tone === 'auto'
        ? '指定なし。「自分」の過去メッセージの文体・テンションから本人らしさを最優先で再現する'
        : tone;

    let userPrompt =
      `## 相手のプロフィール\n${partnerProfile.trim() || '(情報なし)'}\n\n` +
      (styleSample.trim()
        ? `## 本人の普段の文体サンプル(文体抽出の最優先材料にすること)\n${styleSample.trim()}\n\n`
        : '') +
      (adopted.length
        ? `## 本人が過去に採用した返信(文体・テンポの参考。内容や話題は流用しない)\n${adopted
            .slice(-8)
            .map((t) => '- ' + t)
            .join('\n')}\n\n`
        : '') +
      (images.length ? `## 会話(添付スクショ${images.length}枚を時系列順に読み取ること)\n` : '') +
      (conversation.trim() ? `## 会話(テキスト)\n${conversation.trim()}\n\n` : '\n') +
      `## 今回のゴール\n${goal}\n\n` +
      `## トーン\n${toneText}\n` +
      `\n## 吹き出しの分け方\n${SPLIT_PROMPT[split]}\n` +
      (extra.trim() ? `\n## ユーザーからの追加指示(最優先で従う)\n${extra.trim()}\n` : '');

    if (history.length) {
      userPrompt +=
        `\n## 既に提示済みの案(これらとは方向性・言い回しを変えること)\n` +
        history.map((t) => `- ${t}`).join('\n') +
        '\n';
    }
    userPrompt += `\nこの状況に最適な返信を3案提案してください。`;

    const content = [...imageBlocks(images), { type: 'text' as const, text: userPrompt }];

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++reqIdRef.current;
    const sentInputs = inputsRef.current;

    await run(STAGES, async () => {
      let res: ReplyResult;
      try {
        res = await callClaude<ReplyResult>(
          key,
          REPLY_SYSTEM,
          REPLY_SCHEMA,
          content,
          controller.signal,
        );
      } catch (err) {
        if (err instanceof CanceledError) return; // 本人が入力を変えた等。エラー表示はしない
        throw err;
      }
      // 送信後に会話やサンプルが切り替わっていたら、この結果はもう別物なので捨てる
      if (reqId !== reqIdRef.current) return;
      if (sentInputs !== inputsRef.current) {
        setError('入力が変わったので、前回の結果は使いませんでした。もう一度作成してください。');
        return;
      }
      const replies = (res.replies ?? []).slice(0, 3).filter((r) => normalizeBubbles(r).length > 0);
      if (replies.length === 0) {
        throw new Error('提案が返ってきませんでした。もう一度お試しください。');
      }
      setResult({ ...res, replies });
      setResultSig(sentInputs);
      // 生成が終わったら結果まで運ぶ(入力欄をスクロールし直させない)
      window.requestAnimationFrame(() =>
        document.getElementById('replyAnalysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      if (reqId !== reqIdRef.current) return;
      setLastReplies((prev) =>
        [...(keepHistory ? prev : []), ...replies.map((r) => normalizeBubbles(r).join('\n'))].slice(
          -9,
        ),
      );
    });
  }

  // 表示中の提案が「今の入力に対するもの」でなくなったら、出しっぱなしにしない
  const stale = result !== null && resultSig !== inputsRef.current;
  const shown = stale ? null : result;

  return (
    <div id="tabReply" hidden={hidden} role="tabpanel" aria-labelledby="tabBtnReply">
      <section className="card p-4">
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-ink-muted">会話を読み込む</h2>
        <Dropzone
          dropId="convDrop"
          fileId="convFile"
          thumbsId="convThumbs"
          title="トーク画面のスクショを追加"
          hint="LINE・Pairs・Tinderなど / 最大6枚 / 右側が自分として読み取ります"
          images={images}
          setImages={setImages}
          onError={setError}
          epoch={imagesEpoch}
          onBusyChange={setImagesBusy}
        />

        <div className="mt-4">
          <label className="label" htmlFor="conversation">
            テキストで貼り付け(スクショと併用可)
          </label>
          <AutoTextarea
            id="conversation"
            placeholder={'自分: 最近どこか行きました?\n相手: 代官山の新しいお店行きましたよ〜'}
            value={conversation}
            onChange={setConversation}
          />
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="partnerProfile">
            相手のプロフィール(任意・精度が上がります)
          </label>
          <input
            type="text"
            id="partnerProfile"
            className="field"
            placeholder="26歳 看護師 カフェ巡り・韓国ドラマ好き"
            value={partnerProfile}
            onChange={(e) => setPartnerProfile(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="sampleSelect">
            動作確認用のサンプル会話(架空)
          </label>
          <select
            id="sampleSelect"
            className="field"
            value={sample}
            onChange={(e) => loadSample(e.target.value)}
          >
            <option value="">選ぶと会話・プロフィール・文体・ゴールが自動で入ります</option>
            {SAMPLES.map((sm, i) => (
              <option key={i} value={String(i)}>
                {sm.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card mt-3 p-4">
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-ink-muted">今回のゴール</h2>
        <Chips name="goal" options={GOALS} value={goal} onChange={setGoal} ariaLabel="今回のゴール" />
        <h2 className="mt-5 mb-3 text-[13px] font-bold tracking-wide text-ink-muted">トーン</h2>
        <Chips name="tone" options={TONES} value={tone} onChange={setTone} ariaLabel="トーン" />
        <h2 className="mt-5 mb-3 text-[13px] font-bold tracking-wide text-ink-muted">
          吹き出しの分け方
        </h2>
        <Chips
          name="split"
          options={SPLITS}
          value={split}
          onChange={setSplit}
          ariaLabel="吹き出しの分け方"
        />
      </section>

      <details className="card mt-3 px-4 py-3.5">
        <summary className="cursor-pointer text-[13px] font-bold text-ink-muted">
          詳細設定(追加の指示・文体サンプル)
        </summary>
        <div className="mt-4">
          <label className="label" htmlFor="extra">
            追加の指示
          </label>
          <input
            type="text"
            id="extra"
            className="field"
            placeholder="今週の土曜に誘いたい / 敬語は崩さないで"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="styleSample">
            普段の自分の文体サンプル
          </label>
          <AutoTextarea
            id="styleSample"
            minHeight={76}
            placeholder={'友達とのLINEなど、普段自分が送っている文をそのまま貼ってください'}
            value={styleSample}
            onChange={setStyleSample}
          />
        </div>
        <p id="adoptedNote" className="mt-3 flex items-center gap-2 text-[12px] text-ink-muted">
          {adopted.length ? (
            <>
              <span>
            コピーした返信 {adopted.length}件を記憶(直近8件を文体学習に使用)
            {adoptedPersisted ? '' : '(この端末では保存できないため今回のみ)'}
          </span>
              <button
                type="button"
                onClick={onClearAdopted}
                className="inline-flex items-center gap-1 text-ink-faint underline underline-offset-2"
              >
                <Trash2 size={12} strokeWidth={2} />
                消す
              </button>
            </>
          ) : (
            <span>
              コピーした返信は「本人が採用した文」としてこのブラウザに記憶され、次回から文体学習に使われます(0件)
            </span>
          )}
        </p>
      </details>

      {busy && (
        <div className="mt-4 space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-3.5">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton mt-3 ml-auto h-9 w-3/5" />
              <div className="skeleton mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      )}

      {stale && !busy && (
        <p id="staleNote" className="mt-4 px-1 text-[12px] text-ink-muted">
          入力が変わったので、前の提案は表示していません。もう一度「返信案を3つ作る」を押してください。
        </p>
      )}

      <div id="replyAnalysis" className="card mt-4 scroll-mt-20 p-4" hidden={!shown}>
        <h2 className="mb-1.5 text-[12px] font-bold tracking-wide text-ink-muted">いまの状況</h2>
        <p id="situation" className="mb-3 text-[13.5px] leading-relaxed">
          {shown?.situation ?? ''}
        </p>
        <Meter
          barId="meterBar"
          pctId="meterPct"
          label="脈あり度"
          value={shown?.interest_level ?? 0}
          suffix="%"
        />
      </div>

      <h2 className="mt-4 mb-2 px-1 text-[12px] font-bold tracking-wide text-ink-muted" hidden={!shown || busy}>
        送信プレビュー(そのままコピーして送れます)
      </h2>
      {shown && shown.replies.length < 3 && !busy && (
        <p id="shortfallNote" className="mb-2 px-1 text-[12px] text-ink-muted">
          AIから{shown.replies.length}案しか返りませんでした。「方向性を変えて別の3案」で出し直せます。
        </p>
      )}
      {shown && !busy && split === 'multi' &&
        shown.replies.every((r) => normalizeBubbles(r).length === 1) && (
          <p id="splitNote" className="mb-2 px-1 text-[12px] text-ink-muted">
            「分けて送る」を選びましたが、AIは1通で返しました(この場面では分けない方が自然と判断されています)。
          </p>
        )}
      <div id="replyResults" className="space-y-3" hidden={!shown || busy}>
        {(shown?.replies ?? []).map((r, i) => (
          <ReplyCard
            key={i}
            index={i}
            bubbles={
              // 「1通にまとめる」を選んだら、AIが分けてきても必ず1通にする
              split === 'single' ? [normalizeBubbles(r).join('\n')] : normalizeBubbles(r)
            }
            why={r.why}
            onCopy={onAdopt}
          />
        ))}
      </div>

      <div
        id="replyAdvice"
        className="mt-3 rounded-xl border-l-[3px] border-brand bg-brand-soft px-4 py-3.5"
        hidden={!shown}
      >
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink-muted">
          <Compass size={14} strokeWidth={2} />
          次の一手
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed">{shown?.advice ?? ''}</p>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-5 border-t border-line bg-canvas/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          id="generate"
          className="btn-primary"
          disabled={busy}
          onClick={() => void generate(false)}
        >
          {busy ? stage : '返信案を3つ作る'}
        </button>
        <button
          type="button"
          id="regenerate"
          hidden={!shown}
          aria-hidden={!shown}
          disabled={busy}
          className="btn-ghost mt-2 flex w-full items-center justify-center gap-1.5"
          onClick={() => void generate(true)}
        >
          <RefreshCw size={14} strokeWidth={2} />
          方向性を変えて別の3案
        </button>
      </div>
    </div>
  );
}
