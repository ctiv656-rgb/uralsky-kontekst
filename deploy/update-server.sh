#!/usr/bin/env bash
set -euo pipefail
umask 022
BASE=/opt/uralsky-kontekst
REPO="$BASE/repo"
BRANCH=server
EXPECTED_REMOTE=https://github.com/ctiv656-rgb/uralsky-kontekst.git
export GIT_TERMINAL_PROMPT=0
exec 9>"$BASE/update.lock"
flock -n 9 || exit 0
[[ "$(git -C "$REPO" remote get-url origin)" == "$EXPECTED_REMOTE" ]] || { echo 'Unexpected Git remote'; exit 1; }
git -C "$REPO" fetch --no-tags origin "$BRANCH"
REVISION="$(git -C "$REPO" rev-parse 'FETCH_HEAD^{commit}')"
TARGET="$BASE/releases/$REVISION"
[[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$(readlink -f "$BASE/current" 2>/dev/null || true)" != "$TARGET" ]] || exit 0
STAGE="$(mktemp -d "$BASE/tmp/release.XXXXXXXX")"
cleanup() { [[ "$STAGE" == "$BASE/tmp/release."* ]] && rm -rf -- "$STAGE"; }
trap cleanup EXIT
mkdir "$STAGE/source"
git -C "$REPO" archive "$REVISION" | tar -x -C "$STAGE/source"
python3 "$STAGE/source/deploy/build.py" --source "$STAGE/source" --output "$STAGE/public" --revision "$REVISION"
if [[ ! -d "$TARGET" ]]; then mv "$STAGE/public" "$TARGET"; fi
# Atomic symlink replacement: Nginx reads either the old complete release or the new one
if [[ -L "$BASE/current" ]]; then
  ln -s "$(readlink -f "$BASE/current")" "$STAGE/previous"
  mv -Tf "$STAGE/previous" "$BASE/previous"
elif [[ -e "$BASE/current" ]]; then
  echo 'current must be a symlink, refusing to replace a directory'; exit 1
fi
ln -s "$TARGET" "$STAGE/current"
mv -Tf "$STAGE/current" "$BASE/current"
printf 'Published revision %s\n' "$REVISION"
