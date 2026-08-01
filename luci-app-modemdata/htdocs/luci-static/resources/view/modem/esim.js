'use strict';
'require view';
'require rpc';
'require ui';

/*
	eSIM / SIM slot management.

	Everything goes through the `esim` ubus object (/usr/libexec/rpcd/esim),
	not fs.exec. The `file` object can only grant "may exec this binary", not
	which arguments are allowed, so exposing the helpers that way would let a
	read-only session run `md_esim delete <ICCID> -y`. Going through rpcd lets
	the ACL name individual methods, and gives the plugin somewhere to cache
	reads - each status/list call opens a logical channel on the card, and the
	card has only five.

	Behind the plugin:
	  md_esim  shell - slot switching and local ES10 operations
	  md_lpa   Go binary - ES9+ profile download, which needs TLS and ECDSA
	           and so cannot be done in shell. Optional; `capabilities`
	           reports whether it is installed.
*/

function declare(method, params) {
	return rpc.declare({ object: 'esim', method: method, params: params });
}

var api = {
	status: declare('status'),
	list: declare('list'),
	capabilities: declare('capabilities'),
	device: declare('device'),
	switch: declare('switch', ['slot']),
	enable: declare('enable', ['iccid']),
	disable: declare('disable', ['iccid']),
	'delete': declare('delete', ['iccid']),
	download: declare('download', ['code', 'confirmation_code']),
	downloadStatus: declare('download_status'),
	reset: declare('reset')
};

// The plugin reports faults in-band so that a card error is not indistinguishable
// from a broken ubus call.
function unwrap(data) {
	if (data && data.error)
		return Promise.reject(new Error(data.error));
	if (data == null)
		return Promise.reject(new Error(_('no response')));
	return data;
}

function badge(text, kind) {
	var colors = {
		on:   { bg: '#e6f4ea', fg: '#137333', bd: '#137333' },
		off:  { bg: '#f1f3f4', fg: '#5f6368', bd: '#9aa0a6' },
		warn: { bg: '#fef7e0', fg: '#b06000', bd: '#b06000' }
	};
	var c = colors[kind] || colors.off;
	return E('span', {
		'style': 'display:inline-block;padding:1px 8px;border-radius:10px;font-size:90%;' +
			'background:' + c.bg + ';color:' + c.fg + ';border:1px solid ' + c.bd
	}, text);
}

