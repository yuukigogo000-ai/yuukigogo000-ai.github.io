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

/** 保存できたかどうかを呼び出し側に返す(「保存した」と嘘をつかないため) */
export function addAdopted(text: string): { list: string[]; persisted: boolean } {
  const t = String(text || '').trim();
  if (!t) return { list: getAdopted(), persisted: true };
  const a = getAdopted().filter((x) => x !== t);
  a.push(t);
  const next = a.slice(-ADOPTED_MAX);
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
