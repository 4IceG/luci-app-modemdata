#!/bin/sh
# Test in an isolated copy; the caller's upstream checkout is not modified.
set -eu
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" -ne 1 ] || [ ! -f "$1/modemdata/Makefile" ]; then
    echo "Usage: $0 /path/to/obsy-modemdata-checkout" >&2
    exit 2
fi
TEST_TMP=$(mktemp -d)
trap 'rm -rf -- "$TEST_TMP"' EXIT HUP INT TERM
cp -a "$1/modemdata" "$TEST_TMP/modemdata"
before=$(find "$TEST_TMP" -type f -exec sha256sum {} \; | sort)
"$SCRIPT_DIR/apply-modemdata-fixes.sh" --check "$TEST_TMP"
after=$(find "$TEST_TMP" -type f -exec sha256sum {} \; | sort)
[ "$before" = "$after" ] || { echo 'Check-only mode modified files' >&2; exit 1; }
"$SCRIPT_DIR/apply-modemdata-fixes.sh" "$TEST_TMP"
before=$(find "$TEST_TMP" -type f -exec sha256sum {} \; | sort)
"$SCRIPT_DIR/apply-modemdata-fixes.sh" "$TEST_TMP"
after=$(find "$TEST_TMP" -type f -exec sha256sum {} \; | sort)
[ "$before" = "$after" ] || { echo 'Repeated apply modified files' >&2; exit 1; }
# An incompatible upstream source must fail before creating any patched files.
mkdir "$TEST_TMP/conflict"
cp -a "$1/modemdata" "$TEST_TMP/conflict/modemdata"
printf ': incompatible upstream fixture\n' > "$TEST_TMP/conflict/modemdata/files/usr/share/modemdata/params.sh"
before=$(find "$TEST_TMP/conflict" -type f -exec sha256sum {} \; | sort)
if "$SCRIPT_DIR/apply-modemdata-fixes.sh" "$TEST_TMP/conflict" > "$TEST_TMP/conflict.log" 2>&1; then
    echo 'Unexpected success applying a conflicting patch' >&2
    exit 1
fi
after=$(find "$TEST_TMP/conflict" -type f -exec sha256sum {} \; | sort)
[ "$before" = "$after" ] || { echo 'Failed apply modified files' >&2; exit 1; }
# Git must not silently skip the entire patch in an enclosing checkout.
mkdir -p "$TEST_TMP/outer/nested"
git init -q "$TEST_TMP/outer"
cp -a "$1/modemdata" "$TEST_TMP/outer/nested/modemdata"
before=$(find "$TEST_TMP/outer/nested" -type f -exec sha256sum {} \; | sort)
if "$SCRIPT_DIR/apply-modemdata-fixes.sh" "$TEST_TMP/outer/nested" > "$TEST_TMP/nested.log" 2>&1; then
    echo 'Unexpected success in a nested non-root Git directory' >&2
    exit 1
fi
after=$(find "$TEST_TMP/outer/nested" -type f -exec sha256sum {} \; | sort)
[ "$before" = "$after" ] || { echo 'Rejected nested target modified files' >&2; exit 1; }
export MODEMDATA_SOURCE_ROOT="$TEST_TMP"
python3 "$SCRIPT_DIR/tests/test-modemdata-transport.py"
python3 "$SCRIPT_DIR/tests/test-modemdata-nsa.py"
