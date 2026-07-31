// md_lpa - eSIM (eUICC) LPA for the SoftBank Air 6 / RG620TSBK modem.
//
// Handles the parts of SGP.22 that a shell script cannot: ES9+ profile
// download, which needs TLS, ECDSA/ECKA and full ASN.1. Local ES10 operations
// are also available here so a GUI can use one tool for everything.
//
// APDUs go over the modem's AT interface (AT+CCHO / AT+CGLA / AT+CCHC) via
// atcid's unix socket - see atchannel.go for the device quirks involved.
//
// Build (static, no libc dependency, for OpenWrt aarch64/musl):
//
//	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o md_lpa .
package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"os"
	"strings"

	"github.com/damonto/euicc-go/bertlv"
	"github.com/damonto/euicc-go/lpa"
	sgp22 "github.com/damonto/euicc-go/v2"
)

var (
	device  = flag.String("d", "/dev/adb_atci_socket", "AT device (unix socket or tty)")
	yes     = flag.Bool("y", false, "confirm a destructive operation")
	imei    = flag.String("imei", "", "IMEI to present to the SM-DP+")
	confirm = flag.String("cc", "", "confirmation code, when the profile requires one")
	// md_esim probes six ISD-R AIDs; euicc-go defaults to the standard GSMA
	// one. Cards such as eSIM.me or 5ber use their own, hence this escape hatch.
	aidHex  = flag.String("aid", "", "ISD-R AID in hex (default: standard GSMA ISD-R)")
	verbose = flag.Bool("v", false, "log the APDU exchange to stderr")
	// Each STORE DATA block becomes one AT+CGLA line of roughly
	// 2*(5+mss)+20 characters. atcid drops the connection when a line gets
	// too long, which shows up as an empty response and EOF partway through
	// a profile download, so keep blocks well under its buffer.
	mss = flag.Int("mss", 120, "bytes per APDU block")
)

