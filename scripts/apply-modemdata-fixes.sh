#!/bin/sh
# Apply companion fixes to an obsy/modemdata source checkout, never live files.
set -eu
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
PATCH="$SCRIPT_DIR/../patches/modemdata/0001-quectel-reporting.patch"
check_only=0
if [ "${1:-}" = "--check" ]; then
    check_only=1
    shift
fi
if [ "$#" -ne 1 ] || [ ! -f "$1/modemdata/Makefile" ]; then
    echo "Usage: $0 [--check] /path/to/obsy-modemdata-checkout" >&2
    exit 2
fi
backend=$(CDPATH='' cd -- "$1" && pwd -P)
# git apply in a subdirectory can silently skip every patch path. Require an
# actual checkout root, or a standalone tree outside another Git repository.
repo_root=$(git -C "$backend" rev-parse --show-toplevel 2>/dev/null || :)
if [ -n "$repo_root" ] && [ "$repo_root" != "$backend" ]; then
    echo "Target is inside another Git repository; use the backend checkout root or a standalone source tree." >&2
    exit 2
fi
if git -C "$backend" apply --reverse --check "$PATCH" 2>/dev/null; then
    echo "Modemdata reporting fixes are already applied."
    exit 0
fi
# Validate the entire patch before changing any file. Upstream conflicts are
# reported rather than bypassed, and unrelated local changes are preserved.
git -C "$backend" apply --check "$PATCH"
if [ "$check_only" -eq 0 ]; then
    git -C "$backend" apply "$PATCH"
    echo "Applied Modemdata reporting fixes to $backend"
fi
