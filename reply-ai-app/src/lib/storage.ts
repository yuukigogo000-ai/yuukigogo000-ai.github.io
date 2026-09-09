// ブラウザに置くものだけ。サーバーは存在しない。

export const KEY_STORAGE = 'reply_ai_key';
export const ADOPTED_KEY = 'reply_ai_adopted';
export const INSTALL_HINT_KEY = 'reply_ai_install_hint_closed';
export const ONBOARD_KEY = 'reply_ai_onboarded';

const ADOPTED_MAX = 30;

export function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function saveKey(key: string, remember: boolean) {
  try {
    if (remember) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* プライベートブラウズ等で保存できなくても動作は続ける */
  }
}

/** 本人が実際にコピーして使った返信。次回以降の文体学習の材料になる。 */
export function getAdopted(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(ADOPTED_KEY) || '[]');
    return Array.isArray(a) ? (a as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * 採用した文を追記する。複数まとめて渡すこと。
 * 1件ずつ呼ぶと、保存に失敗した端末で前の1件が毎回失われる(保存済みの内容を読み直すため)。
 * 保存できたかどうかも返す(「保存した」と嘘をつかないため)。
 */
export function addAdopted(
  texts: string | string[],
  base?: string[],
): { list: string[]; persisted: boolean } {
  const items = (Array.isArray(texts) ? texts : [texts])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  let list = base ?? getAdopted();
  if (!items.length) return { list, persisted: true };
  for (const t of items) {
    list = list.filter((x) => x !== t);
    list.push(t);
  }
  const next = list.slice(-ADOPTED_MAX);
  try {
    localStorage.setItem(ADOPTED_KEY, JSON.stringify(next));
    return { list: next, persisted: true };
  } catch {
    return { list: next, persisted: false };
  }
}

export function clearAdopted() {
  try {
    localStorage.removeItem(ADOPTED_KEY);
  } catch {
    /* ignore */
  }
}