return view.extend({
	status: null,
	profiles: [],
	hasLPA: false,
	device: '',

	load: function () {
		return Promise.all([
			api.capabilities().then(function (c) {
				return !!(c && c.download);
			}).catch(function () { return false; }),
			api.device().then(function (d) {
				return (d && d.device) || '';
			}).catch(function () { return ''; })
		]);
	},

	refresh: function () {
		var self = this;
		return api.status().then(unwrap).then(function (st) {
			self.status = st;
			if (!st.euicc) { self.profiles = []; return null; }
			return api.list().then(unwrap).then(function (r) { self.profiles = r.profiles || []; })
				.catch(function () { self.profiles = []; });
		}).catch(function (e) {
			self.status = { error: e.message };
			self.profiles = [];
		}).then(function () { self.render_body(); });
	},

	busy: function (title, promise) {
		var self = this;
		ui.showModal(title, [
			E('p', { 'class': 'spinning' }, _('This can take up to a minute. Do not reload the page.'))
		]);
		return promise.then(function (r) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Done.')), 'info');
			return self.refresh().then(function () { return r; });
		}).catch(function (e) {
			ui.hideModal();
			ui.addNotification(null, E('p', e.message), 'error');
			return self.refresh();
		});
	},

	confirm: function (title, body, onOK) {
		ui.showModal(title, [
			E('div', {}, body),
			E('div', { 'class': 'right', 'style': 'margin-top:1em' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': function () { ui.hideModal(); onOK(); }
				}, _('Continue'))
			])
		]);
	},

	switchSlot: function (target) {
		var self = this;
		// E() sets textContent, so markup passed as a string would be shown
		// literally - build emphasis as real nodes instead.
		this.confirm(_('Switch SIM'), [
			E('p', {}, [
				_('Switch to') + ' ',
				E('strong', {}, _('SIM %s').format(target)),
				'?'
			]),
			E('p', {}, _('The modem is reset, so the connection drops for about half a minute.'))
		], function () {
			self.busy(_('Switching SIM…'), api.switch(target).then(unwrap));
		});
	},

	profileOp: function (op, p) {
		var self = this;
		var name = p.nickname || p.name || p.iccid;
		var go = function () {
			self.busy(_('Working…'), api[op](p.iccid).then(unwrap));
		};
		if (op != 'delete') return go();

		this.confirm(_('Delete profile'), [
			E('p', {}, [_('Permanently delete') + ' ', E('strong', {}, name), '?']),
			E('p', {}, _('This cannot be undone. The profile can only be restored if the operator issues a new activation code.'))
		], go);
	},

	install: function () {
		var self = this;
		var code = document.getElementById('ac').value.trim();
		var cc = document.getElementById('cc').value.trim();
		if (!code)
			return ui.addNotification(null, E('p', _('Enter an activation code first.')), 'error');

		// The download outlives LuCI's 20s RPC timeout, so the call only
		// starts it and the result is collected by polling.
		this.busy(_('Downloading profile…'),
			api.download(code, cc).then(unwrap).then(function () {
				return self.awaitDownload();
			}).then(function (r) {
				document.getElementById('ac').value = '';
				document.getElementById('cc').value = '';
				return r;
			}));
	},

	awaitDownload: function () {
		var deadline = Date.now() + 300000;

		function poll() {
			return api.downloadStatus().then(function (s) {
				if (s && s.error)
					return Promise.reject(new Error(s.error));
				if (s && s.result)
					return s;
				if (!s || s.running !== true)
					return Promise.reject(new Error(_('The download stopped without reporting a result.')));
				if (Date.now() > deadline)
					return Promise.reject(new Error(_('The download is taking too long; giving up watching it.')));
				return new Promise(function (resolve) { window.setTimeout(resolve, 2000); }).then(poll);
			});
		}
		return poll();
	},

	resetModem: function () {
		var self = this;
		this.confirm(_('Reset modem'), [
			E('p', {}, _('Power-cycle the modem to unstick the card.')),
			E('p', {}, _('Use this if the card reports errors, or if the EID is readable but the profile list is not. The modem is unavailable for about 40 seconds.'))
		], function () {
			self.busy(_('Resetting modem…'), api.reset().then(unwrap));
		});
	},

	render_body: function () {
		var node = document.getElementById('esim-body');
		if (!node) return;
		while (node.firstChild) node.removeChild(node.firstChild);
		node.appendChild(this.render_content());
	},

	render_slot: function () {
		var st = this.status || {};
		var active = parseInt(st.slot, 10);
		var count = parseInt(st.slots, 10) || 2;
		var self = this;

		// The modem calls its two slots "uSIM" and "eSIM", but that naming
		// describes the slot, not the card: a slot may hold a removable eUICC
		// and both slots may hold ordinary cards. So identify slots by number
		// and let the probe decide whether the active card is an eSIM.
		var buttons = [];
		for (var i = 1; i <= count; i++) {
			buttons.push(E('button', {
				'class': 'btn cbi-button-action',
				'disabled': (i == active) ? 'disabled' : null,
				'click': ui.createHandlerFn(self, 'switchSlot', i)
			}, _('Switch to SIM %s').format(i)), ' ');
		}

		var activeLabel = active
			? _('SIM %s').format(active) + (st.at_name ? ' (' + st.at_name + ')' : '')
			: '-';

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('SIM slots')),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'width': '30%' }, _('Active slot')),
					E('td', { 'class': 'td left' }, badge(activeLabel, 'on'))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('Card in this slot')),
					E('td', { 'class': 'td left' }, st.euicc
						? badge(_('eSIM (eUICC) - profiles can be managed'), 'on')
						: badge(_('Ordinary SIM - no profiles to manage'), 'off'))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('ICCID')),
					E('td', { 'class': 'td left' }, st.iccid || '-')
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('IMSI')),
					E('td', { 'class': 'td left' }, st.imsi || '-')
				])
			]),
			E('div', { 'style': 'margin-top:.5em' }, buttons),
			E('p', { 'style': 'margin-top:.5em;opacity:.75;font-size:90%' },
				_('Only one slot is active at a time. The names in brackets are the modem\'s own labels for its slots and do not say what is actually in them - whether a card is an eSIM is detected from the card itself.'))
		]);
	},

	render_profiles: function () {
		var self = this;
		var rows = [E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Profile')),
			E('th', { 'class': 'th' }, _('Provider')),
			E('th', { 'class': 'th' }, _('ICCID')),
			E('th', { 'class': 'th' }, _('State')),
			E('th', { 'class': 'th right' }, _('Actions'))
		])];

		if (!this.profiles.length) {
			rows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '5' }, _('No profiles on this eSIM.'))
			]));
		}

		this.profiles.forEach(function (p) {
			var on = (p.state == 'enabled');
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, p.nickname || p.name || '-'),
				E('td', { 'class': 'td left' }, p.provider || '-'),
				E('td', { 'class': 'td left' }, p.iccid),
				E('td', { 'class': 'td left' }, on ? badge(_('enabled'), 'on') : badge(_('disabled'), 'off')),
				E('td', { 'class': 'td right' }, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': ui.createHandlerFn(self, 'profileOp', on ? 'disable' : 'enable', p)
					}, on ? _('Disable') : _('Enable')),
					' ',
					E('button', {
						'class': 'btn cbi-button-negative',
						'click': ui.createHandlerFn(self, 'profileOp', 'delete', p)
					}, _('Delete'))
				])
			]));
		});

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Profiles')),
			E('table', { 'class': 'table' }, rows)
		]);
	},

	render_install: function () {
		if (!this.hasLPA) {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Install profile')),
				E('p', { 'class': 'alert-message warning' },
					_('md_lpa is not installed. Downloading a profile needs TLS and ECDSA, which the shell helper cannot do.'))
			]);
		}
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Install profile')),
			E('p', {}, _('Paste the activation code from the operator, or the contents of their QR code.')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Activation code')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', {
						'id': 'ac', 'type': 'text', 'class': 'cbi-input-text',
						'style': 'width:100%;max-width:38em',
						'placeholder': 'LPA:1$rsp.example.com$MATCHING-ID'
					})
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Confirmation code')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', {
						'id': 'cc', 'type': 'text', 'class': 'cbi-input-text',
						'style': 'width:100%;max-width:20em',
						'placeholder': _('only if the operator requires one')
					})
				])
			]),
			E('div', {}, [
				E('button', {
					'class': 'btn cbi-button-apply',
					'click': ui.createHandlerFn(this, 'install')
				}, _('Install'))
			])
		]);
	},

	render_content: function () {
		var st = this.status || {};
		if (st.error) {
			return E('div', {}, [
				E('p', { 'class': 'alert-message error' },
					_('Cannot talk to the modem: %s').format(st.error)),
				this.device
					? E('p', {}, [
						_('Check that socat is installed and that this AT port exists:') + ' ',
						E('code', {}, this.device)
					])
					: E('p', {}, _('The AT port in use could not be determined. Check that md_esim is installed and that rpcd was restarted after the ACL was added.'))
			]);
		}

		var body = [this.render_slot()];
		if (st.euicc) {
			body.push(this.render_profiles());
			body.push(this.render_install());
		} else {
			body.push(E('div', { 'class': 'cbi-section' }, [
				E('p', { 'class': 'alert-message warning' },
					_('The card in the active slot is an ordinary SIM, so there are no profiles to manage. If another slot holds an eSIM, switch to it above.'))
			]));
		}
		body.push(E('div', {}, [
			E('button', {
				'class': 'btn cbi-button-neutral',
				'click': ui.createHandlerFn(this, 'refresh')
			}, _('Refresh')),
			' ',
			E('button', {
				'class': 'btn cbi-button-reset',
				'click': ui.createHandlerFn(this, 'resetModem')
			}, _('Reset modem'))
		]));
		return E('div', {}, body);
	},

	render: function (data) {
		var self = this;
		this.hasLPA = data[0];
		this.device = data[1];
		var container = E('div', {}, [
			E('h2', {}, _('SIM(s) Configurations')),
			E('div', { 'id': 'esim-body' }, E('p', { 'class': 'spinning' }, _('Reading the card…')))
		]);
		// Kick the first read off after the view is mounted, so the spinner shows.
		window.setTimeout(function () { self.refresh(); }, 0);
		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
