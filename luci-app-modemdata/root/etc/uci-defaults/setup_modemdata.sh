#!/bin/sh
#
# (c) 2025-2026 Rafał Wabik - IceG - From eko.one.pl forum
#

chmod 664 /www/luci-static/resources/icons/ctime_new.svg
chmod 664 /www/luci-static/resources/icons/mybts.svg
chmod 664 /www/luci-static/resources/icons/sim_new.svg
chmod 664 /www/luci-static/resources/icons/termometr.svg
chmod 664 /www/luci-static/resources/icons/mobile-signal-000-000.svg
chmod 664 /www/luci-static/resources/icons/mobile-signal-000-020.svg
chmod 664 /www/luci-static/resources/icons/mobile-signal-020-040.svg
chmod 664 /www/luci-static/resources/icons/mobile-signal-040-060.svg
chmod 664 /www/luci-static/resources/icons/mobile-signal-060-080.svg
chmod 664 /www/luci-static/resources/icons/mobile-signal-080-100.svg

chmod +x /usr/bin/md_modemmanager 2>&1 &
chmod +x /usr/bin/md_serial_ecm 2>&1 &
chmod +x /usr/bin/md_uqmi 2>&1 &

rm -rf /tmp/luci-indexcache 2>&1 &
rm -rf /tmp/luci-modulecache/ 2>&1 &

exit 0

