#!/usr/bin/env python3
"""从 tgnav/tgnav.github.io 导入群组到本站群组导航。

用法:
    python3 scripts/import_tgnav.py              # 自动 clone tgnav 仓库
    python3 scripts/import_tgnav.py --src PATH   # 使用本地已 clone 的仓库

做的事情:
  1. 解析 tgnav 的 detail/*/index.html，取出所有「群组」(用户名、名称、分类、简介)
  2. 跳过本站 group/index.html 中已有的群组（用户名不区分大小写）
  3. 按分类映射插入到 group/index.html 对应分区（包在 tgnav 标记注释里，可重复运行）
  4. 以 detail/ubuntuzh/index.html 为模板生成 detail/<用户名>/index.html
  5. 把新详情页加入 sitemap.xml
"""
import argparse
import glob
import html
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUP_PAGE = os.path.join(ROOT, 'group', 'index.html')
DETAIL_DIR = os.path.join(ROOT, 'detail')
TEMPLATE = os.path.join(DETAIL_DIR, 'ubuntuzh', 'index.html')
SITEMAP = os.path.join(ROOT, 'sitemap.xml')
TGNAV_REPO = 'https://github.com/tgnav/tgnav.github.io'

BEGIN = '<!-- tgnav:begin -->'
END = '<!-- tgnav:end -->'
DETAIL_MARK = '<!-- tgnav-import -->'

# tgnav 分类 -> 本站群组分区
CATEGORY_MAP = {
    '中文社群': '中文社群',
    '兴趣社群': '闲聊吹水',
    '其他分类': '闲聊吹水',
    '影音资源': '影音娱乐',
    'emby社群': '影音娱乐',
    '资源分享': '影音娱乐',
    '游戏': 'ACG/二次元',
    '小说阅读': '阅读学习',
    '技术开发': '编程开发',
    '数码社群': '数码科技',
    'ios社区': '数码科技',
    '主机vps': '数码科技',
    '软件社群': '软件交流',
    '卡号资金': '卡号交流',
}
DEFAULT_SECTION = '闲聊吹水'

CARD = '''                <div class="url-card col-6 col-sm-6 col-md-4 col-xl-5a col-xxl-6a">
                    <div class="url-body default"><a href="/detail/{u}/ data-id" data-url="{u}" data-toggle="tooltip" data-placement="bottom" data-original-title="{desc}">
                        <div class="card-body">
                            <div class="url-content d-flex align-items-center">
                                <div class="url-img mr-2 d-flex align-items-center justify-content-center"><img class="lazy" src="/assets/images/loading.gif" data-src="https://t.me/i/userpic/160/{u}.jpg" onerror='this.src="/assets/images/default.jpg"'
                                                                                                                alt="{title}" referrerpolicy="origin"></div>
                                <div class="url-info flex-fill">
                                    <div class="text-sm overflowClip_1"><strong>{title}</strong></div>
                                    <p class="overflowClip_1 m-0 text-muted text-xs">{desc}</p></div>
                            </div>
                        </div>
                    </a><a href="/go/?username={u}" target="_blank" rel="nofollow" class="togo text-center text-muted is-views" data-id="689" data-toggle="tooltip" data-placement="right" title="直达" data-original-title="直达"><i
                            class="fa fa-circle-chevron-right"></i></a></div>
                </div>
'''


def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def shorten(text, n):
    return text if len(text) <= n else text[:n].rstrip() + '…'


def parse_tgnav(src):
    groups = []
    for path in sorted(glob.glob(os.path.join(src, 'detail', '*', 'index.html'))):
        s = open(path, encoding='utf-8').read()
        if not re.search(r'type-badge"[^>]*>\s*群组\s*<', s):
            continue
        username = os.path.basename(os.path.dirname(path))
        if not re.fullmatch(r'[A-Za-z0-9_]{4,64}', username):
            continue
        title = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
        cat = re.search(r'category-badge"[^>]*>\s*([^<]+?)\s*<', s)
        bio = re.search(r'群组简介与描述\s*</h3>\s*<div[^>]*>(.*?)</div>', s, re.S)
        groups.append({
            'username': username,
            'title': clean(re.sub(r'<[^>]+>', '', title.group(1))) if title else username,
            'category': clean(cat.group(1)) if cat else '',
            'bio': re.sub(r'^[（(]?暂无描述[）)]?$', '', clean(re.sub(r'<[^>]+>', ' ', bio.group(1)))) if bio else '',
        })
    return groups


def bio_of(g):
    return g['bio'] or f'Telegram群组 @{g["username"]}'


def strip_previous_import(page):
    return re.sub(r'\n' + re.escape(BEGIN) + r'.*?' + re.escape(END), '', page, flags=re.S)


def section_bounds(page, name):
    """返回分区 name 的 (hash_id, row 内容起点, row 结束位置)。"""
    m = re.search(r'<i class="site-tag[^"]*" id="([0-9a-f]+)"></i>' + re.escape(name) + r'</h4></div>', page)
    if not m:
        sys.exit('找不到分区: ' + name)
    end = page.find('\n            </div>\n            <br>', m.end())
    return m.group(1), m.end(), end


