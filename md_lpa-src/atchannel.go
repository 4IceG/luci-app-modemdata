package main

import (
	"bufio"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
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
func (c *ATChannel) command(cmd string) ([]string, error) {
	if c.conn == nil {
		return nil, errors.New("channel is not connected")
	}
	if d, ok := c.conn.(net.Conn); ok {
		_ = d.SetDeadline(time.Now().Add(c.timeout))
	}
	if _, err := io.WriteString(c.conn, cmd+"\r"); err != nil {
		return nil, fmt.Errorf("write %q: %w", cmd, err)
	}

	var lines []string
	for {
		line, err := c.reader.ReadString('\n')
		if err != nil {
			if len(lines) > 0 {
				return lines, nil
			}
			return nil, fmt.Errorf("read after %q: %w", cmd, err)
		}
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

// Transmit sends one APDU and returns the response WITH the status word
// appended. Chaining (61xx GET RESPONSE, command chunking) is handled by
// euicc-go's transmitter, so it must not be duplicated here.
func (c *ATChannel) Transmit(command []byte) ([]byte, error) {
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
		// 91xx means the command succeeded and the card has a proactive
		// command (REFRESH) queued. Upstream only accepts 9000/61xx, so
		// present it as plain success.
		if b[len(b)-2] == 0x91 {
			b[len(b)-2], b[len(b)-1] = 0x90, 0x00
		}
		return b, nil
	}
	return nil, fmt.Errorf("no +CGLA response: %v", lines)
}
