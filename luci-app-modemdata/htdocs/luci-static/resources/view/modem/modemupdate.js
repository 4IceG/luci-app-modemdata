'use strict';
'require form';
'require fs';
'require view';
'require ui';
'require uci';
'require dom';
'require tools.widgets as widgets';

/*

  Copyright 2025-2026 Rafał Wabik - IceG - From eko.one.pl forum
  
  MIT License
  
*/

function handleOpen(ev) {
	if (ev === 'ropenissues')      { window.open('https://github.com/4IceG/luci-app-modemdata/issues'); return; }
	if (ev === 'copenissues')      { window.open('https://github.com/obsy/modemdata/issues'); return; }
	if (ev === 'opendiscussion')   { window.open('https://github.com/4IceG/luci-app-modemdata/discussions'); return; }
	if (ev === 'ropencoffee')      { window.open('https://suppi.pl/rafalwabik'); return; }
	if (ev === 'copencoffee')      { window.open('https://buycoffee.to/eko.one.pl'); return; }
	if (ev === 'opensupport')      { window.open('https://github.com/sponsors/4IceG'); return; }
	if (ev === 'opentopic')        { window.open('https://eko.one.pl/forum/viewtopic.php?id=24829'); return; }
}

return view.extend({
	load: function () {
		return uci.load('modemdata');
	},

	render: function (data) {
		let m, s, o;

		let info = _('In the future tab will allow you to update the package from %sRafał (IceG) external repository%s.')
			.format('<a href="https://github.com/4IceG/Modem-extras-apk" target="_blank">', '</a>');

		m = new form.Map('modemdata', _('Package update and support'), info);

		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function (view, section_id) {
			return E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'ifacebox', 'style': 'display:flex' }, [
			E('strong', _('Info')),
					E('label', {}, _('Option will appear after apk implementation.')),
				]),
				E('br'),
			]);
		}, o, this);

		s = m.section(form.TypedSection);
		s.anonymous = true;

		s.tab('info', _('Modemdata Info'));
		
		let packages = [
			{
				package: _('Modemdata'),
				author: 'Cezary Jackiewicz (obsy)',
				authorLink: 'https://github.com/obsy',
				buttons: [
					{
						class: 'cbi-button-action important',
						label: _('Buy a coffee'),
						tooltip: _('Buy a coffee if you want to support the development of the project and the author'),
						action: 'copencoffee',
						disabled: false
					},
					{
						class: 'cbi-button-remove',
						label: _('Report a bug'),
						tooltip: _('Report a bug on the package Github page'),
						action: 'copenissues',
						disabled: false
					}
				]
			},
			{
				package: _('Luci-app-modemdata'),
				author: 'Rafał Wabik (IceG)',
				authorLink: 'https://github.com/4IceG',
				buttons: [
					{
						class: 'cbi-button-action important',
						label: _('Buy a coffee'),
						tooltip: _('Buy a coffee if you want to support the development of the project and the author'),
						action: 'ropencoffee',
						disabled: false
					},
					{
						class: 'cbi-button-action',
						label: _('Become a sponsor'),
						tooltip: _('Become a sponsor if you want to support the development of the project and the author'),
						action: 'opensupport',
						disabled: false
					},
					{
						class: 'cbi-button-add',
						label: _('Write on forum'),
						tooltip: _('Write in the topic of the package on the forum eko.one.pl'),
						action: 'opentopic',
						disabled: false
					},
					{
						class: 'cbi-button-neutral',
						label: _('Open discussion'),
						tooltip: _('Open a package discussion on Github'),
						action: 'opendiscussion',
						disabled: false
					},
					{
						class: 'cbi-button-remove',
						label: _('Report a bug'),
						tooltip: _('Report a bug on the package Github page'),
						action: 'ropenissues',
						disabled: false
					}
				]
			}
		];

		let rows = [];
		let table = E('table', { 
		    'class': 'table', 
            'style': 'border:1px solid var(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%;'
            }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Package name')),
				E('th', { 'class': 'th' }, _('Author (package maintainer)')),
				E('th', { 'class': 'th nowrap cbi-section-actions' })
			])
		]);

		for (let i = 0; i < packages.length; i++) {
			let pkg = packages[i];
			let buttonElements = [];

			for (let j = 0; j < pkg.buttons.length; j++) {
				let btn = pkg.buttons[j];
				let buttonAttrs = {
					'class': 'btn ' + btn.class,
					'data-tooltip': btn.tooltip
				};
				
				if (btn.disabled) {
					buttonAttrs.disabled = true;
				} else if (btn.action) {
					buttonAttrs.click = function() { return handleOpen(btn.action); };
				}
				
				buttonElements.push(E('button', buttonAttrs, btn.label));
			}

			let authorCell = pkg.author ? 
				E('a', { 'href': pkg.authorLink, 'target': '_blank', 'style': 'color:#37c' }, pkg.author) : 
				'';

			rows.push([
				pkg.package,
				authorCell,
				E('div', { 'style': 'display: flex; flex-wrap: wrap; gap: 0.5em;' }, buttonElements)
			]);
		}

		cbi_update_table(table, rows);

		o = s.taboption('info', form.DummyValue, '_packages_info');
		o.render = function() {
			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, _('Information about package authors and available support options.')),
				table
			]);
		};

		s.tab('troubleshooting', _('Troubleshooting / Hints'));
		
		let troubleshootingData = [
            // 1.
			{
				issue: _('If data in LuCI is not visible, and we are 100% sure that the modem has been defined/configured correctly.'),
				solution: _('Go to the Diagnostics tab and run a script check. Most often, the error is caused by a strange operator name. To fix this, select the Force PLMN from file option if it is available in the modem configuration options.')
			},
            // 2.
            {
                issue: _('Package does not show data for the Fibocom FM350-GL modem.'),
                solution: _('The modem is very sensitive to data read by the communication port. Selecting the wrong communication port may cause the modem to freeze or restart.') + 
                          ' ' + 
                          '<a href="https://github.com/obsy/modemfeed/tree/master/luci/protocols/luci-proto-xmm" target="_blank" rel="noopener noreferrer">luci-proto-xmm</a>' +
                          ' ' + _('and') + ' ' +
                          '<a href="https://github.com/obsy/modemfeed/tree/master/packages/net/xmm-modem" target="_blank" rel="noopener noreferrer">xmm-modem</a>' +
                          ' ' + _('packages are recommended for proper modem support.')
            }
		];

		let troubleshootingRows = [];
		let troubleshootingTable = E('table', { 
			'class': 'table', 
			'style': 'border:1px solid var(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%;'
		}, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'style': 'width:40%' }, _('Problem')),
				E('th', { 'class': 'th' }, _('Suggested solution'))
			])
		]);

		for (let i = 0; i < troubleshootingData.length; i++) {
			let item = troubleshootingData[i];
			troubleshootingRows.push([
				item.issue,
				E('em', {}, item.solution)
			]);
		}

		cbi_update_table(troubleshootingTable, troubleshootingRows);

		o = s.taboption('troubleshooting', form.DummyValue, '_troubleshooting_info');
		o.render = function() {
			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, _('Common problems that may arise when using the package, and ways to solve them.')),
				troubleshootingTable
			]);
		};

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
