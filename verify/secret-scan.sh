#!/usr/bin/env bash
# Secret scan before any repo goes public. Usage: verify/secret-scan.sh <repo-path>
# Scans the working tree AND full git history. Exit 1 on any finding.
set -euo pipefail
repo="${1:?usage: secret-scan.sh <repo-path>}"
name="$(basename "$repo")"
out="$(cd "$(dirname "$0")" && pwd)/$name"
mkdir -p "$out"
fail=0
tmp="$(mktemp -d)"
ign=(); [ -f "$repo/.gitleaksignore" ] && ign=(--gitleaks-ignore-path "$repo/.gitleaksignore"); [ -f "$repo/.gitleaks.toml" ] && ign+=(--config "$repo/.gitleaks.toml")
count() { python3 -c 'import sys,json; print(len(json.load(open(sys.argv[1]))))' "$1" 2>/dev/null || echo error; }
gitleaks dir "$repo" ${ign[@]+"${ign[@]}"} --no-banner --redact --report-format json --report-path "$tmp/dir.json" >/dev/null 2>&1 || true
dir_n=$(count "$tmp/dir.json")
git_n="n/a"
if git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
  gitleaks git "$repo" ${ign[@]+"${ign[@]}"} --no-banner --redact --report-format json --report-path "$tmp/git.json" >/dev/null 2>&1 || true
  git_n=$(count "$tmp/git.json")
fi
tracked_env=$(git -C "$repo" ls-files 2>/dev/null | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
[ "$dir_n" != "0" ] && fail=1
[ "$git_n" != "0" ] && [ "$git_n" != "n/a" ] && fail=1
[ -n "$tracked_env" ] && fail=1
{
  echo "# secret scan: $name: $([ $fail = 0 ] && echo PASS || echo FAIL)"
  echo "- Run: $(date -u +%FT%TZ)"
  echo "- gitleaks working tree findings: $dir_n"
  echo "- gitleaks git history findings: $git_n"
  echo "- tracked .env files: ${tracked_env:-none}"
} > "$out/secret-scan.md"
cat "$out/secret-scan.md"
exit $fail
