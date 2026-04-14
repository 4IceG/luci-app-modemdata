'use strict';
'require baseclass';
'require form';
'require fs';
'require view';
'require uci';
'require ui';
'require tools.widgets as widgets';

/*

  Copyright 2025-2026 Rafał Wabik - IceG - From eko.one.pl forum

  MIT License
  
*/

let pkg = {
    get Name() { return 'modemdata'; },
    get URL()  { return 'https://openwrt.org/packages/pkgdata/' + pkg.Name + '/'; },

    // Package Manager
    get pkgMgrURINew() { return 'admin/system/package-manager'; },
    // opkg
    get pkgMgrURIOld() { return 'admin/system/opkg'; },

    get modemdefURI() { return 'admin/modem/modemdata/modemdefine'; },

    bestPkgMgrURI: function () {
        return L.resolveDefault(
            fs.stat('/www/luci-static/resources/view/system/package-manager.js'), null
        ).then(st => {
            if (st && st.type === 'file')
                return pkg.pkgMgrURINew;

            return L.resolveDefault(fs.stat('/usr/libexec/package-manager-call'), null)
                .then(st2 => (st2 ? pkg.pkgMgrURINew : pkg.pkgMgrURIOld));
        }).catch(() => pkg.pkgMgrURIOld);
    },

    openInstallerSearch: function (query) {
        return pkg.bestPkgMgrURI().then(uri => {
            let q = query ? ('?query=' + encodeURIComponent(query)) : '';
            window.open(L.url(uri) + q, '_blank', 'noopener');
        });
    }
};

return view.extend({

    option_install_curl: function () {
        return pkg.openInstallerSearch('curl');
    },

    checkPackages: function () {
        return fs.exec_direct('/usr/bin/opkg', ['list-installed'], 'text')
            .catch(function () {
                return fs.exec_direct('/usr/libexec/opkg-call', ['list-installed'], 'text')
                    .catch(function () {
                        return fs.exec_direct('/usr/libexec/package-manager-call', ['list-installed'], 'text')
                            .catch(function () { return ''; });
                    });
            })
            .then(function (data) {
                data = (data || '').trim();
                return data ? data.split('\n') : [];
            });
    },

    load: function () {
        return Promise.all([
            this.checkPackages()
        ]);
    },

    render: function (data) {
        let installedList = Array.isArray(data[0]) ? data[0] : [];
        let curlInstalled = installedList.some(function (s) { return s && s.indexOf('curl') !== -1; });
        let m, s, o;

        m = new form.Map('modemdata', _('Configuration'),
            _('Configuration panel for modemdata and gui application.')
        );

        s = m.section(form.TypedSection, 'modemdata', '', null);
        s.anonymous = true;

        o = s.option(form.ListValue, 'updtime', _('Refresh rate'),
            _('Set how often the data should be refreshed in the Modem(s) tab. \
               <br /><br /><b>Important</b> \
               <br />Not every modem / protocol can communicate quickly with scripts. Too high a polling rate can freeze the modem. \
               <br />ModemManager and uqmi need more time to respond.')
        );
        o.value('-1', _('Disabled'));
        o.value('5',  _('5 seconds'));
        o.value('10', _('10 seconds'));
        o.value('30', _('30 seconds'));
        o.value('45', _('45 seconds'));
        o.default = '5';
        o.rmempty = false;

        o = s.option(form.DynamicList, 'hide_data', _('Add data to hide'),
            _('Enter the data you would like to hide, e.g. <code>IMEI, IMSI</code>.')
        );
        o.rmempty = true;

        s = m.section(form.TypedSection, 'modemdata', null);
        s.anonymous = true;
        s.addremove = false;

        s.tab('bts1', _('BTS search settings'));
        s.anonymous = true;

        o = s.taboption('bts1', form.DummyValue, '_dummy');
        o.rawhtml = true;
        o.default =
            '<div class="cbi-section-descr">' +
            _('Note: The package is fully compatible with the latest, third-generation version of the BTSearch website.') +
/* ---  Downloading data using curl       
            ' ' +
            _('To download data (via the API), you must have the curl package installed (to do this click on the button added below).') +
*/
            '</div>';

        o = s.taboption('bts1', form.ListValue, 'website',
            _('Website to search for BTS'),
            _('Select a website for searching.')
        );
        o.value('www.btsearch.pl', _('btsearch.pl'));
        o.value('lteitaly.it',     _('lteitaly.it'));
        o.default = 'www.btsearch.pl';
        o.modalonly = true;

        o = s.taboption('bts1', form.ListValue, 'btsaction', _('Action'),
            _('Select an action after clicking the search button.')
        );
        o.value('open', _('Open page'));
        o.default = 'open';
        o.modalonly = true;
        o.depends('website', 'www.btsearch.pl');
        o.value('download', _('Download data'));

/* ---  Downloading data using curl

        if (curlInstalled) {
            o.value('download', _('Download data'));
        }

        let sCurl = m.section(form.NamedSection, 'kmods', 'kmods', _());
        sCurl.render = L.bind(function (view) {
            return form.NamedSection.prototype.render.apply(this, this.varargs(arguments, 1))
                .then(L.bind(function (node) {
                    let btn = curlInstalled
                        ? E('button', { 'class': 'edit btn', 'disabled': true }, _('Installed'))
                        : E('button', {
                            'class': 'btn cbi-button-action',
                            'click': ui.createHandlerFn(view, 'option_install_curl', this.map),
                            'title': _('Install a package using package manager')
                          }, [_('Install…')]);

                    node.appendChild(E('div', { 'class': 'cbi-value' }, [
                        E('label', { 'class': 'cbi-value-title' }, _('Install curl')),
                        E('div', { 'class': 'cbi-value-field', 'style': 'width:25vw' },
                            E('div', { 'class': 'cbi-section-node' }, [ btn ])
                        )
                    ]));
                    node.appendChild(E('br'));
                    node.appendChild(E('br'));
                    return node;
                }, this));
        }, sCurl, this);
        
*/

        return m.render();
    }
});
