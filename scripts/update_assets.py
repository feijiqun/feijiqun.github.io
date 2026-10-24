#!/usr/bin/env python3
"""
给所有 HTML 页面更新自有静态资源的引用，可重复运行：

  1. 确保每个引用了 custom-style.css 的页面在 </head> 前加载 /assets/css/theme.css
     （全站主题，必须是最后加载的样式表）。
  2. 给 /assets/css/*.css、/assets/js/*.js 的引用加上 ?v=<文件内容哈希前 8 位>，
     文件内容变了哈希就变，浏览器、Cloudflare 和 service worker 都会当成新地址重新拉取。

改完 assets 里的 css/js 后运行一次再提交：
  python3 scripts/update_assets.py

detail/ubuntuzh/index.html 是 import_tgnav.py 的模板，也会一起更新。
"""
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', '.claude', 'node_modules', '_site'}

THEME_LINK = '<link rel=stylesheet id=theme-css href=/assets/css/theme.css type=text/css media=all>'

# 匹配 /assets/css/xxx.css 或 ../assets/js/xxx.js，可带旧的 ?v=
ASSET_RE = re.compile(r'((?:\.\./)*/?assets/(?:css|js)/[\w.\-]+\.(?:css|js))(\?v=[\w]+)?')

_hashes = {}


def asset_hash(rel_path):
    name = rel_path.lstrip('./')
    if name not in _hashes:
        path = os.path.join(ROOT, name)
        if not os.path.isfile(path):
            _hashes[name] = None
        else:
            with open(path, 'rb') as fh:
                _hashes[name] = hashlib.md5(fh.read()).hexdigest()[:8]
    return _hashes[name]


def version_ref(match):
    path = match.group(1)
    digest = asset_hash(path)
    return f'{path}?v={digest}' if digest else match.group(0)


def update_html(html):
    if 'custom-style.css' in html and 'id=theme-css' not in html:
        html = html.replace('</head>', f'    {THEME_LINK}\n</head>', 1)
    return ASSET_RE.sub(version_ref, html)


def main():
    changed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.endswith('.html'):
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding='utf-8') as fh:
                html = fh.read()
            new = update_html(html)
            if new != html:
                with open(path, 'w', encoding='utf-8') as fh:
                    fh.write(new)
                changed += 1
    print(f'updated {changed} html files')


if __name__ == '__main__':
    main()
