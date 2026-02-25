'use strict';
'require baseclass';
'require form';
'require fs';
'require view';
'require ui';
'require uci';
'require poll';
'require dom';

/*

  Copyright 2025-2026 Rafał Wabik - IceG - From eko.one.pl forum
  
  MIT License
  
*/

let refresh = {
  interval: 5,         // normal => 5s
  labelEl: null,
  selectEl: null,
  lastSec: null,
  remaining: null
};

let _latestJsonByIndex = {};
let _mainPollWasActive = false;

let _sigModalOpen = false;
let _sigModalTimer = null;
let _sigInflight = false;
let _sigModalIndex = null;

function addDarkModeStyles() {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = `
    :root {
      /* normal */
      --connection-connected-bg: #34c759;
      --connection-disconnected-bg: #7f8c8d;
      --connection-text: #ffffff;
      --signal-excellent-bg: #34c759;
      --signal-good-bg: #FFFF00;
      --signal-fair-bg: #FFA500;
      --signal-poor-bg: #e74c3c;
      --signal-nodata-bg: #7f8c8d;
      --signal-text-light: #000000;
      --signal-text-dark: #ffffff;
      --signal-shadow: 3px 3px 8px rgba(0, 0, 0, 0.7);
      --signal-yellow-shadow: 2px 2px 5px rgba(128, 128, 128, 0.5);
    }
    
    :root[data-darkmode="true"] {
      --connection-connected-bg: rgba(46, 204, 113, 0.28);
      --connection-disconnected-bg: rgba(255, 255, 255, 0.12);
      --connection-text: #e5e7eb;
      --signal-excellent-bg: rgba(52, 199, 89, 0.25);
      --signal-good-bg: rgba(255, 255, 0, 0.22);
      --signal-fair-bg: rgba(255, 165, 0, 0.25);
      --signal-poor-bg: rgba(231, 76, 60, 0.25);
      --signal-nodata-bg: rgba(255, 255, 255, 0.1);
      --signal-text-light: #e5e7eb;
      --signal-text-dark: #e5e7eb;
      --signal-shadow: 0 1px 2px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.22);
      --signal-yellow-shadow: 0 1px 2px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.22);
    }

    .connection-status {
      background-color: var(--connection-disconnected-bg);
      color: var(--connection-text);
      text-shadow: 0 1px 2px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.25);
      padding: 2px 5px;
      border-radius: 4px;
      min-width: 92px;
      max-width: 92px;
      text-align: center;
      white-space: nowrap;
      font-weight: 500;
      font-size: 12px;
      display: inline-block;
      border: 1px solid transparent;
    }
    
    :root[data-darkmode="true"] .connection-status--connected {
      background-color: var(--connection-connected-bg);
      border: 1px solid rgba(46, 204, 113, 0.6);
    }
    
    :root[data-darkmode="true"] .connection-status--disconnected {
      background-color: var(--connection-disconnected-bg);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    
    .connection-status--connected {
      background-color: var(--connection-connected-bg);
    }
    
    .connection-status--disconnected {
      background-color: var(--connection-disconnected-bg);
    }

    .signal-badge {
      padding: 3px 10px;
      border-radius: 12px;
      min-width: 80px;
      width: 80px;
      text-align: center;
      white-space: nowrap;
      font-weight: 500;
      font-size: 12px;
      display: inline-block;
      border: 1px solid transparent;
    }
    
    .signal-badge--excellent {
      background-color: var(--signal-excellent-bg);
      color: var(--signal-text-dark);
      text-shadow: var(--signal-shadow);
    }
    
    .signal-badge--good {
      background-color: var(--signal-good-bg);
      color: var(--signal-text-light);
      text-shadow: var(--signal-yellow-shadow);
    }
    
    .signal-badge--fair {
      background-color: var(--signal-fair-bg);
      color: var(--signal-text-dark);
      text-shadow: var(--signal-shadow);
    }
    
    .signal-badge--poor {
      background-color: var(--signal-poor-bg);
      color: var(--signal-text-dark);
      text-shadow: var(--signal-shadow);
    }
    
    .signal-badge--nodata {
      background-color: var(--signal-nodata-bg);
      color: var(--signal-text-dark);
      text-shadow: var(--signal-shadow);
    }

    .table th, .table td {
      min-width: 0;
      padding: 4px 1px;
    }

    .signal-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      box-sizing: border-box;
    }

    .signal-cell .signal-badge {
      flex: 0 0 80px;
      min-width: 56px;
      max-width: 80px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    }

    .signal-cell .signal-label {
      flex: 1 1 0;
      min-width: 55px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 12px;
      line-height: 1.2;
    }

    :root[data-darkmode="true"] .signal-badge--excellent {
      border: 1px solid rgba(52, 199, 89, 0.6);
    }
    
    :root[data-darkmode="true"] .signal-badge--good {
      border: 1px solid rgba(255, 255, 0, 0.5);
    }
    
    :root[data-darkmode="true"] .signal-badge--fair {
      border: 1px solid rgba(255, 165, 0, 0.6);
    }
    
    :root[data-darkmode="true"] .signal-badge--poor {
      border: 1px solid rgba(231, 76, 60, 0.6);
    }
    
    :root[data-darkmode="true"] .signal-badge--nodata {
      border: 1px solid rgba(255, 255, 255, 0.4);
    }

    /* Fix checkbox vertical alignment issue across different themes */
    label.cbi-checkbox {
      display: inline-flex !important;        /* Use flexbox for alignment */
      align-items: center !important;         /* Vertically center checkbox and text */
      gap: 0.25em !important;                 /* Space between checkbox and text */
      line-height: 1.6 !important;            /* Consistent line height */
      vertical-align: middle !important;      /* Align with surrounding text */
      min-height: 24px !important;            /* Minimum height for touch targets */
    }

    label.cbi-checkbox input[type="checkbox"] {
      margin: 0 !important;                   /* Remove default margins */
      margin-right: 0.5em !important;         /* Space after checkbox */
      vertical-align: middle !important;      /* Align with text baseline */
      flex-shrink: 0 !important;              /* Prevent checkbox from shrinking */
      position: relative !important;          /* Keep relative for focus effects */
      top: 0 !important;                      /* Reset vertical offset (fix Argon 6.4px, Bootstrap 2px) */
      bottom: 0 !important;                   /* Reset bottom offset */
      left: 0 !important;                     /* Reset horizontal offset */
      right: 0 !important;                    /* Reset right offset */
    }

    /* Completely hide custom checkbox label and its pseudo-elements to prevent sweep animation */
    label.cbi-checkbox > label[for] {
      display: none !important;               /* Hide the element */
      visibility: hidden !important;          /* Make invisible */
      opacity: 0 !important;                  /* Fully transparent */
      pointer-events: none !important;        /* Disable mouse events */
      max-width: 0 !important;                /* Constrain width */
      max-height: 0 !important;               /* Constrain height */
      overflow: hidden !important;            /* Hide overflow content */
    }

    label.cbi-checkbox > label[for]::before,
    label.cbi-checkbox > label[for]::after {
      display: none !important;               /* Hide pseudo-elements */
      content: none !important;               /* Remove content */
      visibility: hidden !important;          /* Make invisible */
      max-width: 0 !important;                /* Constrain width to prevent sweep animation */
      max-height: 0 !important;               /* Constrain height to prevent sweep animation */
    }

    /* Fix ifacebox card layout - make body fill the entire card */
    .ifacebox {
      min-width: 23% !important;
      display: flex !important;                /* Use flexbox layout for consistent card structure */
      flex-direction: column !important;       /* Stack header and body vertically */
    }

    .ifacebox-body {
      flex: 1 !important;                      /* Fill remaining vertical space to match card height */
      width: 100% !important;                  /* Take full width of parent (fix width compression) */
      box-sizing: border-box !important;       /* Include padding in width calculation */
    }

    .ifacebox-head port-label {
      width: 100% !important;                  /* Take full width of parent */
      box-sizing: border-box !important;       /* Include padding in width calculation */
    }

    /* Fix progress bar width consistency - use theme's default layout */
    .cbi-modal .cbi-progressbar {
      width: 100% !important;                  /* Take full available width */
      box-sizing: border-box !important;       /* Include padding in width */
    }

    /* Fix modal window width for signal levels dialog */
    .cbi-modal {
      max-width: 600px !important;             /* Limit modal width to 600px */
    }

    /* Increase label width to prevent text wrapping on desktop */
    @media screen and (min-width: 481px) {
      .cbi-modal .cbi-value-title {
        min-width: 180px !important;           /* Minimum width for single-line labels */
        white-space: nowrap !important;        /* Prevent text wrapping */
      }
    }
  `;
  document.head.appendChild(style);
}

function setUpdateMessage(el, sec) {
  if (!el) return;

  if (sec < 0) {
    el.textContent = _('Disabled.');
    return;
  }

  if (sec === 0) {
    el.textContent = '';
    el.appendChild(E('em', { 'class': 'spinning' }, _('Refreshing') + '..'));
    return;
  }

  let tmpl = _('Updating again in %s second(s).');
  let parts = String(tmpl).split('%s');
  el.textContent = '';
  el.appendChild(document.createTextNode(parts[0] || ''));
  el.appendChild(E('b', {}, String(sec)));
  el.appendChild(document.createTextNode(parts[1] || ''));
}

async function getSavedUpdateInterval() {
  try {
    const raw = await uci.get('modemdata', '@modemdata[0]', 'updtime');
    let n = raw != null ? parseInt(raw, 10) : 5;
    if (!Number.isFinite(n)) n = 5;
    return (n === -1 || n >= 0) ? n : 5;
  } catch (e) {
    console.error('getSavedUpdateInterval error:', e);
    return 5;
  }
}

async function loadUCInterval(opts = { applyToGlobal: true }) {
  const interval = await getSavedUpdateInterval();

  const selectElement = document.getElementById('selectInterval');
  if (selectElement) selectElement.value = String(interval);

  refresh.interval = interval;

  if (opts.applyToGlobal) {
    if (interval > 0) {
      refresh.remaining = interval;
      refresh.lastSec = null;
      if (!poll.active()) poll.start();
    } else {
      poll.stop();
      refresh.remaining = null;
      setUpdateMessage(refresh.labelEl, -1);
    }
  }
  return interval;
}

