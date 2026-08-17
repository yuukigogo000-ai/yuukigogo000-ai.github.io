import base64, io, json, os, sys

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'stitch_out'
os.makedirs(out, exist_ok=True)
d = json.load(io.open(src, encoding='utf-8'))

for comp in d.get('outputComponents', []):
    ds = comp.get('designSystem')
    if ds:
        theme = ds['designSystem'].get('theme') or {}
        md = theme.get('designMd')
        if md:
            io.open(os.path.join(out, 'design_system.md'), 'w', encoding='utf-8', newline='\n').write(md)
            print('wrote design_system.md', len(md), 'chars')
        io.open(os.path.join(out, 'style_guidelines.md'), 'w', encoding='utf-8', newline='\n').write(
            ds['designSystem'].get('styleGuidelines', ''))
        print('designSystem name:', ds.get('name'))
    des = comp.get('design')
    if des:
        for i, sc in enumerate(des.get('screens', [])):
            base = '%s_%d' % (out, i)
            title = sc.get('title', '')
            html = sc.get('htmlCode') or ''
            if isinstance(html, dict):
                print('htmlCode keys:', list(html.keys()))
                html = html.get('code') or html.get('html') or html.get('content') or ''
            if html:
                p = os.path.join(out, 'screen_%d.html' % i)
                io.open(p, 'w', encoding='utf-8', newline='\n').write(html)
                print('wrote', p, len(html), 'chars |', title)
            shot = sc.get('screenshot')
            if isinstance(shot, dict):
                data = shot.get('data') or shot.get('bytes') or shot.get('imageBytes')
                if data:
                    p = os.path.join(out, 'screen_%d.png' % i)
                    open(p, 'wb').write(base64.b64decode(data))
                    print('wrote', p)
                else:
                    print('screenshot keys:', list(shot.keys()))
            elif isinstance(shot, str):
                p = os.path.join(out, 'screen_%d.png' % i)
                try:
                    open(p, 'wb').write(base64.b64decode(shot))
                    print('wrote', p)
                except Exception as e:
                    print('screenshot str (not b64):', shot[:120])
            print('screen id:', sc.get('id'), '| name:', sc.get('name'))
