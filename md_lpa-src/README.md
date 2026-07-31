# md_lpa

An LPA (Local Profile Assistant) for routers whose modem exposes APDUs only
through AT commands.

`md_esim` (the shell helper shipped inside the LuCI package) already does every
**local** eSIM operation — list, enable, disable, delete, nickname — using
`AT+CCHO` / `AT+CGLA` / `AT+CCHC`. What it cannot do is **download a profile**:
ES9+ needs TLS, ECDSA/ECKA and full ASN.1. That is what this binary is for.

It is built separately because `luci-app-modemdata` is `PKGARCH:=all` and this
is architecture-specific.

## Building

```sh
./build.sh          # arm64 (this router)
./build.sh amd64    # or any other GOARCH
```

Needs Go ≥ 1.24 on the build host. OpenWrt 21.02's `golang` feed package is
1.18, so building on the router itself is not possible — cross-compile and copy
the binary over. `CGO_ENABLED=0` makes it fully static, so the host's glibc and
the router's musl are irrelevant. The result is about 5.7 MB.

## Usage

```
md_lpa [-d DEV] info                       EID and eUICC info
md_lpa [-d DEV] list                       profile list
md_lpa [-d DEV] enable  <ICCID> -y
md_lpa [-d DEV] disable <ICCID> -y
md_lpa [-d DEV] delete  <ICCID> -y
md_lpa [-d DEV] download <ACTIVATION-CODE|-> [-cc CODE] [-imei IMEI]
md_lpa [-d DEV] discovery
```

`DEV` defaults to `/dev/adb_atci_socket`. Output is JSON.

The activation code is the whole `LPA:1$rsp.example.com$MATCHING-ID` string —
what a QR code contains. `-` reads it from stdin, which keeps it out of the
process list.

## How it reaches the card

`atchannel.go` implements euicc-go's `driver.SmartCardChannel` over the modem's
AT interface, connecting straight to atcid's unix socket. No serial port and no
socat pty. It absorbs three quirks of this modem, all measured on the device
(see `docs/ESIM_PROBE_RESULTS.md`):

- `SELECT`-by-AID via `AT+CSIM` is rejected even for an AID that EF_DIR proves
  exists, so AID selection must go through `AT+CCHO`.
- `AT+CCHO` answers with a bare channel number (`1`), not `+CCHO: 1`.
- Profile state changes answer `SW=91xx` — "normal ending, proactive command
  pending" — instead of `9000`. That is success, but euicc-go only accepts
  `9000`/`61xx`, so `91xx` is normalised to `9000` in the driver.

## Choosing the ISD-R AID

`md_esim` probes six ISD-R AIDs; euicc-go defaults to the standard GSMA one
only. Cards such as eSIM.me, 5ber or XeSIM use their own AID, so if `md_esim
probe` finds a card that `md_lpa` cannot open, pass it explicitly:

```sh
md_lpa -aid A06573746B6D65FFFF4953442D522030 list
```

## Status

**Every operation is verified on hardware** (eSTK.me in SIM slot 1), including a
full profile lifecycle: download → enable → disable → delete, each confirmed by
re-reading `list`. A download takes about 23 seconds.

Testing used a free, repeatable profile:

```sh
md_lpa download 'LPA:1$rsp.truphone.com$QRF-SPEEDTEST'
```

These can be downloaded any number of times to any number of eUICCs, which also
makes `delete` safe to exercise. Others are listed at
<https://euicc-manual.osmocom.org/docs/rsp/known-test-profile/>.

Note that options may be given before or after the sub-command: Go's `flag`
package stops at the first non-flag argument, so `enable <ICCID> -y` is
re-scanned by hand to make that form work.

## Further quirks found while getting download working

- **GET RESPONSE needs the bare channel CLA.** The card answers `61xx` for a
  long response but returns `9000` and no data if GET RESPONSE arrives with the
  ES10 CLA (`81`) that euicc-go uses. It must be `01`. Without this the
  AuthenticateServer response is truncated and parsing fails with
  "tag encoding with less than one byte". 61xx/6Cxx chaining is therefore
  handled in the driver, not left to euicc-go.
- **Keep APDU blocks small.** `-mss` defaults to 120 bytes per STORE DATA block.
- **atcid drops long-lived connections** while the modem is busy, which appears
  as a broken pipe or EOF mid-download. The driver reconnects and re-issues;
  this is safe because logical channels outlive the AT session here.
- **Only one connection at a time.** Opening a second connection to atcid while
  one is in use kills the first, so the IMEI is read before the LPA session
  starts rather than during it.
- **The SM-DP+ requires an IMEI.** It is read from the modem with `AT+CGSN`
  when `-imei` is not given.

## Licence

euicc-go is MIT. This wrapper follows the licence of the repository it ships in.