// 1-sec tick
function updateDataTick(runFetchFn) {
  let tick = poll.tick || 0;
  let interval = refresh.interval > 0 ? refresh.interval : 0;

  let sec = interval > 0 ? interval - (tick % interval || interval) : -1;

  if (refresh.labelEl && sec !== refresh.lastSec) {
    setUpdateMessage(refresh.labelEl, sec);
    refresh.lastSec = sec;
  }

  if (interval && sec === 0 && typeof runFetchFn === 'function') {
    return runFetchFn();
  }
  return Promise.resolve();
}

function popTimeout(a, message, timeout, severity) {
    ui.addTimeLimitedNotification(a, message, timeout, severity)
}

function clickToSelectInterval(ev) {
  let v = parseInt(ev.target.value, 10);
  if (isNaN(v)) return;

  refresh.interval = v;

  uci.set('modemdata', '@modemdata[0]', 'updtime', v.toString());
  uci.save();
  uci.apply();

  if (v > 0) {
    refresh.remaining = v;
    refresh.lastSec = null;
    if (!poll.active()) poll.start();
  } else {
    poll.stop();
    refresh.remaining = null;
    setUpdateMessage(refresh.labelEl, -1);
  }
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function toNumber(val){
  if (val == null) return null;
  let s = String(val).replace(',', '.');
  let m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function pctFromRange(val, min, max){
  if (val == null) return 0;
  return clamp(Math.round(((val - min) / (max - min)) * 100), 0, 100);
}

const SIGNAL_RANGES = {
  RSSI:        { min: -110, max: -50,  unit: 'dBm' },
  RSRP:        { min: -120, max: -80,  unit: 'dBm' },
  RSRQ:        { min: -20,  max: -3,   unit: 'dB'  },
  SINR:        { min: -5,   max: 25,   unit: 'dB'  },
  SNR:         { min: 0,    max: 30,   unit: 'dB'  },
  RSSI_wcdma:  { min: -110, max: -50,  unit: 'dBm' },
  RSCP:        { min: -120, max: -60,  unit: 'dBm' },
  ECIO:        { min: -24,  max: 0,    unit: 'dB'  }
};

const SIG_COLORS = {
  green:  '#34c759',
  yellow: '#FFFF00',
  orange: '#FFA500',
  red:    '#e74c3c',
  gray:   '#7f8c8d'
};

function getCSQLabel(csqVal) {
  let n = toNumber(csqVal);
  if (n == null || n === 99) return { label: _('No data'), color: 'gray' };
  if (n >= 20) return { label: _('Excellent'), color: 'green' };
  if (n >= 15) return { label: _('Good'), color: 'yellow' };
  if (n >= 10) return { label: _('Fair'), color: 'orange' };
  return { label: _('Poor'), color: 'red' };
}

function _progressValueDiv(valueId, labelText, descr, barId, showInitially) {
  return E('div', { 
    'class': 'cbi-value', 
    'id': valueId,
    'style': (showInitially === false ? 'display:none;' : '') 
  }, [
    E('label', { 'class': 'cbi-value-title' }, [
      _(labelText)
    ]),
    E('div', { 'class': 'cbi-value-field' }, [
      E('div', { 
        'id': barId, 
        'class': 'cbi-progressbar', 
        'title': '-',
        'style': 'width:100%;max-width:200px;'
      }, E('div')),
      E('div', {
        'id': barId + '_label',
        'style': 'text-align:left;font-size:11px;opacity:0.8;margin-top:2px;'
      }, _(descr))
    ])
  ]);
}

function _qualityFor(metricKey, rawValue){
  if (metricKey === 'CSQ') return getCSQLabel(rawValue);
  let v = rawValue;
  if (v == null || String(v).trim()==='') return { label: _('No data'), color: 'gray' };
  return getSignalLabel(v, metricKey);
}

function _setProgressBarRich(barId, metricKey, rawValue){
  let wrap = document.getElementById(barId);
  if (!wrap) return;
  let inner = wrap.firstElementChild || null;
  if (!inner) return;

  if (!wrap._maxWidthSet) {
    wrap.style.maxWidth = '200px';
    wrap._maxWidthSet = true;
  }

  let oldHint = wrap.querySelector('.bar-hint');
  if (oldHint) oldHint.remove();

  let percent = 0;

  if (metricKey === 'CSQ') {
    let v = toNumber(rawValue);
    if (v == null || v === 99) percent = 0;
    else percent = clamp(Math.round((v / 31) * 100), 0, 100);
  } else {
    let rng = SIGNAL_RANGES[metricKey];
    let numeric = toNumber(rawValue);
    percent = rng ? pctFromRange(numeric, rng.min, rng.max) : 0;
  }

  let q = _qualityFor(metricKey, rawValue);
  let colorHex = SIG_COLORS[q.color] || SIG_COLORS.gray;

  if (inner._lastWidth !== percent) {
    inner.style.width = percent + '%';
    inner._lastWidth = percent;
  }
  if (inner._lastColor !== colorHex) {
    inner.style.backgroundColor = colorHex;
    inner._lastColor = colorHex;
  }

  let unit = '';
  if (metricKey === 'RSSI' || metricKey === 'RSRP' || metricKey === 'RSCP') unit = 'dBm';
  else if (metricKey === 'RSRQ' || metricKey === 'SINR' || metricKey === 'SNR' || metricKey === 'ECIO') unit = 'dB';

  let vtxt = (rawValue == null || String(rawValue).trim()==='') ? '-' : String(rawValue);
  if (unit && vtxt !== '-' && !/\bdB(m)?\b/i.test(vtxt)) vtxt += ' ' + unit;

  let titleTxt;
  if (vtxt === '-' && q.label === _('No data')) {
    titleTxt = q.label;
  } else {
    titleTxt = '%s'.format(vtxt) + ' | ' + q.label;
  }
  wrap.setAttribute('title', titleTxt);

  let labelDiv = document.getElementById(barId + '_label');
  if (labelDiv) {
    let currentLabel = labelDiv.textContent || '';
    if (!currentLabel) {
      labelDiv.textContent = vtxt + ' (' + q.label + ')';
    }
  }
}

async function _readSignalsForIndex(idx, forceFresh) {
  if (idx == null) return null;

  let cached = _latestJsonByIndex[idx];

  if (forceFresh || !cached) {
    try {
      await uci.load('defmodems');
      let defs = uci.sections('defmodems', 'defmodems') || [];
      let m = defs[idx];
      if (!m) return null;

      let res = '';
      if (m.modemdata === 'serial' || m.modemdata === 'ecm')
        res = await L.resolveDefault(fs.exec_direct('/usr/bin/md_serial_ecm', [m.comm_port, m.network, m.forced_plmn || '-']));
      else if (m.modemdata === 'uqmi')
        res = await L.resolveDefault(fs.exec_direct('/usr/bin/md_uqmi', [m.comm_port, m.network, m.forced_plmn || '-', m.onproxy || '-']));
      else if (m.modemdata === 'mm')
        res = await L.resolveDefault(fs.exec_direct('/usr/bin/md_modemmanager', [m.comm_port, m.network, m.forced_plmn || '-']));

      if (!res) return null;
      let jsonraw = JSON.parse(res.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""));
      let arr = Object.values(jsonraw);
      if (!arr || arr.length < 3 || !arr[2]) return null;

      cached = { json0: arr[0], json1: arr[1], json2: arr[2] };

      _latestJsonByIndex[idx] = {
        json0: arr[0],
        json1: arr[1],
        json2: arr[2],
        hash: JSON.stringify(arr[2]).length + '',
        ts: Date.now()
      };
    } catch(e){
      console.error('signals read error:', e);
      return null;
    }
  }

  let j2 = cached.json2 || {};
  let addon = j2.addon || [];
  let byKey = function(k){ let o = addon.find(function(i){ return i.key===k; }); return o ? o.value : null; };

  let csqRaw = (j2 && (j2.csq != null)) ? j2.csq : null;

  function fmt(unit, v) {
    if (v == null || String(v).trim()==='') return null;
    let s = String(v);
    if (unit && !/\bdB(m)?\b/i.test(s)) s = s + ' ' + unit;
    return s;
  }

  return {
    MODE: j2.mode || '',
    CSQ:  csqRaw,
    RSSI: fmt('dBm', byKey('RSSI')),
    RSRP: fmt('dBm', byKey('RSRP') || byKey('RSRP (avg)')),
    RSRQ: fmt('dB',  byKey('RSRQ')),
    SINR: fmt('dB',  byKey('SINR')),
    SNR:  fmt('dB',  byKey('SNR')),
    RSCP: fmt('dBm', byKey('RSCP')),
    ECIO: fmt('dB',  byKey('ECIO'))
  };
}

function _csqFromRssiFallback(rssiRaw) {
  let rssi = toNumber(rssiRaw);
  if (rssi == null || isNaN(rssi)) return null;
  let csq = Math.round((rssi + 113) / 2);
  return clamp(csq, 0, 31);
}

async function _updateBasicSignalsModal(){
  if (!_sigModalOpen) return;
  if (_sigInflight) return;
  if (_sigModalIndex == null) return;
  _sigInflight = true;

  try {
    let d = await _readSignalsForIndex(_sigModalIndex, true);
    if (!d) return;

    let csqEmpty = (d.CSQ == null || String(d.CSQ).trim() === '' || String(d.CSQ) === '99');
    if (csqEmpty) {
      let csqCalc = _csqFromRssiFallback(d.RSSI);
      if (csqCalc != null) {
        d.CSQ = String(csqCalc);
      }
    }

    _setProgressBarRich('bs_bar_csq', 'CSQ', d.CSQ);

    let mode = (d.MODE || '').toUpperCase();
    let isLTE5G = (mode.indexOf('LTE') >= 0 || mode.indexOf('5G') >= 0);

    let show = function(id, vis){
      let el = document.getElementById(id);
      if (el) el.style.display = vis ? '' : 'none';
    };

    if (isLTE5G) {
      show('bs_rssi', true);   show('bs_rsrp', true);   show('bs_rsrq', true);   show('bs_sxx', true);
      show('bs_w_rssi', false); show('bs_rscp', false); show('bs_ecio', false);

      _setProgressBarRich('bs_bar_rssi', 'RSSI', d.RSSI);
      _setProgressBarRich('bs_bar_rsrp', 'RSRP', d.RSRP);
      _setProgressBarRich('bs_bar_rsrq', 'RSRQ', d.RSRQ);

      let sType = (d.SINR != null && String(d.SINR).trim() !== '') ? 'SINR' :
                  ((d.SNR  != null && String(d.SNR ).trim() !== '') ? 'SNR'  : 'SINR');
      let sVal  = (sType === 'SINR') ? d.SINR : d.SNR;
      _setProgressBarRich('bs_bar_sxx', sType, sVal);

      let sxxTitleLabel = document.querySelector('#bs_sxx .cbi-value-title');
      if (sxxTitleLabel) {
        sxxTitleLabel.firstChild.textContent = sType;
      }
    } else {
      show('bs_rssi', false); show('bs_rsrp', false); show('bs_rsrq', false); show('bs_sxx', false);
      show('bs_w_rssi', true); show('bs_rscp', true); show('bs_ecio', true);

      _setProgressBarRich('bs_bar_w_rssi', 'RSSI_wcdma', d.RSSI);
      _setProgressBarRich('bs_bar_rscp',   'RSCP',        d.RSCP);
      _setProgressBarRich('bs_bar_ecio',   'ECIO',        d.ECIO);
    }
  } catch(e){
    console.error('BasicSignals modal update error:', e);
  } finally {
    _sigInflight = false;
  }
}

async function openCellIdModal(modemIndex) {
  if (typeof modemIndex !== 'number') return;

  let wasMainPollActive = poll.active();
  if (wasMainPollActive) poll.stop();

  try {
    let d = await _readSignalsForIndex(modemIndex, true);
    if (!d) {
      if (wasMainPollActive && refresh.interval > 0 && !poll.active()) {
        refresh.lastSec = null;
        poll.start();
      }
      return;
    }

    let cached = _latestJsonByIndex[modemIndex];
    if (!cached || !cached.json2) {
      if (wasMainPollActive && refresh.interval > 0 && !poll.active()) {
        refresh.lastSec = null;
        poll.start();
      }
      return;
    }

    let json2 = cached.json2;
    let cidDec = json2.cid_dec || '0';
    let cidHex = json2.cid_hex || '0';

    let cidHexClean = cidHex.replace(/^0x/i, '').toUpperCase();
    let enbh = '', sech = '', enb = 0, sec = 0;
    let cidHexCellmapper = '', cidDecCellmapper = '';

    if (cidHexClean && cidHexClean.length >= 2) {
      enbh = cidHexClean.slice(0, -2) || '0';
      sech = cidHexClean.slice(-2);
      
      cidHexCellmapper = enbh + ' ' + sech;
      
      enb = parseInt(enbh, 16) || 0;
      sec = parseInt(sech, 16) || 0;
      
      cidDecCellmapper = enb + '/' + sec;
    }

    const fields = [
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('Cell ID (dec)') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': cidDec || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('Cell ID (hex)') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': cidHex || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('eNB ID (hex)') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': enbh || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('Sector ID (hex)') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': sech || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('eNB ID (dec)') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': enb.toString() || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('Sector ID (dec)') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': sec.toString() || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('Cell ID (hex) for CellMapper') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': cidHexCellmapper || '-' }, null)
        )
      ]),
      E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, [ _('Cell ID (dec) for CellMapper') ]),
        E('div', { 'class': 'cbi-value-field' },
          E('input', { 'class': 'cbi-input-text', 'readonly': 'readonly', 'value': cidDecCellmapper || '-' }, null)
        )
      ])
    ];

    ui.showModal(_('Cell ID Information') + ' - ' + _('Modem') + ' #' + (modemIndex+1), [
      E('div', { 'class': 'cbi-section' }, [
        E('div', { 'class': 'cbi-section-descr' }, _('Detailed Cell ID information with formats for different tools and applications.')),
        E('div', { 'class': 'cbi-section' },
          E('div', {}, fields)
        )
      ]),
      E('div', { 'class': 'right' }, [
        E('button', {
          'class': 'btn',
          'click': ui.createHandlerFn(this, function () {
            ui.hideModal();

            if (wasMainPollActive && refresh.interval > 0 && !poll.active()) {
              refresh.lastSec = null;
              poll.start();
            }
          })
        }, _('Close'))
      ])
    ], 'cbi-modal');

  } catch (err) {
    ui.addNotification(null, E('p', {}, _('Error loading Cell ID data: ') + err.message), 'error');
    
    if (wasMainPollActive && refresh.interval > 0 && !poll.active()) {
      refresh.lastSec = null;
      poll.start();
    }
  }
}

