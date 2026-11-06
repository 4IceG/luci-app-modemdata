#!/usr/bin/env python3
"""Exercise AT routing, fail-closed behavior and inter-process serialization."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(os.environ['MODEMDATA_SOURCE_ROOT'])
LIB = ROOT / 'modemdata/files/usr/share/modemdata/libs/at.sh'

class TransportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.lib = self.root / 'at.sh'
        self.lib.write_text(LIB.read_text().replace('/var/lock', str(self.root / 'lock')))
        self.env = dict(os.environ, PATH=str(self.bin) + ':' + os.environ['PATH'],
                        LOG=str(self.root / 'calls'), PORT='/dev/test-modem',
                        DAEMON='1', OWNED='1', FAIL_LIST='0', FAIL_AT='0', FAIL_DISCOVERY='0',
                        ACTIVE=str(self.root / 'active'))
        self.stub('ubus', '''case "$*" in
'list at-daemon') [ "$FAIL_DISCOVERY" = 1 ] && exit 1; [ "$DAEMON" = 1 ] && echo at-daemon; exit 0;;
'call at-daemon list') [ "$FAIL_LIST" = 1 ] && exit 1
if [ "$OWNED" = 1 ]; then printf '{"ports":[{"port":"%s"}]}' "$PORT"; else echo '{"ports":[]}'; fi;;
esac''')
        self.stub('jsonfilter', 'exec python3 -c \'import json,sys; print("\\n".join(p["port"] for p in json.load(sys.stdin)["ports"]))\'')
        self.stub('tom_modem', '''echo "tom $*" >> "$LOG"
[ "$FAIL_AT" = 1 ] && exit 9
mkdir "$ACTIVE" || exit 8
sleep 0.05
rmdir "$ACTIVE"
printf '\r\n+CEREG: 1\r\nAT+CGMI\r\nQuectel\r\nOK\r\n' ''')
        self.stub('sms_tool', 'echo "sms $*" >> "$LOG"; echo OK')

    def stub(self, name, body):
        p = self.bin / name
        p.write_text('#!/bin/sh\n' + body + '\n')
        p.chmod(0o755)

    def run_at(self, command='md_at "$PORT" "AT+CGMI"'):
        return subprocess.run(['sh', '-c', '. "$1"; ' + command, 'test', str(self.lib)],
                              env=self.env, capture_output=True, text=True)

    def calls(self):
        p = self.root / 'calls'
        return p.read_text().splitlines() if p.exists() else []

    def test_owned_port_uses_daemon(self):
        self.assertEqual(self.run_at().returncode, 0)
        self.assertEqual(self.calls(), ['tom -u -d /dev/test-modem -o a -c AT+CGMI'])

    def test_unowned_port_still_uses_daemon(self):
        self.env['OWNED'] = '0'
        self.assertEqual(self.run_at().returncode, 0)
        self.assertEqual(self.calls(), ['tom -u -d /dev/test-modem -o a -c AT+CGMI'])

    def test_no_daemon_uses_direct_transport(self):
        self.env['DAEMON'] = '0'
        self.assertEqual(self.run_at().returncode, 0)
        self.assertNotIn(' -u ', self.calls()[0])

    def test_daemon_failure_never_retries_direct(self):
        self.env['FAIL_AT'] = '1'
        self.assertEqual(self.run_at().returncode, 9)
        self.assertEqual(len(self.calls()), 1)
        self.assertIn(' -u ', self.calls()[0])

    def test_bus_discovery_error_never_opens_port(self):
        self.env['FAIL_DISCOVERY'] = '1'
        self.assertNotEqual(self.run_at().returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_partial_failed_identity_is_discarded(self):
        self.stub('tom_modem', "echo Quectel; exit 9")
        result = self.run_at('DEVICE="$PORT"; md_identity "AT+CGMI" "+CGMI:"')
        self.assertEqual(result.returncode, 9)
        self.assertEqual(result.stdout, '')

    def test_missing_daemon_client_never_opens_owned_port(self):
        (self.bin / 'tom_modem').unlink()
        self.assertNotEqual(self.run_at().returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_standalone_sms_tool_fallback(self):
        self.env['DAEMON'] = '0'
        (self.bin / 'tom_modem').unlink()
        self.assertEqual(self.run_at().returncode, 0)
        self.assertEqual(self.calls(), ['sms -D -d /dev/test-modem at AT+CGMI'])

    def test_concurrent_collectors_are_serialized(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.run_at(), range(8)))
        self.assertTrue(all(r.returncode == 0 for r in results), [r.stderr for r in results])
        self.assertEqual(len(self.calls()), 8)

    def test_identity_ignores_echo_terminal_results_and_urcs(self):
        result = self.run_at('DEVICE="$PORT"; md_identity "AT+CGMI" "+CGMI:"')
        self.assertEqual(result.stdout, 'Quectel\n')

    def test_identity_accepts_prefixed_value(self):
        self.stub('tom_modem', "printf '\\r\\n+CEREG: 1\\r\\n+QCCID: 89000000000000000000\\r\\nOK\\r\\n'")
        result = self.run_at('DEVICE="$PORT"; md_identity "AT+QCCID" "+QCCID:"')
        self.assertEqual(result.stdout, '89000000000000000000\n')

    def test_numeric_identity_skips_startup_and_invalid_values(self):
        self.stub('tom_modem', "printf 'RDY\\r\\n123\\r\\n123456789012345\\r\\nOK\\r\\n'")
        result = self.run_at('DEVICE="$PORT"; md_identity "AT+CGSN" "+CGSN:" imei')
        self.assertEqual(result.stdout, '123456789012345\n')

    def test_startup_message_is_not_a_product(self):
        self.stub('tom_modem', "printf 'RDY\\r\\nSMS Ready\\r\\nRG500Q-EA\\r\\nOK\\r\\n'")
        result = self.run_at('DEVICE="$PORT"; md_identity "AT+CGMM" "+CGMM:"')
        self.assertEqual(result.stdout, 'RG500Q-EA\n')

    def test_iccid_accepts_padding_nibble(self):
        self.stub('tom_modem', "printf '+QCCID: 8900000000000000000F\\r\\nOK\\r\\n'")
        result = self.run_at('DEVICE="$PORT"; md_identity "AT+QCCID" "+QCCID:" iccid')
        self.assertEqual(result.stdout, '8900000000000000000F\n')

    def test_identity_error_is_not_a_value(self):
        self.stub('tom_modem', "printf '\\r\\n+CME ERROR: 10\\r\\nERROR\\r\\n'")
        self.assertEqual(self.run_at('DEVICE="$PORT"; md_identity "AT+CIMI" "+CIMI:"').stdout, '')

if __name__ == '__main__':
    unittest.main(verbosity=2)
