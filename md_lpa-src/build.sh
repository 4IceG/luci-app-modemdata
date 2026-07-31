#!/bin/sh
#
# Cross-compile md_lpa for the router.
#
# OpenWrt 21.02's golang feed is 1.18, and euicc-go needs a much newer Go, so
# this is built on the host and the finished binary is copied over. Nothing is
# linked against libc (CGO_ENABLED=0), so the glibc/musl difference between the
# build host and OpenWrt does not matter.
#
# Usage:  ./build.sh [GOARCH]        (default arm64, which is this router)
#
set -eu

ARCH="${1:-arm64}"
OUT="md_lpa-${ARCH}"

command -v go >/dev/null 2>&1 || {
	echo "go is not installed. Get it from https://go.dev/dl/ and put it in PATH." >&2
	exit 1
}

CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" \
	go build -trimpath -ldflags "-s -w" -o "$OUT" .

echo "built: $OUT"
file "$OUT" 2>/dev/null || true

cat <<EOF

Install it on the router:

    scp -O $OUT root@192.168.20.110:/usr/bin/md_lpa
    ssh root@192.168.20.110 chmod 755 /usr/bin/md_lpa

(dropbear has no sftp-server, hence scp -O. Without md_lpa everything still
works except downloading a profile.)
EOF
