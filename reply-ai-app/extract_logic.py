import io, os, re

SRC = os.path.join(os.path.dirname(__file__), '..', 'reply-ai', 'index.html')
OUT = os.path.join(os.path.dirname(__file__), 'src', 'lib')
os.makedirs(OUT, exist_ok=True)
html = io.open(SRC, encoding='utf-8').read()

def cut(start, end, label):
    i = html.index(start)
    j = html.index(end, i + len(start))
    body = html[i + len(start): j]
    print('%s: %d chars' % (label, len(body)))
    return body

reply_schema = cut('const REPLY_SCHEMA = {', '\n};', 'REPLY_SCHEMA')
reply_system = cut('const REPLY_SYSTEM = `', '`;\n\nlet lastReplies', 'REPLY_SYSTEM')
profile_schema = cut('const PROFILE_SCHEMA = {', '\n};', 'PROFILE_SCHEMA')
profile_system = cut('const PROFILE_SYSTEM = `', "`;\n\n$('profGenerate')", 'PROFILE_SYSTEM')
samples = cut('const SAMPLES = [', "\n];\n\n$('sampleSelect')", 'SAMPLES')

for name, txt in (('REPLY_SYSTEM', reply_system), ('PROFILE_SYSTEM', profile_system)):
    if '`' in txt or '${' in txt:
        raise SystemExit('unexpected backtick/interpolation in %s' % name)

prompts = (
    '// このファイルは reply-ai/index.html (v1) から extract_logic.py で機械的に移植したもの。\n'
    '// 指示書の文言は劣化させないこと。改訂の根拠は ../RESEARCH_LINE_STYLE.md を参照。\n\n'
    'export const REPLY_SCHEMA = {' + reply_schema + '\n} as const;\n\n'
    'export const REPLY_SYSTEM = `' + reply_system + '`;\n\n'
    'export const PROFILE_SCHEMA = {' + profile_schema + '\n} as const;\n\n'
    'export const PROFILE_SYSTEM = `' + profile_system + '`;\n'
)
io.open(os.path.join(OUT, 'prompts.ts'), 'w', encoding='utf-8', newline='\n').write(prompts)

samples_ts = (
    '// reply-ai/index.html (v1) から機械的に移植。相手役・自分役ともにAIが書いた架空の会話。\n\n'
    'export type Sample = {\n'
    '  label: string;\n'
    '  goal: string;\n'
    '  profile: string;\n'
    '  style: string;\n'
    '  conversation: string;\n'
    '};\n\n'
    'export const SAMPLES: Sample[] = [' + samples + '\n];\n'
)
io.open(os.path.join(OUT, 'samples.ts'), 'w', encoding='utf-8', newline='\n').write(samples_ts)
print('written:', os.path.join(OUT, 'prompts.ts'), os.path.join(OUT, 'samples.ts'))
