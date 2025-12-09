#!/bin/sh
#
# (c) 2025 Rafał Wabik - IceG - From eko.one.pl forum
#

chmod +x /usr/share/modemdata/btsearch.sh 2>&1 &
chmod +x /usr/share/modemdata/product.sh 2>&1 &

chmod +x /usr/bin/md_modemmanager 2>&1 &
chmod +x /usr/bin/md_serial_ecm 2>&1 &
chmod +x /usr/bin/md_uqmi 2>&1 &

rm -rf /tmp/luci-indexcache 2>&1 &
rm -rf /tmp/luci-modulecache/ 2>&1 &

exit 0