async function openBasicSignalsModal(modemIndex) {
  if (typeof modemIndex !== 'number') return;

  _mainPollWasActive = poll.active();
  if (_mainPollWasActive) poll.stop();

  _sigModalOpen = true;
  _sigModalIndex = modemIndex;

  const saved = await getSavedUpdateInterval();
  const modalInterval = (saved > 0 ? saved : 5);
  const refreshIntervalMs = modalInterval * 1000;

  const signalValues = E('div', { 'class': 'cbi-section' }, [
    _progressValueDiv('bs_csq',  'CSQ', _('(Signal Strength)'), 'bs_bar_csq',  true),
    _progressValueDiv('bs_rssi', 'RSSI', '(Received Signal Strength Indicator)', 'bs_bar_rssi', true),
    _progressValueDiv('bs_rsrp', 'RSRP', '(Reference Signal Received Power)', 'bs_bar_rsrp', true),
    _progressValueDiv('bs_rsrq', 'RSRQ', '(Reference Signal Received Quality)', 'bs_bar_rsrq', true),
    _progressValueDiv('bs_sxx',  'SINR/SNR', '(Signal to Interference+Noise / Signal to Noise)', 'bs_bar_sxx', true),
    _progressValueDiv('bs_w_rssi', 'RSSI', '(Received Signal Strength Indicator)', 'bs_bar_w_rssi', false),
    _progressValueDiv('bs_rscp',   'RSCP', '(Received Signal Code Power)', 'bs_bar_rscp', false),
    _progressValueDiv('bs_ecio',   'ECIO', '(Energy per Chip / Interference)', 'bs_bar_ecio', false)
  ]);

  ui.showModal(_('Primary band signal levels') + ' - ' + _('Modem') + ' #' + (modemIndex+1), [
        E('div', { 'class': 'cbi-section' }, [
        E('div', { 'class': 'cbi-section-descr' },
        _('Updating again in %s second(s).').format(modalInterval)
    ),
      signalValues
    ]),
    E('div', { 'class': 'right' }, [
      E('button', {
        'class': 'btn',
        'click': ui.createHandlerFn(this, function () {
          _sigModalOpen = false;
          _sigModalIndex = null;
          if (_sigModalTimer) { clearInterval(_sigModalTimer); _sigModalTimer = null; }
          ui.hideModal();

          if (_mainPollWasActive && refresh.interval > 0 && !poll.active()) {
            refresh.lastSec = null;
            poll.start();
          }
        })
      }, _('Close'))
    ])
  ], 'cbi-modal');

  setTimeout(_updateBasicSignalsModal, 100);
  if (_sigModalTimer) { clearInterval(_sigModalTimer); }
  _sigModalTimer = setInterval(_updateBasicSignalsModal, refreshIntervalMs);
}

/* BTS info download */
async function handleDownloadAction(evOrBtn) {

  let modemIndex = null;
  const t = (evOrBtn && evOrBtn.target) ? evOrBtn.target : evOrBtn;

  if (typeof evOrBtn === 'number') {
    modemIndex = evOrBtn;
  } else if (t) {
    const dsIdx = t.getAttribute && t.getAttribute('data-modem-index');
    if (dsIdx !== null && dsIdx !== '') modemIndex = parseInt(dsIdx, 10);
    if (modemIndex == null) {
      const id = t.id || '';
      const m = id.match(/_(\d+)$/);
      if (m) modemIndex = parseInt(m[1], 10);
    }
  }
  if (modemIndex == null) return;

  let cellElement = document.getElementById('cell_' + modemIndex);
  let providerElement = document.getElementById('operator_' + modemIndex);
  let providerValue = providerElement ? (providerElement.textContent || '').trim().toLowerCase() : '';
  if (!cellElement) return;

  let cellValue = (cellElement.textContent || '').trim();
  let parts = cellValue.split(/\s+/);
  let hexPart = parts.length > 1 ? parts[1] : '';
  let cellHEXNumeric = hexPart ? hexPart.replace(/[()]/g, '') : '';

  let searchsite = '';
  switch (providerValue) {
    case 't-mobile': searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=1&mode=std'; break;
    case 'orange':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=2&mode=std'; break;
    case 'plus':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=3&mode=std'; break;
    case 'play':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=4&mode=std'; break;
    case 'sferia':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=5&mode=std'; break;
    case 'aero 2':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=8&mode=std'; break;
    default:         searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=-1&mode=std'; break;
  }

  let forceNoCert = uci.get('modemdata', '@modemdata[0]', 'force_no_cert');
  let fetchArgs = (forceNoCert === '1')
    ? ['--no-check-certificate', '-O', '/tmp/bts' + modemIndex + '_file', searchsite]
    : ['-O', '/tmp/bts' + modemIndex + '_file', searchsite];

  try {
    await fs.exec_direct('/bin/uclient-fetch', fetchArgs);
    let exists = await fs.stat('/tmp/bts' + modemIndex + '_file');

    if (!exists) {
      ui.addNotification(null, E('p', _('Failed to download bts data file from site.')), 'error');
      if (!poll.active()) poll.start();
      return;
    }

    let mybts = await fs.exec_direct('/usr/share/modemdata/btsearch.sh', [modemIndex]);
    if (!mybts) {
      ui.addNotification(null, E('p', _('Failed to process the downloaded file with btsearch.sh.')), 'error');
      if (!poll.active()) poll.start();
      return;
    }

    let json = JSON.parse(mybts);
    if (!json || !json.mobile || json.mobile.length <= 2) {
      if (!poll.active()) poll.start();
      return;
    }

    if (poll.active()) poll.stop();

    ui.showModal(
      E('span', {}, [
        E('img', {
          'src': L.resource('icons/mybts.svg'),
          'style': 'padding-left: 2px; height: 32px; width: auto; display: inline-block; vertical-align: middle;'
        }),
        ' ',
        _('BTS Information'),
        E('hr')
      ]),
      [
        E('div', { class: 'info-message' }, [
          L.itemlist(E('span'), [
            _('Network'),            json.mobile.length > 1 ? json.mobile : '-',
            _('Location'),           json.location.length > 1 ? json.location : '-',
            _('Cd.'),                json.locationmax.length > 1 ? json.locationmax : '-',
            _('Band'),               json.band.length > 1 ? json.band : '-',
            _('Duplex'),             json.duplex.length > 1 ? json.duplex : '-',
            _('LAC/TAC'),            json.lac_tac.length > 1 ? json.lac_tac : '-',
            _('CID'),                json.cid.length > 1 ? json.cid : '-',
            _('RNC/eNBI'),           json.rnc_enbi.length > 1 ? json.rnc_enbi : '-',
            _('UC-Id/ECID'),         json.uc_id_ecid.length > 1 ? json.uc_id_ecid : '-',
            _('StationID'),          json.stationid.length > 1 ? json.stationid : '-',
            _('Notes Update date'),  json.notes_update_date.length > 1 ? json.notes_update_date : '-'
          ])
        ]),
        E('div', { 'class': 'right' }, [
          E('button', {
            'class': 'btn',
            'click': ui.createHandlerFn(this, function() {
              ui.hideModal();
              if (!poll.active()) poll.start();
            }),
          }, _('Close')),
        ]),
      ]
    );
  } catch (err) {
    ui.addNotification(null, E('p', {}, _('Error: ') + err.message));
    if (!poll.active()) poll.start();
  }
}

