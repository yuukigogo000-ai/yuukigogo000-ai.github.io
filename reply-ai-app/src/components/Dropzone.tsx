import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { MAX_IMAGES, resizeImage, type PickedImage } from '../lib/images';

export function Dropzone({
  dropId,
  fileId,
  thumbsId,
  title,
  hint,
  images,
  setImages,
  onError,
  epoch = 0,
  onBusyChange,
}: {
  dropId: string;
  fileId: string;
  thumbsId: string;
  title: string;
  hint: string;
  images: PickedImage[];
  setImages: (fn: (prev: PickedImage[]) => PickedImage[]) => void;
  onError: (msg: string) => void;
  /** 外部で画像を破棄したら +1 する。処理中の読み込み結果を捨てるための世代番号 */
  epoch?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const epochRef = useRef(epoch);
  const pendingRef = useRef(0);

  useEffect(() => {
    epochRef.current = epoch;
  }, [epoch]);

  async function addFiles(files: File[]) {
    const myEpoch = epochRef.current;
    let count = images.length;
    pendingRef.current += 1;
    onBusyChange?.(true);
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        if (count >= MAX_IMAGES) {
          onError(`スクショは最大${MAX_IMAGES}枚までです。`);
          break;
        }
        try {
          const im = await resizeImage(f, 1400);
          // 読み込み中にサンプル読込などで破棄されたら、この結果は捨てる
          if (epochRef.current !== myEpoch) return;
          count++;
          setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, im]));
        } catch {
          if (epochRef.current !== myEpoch) return;
          onError(
            `「${f.name}」を読み込めませんでした。対応していない画像形式の可能性があります(iPhoneのHEIC写真は、スクショではなく写真の場合に読めないことがあります)。`,
          );
        }
      }
    } finally {
      pendingRef.current -= 1;
      if (pendingRef.current <= 0) {
        pendingRef.current = 0;
        onBusyChange?.(false);
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        id={dropId}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles([...e.dataTransfer.files]);
        }}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${
          dragging
            ? 'border-brand bg-brand-soft'
            : 'border-line-strong bg-surface-2 hover:border-ink-faint'
        }`}
      >
        <ImagePlus size={22} strokeWidth={1.6} className="text-brand" aria-hidden="true" />
        <span className="mt-1 text-[15px] font-bold">{title}</span>
        <span className="text-[12.5px] text-ink-muted">{hint}</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        id={fileId}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />

      <div id={thumbsId} className="mt-2.5 flex flex-wrap gap-2">
        {images.map((im, i) => (
          <div className="thumb relative" key={i}>
            <img
              src={im.thumbUrl}
              alt={`スクショ ${i + 1}`}
              className="h-[76px] rounded-lg border border-line"
            />
            <button
              type="button"
              aria-label={`スクショ ${i + 1} を削除`}
              onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              className="del absolute -top-1.5 -right-1.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-ink text-canvas"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
