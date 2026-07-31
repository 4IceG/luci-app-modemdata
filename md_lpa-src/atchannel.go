package main

import (
	"bufio"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// ATChannel implements driver.SmartCardChannel on top of the modem's AT
// command interface, using the standard 3GPP TS 27.007 logical-channel
// commands (AT+CCHO / AT+CGLA / AT+CCHC).
//
// It talks to atcid's unix socket (/dev/adb_atci_socket) directly, so no
// serial port and no socat pty are involved. A character device works too.
//
// Device quirks this driver exists to absorb (see docs/ESIM_PROBE_RESULTS.md):
//
//   - SELECT-by-AID through AT+CSIM is rejected by this modem even for an AID
//     that EF_DIR proves exists, so AID selection MUST go through AT+CCHO.
//   - AT+CCHO replies with a bare channel number ("1"), not "+CCHO: 1".
//   - The length argument of AT+CGLA counts hex characters, not bytes.
//   - Profile state changes answer SW=91xx ("normal ending, proactive command
//     pending") rather than 9000. That is success, but euicc-go's transmitter
//     only accepts 9000/61xx, so 91xx is normalised to 9000 here.
type ATChannel struct {
	path    string
	conn    io.ReadWriteCloser
	reader  *bufio.Reader
	channel byte
	timeout time.Duration
}

func NewATChannel(path string) *ATChannel {
	return &ATChannel{path: path, timeout: 30 * time.Second}
}

func (c *ATChannel) Connect() error {
	fi, err := os.Stat(c.path)
	if err != nil {
		return fmt.Errorf("stat %s: %w", c.path, err)
	}
	if fi.Mode()&os.ModeSocket != 0 {
		conn, err := net.Dial("unix", c.path)
		if err != nil {
			return fmt.Errorf("dial %s: %w", c.path, err)
		}
		c.conn = conn
	} else {
		f, err := os.OpenFile(c.path, os.O_RDWR, 0)
		if err != nil {
			return fmt.Errorf("open %s: %w", c.path, err)
		}
		c.conn = f
	}
	c.reader = bufio.NewReader(c.conn)
	return nil
}

func (c *ATChannel) Disconnect() error {
	if c.conn == nil {
		return nil
	}
	err := c.conn.Close()
	c.conn = nil
	c.reader = nil
	return err
}

// command sends one AT command and collects lines until a final result code.
//
// atcid drops a long-lived connection now and then, especially while the modem
// is busy, which surfaces as a broken pipe or EOF partway through a download.
// Logical channels outlive the AT session on this modem, so reconnecting and
// re-issuing the command is safe and invisible to the caller.
func (c *ATChannel) command(cmd string) ([]string, error) {
	lines, err := c.commandOnce(cmd)
	if err == nil || !isDisconnect(err) {
		return lines, err
	}
	slog.Debug("[AT] reconnecting after transport error", "err", err)
	_ = c.Disconnect()
	if err := c.Connect(); err != nil {
		return nil, fmt.Errorf("reconnect: %w", err)
	}
	return c.commandOnce(cmd)
}

func isDisconnect(err error) bool {
	return errors.Is(err, io.EOF) || errors.Is(err, syscall.EPIPE) ||
		errors.Is(err, syscall.ECONNRESET) || errors.Is(err, net.ErrClosed)
}

func (c *ATChannel) commandOnce(cmd string) ([]string, error) {
	if c.conn == nil {
		return nil, errors.New("channel is not connected")
	}
	if d, ok := c.conn.(net.Conn); ok {
		_ = d.SetDeadline(time.Now().Add(c.timeout))
	}
	if _, err := io.WriteString(c.conn, cmd+"\r"); err != nil {
		return nil, fmt.Errorf("write %q: %w", cmd, err)
	}

	slog.Debug("[AT] >", "len", len(cmd), "cmd", cmd)

	var lines []string
	for {
		line, err := c.reader.ReadString('\n')
		if err != nil {
			slog.Debug("[AT] read error", "err", err, "collected", lines)
			if len(lines) > 0 {
				return lines, nil
			}
			return nil, fmt.Errorf("read after %q: %w", cmd, err)
		}
		slog.Debug("[AT] <", "line", strings.TrimRight(line, "\r\n"))
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			continue
		}
		switch {
		case line == "OK":
			return lines, nil
		case line == "ERROR", strings.HasPrefix(line, "+CME ERROR"), strings.HasPrefix(line, "+CMS ERROR"):
			return lines, fmt.Errorf("%s -> %s", cmd, line)
		}
		lines = append(lines, line)
	}
}

