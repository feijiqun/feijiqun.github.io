#!/usr/bin/env bash
# 把已提交的文件部署到 Cloudflare Pages 项目 feijiqun（dianbaosousuo.com）。
# 只发布 git 里 HEAD 的内容，未提交/被忽略的文件（.idea、.claude、.DS_Store 等）不会上线。
#
# 用法:
#   scripts/deploy_cloudflare.sh            # 部署 HEAD
#   scripts/deploy_cloudflare.sh --dry-run  # 只导出并列出文件，不部署
set -euo pipefail

PROJECT=feijiqun
BRANCH=main

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "提示: 有未提交的修改，它们不会被部署（只部署 HEAD）。" >&2
fi

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
git archive HEAD | tar -x -C "$OUT"
find "$OUT" -name .DS_Store -delete

COMMIT=$(git rev-parse HEAD)
echo "导出 $(git rev-parse --short HEAD)：$(find "$OUT" -type f | wc -l | tr -d ' ') 个文件"

if [ "${1:-}" = "--dry-run" ]; then
    (cd "$OUT" && find . -type f | sed 's|^\./||' | sort)
    exit 0
fi

npx wrangler pages deploy "$OUT" \
    --project-name "$PROJECT" \
    --branch "$BRANCH" \
    --commit-hash "$COMMIT" \
    --commit-message "$(git log -1 --format=%s)" \
    --commit-dirty=true
