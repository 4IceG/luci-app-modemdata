# Companion Quectel backend reporting fix

This repository packages the **LuCI frontend**. Serial AT collection and radio
classification belong to the separate [`obsy/modemdata`](https://github.com/obsy/modemdata)
backend. This companion patch makes the same backend fix available alongside
the frontend without installing duplicate backend-owned files from the LuCI IPK.

Source: [merged NoobWRT feed PR #2](https://github.com/NoobWRT/noobwrt-custom-feeds/pull/2).
The patch is byte-identical to that feed's `scripts/patches/modemdata-reporting.patch`.
**Installing this LuCI package alone does not apply the backend patch.**
No frontend UI or Hide-data behavior is changed by this PR.

## Changes

- Coordinate AT reads with QModem's per-port flock and existing AT daemon.
  Never retry failed daemon reads by opening a competing direct serial reader.
- Collect Quectel USB `2c7c:0800` identity fields with complete AT transactions
  instead of the generic gcom collector. Filter startup/unsolicited messages,
  validate identifier formats, and accept the ICCID's optional F-padding nibble.
  Failed reads are not replaced by cached SIM identifiers.
- Detect NSA from validated QCAINFO NR or QENG NSA measurements even with
  registration AcT 7. Fall back to a QENG band when QCAINFO lacks it, reject
  sentinel NR rows, and preserve LTE/CA/SA distinctions.
- Add the backend's `flock` dependency and bump its package release.

## Apply to backend source before building

Tested upstream backend revision: `fbdc0b6a720647642e99c6fc8db933a767c9ead0`.
From this repository root, with an `obsy/modemdata` checkout:

```sh
scripts/apply-modemdata-fixes.sh --check /path/to/modemdata-checkout
scripts/apply-modemdata-fixes.sh /path/to/modemdata-checkout
```

The target is a **source checkout** containing `modemdata/Makefile`, not the
router's `/usr/share/modemdata` directory. The helper checks the entire patch
before writing, accepts an already-applied patch without changing files, and
fails visibly on upstream conflicts. A source directory nested inside another
Git repository without its own checkout is rejected to prevent Git from silently
skipping patch paths; use the backend checkout root or a standalone source tree
outside another Git repository. Review any conflicts instead of forcing
application. Build the patched `modemdata` backend and this LuCI package through
your normal OpenWrt SDK/buildroot process. No full firmware build is claimed.

NoobWRT custom-feed users already receive this fix through the merged feed PR;
no second application is needed. If syncing backend source from upstream, apply
this patch again to each fresh, unpatched source tree before building.

## Verification

```sh
scripts/test-modemdata-backend.sh /path/to/modemdata-checkout
```

The runner uses a temporary copy, leaving the supplied checkout unchanged. It
checks dry-run behavior, repeated application, conflict handling and rejection of
nested non-root Git targets, then runs
15 AT transport/identity regressions and 57 BusyBox ash NSA parser fixtures
against the **patched backend**, not a copy of its parser logic. Requirements:
Git, Python 3, BusyBox, `flock` and standard Linux shell utilities.

The byte-identical patch was live-tested on an AW1000 / Quectel RG500Q-EA using
isolated `/tmp` copies of the collector and the existing AT daemon:

| Collector | Complete identity records |
|---|---|
| Original generic gcom collector with flock added | 0 / 5 |
| Patched full UI backend | 5 / 5 |

All five final full-backend samples reported registration 1 and NSA B3/B1/n78.
No private SIM/modem identifiers or raw captures are included. These results do
not prove sustained NR payload throughput or fix the reporter's unconfirmed
B7/n78-specific attach failure. This companion PR performs no live installation.