// IMEI asks the modem for its IMEI. SM-DP+ authentication requires one, and
// making the user type it in would be silly when the modem knows it.
func (c *ATChannel) IMEI() (string, error) {
	if c.conn == nil {
		if err := c.Connect(); err != nil {
			return "", err
		}
		defer c.Disconnect()
	}
	lines, err := c.command("AT+CGSN")
	if err != nil {
		return "", err
	}
	for _, l := range lines {
		l = strings.TrimSpace(strings.TrimPrefix(l, "+CGSN:"))
		l = strings.Trim(l, "\"")
		if len(l) == 15 && strings.IndexFunc(l, func(r rune) bool { return r < '0' || r > '9' }) < 0 {
			return l, nil
		}
	}
	return "", fmt.Errorf("no IMEI in AT+CGSN response: %v", lines)
}

func (c *ATChannel) OpenLogicalChannel(AID []byte) (byte, error) {
	lines, err := c.command(fmt.Sprintf("AT+CCHO=%q", strings.ToUpper(hex.EncodeToString(AID))))
	if err != nil {
		return 0, err
	}
	for _, l := range lines {
		l = strings.TrimSpace(strings.TrimPrefix(l, "+CCHO:"))
		if n, err := strconv.Atoi(strings.TrimSpace(l)); err == nil && n > 0 && n < 20 {
			c.channel = byte(n)
			return byte(n), nil
		}
	}
	return 0, fmt.Errorf("AT+CCHO gave no channel number: %v", lines)
}

func (c *ATChannel) CloseLogicalChannel(channel byte) error {
	_, err := c.command(fmt.Sprintf("AT+CCHC=%d", channel))
	return err
}

// Transmit sends one APDU and returns the complete response with the status
// word appended.
//
// 61xx chaining is resolved here rather than left to euicc-go: this card only
// answers GET RESPONSE when the CLA carries the bare logical channel (01), and
// euicc-go issues it with its ES10 CLA (81), which returns 9000 and no data.
// A large AuthenticateServer response would otherwise arrive truncated.
func (c *ATChannel) Transmit(command []byte) ([]byte, error) {
	var data []byte
	for {
		b, err := c.exchange(command)
		if err != nil {
			return nil, err
		}
		sw1, sw2 := b[len(b)-2], b[len(b)-1]
		data = append(data, b[:len(b)-2]...)

		switch {
		case sw1 == 0x61:
			// GET RESPONSE on the bare channel CLA, not the ES10 one.
			command = []byte{c.channel & 0x0f, 0xC0, 0x00, 0x00, sw2}
		case sw1 == 0x6C:
			// Wrong Le: repeat the original command with the length the card asked for.
			command = append(append([]byte{}, command[:len(command)-1]...), sw2)
			data = data[:0]
		case sw1 == 0x91:
			// Success with a proactive command (REFRESH) pending; upstream
			// only accepts 9000, so present it as plain success.
			return append(data, 0x90, 0x00), nil
		default:
			return append(data, sw1, sw2), nil
		}
	}
}

// exchange runs a single AT+CGLA round trip.
func (c *ATChannel) exchange(command []byte) ([]byte, error) {
	h := strings.ToUpper(hex.EncodeToString(command))
	lines, err := c.command(fmt.Sprintf("AT+CGLA=%d,%d,%q", c.channel, len(h), h))
	if err != nil {
		return nil, err
	}
	for _, l := range lines {
		if !strings.HasPrefix(l, "+CGLA:") {
			continue
		}
		i, j := strings.Index(l, "\""), strings.LastIndex(l, "\"")
		if i < 0 || j <= i {
			continue
		}
		b, err := hex.DecodeString(l[i+1 : j])
		if err != nil {
			return nil, fmt.Errorf("bad hex in %q: %w", l, err)
		}
		if len(b) < 2 {
			return nil, fmt.Errorf("response too short: %q", l)
		}
		return b, nil
	}
	return nil, fmt.Errorf("no +CGLA response: %v", lines)
}