def render_card(g):
    return CARD.format(u=g['username'], title=html.escape(g['title']), desc=html.escape(shorten(bio_of(g), 60)))


def render_detail(template, g, section, section_id, related_cards):
    u, title = g['username'], html.escape(g['title'])
    desc = html.escape(shorten(bio_of(g), 300))
    meta = html.escape(shorten(bio_of(g), 100))
    t = template
    head, rest = t.split('<div class=row>', 1)
    _, tail = rest.split('            <br></div>\n        <footer', 1)
    head = head.replace('<head>', '<head>\n    ' + DETAIL_MARK, 1)
    head = re.sub(r'<meta name=description content="[^"]*">', f'<meta name=description content="Telegram群组: {title} @{u} - {meta}">', head)
    head = re.sub(r'<meta name=keywords content="[^"]*">', f'<meta name=keywords content="Telegram群组: {title} @{u} - {meta}">', head)
    head = re.sub(r'<title>.*?</title>', f'<title>{title} @{u} | 电报群 飞机群 - Telegram频道群组导航</title>', head)
    head = re.sub(r'alt="[^"]*@ubuntuzh"', f'alt="{title} @{u}"', head)
    head = re.sub(r'<h1 class="site-name h3 my-3">.*?</h1>', f'<h1 class="site-name h3 my-3">{title}</h1>', head)
    head = re.sub(r'<p class=mb-2>简介：.*?</p>', f'<p class=mb-2>简介：{desc}</p>', head)
    head = re.sub(r' title=\S+ target=_blank class="btn btn-arrow mr-2"', f' title="{title}" target=_blank class="btn btn-arrow mr-2"', head)
    head = head.replace('#d35f947e91a841167dd63fc942c5df38>编程开发', f'#{section_id}>{section}')
    head = head.replace('分类：编程开发', '分类：' + section)
    head = head.replace('>编程开发</h4>', f'>{section}</h4>')
    head = head.replace('ubuntuzh', u)
    return head + '<div class=row>\n' + ''.join(related_cards) + '            </div>\n            <br></div>\n        <footer' + tail


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', help='本地 tgnav.github.io 仓库路径（默认自动 clone）')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    src = args.src
    if not src:
        src = os.path.join(tempfile.mkdtemp(prefix='tgnav-'), 'repo')
        print('clone', TGNAV_REPO, '->', src)
        subprocess.run(['git', 'clone', '--depth', '1', '-q', TGNAV_REPO, src], check=True)

    groups = parse_tgnav(src)
    page = strip_previous_import(open(GROUP_PAGE, encoding='utf-8').read())
    existing = {u.lower() for u in re.findall(r'data-url="([^"]+)"', page)}
    new = [g for g in groups if g['username'].lower() not in existing]
    print(f'tgnav 群组 {len(groups)} 个，本站已有 {len(groups) - len(new)} 个，新增 {len(new)} 个')

    by_section = {}
    for g in new:
        by_section.setdefault(CATEGORY_MAP.get(g['category'], DEFAULT_SECTION), []).append(g)
    for sec, items in by_section.items():
        print(f'  {sec}: {len(items)}')
    if args.dry_run:
        return

    template = open(TEMPLATE, encoding='utf-8').read()
    sitemap = open(SITEMAP, encoding='utf-8').read()
    sitemap_add = []
    for sec, items in by_section.items():
        sec_id, start, end = section_bounds(page, sec)
        block = BEGIN + '\n' + ''.join(render_card(g) for g in items) + END
        page = page[:end] + '\n' + block + page[end:]

        # 详情页底部「当前分类」推荐：同分区的卡片
        _, start, end = section_bounds(page, sec)
        section_cards = re.findall(r' {16}<div class="url-card.*?\n {16}</div>\n', page[start:end], re.S)
        for g in items:
            d = os.path.join(DETAIL_DIR, g['username'])
            f = os.path.join(d, 'index.html')
            if os.path.exists(f) and DETAIL_MARK not in open(f, encoding='utf-8').read():
                continue  # 不覆盖手工维护的详情页
            related = [c for c in section_cards if f'data-url="{g["username"]}"' not in c][:14]
            os.makedirs(d, exist_ok=True)
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(render_detail(template, g, sec, sec_id, related))
            loc = f'https://dianbaosousuo.com/detail/{g["username"]}/'
            if loc not in sitemap:
                sitemap_add.append(f'    <url>\n        <loc>{loc}</loc>\n        <priority>0.64</priority>\n    </url>\n')

    with open(GROUP_PAGE, 'w', encoding='utf-8') as fh:
        fh.write(page)
    if sitemap_add:
        sitemap = sitemap.replace('</urlset>', ''.join(sitemap_add) + '</urlset>', 1)
        with open(SITEMAP, 'w', encoding='utf-8') as fh:
            fh.write(sitemap)
    print('完成，sitemap 新增', len(sitemap_add), '条')


if __name__ == '__main__':
    main()
