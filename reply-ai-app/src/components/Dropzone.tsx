import { useRef, useState } from 'react';
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
}: {
  dropId: string;
  fileId: string;
  thumbsId: string;
  title: string;
  hint: string;
  images: PickedImage[];
  setImages: (fn: (prev: PickedImage[]) => PickedImage[]) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function addFiles(files: File[]) {
    let count = images.length;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (count >= MAX_IMAGES) {
        onError(`スクショは最大${MAX_IMAGES}枚までです。`);
        break;
      }
      try {
        const im = await resizeImage(f, 1400);
        count++;
        setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, im]));
      } catch {
        onError(
          `「${f.name}」を読み込めませんでした。対応していない画像形式の可能性があります(iPhoneのHEIC写真は、スクショではなく写真の場合に読めないことがあります)。`,
        );
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
