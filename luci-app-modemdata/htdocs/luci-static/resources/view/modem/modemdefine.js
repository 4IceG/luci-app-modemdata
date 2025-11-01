'use strict';
'require baseclass';
'require form';
'require fs';
'require view';
'require uci';
'require ui';
'require tools.widgets as widgets';

/*

  Copyright 2025 Rafał Wabik - IceG - From eko.one.pl forum

  MIT License
  
*/

function usrdesc(section_id) {
  return E('span', (uci.get('defmodems', section_id, 'user_desc') || ''));
}

function getmodem(section_id) {
  return E('span', (uci.get('defmodems', section_id, 'modem') || ''));
}

function getmodemdata(section_id) {
  return E('span', '<code>' + (uci.get('defmodems', section_id, 'comm_port') + '</code>' || '<code>' + '' + '</code>'));
}

return view.extend({
  modemPath: '/etc/modem/modemlist.json',

  load: function () {
    return Promise.all([
      L.resolveDefault(fs.list('/dev'), null),
      L.resolveDefault(fs.read_direct('/sys/kernel/debug/usb/devices', ['-r'])),
      L.resolveDefault(fs.exec_direct('/usr/bin/mmcli', ['-L', '-J']), null),
      this.checkPackages(),
      uci.load('defmodems')
    ]);
  },

  pkg: {
    get Name() { return 'defmodems'; },
    get URL()  { return 'https://openwrt.org/packages/pkgdata/' + this.Name + '/'; },
    get pkgMgrURINew() { return 'admin/system/package-manager'; },
    get pkgMgrURIOld() { return 'admin/system/opkg'; },

    bestPkgMgrURI: function () {
      return L.resolveDefault(
        fs.stat('/www/luci-static/resources/view/system/package-manager.js'), null
      ).then(function (st) {
        if (st && st.type === 'file')
          return 'admin/system/package-manager';
        return L.resolveDefault(fs.stat('/usr/libexec/package-manager-call'), null)
          .then(function (st2) {
            return st2 ? 'admin/system/package-manager' : 'admin/system/opkg';
          });
      }).catch(function () { return 'admin/system/opkg'; });
    },

    openInstallerSearch: function (query) {
      let self = this;
      return self.bestPkgMgrURI().then(function (uri) {
        let q = query ? ('?query=' + encodeURIComponent(query)) : '';
        window.open(L.url(uri) + q, '_blank', 'noopener');
      });
    }
  },

  fileModemDialog: baseclass.extend({
    __init__: function (file, title, description, callback, fileExists) {
      if (fileExists === undefined) fileExists = false;
      this.file = file;
      this.title = title;
      this.description = description;
      this.callback = callback;
      this.fileExists = fileExists;
    },

    load: function () {
      return L.resolveDefault(fs.read(this.file), '');
    },

    handleSave: function () {
      let textarea = document.getElementById('widget.modal_content');
      let value = textarea.value.trim().replace(/\r\n/g, '\n') + '\n';

      return fs.write(this.file, value)
        .then(function (rc) {
          textarea.value = value;
          return rc;
        })
        .catch(function (e) {
          ui.addNotification(
            null,
            E('p', _('Unable to save the contents') + ': %s'.format(e.message))
          );
        })
        .finally(function () {
          ui.hideModal();
        });
    },

    error: function (e) {
      if (!this.fileExists && e instanceof Error && e.name === 'NotFoundError') {
        return this.render();
      } else {
        ui.showModal(
          this.title,
          [
            E('p', {}, _('Unable to read the contents') + ': %s'.format(e.message)),
            E('div', { 'class': 'right' }, [
              E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
            ])
          ],
          'cbi-modal'
        );
      }
    },

    show: function () {
      let self = this;
      ui.showModal(null, E('p', { 'class': 'spinning' }, _('Loading')));
      this.load()
        .then(function (content) {
          ui.hideModal();
          return self.render(content);
        })
        .catch(function (e) {
          ui.hideModal();
          return self.error(e);
        });
    },

    render: function (content) {
      ui.showModal(
        this.title,
        [
          E('p', this.description),
          E('textarea', {
            'id': 'widget.modal_content',
            'class': 'cbi-input-textarea',
            'style': 'width:100% !important; height: 60vh; min-height: 500px;',
            'wrap': 'off',
            'readonly': 'true',
            'spellcheck': 'false'
          }, content.trim()),
          E('div', { 'class': 'right' }, [
            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
          ])
        ],
        'cbi-modal'
      );
    }
  }),

packageDialog: baseclass.extend({
    __init__: function (installedList, pkgHelper) {
      this.installed = Array.isArray(installedList) ? installedList : [];
      this.pkgHelper = pkgHelper;

      this.sections = {
        serial: [
          { name: 'sms-tool', label: 'sms-tool' },
          { name: 'kmod-usb-serial', label: 'kmod-usb-serial' },
          { name: 'kmod-usb-serial-option', label: 'kmod-usb-serial-option' }
        ],
        ecm: [
          { name: 'wget-ssl', label: 'wget-ssl' }
        ],
        uqmi: [
          { name: 'uqmi', label: 'uqmi' },
          { name: 'kmod-usb-net-qmi-wwan', label: 'kmod-usb-net-qmi-wwan' },
          { name: 'kmod-usb-net-cdc-mbim', label: 'kmod-usb-net-cdc-mbim' }
        ],
        ModemManager: [
          { name: 'modemmanager', label: 'modemmanager' }
        ]
      };
    },

    _isInstalled: function (name) {
      let list = this.installed || [];
      return list.find(function (s) { return s && s.indexOf(name) !== -1; }) ? true : false;
    },

    _row: function (pkgName, installed) {
      let title = E('label', { 'class': 'cbi-value-title' }, pkgName);
      let btn = installed
        ? E('button', { 'class': 'edit btn', 'disabled': true }, _('Installed'))
        : E('button', {
            'class': 'btn cbi-button-positive',
            'click': (function (name, ctx) { return function () { ctx.pkgHelper.openInstallerSearch(name); }; })(pkgName, this)
          }, _('Install…'));

      let field = E('div', { 'class': 'cbi-value-field' }, [ btn ]);
      return E('div', { 'class': 'cbi-value' }, [ title, field ]);
    },

    _sectionHeader: function (text) {
      return E('div', {}, [ E('h4', {}, text) ]);
    },

    show: function () {
      ui.showModal(_('Required packages'), [
        E('p', { 'class': 'spinning' }, _('Loading package data…'))
      ]);

      let self = this;
      let loadInstalled = Promise.resolve().then(function () {
        if (self.installed && self.installed.length)
          return self.installed;
        if (typeof checkPackages === 'function')
          return checkPackages().then(function (list) { self.installed = list || []; return self.installed; });
        return [];
      });

      loadInstalled.then(function () {
        let sectionOrder = ['serial', 'ecm', 'uqmi', 'ModemManager'];
        let node = [];

        node.push(E('p', {}, _('Please select method for reading data from the modem and install the necessary packages.')));

        for (let si = 0; si < sectionOrder.length; si++) {
          let key = sectionOrder[si];
          let pkgs = self.sections[key];
          if (!pkgs || pkgs.length === 0) continue;

          node.push(self._sectionHeader(_(key)));

          for (let i = 0; i < pkgs.length; i++) {
            let p = pkgs[i];
            let installed = self._isInstalled(p.name);
            node.push(self._row(p.label, installed));
          }
        }

        let footer = E('div', { 'class': 'right' }, [
          E('div', { 'class': 'btn cbi-button-neutral', 'click': ui.hideModal }, _('Dismiss'))
        ]);

        let body = [
          E('div', {}, node),
          footer
        ];

        ui.showModal(_('Required packages'), body);
      }).catch(function (err) {
        ui.showModal(_('Required packages'), [
          E('p', {}, _('Failed to load package data.')),
          E('pre', {}, (err && err.toString) ? err.toString() : String(err)),
          E('div', { 'class': 'right' }, [
            E('div', { 'class': 'btn cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
          ])
        ]);
      });
    }
  }),

  checkPackages: function() {
      return fs.exec_direct('/usr/bin/opkg', ['list-installed'], 'text')
        .catch(function () {
          return fs.exec_direct('/usr/libexec/opkg-call', ['list-installed'], 'text')
            .catch(function () {
              return fs.exec_direct('/usr/libexec/package-manager-call', ['list-installed'], 'text')
                .catch(function () {
                  return '';
                });
            });
        })
        .then(function (data) {
          data = (data || '').trim();
          return data ? data.split('\n') : [];
        });
  },

  _isPackageInstalled: function(pkgName) {
      return this.checkPackages().then(function(installedPackages) {
        return installedPackages.some(function(pkg) {
          return pkg.includes(pkgName);
        });
      });
  },

  render: function (data) {
    let showModemDialog = new this.fileModemDialog(
      this.modemPath,
      _('Modems found'),
      _("List of found modems. Not all modems may be shown.")
    );

    let installedList = Array.isArray(data[3]) ? data[3] : [];
    let showPackageDialog = new this.packageDialog(installedList, this.pkg);

    // Modemz config info
    let dfmodems = uci.sections('defmodems', 'defmodems');
    if (!dfmodems || dfmodems.length === 0) {
      ui.addNotification(null, E('p', {}, [
        _('Proper Modem Configuration.'),
        E('br'), E('br'),
        E('b', _('User should remember:')),
        E('ul', {}, [
          E('li', _('1. For a specific modem, only one protocol should be set for communication with modem.')),
          E('li', _('2. Only one package can read data from modem (at the same time).')),
          E('li', _('3. Reading data from modem too often may cause it to freeze (MM and uqmi need more time).'))
        ])
      ]), 'info');
    }

    fs.write('/etc/modem/modemlist.json', '');

    let dlines = data[1].trim().split(/\n/).map(function (line) {
      return line.replace(/^<\d+>/, '');
    });
    let devslist = dlines.join('\n');
    let alldevs = devslist.split('\n\n');
    let results = [];

    for (let ai = 0; ai < alldevs.length; ai++) {
      let modem = alldevs[ai];
      let lines = modem.split('\n');
      let vendor = '';
      let pid = '';
      let manufacturer = '';
      let product = '';
      let serialnumber = '';
      let driver = '';
      let bus = '';

      for (let li = 0; li < lines.length; li++) {
        let line = lines[li];
        if (line.indexOf('Driver=hub') !== -1 || line.indexOf('Driver=usb-storage') !== -1 || line.indexOf('Driver=usblp') !== -1) {
          driver = line.split('Driver=')[1].trim();
          break;
        }
        if (line.indexOf('Spd=') !== -1) {
          let mSpd = line.match(/Spd=([^ ]+)/);
          if (mSpd && mSpd[1]) bus = mSpd[1].trim();
        }
        if (line.indexOf('Vendor=') !== -1) {
          let mVen = line.match(/Vendor=([^ ]+)/);
          if (mVen && mVen[1]) vendor = mVen[1].trim();
        }
        if (line.indexOf('ProdID=') !== -1) {
          let mPid = line.match(/ProdID=([^ ]+)/);
          if (mPid && mPid[1]) pid = mPid[1].trim();
        }
        if (line.indexOf('Manufacturer=') !== -1) {
          let mMan = line.match(/Manufacturer=(.*)/);
          if (mMan && mMan[1]) manufacturer = mMan[1].trim();
        }
        if (line.indexOf('Product=') !== -1) {
          let mPro = line.match(/Product=(.*)/);
          if (mPro && mPro[1]) product = mPro[1].trim();
        }
        if (line.indexOf('SerialNumber=') !== -1) {
          let mSn = line.match(/SerialNumber=(.*)/);
          if (mSn && mSn[1]) serialnumber = mSn[1].trim();
        }
      }

      if (driver === '' && (manufacturer !== '' || product !== '')) {
        results.push({
          Manufacturer:  manufacturer,
          Product:       product,
          Vendor:        vendor,
          ProdID:        pid,
          Bus_speed:     bus,
          Serial_Number: serialnumber
        });
      }
    }

    let outputJSON = JSON.stringify(results, null, 2);
    let countm = Object.keys(results).length;

    fs.write('/etc/modem/modemlist.json', outputJSON + '\n');

    let m, s, o;

    m = new form.Map('defmodems', _('Defined modems'),
      _('Interface to define the available modems. The list of modems will make it easier for the user to switch between modems in LuCI.')
    );

    s = m.section(form.TypedSection, 'general', _(''));
    s.anonymous = true;
    s.addremove = false;

    o = s.option(form.Button, '_show_modem_btn', _('Show modems found'),
      _('Currently, only modems connected via USB are searched for.')
    );
    o.onclick = function () { showModemDialog.show(); };
    o.inputtitle = _('Show');
    o.inputstyle = 'edit btn';

    o = s.option(form.Button, '_show_package_btn', _('Check required packages'),
      _('Before configuring the modem, check if all required packages are installed in the system.')
    );
    o.onclick = function () { showPackageDialog.show(); };
    o.inputtitle = _('Check');
    o.inputstyle = 'cbi-button cbi-button-action important';

    s = m.section(form.GridSection, 'defmodems', _('Modem(s)'));
    s.anonymous = true;
    s.addremove = true;
    s.sortable = true;
    s.nodescriptions = true;
    s.addbtntitle = _('Add new modem settings...');

    s.tab('general', _('Modem Settings'));

    o = s.taboption('general', form.Value, 'modem', _('Manufacturer / Product'),
      _("Enter modem name manually if the suggested name is not obvious. \
       <br /><br /><b>Important</b> \
       <br />The modem name is only searched for modems connected via USB.")
    );

    for (let i2 = 0; i2 < countm; i2++) {
      o.value(results[i2].Manufacturer + ' ' + results[i2].Product);
    }
    o.placeholder = _('Please select a modem');
    o.textvalue = getmodem.bind(o);
    o.rmempty = false;

    o = s.taboption('general', form.ListValue, 'modemdata', _('Reading data via'),
      _('Select method for reading data from the modem. <br /> \
        <br />serial port: <br /> \
        Select one of the available ttyUSBX / ttyACMx / wwan0atX / mhi_DUN ports.<br /> \
        <br />ecm: <br /> \
        Enter the IP address 192.168.X.X under which the modem (Huawei) is available.<br /> \
        <br />uqmi: <br /> \
        Select one of the available cdc-wdmX ports.<br /> \
        <br />ModemManager: <br /> \
        Select one of the searched modem identifiers.')
    );

    let have_smstool = installedList.find(function (s) { return s && s.indexOf('sms-tool') !== -1; }) ? true : false;
    let have_serial = installedList.find(function (s) { return s && s.indexOf('kmod-usb-serial') !== -1; }) ? true : false;
    let have_serialoption = installedList.find(function (s) { return s && s.indexOf('kmod-usb-serial-option') !== -1; }) ? true : false;

    let have_ecm = installedList.find(function (s) { return s && s.indexOf('wget-ssl') !== -1; }) ? true : false;

    let have_uqmi = installedList.find(function (s) { return s && s.indexOf('uqmi') !== -1; }) ? true : false;
    let have_uqmiqmi = installedList.find(function (s) { return s && s.indexOf('kmod-usb-net-qmi-wwan') !== -1; }) ? true : false;
    let have_uqmimbim = installedList.find(function (s) { return s && s.indexOf('kmod-usb-net-cdc-mbim') !== -1; }) ? true : false;

    let have_mm = installedList.find(function (s) { return s && s.indexOf('modemmanager') !== -1; }) ? true : false;

    if (have_serial && have_serialoption && have_smstool) {
      o.value('serial', _('serial'));
    }
    if (have_ecm) {
      o.value('ecm', _('ecm'));
    }
    if ((have_uqmi && have_uqmiqmi) || (have_uqmi && have_uqmimbim)) {
      o.value('uqmi', _('uqmi'));
    }
    if (have_mm) {
      o.value('mm', _('modemmanager'));
    }
    o.exclude = s.section;
    o.nocreate = true;
    o.rmempty = false;

    o = s.taboption('general', form.Value, 'comm_port', _('Port / IP / Modem identifier'));
    o.rmempty = false;
    o.textvalue = getmodemdata.bind(o);
    o.modalonly = false;

    o = s.taboption('general', form.Value, 'comm_serial', _('Port for communication'));
    o.depends('modemdata', 'serial');

    data[0].sort(function (a, b) { return a.name > b.name; });
    data[0].forEach(function (dev) {
      if (dev.name.match(/^ttyUSB/) || dev.name.match(/^ttyACM/) || dev.name.match(/^mhi_/) || dev.name.match(/^wwan/)) {
        o.value('/dev/' + dev.name);
      }
    });
    o.placeholder = _('Please select a port');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'forced_plmn_serial', _('Force PLMN'), _('Force reading PLMN from file.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'serial');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'forced_plmn', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Value, 'comm_ecm', _('IP adress'));
    o.depends('modemdata', 'ecm');
    o.placeholder = _('Enter IP adress');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o.validate = function (section_id, value) {
      if (!/^[0-9.]+$/.test(value)) {
        return _('Only numbers and dots are allowed');
      }
      let mIp = value.match(/^192\.168\.(\d{1,3})\.(\d{1,3})$/);
      if (mIp) {
        let p3 = parseInt(mIp[1], 10);
        let p4 = parseInt(mIp[2], 10);
        if (p3 >= 0 && p3 <= 255 && p4 >= 0 && p4 <= 255) {
          return true;
        }
      }
      return _('Enter a valid IP address in the format 192.168.X.X');
    };

    o = s.taboption('general', form.Value, 'comm_uqmi', _('Port for communication'));
    o.depends('modemdata', 'uqmi');

    data[0].sort(function (a, b) { return a.name > b.name; });
    data[0].forEach(function (dev) {
      if (dev.name.match(/^cdc-wdm/)) {
        o.value('/dev/' + dev.name);
      }
    });
    o.placeholder = _('Please select a QMI/MBIM port');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'forced_plmn_uqmi', _('Force PLMN'), _('Force reading PLMN from file.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'uqmi');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'forced_plmn', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'onproxy', _('MBIM device'), _('Select if you want to read from MBIM.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'uqmi');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'onproxy', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Value, 'comm_mm', _('Modem id'));
    o.depends('modemdata', 'mm');

    data[0].sort(function (a, b) { return a.name > b.name; });
    try {
      let mmData = JSON.parse(data[2]);
      if (mmData['modem-list'] && Array.isArray(mmData['modem-list'])) {
        mmData['modem-list'].forEach(function (modem) {
          o.value(modem, _('modem ') + modem.split('/').pop());
        });
      }
    } catch (e) {
      console.error('MMCLI scan error:', e);
    }

    o.placeholder = _('Please select a modem id');
    o.rmempty = false;
    o.modalonly = true;
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'comm_port', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', form.Flag, 'forced_plmn_mm', _('Force PLMN'), _('Force reading PLMN from file.'));
    o.rmempty = false;
    o.modalonly = true;
    o.depends('modemdata', 'mm');
    o.write = function (section_id, value) {
      uci.set('defmodems', section_id, 'forced_plmn', value);
      return form.Value.prototype.write.apply(this, [section_id, value]);
    };

    o = s.taboption('general', widgets.NetworkSelect, 'network', _('Assigned interface'), _('Interface assigned to modem.'));
    o.rmempty = false;
    o.default = 'wan';

    o = s.taboption('general', form.Value, 'user_desc', _('User description'));
    o.rmempty = true;
    o.modalonly = true;
    o.placeholder = _('Optional');

    o = s.taboption('general', form.Value, 'user_desc', _('User description (optional)'));
    o.rawhtml = true;
    o.remove = function () {};
    o.modalonly = false;
    o.textvalue = usrdesc.bind(o);

    return m.render();
  }
});