function handleAction(evOrBtn) {
  let modemIndex = null;
  const t = (evOrBtn && evOrBtn.target) ? evOrBtn.target : evOrBtn;

  if (typeof evOrBtn === 'number') {
    modemIndex = evOrBtn;
  } else if (t) {
    const dsIdx = t.getAttribute && t.getAttribute('data-modem-index');
    if (dsIdx !== null && dsIdx !== '') modemIndex = parseInt(dsIdx, 10);
    if (modemIndex == null) {
      const id = t.id || '';
      const m = id.match(/_(\d+)$/);
      if (m) modemIndex = parseInt(m[1], 10);
    }
  }
  if (modemIndex == null) return;

  return uci.load('modemdata').then(function() {
    let bts_web    = uci.get('modemdata', '@modemdata[0]', 'website');
    let bts_action = uci.get('modemdata', '@modemdata[0]', 'btsaction');

    if (bts_web && bts_web.indexOf('btsearch') >= 0) {
      if (bts_action && bts_action.indexOf('open') >= 0) {
        let cellElement = document.getElementById('cell_' + modemIndex);
        let providerElement = document.getElementById('operator_' + modemIndex);
        let providerValue = providerElement ? (providerElement.textContent || '').trim().toLowerCase() : '';

        if (cellElement) {
          let cellValue = (cellElement.textContent || '').trim();
          let parts = cellValue.split(/\s+/);
          let hexPart = parts.length > 1 ? parts[1] : '';
          let cellHEXNumeric = hexPart ? hexPart.replace(/[()]/g, '') : '';

          let searchsite = '';
          switch (providerValue) {
            case 't-mobile': searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=1&mode=std'; break;
            case 'orange':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=2&mode=std'; break;
            case 'plus':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=3&mode=std'; break;
            case 'play':     searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=4&mode=std'; break;
            case 'sferia':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=5&mode=std'; break;
            case 'aero 2':   searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=8&mode=std'; break;
            default:         searchsite = 'https://www.btsearch.pl/szukaj.php?search=' + cellHEXNumeric + 'h&siec=-1&mode=std'; break;
          }
          window.open(searchsite, '_blank');
        }
      } else {
        handleDownloadAction(modemIndex);
      }
    }

    if (bts_web && bts_web.indexOf('lteitaly') >= 0) {
      let cellElement2 = document.getElementById('cell_' + modemIndex);
      let mncElement = document.getElementById('mnc_' + modemIndex);
      let mccElement = document.getElementById('mcc_' + modemIndex);

      let cellValue2 = cellElement2 ? (cellElement2.textContent || '').trim() : '';
      let mncValue = mncElement ? (mncElement.textContent || '').trim() : '';
      let mccValue = mccElement ? (mccElement.textContent || '').trim() : '';
      let cellNumeric2 = parseInt((cellValue2.split(/\s+/)[0] || '0'), 10);

      let zzmnc = mncValue || '';
      let first = zzmnc.slice(0, 1);
      let second = zzmnc.slice(1, 2);
      let zzcid = Math.round(cellNumeric2 / 256);
      let cutmnc = zzmnc;

      if (zzmnc.length == 3) {
        if (first.indexOf('0') >= 0) cutmnc = zzmnc.slice(1, 3);
        if (first.indexOf('0') >= 0 && second.indexOf('0') >= 0) cutmnc = zzmnc.slice(2, 3);
      } else if (zzmnc.length == 2) {
        first = zzmnc.slice(0, 1);
        if (first.indexOf('0') >= 0) cutmnc = zzmnc.slice(1, 2);
        else cutmnc = zzmnc;
      } else if (zzmnc.length < 2 || (first.indexOf('0') < 0 && second.indexOf('0') < 0)) {
        cutmnc = zzmnc;
      }

      window.open('https://lteitaly.it/internal/map.php#bts=' + mccValue + cutmnc + '.' + zzcid);
    }
  });
}

function updateTableToValues(ev, modemIndex) {
  let table = document.getElementById('lteTable_' + modemIndex);
  if (!table) return;

  let headerCell = table.querySelector('tr:first-child th:last-child');
  if (!headerCell) return;

  let hasSnr  = ev && (ev.snr  !== undefined && ev.snr  !== null && ev.snr  !== '');
  let hasSinr = ev && (ev.sinr !== undefined && ev.sinr !== null && ev.sinr !== '');

  if (hasSinr) {
    headerCell.textContent = _('SINR');
  } else if (hasSnr) {
    headerCell.textContent = _('SNR');
  } else {
    headerCell.textContent = _('SINR');
  }
}

function handleSaveApply() { return null; }
function handleSave() { return null; }
function handleReset() { return null; }

function formatDuration(sec) {
  if (sec === '-' || sec === '') return '-';
  let d = Math.floor(sec / 86400),
      h = Math.floor(sec / 3600) % 24,
      m = Math.floor(sec / 60) % 60,
      s = sec % 60;
  let time = d > 0 ? d + 'd ' : '';
  if (time !== '') time += h + 'h ';
  else time = h > 0 ? h + 'h ' : '';
  if (time !== '') time += m + 'm ';
  else time = m > 0 ? m + 'm ' : '';
  time += s + 's';
  return time;
}

// See https://wiki.teltonika-networks.com/view/Mobile_Signal_Strength_Recommendations
function getSignalLabel(value, type) {
  let signalValue = parseFloat(value);
  if (isNaN(signalValue)) return { label: _('No data'), color: 'gray' };

  switch (type) {
    case 'RSSI':
      if (signalValue > -65) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -75) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -85) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSSI_wcdma':
      if (signalValue >= -70) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -85) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -100) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSRP':
      if (signalValue >= -80) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -90) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -100) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSRQ':
      if (signalValue >= -10) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -15) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -20) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'SINR':
      if (signalValue > 15) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= 10) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= 5) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'SNR':
      if (signalValue > 20) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= 13) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= 5) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'RSCP':
      if (signalValue >= -75) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -85) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -95) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    case 'ECIO':
      if (signalValue >= -6 && signalValue <= 0) return { label: _('Excellent'), color: 'green' };
      if (signalValue >= -10) return { label: _('Good'), color: 'yellow' };
      if (signalValue >= -20) return { label: _('Fair'), color: 'orange' };
      return { label: _('Poor'), color: 'red' };

    default:
      return { label: _('No data'), color: 'gray' };
  }
}

function signalCell(value, label, statusColor) {
  let cssClass = 'signal-badge';
  
  switch (statusColor) {
    case 'green':  cssClass += ' signal-badge--excellent'; break;
    case 'yellow': cssClass += ' signal-badge--good'; break;
    case 'orange': cssClass += ' signal-badge--fair'; break;
    case 'red':    cssClass += ' signal-badge--poor'; break;
    default:       cssClass += ' signal-badge--nodata'; break;
  }

  return E('div', { 'class': 'signal-cell' }, [
    E('span', { 'class': cssClass, 'title': String(value) }, value),
    E('span', { 'class': 'signal-label', 'title': String(label) }, label)
  ]);
}

function createDataConnectionStateElement(stateId, status) {
  let cssClass = 'connection-status';
  let label = '';
  
  if (status === 'CONNECTED') {
    cssClass += ' connection-status--connected';
    label = _('Connected');
  } else {
    cssClass += ' connection-status--disconnected';  
    label = _('Disconnected');
  }

  return E('div', { style: 'display:flex;font-size:12px;' }, [
    E('span', {
      id: stateId,
      'class': cssClass
    }, label)
  ]);
}

function formatDateTime(s) {
  if (s.length == 14) return s.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5:$6");
  if (s.length == 12) return s.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5");
  if (s.length == 8)  return s.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  if (s.length == 6)  return s.replace(/(\d{4})(\d{2})/, "$1-$2");
  return s;
}

