#!/usr/bin/env python3
"""Source the production Quectel handler with canned AT replies, never hardware.

Requires python3 and BusyBox with ash, awk, grep, sed, xargs, sort and head.
All handler external parsing commands use BusyBox applets, as on OpenWrt.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(os.environ['MODEMDATA_SOURCE_ROOT'])
HANDLER = ROOT / 'modemdata/files/usr/share/modemdata/addon/usb/2c7c0800'
BUSYBOX = shutil.which('busybox')
if not BUSYBOX:
    raise SystemExit('BusyBox is required (no host-shell substitute)')

PCC = '+QCAINFO: "PCC",1300,100,"LTE BAND 3",1,10,-85,-10,-60,20'
LTE_SCC = '+QCAINFO: "SCC",300,100,"LTE BAND 1",1,20,-90,-12,-65,15'
NR = '+QCAINFO: "SCC",627264,12,"NR5G BAND 78",747,-92,-11,20'
NR_N = NR.replace('NR5G BAND 78', 'NR N78')
QENG = '+QENG: "NR5G-NSA",413,02,747,-92,20,-11,627264,78,12,1'
QNW = '+QNWINFO: "FDD LTE",41302,"LTE BAND 3",1300'
SA = '+QNWINFO: "NR5G-SA",41302,"NR5G BAND 78",627264'

# Expected full MODE, including band formatting, catches both detection and fallback.
cases = [
    ('LTE only AcT 7', 7, [PCC], 'LTE B3'),
    ('LTE only AcT 13', 13, [PCC], 'LTE B3'),
    ('LTE CA AcT 7', 7, [PCC, LTE_SCC], 'LTE-A B3 / B1'),
    ('LTE CA AcT 13', 13, [PCC, LTE_SCC], 'LTE-A B3 / B1'),
    ('AcT 7 NR5G SCC', 7, [PCC, NR], '5G NSA B3 / n78'),
    ('AcT 13 NR5G SCC', 13, [PCC, NR], '5G NSA B3 / n78'),
    ('AcT 7 NR N SCC', 7, [PCC, NR_N], '5G NSA B3 / n78'),
    ('AcT 13 NR N SCC', 13, [PCC, NR_N], '5G NSA B3 / n78'),
    ('AcT 7 QENG only', 7, [QNW, QENG], '5G NSA B3 / n78'),
    ('AcT 13 QENG only', 13, [QNW, QENG], '5G NSA B3 / n78'),
    ('QENG with LTE PCC only', 13, [PCC, QENG], '5G NSA B3 / n78'),
    ('No duplicate QENG band', 7, [PCC, NR, QENG], '5G NSA B3 / n78'),
    ('Short QENG evidence', 13, [QNW, ','.join(QENG.split(',')[:7])], '5G NSA B3'),
    ('QENG without LTE band reply', 13, [QENG], '5G NSA n78'),
    ('SA unchanged', 11, [SA], '5G SA n78'),
    ('SA ignores NSA evidence', 11, [SA, QENG], '5G SA n78'),
    ('SA NR PCC unchanged', 11, [NR.replace('SCC', 'PCC')], '5G SA n78'),
    ('LTE QNW fallback AcT 7', 7, [QNW], 'LTE B3'),
    ('LTE QNW fallback AcT 13', 13, [QNW], 'LTE B3'),
    ('Invalid then valid QENG', 7, [QNW, QENG.replace('-92', '-32768'), QENG], '5G NSA B3 / n78'),
    ('No evidence', 13, ['ERROR'], 'LTE'),
    ('NR capability is not connection', 7, [PCC, '+QNWINFO: "NR5G-NSA",41302,"NR5G BAND 78",627264'], 'LTE B3'),
    ('QENG SA is not NSA', 13, [PCC, QENG.replace('NR5G-NSA', 'NR5G-SA')], 'LTE B3'),
    ('Invalid NR alongside LTE CA', 7, [PCC, LTE_SCC, NR.replace('-92', '-32768')], 'LTE-A B3 / B1'),
    ('Invalid QCAINFO uses QENG', 13, [PCC, NR.replace('-92', '-32768'), QENG], '5G NSA B3 / n78'),
    ('Invalid QENG preserves valid QCAINFO', 7, [PCC, NR, QENG.replace('-92', '-32768')], '5G NSA B3 / n78'),
]
for mode in (7, 13):
    for name, bad in [
        ('QCAINFO sentinel', NR.replace('-92', '-32768')),
        ('QCAINFO placeholder', NR.replace('747,-92,-11,20', '-,-,-,-')),
        ('QCAINFO missing RSRP', NR.replace('-92', '')),
        ('QCAINFO zero ARFCN', NR.replace('627264', '0')),
        ('QCAINFO invalid PCI', NR.replace('747', '65535')),
        ('QCAINFO zero RSRP', NR.replace('-92', '0')),
        ('QCAINFO invalid band', NR.replace('BAND 78', 'BAND 0')),
        ('QENG sentinel RSRP', QENG.replace('-92', '-32768')),
        ('QENG sentinel SINR', QENG.replace(',20,', ',-32768,')),
        ('QENG placeholders', '+QENG: "NR5G-NSA",413,02,-,-,-,-'),
        ('QENG missing RSRP', QENG.replace('-92', '')),
        ('QENG truncated', '+QENG: "NR5G-NSA",413,02,747'),
        ('QENG zero RSRP', QENG.replace('-92', '0')),
        ('QENG invalid band', QENG.replace(',78,', ',0,')),
        ('QENG invalid ARFCN', QENG.replace('627264', '0')),
    ]:
        cases.append((f'{name} AcT {mode}', mode, [PCC, bad], 'LTE B3'))

with tempfile.TemporaryDirectory(prefix='modemdata-nsa-') as tmp:
    bindir = Path(tmp)
    for applet in ('awk', 'grep', 'sed', 'xargs', 'sort', 'head'):
        (bindir / applet).symlink_to(BUSYBOX)
    (bindir / 'busybox').symlink_to(BUSYBOX)
    sms = bindir / 'sms_tool'
    sms.write_text('#!/bin/sh\ncase "$4" in\n'
                   '  at+qnwinfo*) cat "$AT_FIXTURE" ;;\n'
                   '  "at+cereg=2;+cereg?") printf \'%s\\n\' \' +CEREG: 2,1,"0001","00000001",7\' | sed "s/^ //" ;;\n'
                   '  at+qtemp|"AT+QUIMSLOT?") printf "OK\\n" ;;\n'
                   '  *) printf "Unexpected AT request: %s\\n" "$4" >&2; exit 99 ;;\n'
                   'esac\n')
    sms.chmod(0o755)
    harness = '''
md_at() { sms_tool -d "$1" at "$2"; }
addon() { :; }
band4g() { printf 'B%s' "$1"; }
band5g() { printf 'n%s' "$1"; }
DEVICE=/dev/fake
REGOK=${TEST_REGOK:-1}
MODE_NUM=$TEST_MODE
MODE=unknown
. "$HANDLER"
printf '%s\\n' "$MODE"
'''
    for name, mode, rows, expected in cases:
        fixture = bindir / 'at.txt'
        fixture.write_text('\r\n'.join(rows) + '\r\nOK\r\n')
        env = dict(os.environ, PATH=f'{bindir}:/usr/bin:/bin',
                   AT_FIXTURE=str(fixture), TEST_MODE=str(mode), HANDLER=str(HANDLER))
        result = subprocess.run([BUSYBOX, 'ash', '-c', harness], env=env,
                                text=True, capture_output=True, check=False)
        actual = result.stdout.strip()
        if result.returncode or result.stderr or actual != expected:
            raise SystemExit(f'FAIL {name}: expected {expected!r}, got {actual!r}, '
                             f'exit={result.returncode}, stderr={result.stderr!r}')
        print(f'PASS {name}')
    # Registration refresh can overwrite AcT 13 with 7; NR evidence must still win.
    env.update(TEST_MODE='13', TEST_REGOK='0')
    fixture.write_text(PCC + '\n' + NR + '\nOK\n')
    result = subprocess.run([BUSYBOX, 'ash', '-c', harness], env=env,
                            text=True, capture_output=True, check=False)
    assert result.returncode == 0 and not result.stderr and result.stdout.strip() == '5G NSA B3 / n78', result
    print('PASS CEREG changes AcT 13 to 7')
print(f'All {len(cases) + 1} regression cases passed using BusyBox ash/applications.')