type out struct {
	Result string `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

func emit(v any) {
	e := json.NewEncoder(os.Stdout)
	e.SetEscapeHTML(false)
	_ = e.Encode(v)
}

// Set once the eUICC is open. os.Exit skips deferred calls, so every error
// path has to release the logical channel itself - otherwise the channel stays
// open on the card (they outlive the AT session) and CCHO starts failing after
// a handful of leaks.
var release func()

func fail(format string, a ...any) {
	if release != nil {
		release()
	}
	emit(out{Error: fmt.Sprintf(format, a...)})
	os.Exit(1)
}

func main() {
	flag.Usage = usage
	flag.Parse()
	// Keep the library quiet: stdout must stay valid JSON for the GUI.
	// -v sends its APDU trace to stderr, which leaves stdout parseable.
	logTo := io.Discard
	level := slog.LevelInfo
	if *verbose {
		logTo, level = os.Stderr, slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(logTo, &slog.HandlerOptions{Level: level})))

	// flag stops at the first non-flag argument, so "download CODE -cc 1234"
	// would leave the options unparsed. Re-scan the remainder so options may
	// follow the sub-command, which is how these are naturally typed.
	args := parseTrailingFlags(flag.Args())
	if len(args) == 0 {
		usage()
		os.Exit(1)
	}

	// Resolve the IMEI before the LPA client exists: atcid drops the first
	// connection if a second one is opened while it is in use, so the query
	// must not overlap with the LPA's own session.
	if args[0] == "download" && *imei == "" {
		v, err := NewATChannel(*device).IMEI()
		if err != nil {
			fail("could not read the IMEI from the modem (%v); pass -imei", err)
		}
		*imei = v
	}

	ch := NewATChannel(*device)
	opts := &lpa.Options{Channel: ch, MSS: *mss}
	if *aidHex != "" {
		aid, err := hex.DecodeString(strings.TrimSpace(*aidHex))
		if err != nil {
			fail("bad -aid %q: %v", *aidHex, err)
		}
		opts.AID = aid
	}
	client, err := lpa.New(opts)
	if err != nil {
		fail("cannot open the eUICC: %v", err)
	}
	release = func() { client.Close(); release = nil }
	defer func() {
		if release != nil {
			release()
		}
	}()

	switch args[0] {
	case "info":
		cmdInfo(client)
	case "list":
		cmdList(client)
	case "enable":
		cmdProfileOp(client, args, "enable")
	case "disable":
		cmdProfileOp(client, args, "disable")
	case "delete":
		cmdProfileOp(client, args, "delete")
	case "download":
		cmdDownload(client, args)
	case "discovery":
		cmdDiscovery(client)
	default:
		usage()
		os.Exit(1)
	}
}

func parseTrailingFlags(args []string) []string {
	var pos []string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-y", "--yes":
			*yes = true
		case "-cc", "--cc":
			if i+1 < len(args) {
				*confirm = args[i+1]
				i++
			}
		case "-imei", "--imei":
			if i+1 < len(args) {
				*imei = args[i+1]
				i++
			}
		case "-d", "--d":
			if i+1 < len(args) {
				*device = args[i+1]
				i++
			}
		default:
			pos = append(pos, args[i])
		}
	}
	return pos
}

func usage() {
	fmt.Fprint(os.Stderr, `md_lpa - eSIM (eUICC) LPA over the AT APDU bridge

  md_lpa [-d DEV] info                       EID and eUICC info
  md_lpa [-d DEV] list                       profile list
  md_lpa [-d DEV] enable  <ICCID> -y         enable a profile
  md_lpa [-d DEV] disable <ICCID> -y         disable a profile
  md_lpa [-d DEV] delete  <ICCID> -y         delete a profile (irreversible)
  md_lpa [-d DEV] download <ACTIVATION-CODE|-> [-cc CODE] [-imei IMEI]
  md_lpa [-d DEV] discovery                  ES11 discovery (SM-DS)

The activation code is the full "LPA:1$smdp.example$MATCHINGID" string, or "-"
to read it from stdin. Output is JSON.
`)
}

func cmdInfo(client *lpa.Client) {
	eid, err := client.EID()
	if err != nil {
		fail("cannot read the EID: %v", err)
	}
	info := map[string]any{"eid": strings.ToUpper(hex.EncodeToString(eid))}
	// EUICCInfo2 comes back as raw BER-TLV; tag 82 inside it is the SGP.22
	// version the card implements.
	if v, err := client.EUICCInfo2(); err == nil && v != nil {
		if svn := v.First(bertlv.Universal.Primitive(2)); svn != nil && len(svn.Value) == 3 {
			info["svn"] = fmt.Sprintf("%d.%d.%d", svn.Value[0], svn.Value[1], svn.Value[2])
		}
	}
	emit(info)
}

type profileJSON struct {
	ICCID    string `json:"iccid"`
	ISDPAid  string `json:"isdp_aid"`
	State    string `json:"state"`
	Class    string `json:"class"`
	Nickname string `json:"nickname"`
	Provider string `json:"provider"`
	Name     string `json:"name"`
}

func toJSON(p *sgp22.ProfileInfo) profileJSON {
	state := "disabled"
	if p.ProfileState == sgp22.ProfileEnabled {
		state = "enabled"
	}
	class := map[sgp22.ProfileClass]string{
		sgp22.ProfileClassTest:         "test",
		sgp22.ProfileClassProvisioning: "provisioning",
		sgp22.ProfileClassOperational:  "operational",
	}[p.ProfileClass]
	return profileJSON{
		ICCID:    p.ICCID.String(),
		ISDPAid:  strings.ToUpper(hex.EncodeToString(p.ISDPAID)),
		State:    state,
		Class:    class,
		Nickname: p.ProfileNickname,
		Provider: p.ServiceProviderName,
		Name:     p.ProfileName,
	}
}

func cmdList(client *lpa.Client) {
	profiles, err := client.ListProfile(nil, nil)
	if err != nil {
		fail("cannot list profiles: %v", err)
	}
	list := make([]profileJSON, 0, len(profiles))
	for _, p := range profiles {
		list = append(list, toJSON(p))
	}
	emit(map[string]any{"profiles": list})
}

func cmdProfileOp(client *lpa.Client, args []string, op string) {
	if len(args) < 2 {
		fail("usage: md_lpa %s <ICCID> -y", op)
	}
	if !*yes {
		fail("%s refused: pass -y to confirm", op)
	}
	iccid, err := sgp22.NewICCID(args[1])
	if err != nil {
		fail("bad ICCID %q: %v", args[1], err)
	}

	switch op {
	case "enable":
		err = client.EnableProfile(iccid, true)
	case "disable":
		err = client.DisableProfile(iccid, true)
	case "delete":
		err = client.DeleteProfile(iccid)
	}
	if err != nil {
		fail("%s failed: %v", op, err)
	}
	emit(map[string]any{"result": "ok", "operation": op, "iccid": args[1]})
}

func cmdDownload(client *lpa.Client, args []string) {
	if len(args) < 2 {
		fail("usage: md_lpa download <ACTIVATION-CODE|->")
	}
	raw := args[1]
	if raw == "-" {
		b, err := io.ReadAll(os.Stdin)
		if err != nil {
			fail("cannot read the activation code from stdin: %v", err)
		}
		raw = strings.TrimSpace(string(b))
	}

	ac, err := parseActivationCode(raw)
	if err != nil {
		fail("%v", err)
	}
	ac.IMEI = *imei
	if *confirm != "" {
		ac.ConfirmationCode = *confirm
	}

	var stages []string
	opts := &lpa.DownloadOptions{
		OnProgress: func(s lpa.DownloadStage) { stages = append(stages, string(s)) },
		// Downloading is what the user asked for, so do not second-guess it.
		OnConfirm:               func(*sgp22.ProfileInfo) bool { return true },
		OnEnterConfirmationCode: func() string { return *confirm },
	}

	if _, err := client.DownloadProfile(context.Background(), ac, opts); err != nil {
		if release != nil {
			release()
		}
		emit(map[string]any{"error": fmt.Sprintf("download failed: %v", err), "stages": stages})
		os.Exit(1)
	}
	emit(map[string]any{"result": "ok", "operation": "download", "stages": stages})
}

// parseActivationCode accepts "LPA:1$smdp$matchingid[$oid][$cc]" and also a
// bare "smdp$matchingid", which is what people usually paste.
func parseActivationCode(s string) (*lpa.ActivationCode, error) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(strings.TrimPrefix(s, "LPA:"), "1$")
	parts := strings.Split(s, "$")
	if len(parts) < 1 || parts[0] == "" {
		return nil, fmt.Errorf("activation code %q has no SM-DP+ address", s)
	}
	ac := &lpa.ActivationCode{SMDP: &url.URL{Scheme: "https", Host: parts[0]}}
	if len(parts) > 1 {
		ac.MatchingID = parts[1]
	}
	if len(parts) > 2 {
		ac.OID = parts[2]
	}
	if len(parts) > 3 && parts[3] != "" {
		ac.ConfirmationCode = parts[3]
	}
	return ac, nil
}

func cmdDiscovery(client *lpa.Client) {
	entries, err := client.Discovery(nil, []byte(*imei))
	if err != nil {
		fail("discovery failed: %v", err)
	}
	emit(map[string]any{"entries": entries})
}
