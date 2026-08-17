// UI確認用スクリーンショット。npm run build のあと、リポジトリのルートで http.server を立てて実行する。
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8778/reply-ai/';
const OUT = process.env.SHOT_DIR || './shots';

const result = {
  stop_reason: 'end_turn',
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        situation:
          'サウナと中目黒で共通の話題が出て、相手からも質問が返ってきている。会話は10往復目で温度は高い。',
        interest_level: 74,
        replies: [
          {
            bubbles: ['サウナ仲間じゃないですか笑', '中目黒のそこ、名前思い出せます?'],
            why: '相手のテンションに合わせて短く2通。質問は1つだけに絞って答えやすくしています',
          },
          {
            bubbles: ['平日昼のサウナとか最高すぎる'],
            why: '共感だけで返して、相手に話す余白を残す型',
          },
          {
            bubbles: [
              '中目黒のサウナ気になるんで、今度一緒に行きません?笑',
              '来週の水木の夜か土曜の昼なら空いてます',
            ],
            why: '会話に出た店に紐づけた直球の誘い。曜日を2択にして返事の負担を下げています',
          },
        ],
        advice:
          '相手からの質問が続いているので今日中に返して問題なし。誘うなら案3が最短ですが、断られた直後に誘い直さないこと。',
      }),
    },
  ],
};

const browser = await chromium.launch();

async function shoot(name, colorScheme) {
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    colorScheme,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.route('https://api.anthropic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) }),
  );
  await page.goto(BASE);
  await page.waitForSelector('#generate');
  await page.evaluate(() => localStorage.setItem('reply_ai_key', 'sk-ant-shot'));
  await page.reload();
  await page.waitForSelector('#generate');
  await page.selectOption('#sampleSelect', '1');
  await page.screenshot({ path: `${OUT}/${name}-1-input.png`, fullPage: true });

  await page.click('#generate');
  await page.waitForSelector('#replyResults .card');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-2-result.png`, fullPage: true });

  await page.click('#btnSettings');
  await page.waitForSelector('#apiKey');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}-3-settings.png` });
  await context.close();
}

await shoot('light', 'light');
await shoot('dark', 'dark');
await browser.close();
console.log('shots written to', OUT);
