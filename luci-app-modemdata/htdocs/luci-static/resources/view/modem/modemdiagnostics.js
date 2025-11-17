'use strict';
'require baseclass';
'require form';
'require fs';
'require uci';
'require ui';
'require view';
'require tools.widgets as widgets';

/*

  Copyright 2025 Rafał Wabik - IceG - From eko.one.pl forum

  MIT License
  
*/

// 添加诊断页面样式
function addDiagnosticsStyles() {
  if (document.getElementById('modemdata-diagnostics-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'modemdata-diagnostics-styles';
  style.type = 'text/css';
  style.textContent = `
    /* 强制重置 table 默认样式 - 使用更具体的选择器 */
    table.table,
    .cbi-map table.table {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;
      gap: 16px !important;
      width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      border-spacing: 0 !important;
      border-collapse: initial !important;
      table-layout: initial !important;
      margin-top: 1em !important;
    }

    /* 让 tr 透传，使 td 直接成为 grid 子项 */
    table.table tr,
    table.table .tr,
    .cbi-map table.table tr {
      display: contents !important;
    }
    
    /* 重置 td 的默认 table-cell 显示 */
    table.table td,
    table.table .td,
    .cbi-map table.table td {
      display: flex !important;
    }

    /* 每个诊断项卡片样式 */
    .table .td.left {
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      background: var(--modemdata-card-bg) !important;
      border: 1px solid var(--modemdata-card-border) !important;
      border-radius: 8px !important;
      padding: 16px !important;
      min-height: 150px !important;
      transition: all 0.2s ease !important;
      box-sizing: border-box !important;
    }

    .table .td.left:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    :root[data-darkmode="true"] .table .td.left:hover,
    body.dark .table .td.left:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    /* 隐藏空单元格 */
    .table .td.left:empty {
      display: none !important;
    }

    /* 标题 - 左对齐 */
    .table .cbi-value-title {
      font-weight: 600 !important;
      font-size: 14px !important;
      margin: 0 0 10px 0 !important;
      padding: 0 !important;
      display: block !important;
      color: var(--modemdata-text-primary) !important;
      line-height: 1.4 !important;
      text-align: left !important;
      width: 100% !important;
    }

    /* 命令区域 - 左对齐，单行显示 */
    .table .td.left p {
      margin: 0 0 12px 0 !important;
      padding: 0 !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
      flex: 1 !important;
      text-align: left !important;
      width: 100% !important;
      overflow: hidden !important;
    }

    /* code 标签 - 单行显示，可滚动 */
    .table .td.left p code {
      background-color: rgba(130, 130, 130, 0.3) !important;
      padding: 5px 10px !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
      color: #0a0a0a !important;
      font-weight: 600 !important;
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      display: block !important;
      white-space: nowrap !important;
      overflow-x: auto !important;
      max-width: 100% !important;
    }

    :root[data-darkmode="true"] .table .td.left p code,
    body.dark .table .td.left p code {
      background-color: rgba(210, 210, 210, 0.25) !important;
      color: #f5f5f5 !important;
      border-color: rgba(255, 255, 255, 0.25) !important;
    }

    /* 按钮 - 左对齐，固定宽度 */
    .diag-action {
      display: flex !important;
      margin-top: auto !important;
      width: 100% !important;
      justify-content: flex-start !important;
    }

    .diag-action .cbi-button {
      width: auto !important;
      min-width: 90px !important;
      padding: 6px 20px !important;
      display: inline-block !important;
      text-align: center !important;
    }

    /* 修复下拉框文字被遮挡问题 */
    .cbi-input-select {
      line-height: 1.6 !important;
      padding: 8px 12px !important;
      min-height: 40px !important;
      font-size: 14px !important;
    }

    .cbi-input-select option {
      line-height: 1.8 !important;
      padding: 8px 12px !important;
      min-height: 36px !important;
      font-size: 14px !important;
    }

    /* 响应式断点优化 */
    @media (max-width: 669px) {
      table.table,
      .cbi-map table.table {
        grid-template-columns: 1fr !important;
      }
    }
    
    @media (min-width: 670px) {
      table.table,
      .cbi-map table.table {
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;
      }
    }

    /* 输出对话框样式 */
    #cmd_modal_output {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      color: #333;
    }

    :root[data-darkmode="true"] #cmd_modal_output,
    body.dark #cmd_modal_output {
      background-color: #1a1a1a;
      border-color: #444;
      color: #e0e0e0;
    }

    /* 模态框按钮样式 */
    .cbi-modal .right .btn {
      margin-left: 8px;
      min-width: 80px;
    }

    /* Modem 选择器样式 */
    #mselect {
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #ccc;
      transition: border-color 0.2s ease;
    }

    #mselect:focus {
      border-color: #007bff;
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    :root[data-darkmode="true"] #mselect,
    body.dark #mselect {
      background-color: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
      color: #e0e0e0;
    }
  `;
  document.head.appendChild(style);
  
  // 强制清理 table 的 inline styles，确保 Grid 布局生效
  function cleanTableStyles() {
    document.querySelectorAll('table.table').forEach(function(table) {
      table.removeAttribute('style');
      table.style.cssText = 'display: grid !important; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important; gap: 16px !important; width: 100% !important;';
    });
    document.querySelectorAll('table.table td, table.table .td').forEach(function(td) {
      td.removeAttribute('style');
      if (td.classList.contains('left')) {
        td.style.cssText = 'display: flex !important;';
      }
    });
  }
  
  // 多次尝试清理，确保生效
  setTimeout(cleanTableStyles, 50);
  setTimeout(cleanTableStyles, 200);
  setTimeout(cleanTableStyles, 500);
}

let commandOutputDialog = baseclass.extend({
  __init__: function(title, content){ this.title = title; this.content = content; },

  render: function(){
    let self = this;

    ui.showModal(this.title, [
      E('p', _('Command result')),
      E('textarea', {
        'id': 'cmd_modal_output',
        'class': 'cbi-input-textarea',
        'style': 'width:100% !important; height:60vh; min-height:500px;',
        'readonly': true,
        'wrap': 'off',
        'spellcheck': 'false'
      }, this.content.trim()),

      E('div', { 'class': 'right' }, [
        E('button', {
          'class': 'btn cbi-button-remove',
          'click': ui.createHandlerFn(this, function(){
            document.getElementById('cmd_modal_output').value = '';
            fs.write('/tmp/debug_result.txt', '')
              .catch(function(e){
                ui.addNotification(null, E('p', _('Unable to clear the file') + ': %s'.format(e.message)), 'error');
              });
          })
        }, _('Clear')), ' ',

        E('button', {
          'class': 'cbi-button cbi-button-apply important',
          'click': ui.createHandlerFn(this, function(){
            let blob = new Blob([self.content], { type: 'text/plain' });
            let link = document.createElement('a');
            link.download = 'debug_result.txt';
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
          })
        }, _('Download')), ' ',

        E('button', {
          'class': 'btn',
          'click': ui.hideModal
        }, _('Close'))
      ])
    ], 'cbi-modal');
  },

  show: function(){ this.render(); }
});

return view.extend({
  handleCommand: function(exec, args){
    return fs.exec(exec, args).then((res)=>{
      let output = [res.stdout||'', res.stderr||''].join('\n');
      fs.write('/tmp/debug_result.txt', res.stdout||'');
      let dialog = new commandOutputDialog(_('Diagnostics'), output);
      dialog.show();
    }).catch((err)=>{ ui.addNotification(null, E('p', [err])); }).finally(()=>{});
  },

  handleUSB: function(){ return this.handleCommand('/bin/cat', ['/sys/kernel/debug/usb/devices']); },
  handleTTY: function(){ return this.handleCommand('/bin/ls', ['/dev']); },

  handleDBG: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let valueParts = value.split('_'); let device = valueParts[1] || ''; let network = valueParts[2] || '';
    return this.handleCommand('/bin/sh', ['/usr/bin/md_serial_ecm', device, network]);
  },

  handleproduct: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let device = value.split('_')[1] || '';
    return this.handleCommand('/bin/sh', ['-x', '/usr/share/modemdata/product.sh', device]);
  },

  handlenetwork: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let network = value.split('_')[2] || '';
    return this.handleCommand('/bin/sh', ['-x', '/usr/share/modemdata/network.sh', network]);
  },

  handleparams: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let device = value.split('_')[1] || '';
    return this.handleCommand('/bin/sh', ['-x', '/usr/share/modemdata/params.sh', device]);
  },

  handleuqmi: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let valueParts = value.split('_'); let device = valueParts[1]||''; let network = valueParts[2]||''; let forced_plmn = valueParts[3]||''; let onproxy = (valueParts[4]||'').replace('undefined','0');
    return this.handleCommand('/bin/sh', ['/usr/bin/md_uqmi', device, network, forced_plmn, onproxy]);
  },

  handleparuqmi: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let valueParts = value.split('_'); let device = valueParts[1]||''; let forced_plmn = valueParts[3]||''; let onproxy = (valueParts[4]||'').replace('undefined','0');
    return this.handleCommand('/bin/sh', ['-x', '/usr/share/modemdata/params_qmi.sh', device, forced_plmn, onproxy]);
  },

  handlemm: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let valueParts = value.split('_'); let device = valueParts[1]||''; let network = valueParts[2]||''; let forced_plmn = valueParts[3]||'';
    return this.handleCommand('/bin/sh', ['/usr/bin/md_modemmanager', device, network, forced_plmn]);
  },

  handleparamsmm: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let valueParts = value.split('_'); let device = valueParts[1]||''; let forced_plmn = valueParts[3]||'';
    return this.handleCommand('/bin/sh', ['-x', '/usr/share/modemdata/params_modemmanager.sh', device, forced_plmn]);
  },

  handleprodmm: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : '';
    let valueParts = value.split('_'); let device = valueParts[1]||'';
    return this.handleCommand('/bin/sh', ['-x', '/usr/share/modemdata/product_modemmanager.sh', device]);
  },

  handleClear: function(){ fs.write('/tmp/debug_result.txt',''); },

  handleDownload: function(){
    return L.resolveDefault(fs.read_direct('/tmp/debug_result.txt'), null).then((res)=>{
      if(res){ let blob = new Blob([res], { type:'text/plain' }); let link = document.createElement('a'); link.download = 'debug_result.txt'; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); }
    }).catch((err)=>{ ui.addNotification(null, E('p', {}, _('Download error') + ': ' + err.message)); });
  },

  handleBlock: function(){
    let select = document.getElementById('mselect'); let value = select ? select.value : ''; let valueParts = value.split('_'); let modemdata = valueParts[0] || '';
    let buttons = document.querySelectorAll('.diag-action > .cbi-button'); for(let i=0;i<buttons.length;i++) buttons[i].removeAttribute('disabled');

    if (modemdata.includes('uqmi')) { 
        document.getElementById('s1').setAttribute('disabled','disabled');
        document.getElementById('s2').setAttribute('disabled','disabled');
        document.getElementById('s3').setAttribute('disabled','disabled');
        document.getElementById('m1').setAttribute('disabled','disabled');
        document.getElementById('m2').setAttribute('disabled','disabled');
        document.getElementById('m3').setAttribute('disabled','disabled');
    }
    if (modemdata.includes('serial')) {
        document.getElementById('u1').setAttribute('disabled','disabled');
        document.getElementById('u2').setAttribute('disabled','disabled');
        document.getElementById('m1').setAttribute('disabled','disabled');
        document.getElementById('m2').setAttribute('disabled','disabled');
        document.getElementById('m3').setAttribute('disabled','disabled');
    }
    if (modemdata.includes('mm')) {
        document.getElementById('s1').setAttribute('disabled','disabled');
        document.getElementById('s2').setAttribute('disabled','disabled');
        document.getElementById('s3').setAttribute('disabled','disabled');
        document.getElementById('u1').setAttribute('disabled','disabled');
        document.getElementById('u2').setAttribute('disabled','disabled');
    }
  },

  load: function(){ return L.resolveDefault(uci.load('defmodems')); },

  render: function(){
    // 初始化样式
    addDiagnosticsStyles();
    
    let sections = uci.sections('defmodems','defmodems');
    let result = sections.map(s=>`${s.modemdata}_${s.comm_port}_${s.network}_${s.forced_plmn}_${s.onproxy}_#[ ${s.modemdata} ] ${s.comm_port} - ${s.modem} (${s.user_desc})`).join(';');
    result = result.replace("(undefined)","");

    let off_s1,off_s2,off_s3,off_u1,off_u2,off_m1,off_m2,off_m3;
    let modemz = E('div', { class:'cbi-section' }, [
      E('div', { class:'cbi-section-descr' }, this.description),
      E('div', { class:'cbi-value' }, [
        E('label', { class:'cbi-value-title' }, [_('Modem')]),
        E('div', { class:'cbi-value-field' }, [
          E('select', { class:'cbi-input-select', id:'mselect', style:'width:100%;', change:ui.createHandlerFn(this,'handleBlock'), mousedown:ui.createHandlerFn(this,'handleBlock') },
            (result||'').trim().split(/;/).map(function(cmd){ let fields = cmd.split(/#/); let name = fields[1]; let code = fields[0]; return E('option', { value:code }, name); })
          )
        ])
      ])
    ]);

    let modemdata = result.split('_')[0] || '';
    if (modemdata.includes('uqmi')) {
    const ids=['s1','s2','s3','m1','m2','m3'];
        off_s1=ids.includes('s1')?true:false;
        off_s2=ids.includes('s2')?true:false;
        off_s3=ids.includes('s3')?true:false;
        off_m1=ids.includes('m1')?true:false;
        off_m2=ids.includes('m2')?true:false;
        off_m3=ids.includes('m3')?true:false;
    }
    if (modemdata.includes('serial')) {
    const ids=['u1','u2','m1','m2','m3'];
        off_u1=ids.includes('u1')?true:false;
        off_u2=ids.includes('u2')?true:false;
        off_m1=ids.includes('m1')?true:false;
        off_m2=ids.includes('m2')?true:false;
        off_m3=ids.includes('m3')?true:false;
    }
    if (modemdata.includes('mm')) {
    const ids=['s1','s2','s3','u1','u2'];
        off_s1=ids.includes('s1')?true:false;
        off_s2=ids.includes('s2')?true:false;
        off_s3=ids.includes('s3')?true:false;
        off_u1=ids.includes('u1')?true:false;
        off_u2=ids.includes('u2')?true:false;
    }

    let table4 = E('table', { class:'table' }, [
      E('tr', {}, [
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("USB debug information")),
          E('p', {}, _("<code>cat /sys/kernel/debug/usb/devices</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button', click:ui.createHandlerFn(this,'handleUSB') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check ttyX ports")),
          E('p', {}, _("<code>ls /dev</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button', click:ui.createHandlerFn(this,'handleTTY') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check") + ' ' + _("network.sh")),
          E('p', {}, _("<code>sh -x /usr/share/modemdata/network.sh</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button', click:ui.createHandlerFn(this,'handlenetwork') }, _('Run')) ])
        ])
      ])
    ]);

    let table = E('table', { class:'table' }, [
      E('tr', {}, [
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check serial and ecm mode")),
          E('p', {}, _("<code>sh /usr/bin/md_serial_ecm</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-add', id:'s1', disabled:off_s1, click:ui.createHandlerFn(this,'handleDBG') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check") + ' ' + _("product.sh")),
          E('p', {}, _("<code>sh -x /usr/share/modemdata/product.sh</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-add', id:'s2', disabled:off_s2, click:ui.createHandlerFn(this,'handleproduct') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check") + ' ' + _("params.sh")),
          E('p', {}, _("<code>sh -x /usr/share/modemdata/params.sh</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-add', id:'s3', disabled:off_s3, click:ui.createHandlerFn(this,'handleparams') }, _('Run')) ])
        ])
      ])
    ]);

    let table2 = E('table', { class:'table' }, [
      E('tr', {}, [
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check uqmi mode")),
          E('p', {}, _("<code>sh -x /usr/bin/md_uqmi</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-remove', id:'u1', disabled:off_u1, click:ui.createHandlerFn(this,'handleuqmi') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check") + ' ' + _("params_qmi.sh")),
          E('p', {}, _("<code>sh -x /usr/share/modemdata/params_qmi.sh</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-remove', id:'u2', disabled:off_u2, click:ui.createHandlerFn(this,'handleparuqmi') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [])
      ])
    ]);

    let table3 = E('table', { class:'table' }, [
      E('tr', {}, [
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check ModemManager mode")),
          E('p', {}, _("<code>sh -x /usr/bin/md_modemmanager</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-apply', id:'m1', disabled:off_m1, click:ui.createHandlerFn(this,'handlemm') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check") + ' ' + _("params_modemmanager.sh")),
          E('p', {}, _("<code>sh -x /usr/share/modemdata/params_modemmanager.sh</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-apply', id:'m2', disabled:off_m2, click:ui.createHandlerFn(this,'handleparamsmm') }, _('Run')) ])
        ]),
        E('td', { class:'td left' }, [
          E('label', { class:'cbi-value-title' }, _("Check") + ' ' + _("product_modemmanager.sh")),
          E('p', {}, _("<code>sh -x /usr/share/modemdata/product_modemmanager.sh</code>")),
          E('span', { class:'diag-action' }, [ E('button', { class:'cbi-button cbi-button-apply', id:'m3', disabled:off_m3, click:ui.createHandlerFn(this,'handleprodmm') }, _('Run')) ])
        ])
      ])
    ]);

    let info = _('For more information about the modemdata package, please visit: %shttps://github.com/obsy/modemdata%s.').format('<a href="https://github.com/obsy/modemdata" target="_blank">','</a>');
    return E('div', { class:'cbi-map' }, [
      E('h2', {}, _('Diagnostics')),
      E('div', { class:'cbi-map-descr' }, _('Run various commands to verify data read from the modem and debug scripts.') + '<br>' + info),
      E('hr'), modemz, table4, table, table2, table3
    ]);
  },

  handleSaveApply: null,
  handleSave: null,
  handleReset: null
});
