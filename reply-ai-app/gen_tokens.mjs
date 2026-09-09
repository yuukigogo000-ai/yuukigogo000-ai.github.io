// M3 の色ロールをシード色から生成して CSS 変数にする(UI_PLAYBOOK §9)。
// 出所: Google Stitch「Zen Precision」のシード #2d5a4c
import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';

const SEED = '#2d5a4c';
const theme = themeFromSourceColor(argbFromHex(SEED));

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface',
];

const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

function block(scheme, extra) {
  const lines = ROLES.map((r) => `  --md-${kebab(r)}: ${hexFromArgb(scheme[r])};`);
  return lines.concat(extra).join('\n');
}

// M3 の surface container 群は palette から作る(スキームに含まれないため)
const neutral = theme.palettes.neutral;
const tone = (t) => hexFromArgb(neutral.tone(t));

const light = block(theme.schemes.light, [
  `  --md-surface-container-lowest: ${tone(100)};`,
  `  --md-surface-container-low: ${tone(96)};`,
  `  --md-surface-container: ${tone(94)};`,
  `  --md-surface-container-high: ${tone(92)};`,
]);
const dark = block(theme.schemes.dark, [
  `  --md-surface-container-lowest: ${tone(4)};`,
  `  --md-surface-container-low: ${tone(10)};`,
  `  --md-surface-container: ${tone(12)};`,
  `  --md-surface-container-high: ${tone(17)};`,
]);

const css = `/* 自動生成: node gen_tokens.mjs (シード ${SEED} / Material Design 3 公式ロール)
   手で書き換えない。色を変えるときはシードを変えて再生成する。 */
:root {
${light}
}

@media (prefers-color-scheme: dark) {
  :root {
${dark
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}
  }
}
`;

// 出力は標準出力へ(node .tmp_tokens/gen_tokens.js > src/tokens.css)
process.stdout.write(css);