function checkOperatorName(t) {
  let w = t.split(' ');
  let f = {};
  for (let i = 0; i < w.length; i++) {
    let wo = w[i].toLowerCase();
    if (!f.hasOwnProperty(wo)) f[wo] = i;
  }
  let u = Object.keys(f).map(function(wo){ return w[f[wo]]; });
  return u.join(' ');
}

function CreateModemMultiverse(modemTabs, sectionsxt) {
  return Promise.all(modemTabs.map(function(modem) {
    return (function() {
      return (function() {
        if (modem.modemdata === 'serial' || modem.modemdata === 'ecm')
          return L.resolveDefault(fs.exec_direct('/usr/bin/md_serial_ecm', [modem.comm_port, modem.network, modem.forced_plmn_op]));
        else if (modem.modemdata === 'uqmi')
          return L.resolveDefault(fs.exec_direct('/usr/bin/md_uqmi', [modem.comm_port, modem.network, modem.forced_plmn_op, modem.mbim_op]));
        else if (modem.modemdata === 'mm') {
          return L.resolveDefault(fs.exec_direct('/usr/bin/md_modemmanager', [modem.comm_port, modem.network, modem.forced_plmn_op]));
        }
        return Promise.resolve('');
      })().then(function(res) {
        if (!res) return;

        let jsonraw = JSON.parse(res.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""));
        let json = Object.values(jsonraw);
        if (!json || json.length < 3 || !json[0] || !json[1] || !json[2]) return;

        if (json?.[2]?.error) {
          const err = String(json[2].error);

          if (err.includes('Device is busy')) {
            if (poll.active()) poll.stop();

            popTimeout(null, E('p', _('Waiting...') + ' ' + _('Device is busy')), 5000, 'info');

            window.setTimeout(() => {
              if (!poll.active()) poll.start();
            }, 8000);
          }
          else if (err.includes('Device not found')) {
            if (poll.active()) poll.stop();

            ui.addNotification(null, E('p', _('Waiting...') + ' ' + _('Device not found')), 'error');
          }

          return;
        }

        let rowsWcdma = [];
        let rowsLte = [];

        let wcdmaTable = document.getElementById(modem.wcdmaTableId);
        let lteTable = document.getElementById(modem.lteTableId);

        const addonArr = Array.isArray(json?.[2]?.addon) ? json[2].addon : [];
        const getAddon = (key) => {
          const searchKeyLower = String(key).toLowerCase();
          const found = addonArr.find(i => i && String(i['key']).toLowerCase() === searchKeyLower);
          return found ? found['value'] : null;
        };

        let modeRaw = json?.[2]?.mode || '';
        let modeLower = modeRaw.toLowerCase();

        const isPrimaryBand = (key) => key && String(key).toLowerCase().includes('primary');

        const bandsFiltered = addonArr.filter(item =>
          item && (isPrimaryBand(item['key']) || /^\(S\d+\) band$/i.test(item['key']))
        );

        const cutBeforeAt = (str) => String(str ?? '').split('@')[0].trim() || '-';
        const extractBwFromAt = (str) => (String(str ?? '').split('@')[1] || '').trim();
        const isValidBw = (bw) => bw && !['', '-', 'MHz'].includes(String(bw).trim());
        const isValidValue = (val) => val && val !== '-' && val !== '' && val !== null;

        const withDbUnit = (val) => {
          const s = String(val || '').trim();
          if (s === '' || s === '-') return s;
          return s.match(/dB/i) ? s : s + ' dB';
        };

        const makeBwCell = (ul, dl, fallback) => {
          const haveUL = isValidBw(ul);
          const haveDL = isValidBw(dl);
          if (haveUL && haveDL)
            return E('div', {}, [_('UL: ' + ul), E('br', {}), _('DL: ' + dl)]);
          if (haveUL) return E('div', {}, [_('UL: ' + ul)]);
          if (haveDL) return E('div', {}, [_('DL: ' + dl)]);
          return typeof fallback === 'string' ? E('div', {}, _(fallback)) : (fallback ?? E('div', {}, _('-')));
        };

        const makeEarfcnCell = (ul, dl, fallback) => {
          const haveUL = isValidValue(ul);
          const haveDL = isValidValue(dl);
          if (haveUL && haveDL)
            return E('div', {}, [_('UL: ' + ul), E('br', {}), _('DL: ' + dl)]);
          if (haveUL) return E('div', {}, [_('UL: ' + ul)]);
          if (haveDL) return E('div', {}, [_('DL: ' + dl)]);
          return typeof fallback === 'string' ? E('div', {}, _(fallback)) : (fallback ?? E('div', {}, _('-')));
        };

        if (!modeLower.match(/lte|5g/) && bandsFiltered.length === 0) {
          // --- WCDMA (3G) ---
          let bs = document.getElementById(modem.bandshowId);
          if (bs) bs.style.display = 'block';
          if (lteTable) lteTable.style.display = 'none';
          if (wcdmaTable) wcdmaTable.style.display = 'table';

          const uarfcn = getAddon('UARFCN') || '-';
          const rssi = getAddon('RSSI') || '-';
          const rscp = getAddon('RSCP') || '-';
          const ecio = getAddon('ECIO') || '-';

          rowsWcdma.push([
            modeRaw || '-',
            uarfcn,
            !isNaN(parseInt(rssi, 10)) ? signalCell(rssi, getSignalLabel(rssi, 'RSSI_wcdma').label, getSignalLabel(rssi, 'RSSI_wcdma').color) : E('div', {}, _('')),
            !isNaN(parseInt(rscp, 10)) ? signalCell(rscp, getSignalLabel(rscp, 'RSCP').label, getSignalLabel(rscp, 'RSCP').color) : E('div', {}, _('')),
            !isNaN(parseInt(ecio, 10)) ? signalCell(ecio, getSignalLabel(ecio, 'ECIO').label, getSignalLabel(ecio, 'ECIO').color) : E('div', {}, _(''))
          ]);

          if (wcdmaTable) cbi_update_table(wcdmaTable, rowsWcdma);

        } else {
          // --- LTE / 5G ---
          let bs2 = document.getElementById(modem.bandshowId);
          if (bs2) bs2.style.display = 'block';
          if (lteTable) lteTable.style.display = 'table';
          if (wcdmaTable) wcdmaTable.style.display = 'none';

          let bands = bandsFiltered.slice();
          const primaryBandFromAddon = addonArr.find(item => item && isPrimaryBand(item['key']));
          const primaryBandValue = primaryBandFromAddon ? primaryBandFromAddon['value'] : null;

          if (bands.length === 0 && primaryBandValue)
            bands.push({ 'key': 'Primary band', 'value': primaryBandValue });
          if (bands.length === 0)
            bands.push({ 'key': 'Primary band', 'value': _('(no data)') });

          const getFirstValueWithUnit = function (key) {
            let raw = getAddon(key) || '-';
            let parts = String(raw).split('/');
            let first = parts[0] ? parts[0].trim() : '-';
            let second = parts[1] ? parts[1].trim() : '';
            let unitMatch = second && second.match(/(dBm|dB)$/i);
            return unitMatch ? (first + ' ' + unitMatch[1]) : first;
          };

          const getBandwidthForBand = (bandKey, rawBandValue) => {
            let bwUL, bwDL, bwGeneric;
            if (isPrimaryBand(bandKey)) {
              bwUL = getAddon('Bandwidth UL');
              bwDL = getAddon('Bandwidth DL');
              bwGeneric = getAddon('Bandwidth');
            } else {
              const sccIndexM = bandKey.match(/\d+/);
              if (sccIndexM) {
                const n = sccIndexM[0];
                bwUL = getAddon('(S' + n + ') Bandwidth UL');
                bwDL = getAddon('(S' + n + ') Bandwidth DL');
                bwGeneric = getAddon('(S' + n + ') Bandwidth');
              }
            }
            if (isValidBw(bwUL) || isValidBw(bwDL)) return makeBwCell(bwUL, bwDL, '-');
            else if (isValidBw(bwGeneric)) return E('div', {}, _(bwGeneric));
            else {
              const bwFromAt = extractBwFromAt(rawBandValue);
              return bwFromAt ? E('div', {}, _(bwFromAt)) : E('div', {}, _('-'));
            }
          };

          for (let i = 0; i < bands.length; i++) {
            const bandKey = bands[i]['key'];
            const bandLabel = isPrimaryBand(bandKey) ? 'PCC' : ('SCC' + (bandKey.match(/\d+/)?.[0] || ''));
            const rawBandVal = bands[i]['value'] || '-';
            const bandwidthForRow = getBandwidthForBand(bandKey, rawBandVal);
            const bandValueForRow = cutBeforeAt(isPrimaryBand(bandKey) && primaryBandValue ? primaryBandValue : rawBandVal);

            let row = [bandLabel + ' ' + bandValueForRow, bandwidthForRow];

            const sccIndexM = bandKey.match(/\d+/);
            if (sccIndexM) {
              // SCC
              const n = sccIndexM[0];
              const getVal = (k) => getAddon(k) || '-';
              const sinr = withDbUnit(getVal('(S' + n + ') SINR'));
              const snr = withDbUnit(getVal('(S' + n + ') SNR'));

              const earfcn = getAddon('(S' + n + ') EARFCN');
              const earfcnDl = getAddon('(S' + n + ') EARFCN DL');
              const earfcnUl = getAddon('(S' + n + ') EARFCN UL');
              
              let earfcnCell;
              if (isValidValue(earfcn)) {
                earfcnCell = E('div', {}, _(earfcn));
              } else {
                earfcnCell = makeEarfcnCell(earfcnUl, earfcnDl, '-');
              }

              row.push(
                getVal('(S' + n + ') PCI'),
                earfcnCell,
                !isNaN(parseInt(getVal('(S' + n + ') RSSI'), 10)) ? signalCell(getVal('(S' + n + ') RSSI'), getSignalLabel(getVal('(S' + n + ') RSSI'), 'RSSI').label, getSignalLabel(getVal('(S' + n + ') RSSI'), 'RSSI').color) : E('div', {}, _('')),
                !isNaN(parseInt(getVal('(S' + n + ') RSRP'), 10)) ? signalCell(getVal('(S' + n + ') RSRP'), getSignalLabel(getVal('(S' + n + ') RSRP'), 'RSRP').label, getSignalLabel(getVal('(S' + n + ') RSRP'), 'RSRP').color) : E('div', {}, _('')),
                !isNaN(parseInt(getVal('(S' + n + ') RSRQ'), 10)) ? signalCell(getVal('(S' + n + ') RSRQ'), getSignalLabel(getVal('(S' + n + ') RSRQ'), 'RSRQ').label, getSignalLabel(getVal('(S' + n + ') RSRQ'), 'RSRQ').color) : E('div', {}, _('')),
                !isNaN(parseInt(sinr, 10)) ? signalCell(sinr, getSignalLabel(sinr, 'SINR').label, getSignalLabel(sinr, 'SINR').color)
                  : !isNaN(parseInt(snr, 10)) ? signalCell(snr, getSignalLabel(snr, 'SNR').label, getSignalLabel(snr, 'SNR').color)
                  : E('div', {}, _(''))
              );

              rowsLte.push(row);
            } else {
              // PCC
              const pci = getAddon('PCI') || '-';
              
              const earfcn = getAddon('EARFCN');
              const earfcnDl = getAddon('EARFCN DL');
              const earfcnUl = getAddon('EARFCN UL');
              
              let earfcnCell;
              if (isValidValue(earfcn)) {
                earfcnCell = E('div', {}, _(earfcn));
              } else {
                earfcnCell = makeEarfcnCell(earfcnUl, earfcnDl, '-');
              }

              const sinr0 = withDbUnit(getAddon('SINR'));
              const snr0 = withDbUnit(getAddon('SNR'));

              const rssiFirst = getFirstValueWithUnit('RSSI');
              const rsrpFirst = getFirstValueWithUnit('RSRP');

              row.push(
                pci,
                earfcnCell,
                !isNaN(parseFloat(rssiFirst)) ? signalCell(rssiFirst, getSignalLabel(rssiFirst, 'RSSI').label, getSignalLabel(rssiFirst, 'RSSI').color) : E('div', {}, _('')),
                !isNaN(parseFloat(rsrpFirst)) ? signalCell(rsrpFirst, getSignalLabel(rsrpFirst, 'RSRP').label, getSignalLabel(rsrpFirst, 'RSRP').color) : E('div', {}, _('')),
                !isNaN(parseInt(getAddon('RSRQ'), 10)) ? signalCell(getAddon('RSRQ'), getSignalLabel(getAddon('RSRQ'), 'RSRQ').label, getSignalLabel(getAddon('RSRQ'), 'RSRQ').color) : E('div', {}, _('')),
                !isNaN(parseInt(sinr0, 10)) ? signalCell(sinr0, getSignalLabel(sinr0, 'SINR').label, getSignalLabel(sinr0, 'SINR').color)
                  : !isNaN(parseInt(snr0, 10)) ? signalCell(snr0, getSignalLabel(snr0, 'SNR').label, getSignalLabel(snr0, 'SNR').color)
                  : E('div', {}, _(''))
              );

              rowsLte.push(row);
            }
          }

          if (lteTable) cbi_update_table(lteTable, rowsLte);

          const tsnr = {
            sinr: getAddon('SINR'),
            snr: getAddon('SNR')
          };
          updateTableToValues(tsnr, modem.index);
        }
      
        // MOBILE SVG
        let p = json[2].signal;
        let icon;
        switch (true) {
          case (p <= 0): icon = L.resource('icons/mobile-signal-000-000.svg'); break;
          case (p < 20): icon = L.resource('icons/mobile-signal-000-020.svg'); break;
          case (p < 40): icon = L.resource('icons/mobile-signal-020-040.svg'); break;
          case (p < 60): icon = L.resource('icons/mobile-signal-040-060.svg'); break;
          case (p < 80): icon = L.resource('icons/mobile-signal-060-080.svg'); break;
          default:       icon = L.resource('icons/mobile-signal-080-100.svg'); break;
        }

        // Signal
        let signalView = document.getElementById(modem.signalId);
        if (signalView) {
          signalView.innerHTML = '';
          if (p === 0) {
            if (lteTable) lteTable.style.display = 'none';
            if (wcdmaTable) wcdmaTable.style.display = 'none';
            let bs3 = document.getElementById(modem.bandshowId); if (bs3) bs3.style.display = 'none';
          }
          let title = _('Signal strength') + ': ' + p + '%';
          signalView.appendChild(
            E('div', { 'class': 'ifacebadge', 'style': 'width:92px;', 'title': title }, [
              E('img', { 'src': icon, 'style': 'padding:0 auto;height:32px;width:auto;display:inline-block;margin:0 auto;' }),
              E('strong', {'style': 'margin-left:-.1em;'}, p > 0 ? (p + '%') : '')
            ])
          );
        }

        // Connection status
        let stateView = document.getElementById(modem.stateId);
        if (stateView) {
          let status = json[1].status;
          let el = createDataConnectionStateElement('dataStatus', status);
          stateView.innerHTML = '';
          stateView.appendChild(el);
        }

        // Connection statistics
        let connstView = document.getElementById(modem.connstId);
        if (connstView) {
          if (json[1].conn_time_sec < 1) {
            connstView.innerHTML = '';
            if (lteTable) lteTable.style.display = 'none';
            if (wcdmaTable) wcdmaTable.style.display = 'none';
            let bs4 = document.getElementById(modem.bandshowId); if (bs4) bs4.style.display = 'none';
            connstView.appendChild(E('div', {}, [ E('em', { 'class': 'spinning' }, _('Waiting for data...')) ]));
          } else {
            connstView.innerHTML = '';
            let title2 = _('Time') + ': ' + formatDuration(json[1].conn_time_sec);
            connstView.appendChild(
              E('div', { 'class': 'ifacebadge', 'title': title2 }, [
                E('img', { 'src': L.resource('icons/ctime_new.svg'), 'style': 'height:16px;width:auto;display:inline-block;vertical-align:middle;' }),
                E('normal', { 'style': 'margin-left:.5em;display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:85%;vertical-align:middle;' }, [ formatDuration(json[1].conn_time_sec) || '-' ])
              ])
            );
          }
        }

        let rxView = document.getElementById(modem.rxId);
        if (rxView) rxView.textContent = json[1].rx.length > 1 ? json[1].rx : '0 B';

        let txView = document.getElementById(modem.txId);
        if (txView) txView.textContent = json[1].tx.length > 1 ? json[1].tx : '0 B';

        // ON/OFF HIDE DATA
        let hide_list = Array.isArray(sectionsxt[0].hide_data) ? sectionsxt[0].hide_data : [];
        let hidedata = document.getElementById('hide-data') ? document.getElementById('hide-data').checked : false;

        // Operator
        let operatorView = document.getElementById(modem.operatorId);
        if (operatorView) {
          let opName = json[2].operator_name.length > 1 ? checkOperatorName(json[2].operator_name) : '-';
          operatorView.textContent = (hidedata && hide_list.indexOf(_('Operator')) >= 0) ? opName.replace(/./g, '#') : opName;
        }

        // SIM status
        let simView = document.getElementById(modem.simId);
        if (simView) {
          let reg = json[2].registration;
          let simStatusValue = '-';
          switch (reg) {
            case '0': simStatusValue = _('Not registered'); break;
            case '1': simStatusValue = _('Registered, home'); break;
            case '2': simStatusValue = _('Searching..'); break;
            case '3': simStatusValue = _('Registering denied'); break;
            case '5': simStatusValue = _('Registered (roaming)'); break;
            case '6': simStatusValue = _('Registered, only SMS'); break;
            case '7': simStatusValue = _('Registered (roaming), only SMS'); break;
            default:  simStatusValue = '-';
          }
          simView.textContent = simStatusValue;
          simView.title = simStatusValue;
        }

        // SIM slot
        let slotView = document.getElementById(modem.slotId);
        if (slotView) {
          slotView.innerHTML = '';
          let slotObj = (json[2].addon || []).find(function(i){ return i.key==='Slot'; });
          let slot = slotObj ? ('SIM ' + slotObj.value) : _('No data');
          if (slot && slot !== _('No data') && parseInt(slotObj.value, 10) >= 1) {
            let slotDivElement = document.getElementById(modem.slotDivId);
            if (slotDivElement) slotDivElement.style.display = 'flex';
            slotView.appendChild(
              E('div', { 'class': 'ifacebadge', 'title': _('Slot in use') + ': ' + slot }, [
                E('img', { 'src': L.resource('icons/sim_new.svg'), 'style': 'height:32px;width:auto;display:inline-block;margin:0 auto;' }),
                E('normal', { 'style': 'margin-left:.5em;' }, [ slot ])
              ])
            );
          }
        }

        // ICCID
        let iccidView = document.getElementById(modem.iccidId);
        if (iccidView) {
          iccidView.innerHTML = (hidedata && hide_list.indexOf('ICCID') >= 0) ? (json[0].iccid || '').replace(/./g, '#') : (json[0].iccid || '');
        }

        // IMEI
        let imeiView = document.getElementById(modem.imeiId);
        if (imeiView) {
          imeiView.innerHTML = (hidedata && hide_list.indexOf('IMEI') >= 0) ? (json[0].imei || '').replace(/./g, '#') : (json[0].imei || '');
        }

        // IMSI
        let imsiView = document.getElementById(modem.imsiId);
        if (imsiView) {
          imsiView.innerHTML = (hidedata && hide_list.indexOf('IMSI') >= 0) ? (json[0].imsi || '').replace(/./g, '#') : (json[0].imsi || '');
        }

        // Country
        let countryView = document.getElementById(modem.countryId);
        if (countryView) {
          let countryTxt = (json[2].country || '').replace('Poland', _('Poland'));
          countryView.style.display = (countryTxt && countryTxt.length > 2) ? '' : 'none';
          countryView.innerHTML = (hidedata && hide_list.indexOf(_('Country')) >= 0) ? countryTxt.replace(/./g, '#') : countryTxt;
        }

        // Modem type
        let modemtypeView = document.getElementById(modem.modemtypeId);
        if (modemtypeView) {
          modemtypeView.textContent = (json[0].vendor || '-') + ' ' + (json[0].product || '-');
          modemtypeView.title = modemtypeView.textContent;
        }

        // FW
        let firmwareView = document.getElementById(modem.firmwareId);
        if (firmwareView) {
          firmwareView.textContent = json[0].revision || '-';
          firmwareView.title = firmwareView.textContent;
        }

        // Temperature
        let tempView = document.getElementById(modem.tempId);
        if (tempView) {
          let temperatureObj = (json[2].addon || []).find(function(i){ return i.key==='Temperature'; });
          let temperature = temperatureObj ? temperatureObj.value : _('No data');
          temperature = temperature.replace('&deg;', '°');
          if (temperature && temperature !== _('No data') && temperature.length > 2) {
            let tempDivElement = document.getElementById(modem.tempDivId);
            if (tempDivElement) tempDivElement.style.display = 'flex';
            tempView.innerHTML = '';
            tempView.appendChild(
              E('div', { 'class': 'ifacebadge', 'title': _('Chip Temperature') + ': ' + temperature }, [
                E('img', { 'src': L.resource('icons/termometr.svg'), 'style': 'padding-left:2px;height:32px;width:auto;display:inline-block;' }),
                E('normal', { 'style': 'margin-left:.1em;font-size:12px' }, [ temperature || '-' ])
              ])
            );
          }
        }

        // Cell ID
        let cellView = document.getElementById(modem.cellId);
        if (cellView) {
          let celldata = (json[2].cid_dec + ' (' + json[2].cid_hex + ')');
          if (hidedata && hide_list.indexOf(_('Cell ID')) >= 0) celldata = celldata.replace(/./g, '#');
          if (parseInt(json[2].cid_dec || '0', 10) < 1) cellView.innerHTML = '-';
          else {
            cellView.textContent = celldata;
            cellView.title = celldata;
          }
        }

        // LAC
        let lacView = document.getElementById(modem.lacId);
        if (lacView) {
          if (hidedata && hide_list.indexOf('LAC') >= 0) {
            lacView.innerHTML = (json[2].lac_dec || '').replace(/./g, '#') + ' (' + (json[2].lac_hex || '').replace(/./g, '#') + ')';
          } else {
            if (!json[2].lac_dec || !json[2].lac_hex || json[2].lac_dec === '0' || json[2].lac_hex === '0')
              lacView.innerHTML = '-';
            else
              lacView.innerHTML = json[2].lac_dec + ' (' + json[2].lac_hex + ')';
          }
        }

        // TAC
        let tacView = document.getElementById(modem.tacId);
        if (tacView) {
          let tacObj = (json[2].addon || []).find(function(i){ return i.key==='TAC'; });
          let tac = tacObj ? tacObj.value : _('-');
          tacView.innerHTML = (hidedata && hide_list.indexOf('TAC') >= 0) ? tac.replace(/./g, '#') : tac;
        }

        // MCC
        let mccView = document.getElementById(modem.mccId);
        if (mccView) {
          mccView.innerHTML = (hidedata && hide_list.indexOf('MCC') >= 0) ? (json[2].operator_mcc || '').replace(/./g, '#') : (json[2].operator_mcc || '');
        }

        // MNC
        let mncView = document.getElementById(modem.mncId);
        if (mncView) {
          mncView.innerHTML = (hidedata && hide_list.indexOf('MNC') >= 0) ? (json[2].operator_mnc || '').replace(/./g, '#') : (json[2].operator_mnc || '');
        }

        // Mode
        let modeView = document.getElementById(modem.modeId);
        if (modeView) {
          if ((json[2].mode || '').length <= 1) {
            modeView.textContent = '-';
            if (lteTable) lteTable.style.display = 'none';
            if (wcdmaTable) wcdmaTable.style.display = 'none';
            let bs5 = document.getElementById(modem.bandshowId); if (bs5) bs5.style.display = 'none';
          } else {
            let modeRaw2 = json[2].mode || '';
            let modeUp = modeRaw2.toUpperCase();
            let modeDisplay;

            if (modeUp.indexOf('LTE') >= 0 || modeUp.indexOf('5G') >= 0) {
              let tech = '';
              if (modeUp.indexOf('LTE') >= 0) tech = modeRaw2.split(' ')[0];
              if (modeUp.indexOf('5G') >= 0) tech = modeRaw2.split(' ')[0] + (modeRaw2.split(' ')[1] ? (' ' + modeRaw2.split(' ')[1]) : '');
              let count = (modeRaw2.match(/\//g) || []).length + 1;
              modeDisplay = (count > 1) ? (tech + ' (' + count + 'CA)') : tech;
            } else {
              modeDisplay = modeRaw2.split(' ')[0];
            }

            modeDisplay = modeDisplay.replace('LTE_A', 'LTE-A');
            modeView.textContent = modeDisplay;
          }
        }
      });
    })().catch(function(e) {
      console.error('JSON parsing error', modem.comm_port, e);
    });
  })).then(function() {
    return Promise.resolve();
  });
}

return view.extend({

  load: function() {
    return Promise.all([
      uci.load('defmodems'),
      uci.load('modemdata')
    ]);
  },

  render: function (data) {
    addDarkModeStyles();
    
    let sections   = uci.sections('defmodems', 'defmodems') || [];
    let sectionsxt = uci.sections('modemdata', 'modemdata') || [];

    loadUCInterval();

    let info = _('For more information about the modemdata package, please visit: %shttps://github.com/obsy/modemdata%s.')
      .format('<a href="https://github.com/obsy/modemdata" target="_blank">', '</a>');

    if (!Array.isArray(sections) || sections.length === 0) {

      let modemsModal = baseclass.extend({
        __init__: function() {
          this.title = _('No Modems Detected...');
          this.description = _('Oops.. there are no modems in settings. You will be redirected to a tab where you can define the installed modem(s).');
          this.countdown = 10;
          this.timer = null;
        },

        startCountdown: function() {
          let self = this;
          let countdownLabel = document.getElementById('countdownLabel');
          this.timer = setInterval(function() {
            self.countdown--;
            if (self.countdown > 0) {
              countdownLabel.textContent = _('Redirecting in') +' '+ self.countdown +' '+ _('seconds...');
            } else {
              clearInterval(self.timer);
              countdownLabel.textContent = _('Redirecting...');

              let pkg = {
                get modemdefURI() {
                  return 'admin/modem/modemdata/modemdefine';
                }
              };
              window.location.href = L.url(pkg.modemdefURI);
            }
          }, 1000);
        },

        render: function() {
          ui.showModal(this.title, [
            E('div', { class: 'info-message' }, [
              E('p', {}, this.description),
              E('label', { id: 'countdownLabel' }, _('Redirecting in') +' '+ this.countdown +' '+ _('seconds...'))
            ]),
          ], 'cbi-modal');

          this.startCountdown();
        }
      });

      let modemDialog = new modemsModal();
      modemDialog.render();

      return E([
        E('h2', { 'class': 'fade-in' }, _('Modemdata')),
        E('div', { 'class': 'cbi-section-descr fade-in' },
          _('Package allows the user to view the data read from the modem, to see the parameters of the connection to the mobile network.') + '<br />' + info)
      ]);
    }

    let globalToolbar = E('div', {
      'class': 'right',
      'style': 'width:100%; margin-bottom:8px; display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap;'
    }, [
      E('div', { 'style': 'display:flex; flex-direction:column; align-items:flex-start; gap:.5rem; min-width:320px;' }, [
        E('div', { 'style': 'display:flex; align-items:center; gap:.75rem; flex-wrap:wrap;' }, [
          E('label', { 'for': 'selectInterval', 'style': 'text-align:left;' }, _('Auto update every:')),
          E('select', { 'id': 'selectInterval', 'change': clickToSelectInterval }, [
            E('option', { value: '-1' }, _('Disabled')),
            E('option', { value: '5' }, _('5 seconds')),
            E('option', { value: '10' }, _('10 seconds')),
            E('option', { value: '30' }, _('30 seconds')),
            E('option', { value: '45' }, _('45 seconds'))
          ])
        ]),
        E('label', {
          'id': 'countdown-label',
          'style': 'font-size:.9em; opacity:.85; min-height:1.2em; margin-top:.25rem; text-align:left;'
        },
          E('em', { 'class': 'spinning' }, _('Please wait... data collection is in progress.'))
        )
      ]),

      E('div', { 'style': 'display:flex; align-items:center; gap:1rem; margin-left:auto; flex-wrap:wrap;' }, [
        E('label', { 
          'class': 'cbi-checkbox', 
          'style': 'user-select:none;'
        }, [
          E('input', {
            'id': 'hide-data',
            'type': 'checkbox',
            'name': 'showhistory',
            'title': _('Hide selected data')
          }),
          ' ',
          E('label', { 'for': 'hide-data' }),
          ' ',
          _('Hide data.')
        ]),
      ])
    ]);

    let tabsContainer = E('div', { 'class': 'cbi-section-node cbi-section-node-tabbed' });
    let modemTabs = [];

    let wcdmaTableTitles = [
      _('Name'),
      _('UARFCN'),
      _('RSSI'),
      _('RSCP'),
      _('EC/IO'),
    ];

    let lteTableTitles = [
      _('Band'),
      _('Bandwidth'),
      _('Physical cell ID'),
      _('EARFCN'),
      _('RSSI'),
      _('RSRP'),
      _('RSRQ'),
      _('SINR'),
    ];

    // TABS
    for (let i = 0; i < sections.length; i++) {
      let modem = sections[i];
      let rmethod = modem.modemdata || '-';
      let fplmn   = modem.forced_plmn || '-';
      let rmbim   = modem.onproxy || '-';
      let modemName = modem.modem || '-';
      let desc    = modem.user_desc || '-';
      let net     = modem.network || '-';
      let mport   = modem.comm_port || '-';
      let tabTitle = modemName + (desc.length >= 2 ? (' (' + desc + ')') : '');

      // Data_i
      let signalId     = 'signal_' + i;
      let connstId     = 'connst_' + i;
      let stateId      = 'state_' + i;
      let operatorId   = 'operator_' + i;
      let countryId    = 'country_' + i;
      let simId        = 'sim_' + i;
      let rxId         = 'rx_' + i;
      let txId         = 'tx_' + i;
      let slotId       = 'slot_' + i;
      let slotDivId    = 'slotDiv_' + i;
      let tempDivId    = 'tempDiv_' + i;
      let iccidId      = 'iccid_' + i;
      let imeiId       = 'imei_' + i;
      let imsiId       = 'imsi_' + i;
      let modemtypeId  = 'modemtype_' + i;
      let firmwareId   = 'firmware_' + i;
      let tempId       = 'temp_' + i;
      let cellId       = 'cell_' + i;
      let lacId        = 'lac_' + i;
      let tacId        = 'tac_' + i;
      let mccId        = 'mcc_' + i;
      let mncId        = 'mnc_' + i;
      let modeId       = 'mode_' + i;
      let bandshowId   = 'bandshow_' + i;
      let wcdmaTableId = 'wcdmaTable_' + i;
      let lteTableId   = 'lteTable_' + i;

      // WCDMA & LTE TABLE
      let wcdmaTable = E('table', {
        'class': 'table',
        'id': wcdmaTableId,
        'style': 'border:1px solid var(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%; display:none; font-size:12px;'
      },
        E('tr', { 'class': 'tr table-titles' }, [
          E('th', { 'class': 'th left', 'style': 'min-width:80px; width:80px;'  }, wcdmaTableTitles[0]),
          E('th', { 'class': 'th left', 'style': 'min-width:80px; width:80px;;'  }, wcdmaTableTitles[1]),
          E('th', { 'class': 'th left', 'style': 'min-width:100px; width:100px;' }, wcdmaTableTitles[2]),
          E('th', { 'class': 'th left', 'style': 'min-width:100px; width:100px;' }, wcdmaTableTitles[3]),
          E('th', { 'class': 'th left', 'style': 'min-width:100px; width:100px;' }, wcdmaTableTitles[4])
        ])
      );

      let lteTable = E('table', {
        'class': 'table',
        'id': lteTableId,
        'style': 'border:1px solid var(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%; display:none; font-size:12px;'
      },
        E('tr', { 'class': 'tr table-titles' }, [
          E('th', { 'class': 'th left', 'style': 'min-width:75px; width:85px;' }, lteTableTitles[0]),
          E('th', { 'class': 'th left', 'style': 'min-width:55px;  width:60px;'  }, lteTableTitles[1]),
          E('th', { 'class': 'th left', 'style': 'min-width:50px;  width:60px;'  }, lteTableTitles[2]),
          E('th', { 'class': 'th left', 'style': 'min-width:35px;  width:45px;'  }, lteTableTitles[3]),
          E('th', { 'class': 'th left', 'style': 'min-width:90px;  width:100px;'  }, lteTableTitles[4]),
          E('th', { 'class': 'th left', 'style': 'min-width:90px;  width:100px;'  }, lteTableTitles[5]),
          E('th', { 'class': 'th left', 'style': 'min-width:90px;  width:100px;'  }, lteTableTitles[6]),
          E('th', { 'class': 'th left', 'style': 'min-width:90px;  width:100px;'  }, lteTableTitles[7])
        ])
      );

      const perTabToolbar = E('div', {
        'style': 'display:flex; align-items:center; gap:.5rem; margin-left:auto;'
      }, [
        E('span', {}, _('Primary band')),
        E('button', {
          'class': 'btn cbi-button-neutral',
          'id': 'basicSignals_' + i,
          'data-tooltip': _('Show signal levels'),
          'click': ui.createHandlerFn(this, function(){ openBasicSignalsModal(i); })
        }, _('☰')),
        E('span', {}, _('Search BTS')),
        E('button', {
          'class': 'cbi-button cbi-button-action important',
          'id': 'btsSearch_' + i,
          'click': ui.createHandlerFn(this, function () { return handleAction(i); })
        }, _('Search'))
      ]);

      let modemTab = E('div', {
        'data-tab': 'tab' + i,
        'data-tab-title': tabTitle
      }, [
        E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:.25rem;' }, [
          E('h4', {}, [ _('General Information') ]),
          perTabToolbar
        ]),

        E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));margin-bottom:1em;gap:1em' }, [

          // Connection
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head port-label', 'style': 'font-weight:bold;padding:8px' }, [ _('Connection') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px' }, [
                E('span', {}, _('Signal') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': signalId }, [ '-' ])
              ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px' }, [
                  E('span', {
                    'style': 'min-width:0; max-width:70%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'
                  }, _('Connection state') + ':'),
                  E('span', {
                    'style': 'font-weight:500',
                    'id': stateId
                  }, [ '-' ])
                ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Operator') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': operatorId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Country') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': countryId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Technology') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': modeId }, [ '-' ])
              ]),
              E('div', { 'style': 'text-align:left;font-size:11px;border-top:1px solid var(--border-color-medium);padding-top:8px' }, [
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {
                    'style': 'min-width:0; max-width:75%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'
                  }, _('Connection time') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': connstId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:2px' }, [
                  E('span', '▲ ' + _('Sent') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': txId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between' }, [
                  E('span', '▼ ' + _('Received') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': rxId }, [ '-' ])
                ])
              ])
            ])
          ]),

          // SIM Card
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head port-label', 'style': 'font-weight:bold;padding:8px' }, [ _('SIM Card') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'id': slotDivId, 'style': 'display:none;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Slot in use') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': slotId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('SIM status') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:75%; display:inline-block; cursor:pointer;',
                  'id': simId, 'title': '-'
                }, [ '-' ])
              ]),
              E('div', { 'style': 'text-align:left;font-size:11px;border-top:1px solid var(--border-color-medium);padding-top:8px' }, [
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('IMSI') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': imsiId }, [ '-' ])
                ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('ICCID') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': iccidId }, [ '-' ])
                ])
              ])
            ])
          ]),

          // Modem Info
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head port-label', 'style': 'font-weight:bold;padding:8px' }, [ _('Modem Information') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Modem type') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%; display:inline-block; cursor:pointer;',
                  'id': modemtypeId, 'title': '-'
                }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Revision / FW') + ':'),
                E('span', {
                  'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%; display:inline-block; cursor:pointer;',
                  'id': firmwareId, 'title': '-'
                }, [ '-' ])
              ]),
                E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                  E('span', {}, _('Modem IMEI') + ':'),
                  E('span', { 'style': 'font-weight:500', 'id': imeiId }, [ '-' ])
                ]),
              E('div', { 'id': tempDivId, 'style': 'display:none;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Chip Temperature') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': tempId }, [ '-' ])
              ])
            ])
          ]),

          // Cell Info
          E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;width:100%' }, [
            E('div', { 'class': 'ifacebox-head port-label', 'style': 'font-weight:bold;padding:8px' }, [ _('Cell Information') ]),
            E('div', { 'class': 'ifacebox-body', 'style': 'padding:8px' }, [
            E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
              E('span', {}, _('Cell ID') + ':'),
              E('span', {
                'style': 'font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:42%; display:inline-block; cursor:pointer;',
                'id': cellId, 
                'title': _('Click to view Cell ID details'),
                'click': ui.createHandlerFn(this, function() { openCellIdModal(i); })
              }, [ '-' ])
            ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('TAC') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': tacId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('LAC') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': lacId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Mobile Country Code') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': mccId }, [ '-' ])
              ]),
              E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px' }, [
                E('span', {}, _('Mobile Network Code') + ':'),
                E('span', { 'style': 'font-weight:500', 'id': mncId }, [ '-' ])
              ])
            ])
          ])
        ]),

        E('h4', { id: bandshowId, style: 'display: none;' }, [ _('Bands') ]),
        wcdmaTable,
        lteTable
      ]);

      tabsContainer.append(modemTab);

      modemTabs.push({
        index: i,
        network: net,
        comm_port: mport,
        forced_plmn_op: fplmn,
        mbim_op: rmbim,
        modemdata: rmethod,
        signalId: signalId,
        connstId: connstId,
        operatorId: operatorId,
        countryId: countryId,
        simId: simId,
        rxId: rxId,
        txId: txId,
        slotId: slotId,
        slotDivId: slotDivId,
        tempDivId: tempDivId,
        iccidId: iccidId,
        imeiId: imeiId,
        imsiId: imsiId,
        modemtypeId: modemtypeId,
        firmwareId: firmwareId,
        tempId: tempId,
        cellId: cellId,
        lacId: lacId,
        tacId: tacId,
        mccId: mccId,
        mncId: mncId,
        stateId: stateId,
        modeId: modeId,
        bandshowId: bandshowId,
        wcdmaTableId: wcdmaTableId,
        lteTableId: lteTableId
      });
    }

    setTimeout(function() {
      refresh.labelEl = document.getElementById('countdown-label');
      refresh.selectEl = document.getElementById('selectInterval');
      if (refresh.selectEl) refresh.selectEl.value = String(refresh.interval);
      if (!poll.active() || refresh.interval < 0) setUpdateMessage(refresh.labelEl, -1);
    }, 0);

    document.addEventListener('poll-start', function() {
      if (refresh.selectEl) refresh.selectEl.value = String(refresh.interval);
    });

    document.addEventListener('poll-stop', function() {
      if (refresh.selectEl) refresh.selectEl.value = '-1';
      setUpdateMessage(refresh.labelEl, -1);
    });

    // Poll 1 sec
    poll.add(function() {
      return updateDataTick(function() {
        return CreateModemMultiverse(modemTabs, sectionsxt);
      });
    }, 1);

    // TABS
    setTimeout(function() { ui.tabs.initTabGroup(tabsContainer.children); }, 0);

    return E([
      E('h2', { 'class': 'fade-in' }, _('Modemdata')),
      E('div', { 'class': 'cbi-section-descr fade-in' },
        _('Package allows the user to view the data read from the modem, to see the parameters of the connection to the mobile network.') + '<br />' + info),
      E('hr'),
      globalToolbar,
      tabsContainer
    ]);
  }, 

  handleSaveApply: null,
  handleSave     : null,
  handleReset    : null
});
