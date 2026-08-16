// ビルド前処理:Web版 band/ をそのまま desktop/app/ へ同梱する
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "band");
const dest = join(here, "..", "app");

if (!existsSync(src)) {
  console.error("band/ が見つかりません:", src);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("copied band/ ->", dest);
