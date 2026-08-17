// スクショはブラウザ内で縮小してから送る(通信量とトークン代の節約)。

export type PickedImage = { data: string; thumbUrl: string };

export const MAX_IMAGES = 6;

export function resizeImage(file: File, maxEdge: number): Promise<PickedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ data: dataUrl.split(',')[1], thumbUrl: dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    img.src = url;
  });
}

export function imageBlocks(store: PickedImage[]) {
  return store.map(
    (im) =>
      ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: im.data },
      }) as const,
  );
}
