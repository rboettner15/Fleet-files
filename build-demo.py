#!/usr/bin/env python3
"""Build demo/FleetFiles-Demo.html: one self-contained offline file (no server)."""
import base64, json, os, re
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
b64 = lambda f, mt: f"data:{mt};base64," + base64.b64encode(open(os.path.join(P, f), 'rb').read()).decode()
css = open(f'{P}/style.css').read()
for w in ('600', '700'):
    css = css.replace(f'url(/fonts/oxanium-latin-{w}-normal.woff2)', 'url(' + b64(f'fonts/oxanium-latin-{w}-normal.woff2', 'font/woff2') + ')')
for f in ('pit-mobile', 'pit-desktop'):
    css = css.replace(f'url(/photos/{f}.webp)', 'url(' + b64(f'photos/{f}.webp', 'image/webp') + ')')
assert '/fonts/' not in css and '/photos/' not in css
photos = {k: b64(f'photos/{k}.jpg', 'image/jpeg') for k in ['truck','dump-truck','trailer','loader','excavator','dozer','generator','other']}
html = open(f'{P}/index.html').read()
html = re.sub(r'<link rel="(manifest|stylesheet)"[^>]*>', '', html)
html = re.sub(r'<link rel="(apple-touch-icon|icon)"[^>]*>', '', html)
icon = b64('apple-touch-icon.png', 'image/png')
html = html.replace('<title>Fleet Files</title>', f'<title>Fleet Files – Demo</title><link rel="icon" href="{icon}"><link rel="apple-touch-icon" href="{icon}"><style>{css}.ffstatic-note{{margin:10px 0;padding:10px 12px;border:2px dashed var(--yellow,#f5b301);border-radius:10px;color:#fff;background:rgba(0,0,0,.45);font-size:15px;line-height:1.35}}</style>')
data = ('window.FF_STANDALONE=true;window.FF_SEED=' + open(f'{P}/demo-seed.json').read() + ';window.FF_PHOTOS=' + json.dumps(photos)
        + ';window.FF_CREDITS=' + open(f'{P}/photos/credits.json').read() + ';')
import subprocess
app = subprocess.run(['node', '/tmp/pw/babel.js'], input=open(f'{P}/app.js').read(), capture_output=True, text=True, check=True, cwd='/tmp/pw').stdout
assert 'require(' not in app and '?.' not in app and '??' not in app
app = app.replace('</script', '<\\/script')
ERR = '''<script>(function(){function show(m){try{var d=document.getElementById('fferr');if(!d){d=document.createElement('div');d.id='fferr';d.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#7f1d1d;color:#fff;border:2px solid #fca5a5;border-radius:10px;padding:10px 12px;font:15px/1.35 -apple-system,system-ui,sans-serif';(document.body||document.documentElement).appendChild(d);}
d.textContent='Fleet Files hit an error: '+m+' \u2014 For the full demo, tap Share \u2192 Open in Safari (or Save to Files, then open it).';}catch(e){}}
window.addEventListener('error',function(e){show(e.message||'script error');});window.addEventListener('unhandledrejection',function(e){show((e.reason&&e.reason.message)||String(e.reason));});})();</script>'''
html = html.replace('<title>Fleet Files – Demo</title>', '<title>Fleet Files – Demo</title>' + ERR, 1)
html = html.replace('<script src="/app.js"></script>', f'<script>{data}</script><script>{app}</script>')
STATIC = os.path.join(os.path.dirname(P), 'demo', '.static.html')
if os.path.exists(STATIC):  # pre-rendered first screen (shown even with JS off); produced by demo/snapshot.js
    st = open(STATIC).read(); title, bar, app_html = st.split('<!--SPLIT-->')
    html = html.replace('<h1 id="title">Fleet Files</h1>', '<h1 id="title">' + title + '</h1>')
    note = '<div class="ffstatic-note">Preview mode: for the full interactive demo, tap <b>Share → Open in Safari</b> (or <b>Save to Files</b>, then open it).</div>'
    html = html.replace('<main id="app"></main>', bar + '<main id="app">' + note + app_html + '</main>')
    html = html.replace('<button id="menu" class="icon-btn" aria-label="Settings" hidden>', '<button id="menu" class="icon-btn" aria-label="Settings">')
assert 'rel="manifest"' not in html  # server-only /api paths in app.js are unused in standalone mode
out = os.path.join(os.path.dirname(P), 'demo', 'FleetFiles-Demo.html')
open(out, 'w').write(html); print(out, round(os.path.getsize(out)/1e6, 2), 'MB')
