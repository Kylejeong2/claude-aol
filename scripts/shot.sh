#!/usr/bin/env bash
set -euo pipefail
block="${1:?block id}"
out="${2:-/tmp/aim-shot.png}"
html="$(mktemp -t aimcap).html"
{
  printf '<html><head><style>body{margin:0;background:#000}#t>div{font-family:Menlo,monospace!important;font-size:13px;line-height:16px}#t>div>div{display:inline-block!important;height:16px;vertical-align:top}</style></head><body><div id="t">'
  rex capture -b "$block" --format=html
  printf '</div></body></html>'
} > "$html"
cols=$(rex capture -b "$block" | python3 -c 'import sys; print(max(len(line.rstrip("\n")) for line in sys.stdin))')
rows=$(rex capture -b "$block" | wc -l | tr -d ' ')
width=$(( cols * 8 + 20 ))
height=$(( rows * 16 + 20 ))
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size="${width},${height}" --screenshot="$out" "file://$html" >/dev/null 2>&1
rm -f "$html"
echo "$out"
