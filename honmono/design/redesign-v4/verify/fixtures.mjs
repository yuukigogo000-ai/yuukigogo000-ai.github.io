// 検査用のダミーファイルをブラウザ内で組み立てる。
// 画素データは持たない(解析器はマーカー/チャンクだけを読むため)。
// この関数はページの中で eval されるので、外部依存を持たせない。
export const FIXTURE_SCRIPT = `
window.__mk = (function () {
  const enc = new TextEncoder();
  function cat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const o = new Uint8Array(n); let i = 0;
    for (const p of parts) { o.set(p, i); i += p.length; }
    return o;
  }
  const u16be = v => new Uint8Array([v >> 8 & 255, v & 255]);
  const u32be = v => new Uint8Array([v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255]);

  // --- PNG ---
  function pngChunk(type, data) {
    return cat([u32be(data.length), enc.encode(type), data, u32be(0)]); // CRCは解析器が見ない
  }
  function ihdr(w, h) {
    return pngChunk('IHDR', cat([u32be(w), u32be(h), new Uint8Array([8, 2, 0, 0, 0])]));
  }
  function png(w, h, extra) {
    return cat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ihdr(w, h)]
      .concat(extra || []).concat([pngChunk('IEND', new Uint8Array(0))]));
  }
  function tEXt(key, val) {
    return pngChunk('tEXt', cat([enc.encode(key), new Uint8Array([0]), enc.encode(val)]));
  }

  // --- JPEG ---
  function seg(marker, body) {
    return cat([new Uint8Array([0xFF, marker]), u16be(body.length + 2), body]);
  }
  function sof0(w, h) {
    return seg(0xC0, cat([new Uint8Array([8]), u16be(h), u16be(w), new Uint8Array([1, 1, 0x11, 0])]));
  }
  // 文字列タグだけを持つ最小のTIFF(リトルエンディアン)
  function tiff(entries) {
    const head = cat([enc.encode('II'), new Uint8Array([42, 0]), u32be(0)]);
    const hdr = new Uint8Array(8);
    hdr.set(enc.encode('II'), 0); hdr[2] = 42; hdr[3] = 0;
    new DataView(hdr.buffer).setUint32(4, 8, true);           // IFD0 は offset 8
    const n = entries.length;
    const dirLen = 2 + n * 12 + 4;
    let valOff = 8 + dirLen;
    const dir = new Uint8Array(dirLen);
    const dv = new DataView(dir.buffer);
    dv.setUint16(0, n, true);
    const vals = [];
    entries.forEach((e, i) => {
      const bytes = cat([enc.encode(e.value), new Uint8Array([0])]);
      const o = 2 + i * 12;
      dv.setUint16(o, e.tag, true);
      dv.setUint16(o + 2, 2, true);          // ASCII
      dv.setUint32(o + 4, bytes.length, true);
      dv.setUint32(o + 8, valOff, true);
      vals.push(bytes); valOff += bytes.length;
    });
    dv.setUint32(2 + n * 12, 0, true);        // 次のIFDなし
    return cat([hdr, dir].concat(vals));
  }
  function jpeg(parts) {
    return cat([new Uint8Array([0xFF, 0xD8])].concat(parts).concat([new Uint8Array([0xFF, 0xD9])]));
  }
  const file = (bytes, name, type) => new File([bytes], name, { type });

  return {
    // verdict=ai : 生成パラメータ入りPNG
    ai: () => file(png(512, 512, [tEXt('parameters', 'masterpiece, Steps: 20, Sampler: Euler a, Seed: 1')]),
                   'ai.png', 'image/png'),
    // verdict=camera : カメラEXIF入りJPEG
    camera: () => file(jpeg([
        seg(0xE1, cat([new TextEncoder().encode('Exif'), new Uint8Array([0, 0]),
          tiff([{ tag: 0x010F, value: 'TESTCAM' }, { tag: 0x0110, value: 'MODEL-1' }])])),
        sof0(4000, 3000)]), 'camera.jpg', 'image/jpeg'),
    // verdict=stock : 素材サイトの痕跡をXMPに持つJPEG
    stock: () => file(jpeg([
        seg(0xE1, cat([enc.encode('http://ns.adobe.com/xap/1.0/'), new Uint8Array([0]),
          enc.encode('<x:xmpmeta><rdf:RDF><rdf:Description photoshop:Credit="Adobe Stock" /></rdf:RDF></x:xmpmeta>')])),
        sof0(1600, 1200)]), 'stock.jpg', 'image/jpeg'),
    // verdict=weak : 生成AI定番サイズだけが手がかり
    weak: () => file(png(1024, 1024, []), 'weak.png', 'image/png'),
    // verdict=c2pa : caBXチャンクを持つPNG(SDKでは解析できない = 読み取り不能状態も再現する)
    c2pa: () => file(png(800, 600, [pngChunk('caBX', enc.encode('jumb c2pa.claim placeholder'))]),
                     'c2pa.png', 'image/png'),
    // verdict=unknown : 手がかりが何も無いJPEG
    unknown: () => file(jpeg([sof0(640, 480)]), 'unknown.jpg', 'image/jpeg'),
    // 非対応形式
    unsupported: () => file(enc.encode('this is definitely not an image file at all'),
                            'note.txt', 'text/plain'),
    // 動画(ftyp)
    video: () => file(cat([u32be(24), enc.encode('ftypisom'), new Uint8Array(12)]),
                      'clip.mp4', 'video/mp4'),
    // 解析中に例外を起こす(arrayBuffer が失敗する File 相当)
    broken: () => {
      const f = file(png(8, 8, []), 'broken.png', 'image/png');
      Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.reject(new Error('injected')) });
      return f;
    },
  };
})();
`;
