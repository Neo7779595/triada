#!/usr/bin/env bash
# Прогон всех проверок. Поднимает статику на 8897 и гоняет probe_*.js по очереди.
# Использование:  ./tests/run.sh            — всё
#                 ./tests/run.sh calc zen   — только названные
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8897
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  echo "· поднимаю статику на :$PORT"
  (cd "$ROOT" && nohup python3 -m http.server $PORT --bind 127.0.0.1 >/tmp/probe-http.log 2>&1 &)
  sleep 2
fi
cd "$ROOT/tests"
if [ $# -gt 0 ]; then LIST=""; for n in "$@"; do LIST="$LIST probe_$n.js"; done
else LIST=$(ls probe_*.js); fi
fail=0; total_ok=0; total_fail=0
for f in $LIST; do
  out=$(node "$f" 2>&1); line=$(echo "$out" | tail -1)
  ok=$(echo "$line" | grep -o '[0-9]* ok' | grep -o '[0-9]*'); bad=$(echo "$line" | grep -o '[0-9]* fail' | grep -o '[0-9]*')
  printf '%-22s %s\n' "$f" "$line"
  if [ -n "${bad:-}" ] && [ "$bad" != "0" ]; then fail=1; echo "$out" | grep '✗' | head -20; fi
  total_ok=$((total_ok+${ok:-0})); total_fail=$((total_fail+${bad:-0}))
done
echo "──────────────────────────────────────────"
printf 'ИТОГО %s ok · %s fail\n' "$total_ok" "$total_fail"
exit $fail
