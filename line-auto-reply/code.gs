/**
 * LINE自動返信ボット（Google Apps Script版）
 *
 * 使い方は同じフォルダの README.md を見てください。
 * ここを書き換えるのは基本的に「返信ルール(RULES)」と「各種メッセージ」だけでOKです。
 */

// ======================================================================
// ★ 設定エリア（ここだけ編集すればOK）
// ======================================================================

/**
 * 返信ルール。上から順にチェックして、最初にマッチしたものを返信します。
 *  - keywords: この単語のどれかがメッセージに「含まれて」いたら反応
 *  - reply   : 返信する文章（\n で改行できます）
 */
const RULES = [
  {
    keywords: ['営業時間', '何時まで', '何時から'],
    reply: '営業時間のご案内です。\n平日 10:00〜19:00\n土日祝 10:00〜17:00\n定休日：水曜日',
  },
  {
    keywords: ['場所', '住所', 'アクセス', 'どこ'],
    reply: '所在地はこちらです。\n〒000-0000 東京都〇〇区〇〇 1-2-3\n最寄駅：〇〇駅 徒歩5分',
  },
  {
    keywords: ['予約', '空き'],
    reply: 'ご予約ありがとうございます！\nご希望の日時を「8月20日 14時」のように送ってください。担当者から折り返しご連絡します。',
  },
  {
    keywords: ['料金', '価格', 'いくら'],
    reply: '料金のご案内です。\n・基本コース：3,000円\n・スペシャルコース：5,000円\n詳しくはスタッフまでお気軽にどうぞ。',
  },
];

/**
 * どのルールにもマッチしなかったときの返信。
 * 「返信しない」ようにしたい場合は null にしてください。（例: const DEFAULT_REPLY = null;）
 */
const DEFAULT_REPLY =
  'メッセージありがとうございます！\n' +
  '以下のキーワードを送ると自動でご案内します。\n' +
  '・営業時間\n・アクセス\n・予約\n・料金\n' +
  'その他のお問い合わせは、担当者が確認しだいお返事します。';

/**
 * 友だち追加された瞬間に送るあいさつメッセージ。
 * 不要なら null にしてください。
 */
const FOLLOW_GREETING =
  '友だち追加ありがとうございます！\n' +
  '「営業時間」「アクセス」「予約」「料金」などのキーワードを送ると、自動でご案内します。';

// ======================================================================
// ここから下は変更不要
// ======================================================================

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

/** LINEからWebhookで呼ばれる入口 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(handleEvent);
  } catch (err) {
    console.error('doPost error: ' + err);
  }
  // LINEには常に200を返す（返さないと再送が繰り返される）
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** イベント1件を処理 */
function handleEvent(event) {
  if (event.type === 'follow' && FOLLOW_GREETING) {
    replyText(event.replyToken, FOLLOW_GREETING);
    return;
  }

  if (event.type !== 'message' || !event.message || event.message.type !== 'text') {
    return; // スタンプ・画像などは無視
  }

  const userText = event.message.text;
  const reply = findReply(userText);
  if (reply) {
    replyText(event.replyToken, reply);
  }
}

/** メッセージ本文からルールを探す */
function findReply(text) {
  for (const rule of RULES) {
    if (rule.keywords.some(function (kw) { return text.indexOf(kw) !== -1; })) {
      return rule.reply;
    }
  }
  return DEFAULT_REPLY;
}

/** テキストを返信する */
function replyText(replyToken, text) {
  const token = getChannelAccessToken();
  if (!token) {
    console.error('チャネルアクセストークンが未設定です。README.md の手順4を確認してください。');
    return;
  }
  const res = UrlFetchApp.fetch(LINE_REPLY_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: String(text).slice(0, 5000) }],
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    console.error('LINE返信エラー: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

/** スクリプトプロパティからトークンを取得 */
function getChannelAccessToken() {
  return PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
}

/**
 * 【初回設定用】チャネルアクセストークンを保存する関数。
 * README.md の手順4のとおり、下の 'ここにトークンを貼る' を書き換えて1回だけ実行し、
 * 実行が終わったら貼ったトークンを消して保存し直してください。
 */
function setToken() {
  PropertiesService.getScriptProperties().setProperty(
    'LINE_CHANNEL_ACCESS_TOKEN',
    'ここにトークンを貼る'
  );
}

/**
 * 【動作確認用】トークンが正しく保存できているかテストする関数。
 * 実行して「トークン設定OK」とログに出れば成功です。
 */
function checkToken() {
  const token = getChannelAccessToken();
  if (!token || token === 'ここにトークンを貼る') {
    console.log('NG: トークンが未設定です。setToken() を実行してください。');
  } else {
    console.log('トークン設定OK（先頭10文字: ' + token.slice(0, 10) + '...）');
  }
}
