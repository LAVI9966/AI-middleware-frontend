/* eslint-disable */
(function () {
  const REGISTER_URL = 'https://apireftest.hostnsoft.com/api/v1/embed/affiliates/register';
  const BALANCE_URL = 'https://apireftest.hostnsoft.com/api/v1/embed/balance';

  function getScriptAttrs() {
    const script =
      document.currentScript ||
      document.querySelector('script[src*="affiliate-embed"]');
    return {
      email: script ? (script.getAttribute('email') || '') : '',
      embed_token: script ? (script.getAttribute('token') || '') : '',
      target: script ? (script.getAttribute('target') || '') : '',
      url: script ? (script.getAttribute('URL') || script.getAttribute('url') || '') : '',
      full_name: script ? (script.getAttribute('full_name') || '') : '',
      password: script ? (script.getAttribute('password') || '') : '',
      currency_code: script ? (script.getAttribute('currency_code') || '') : '',
      commission_group_id: script ? (script.getAttribute('commission_group_id') || '') : '',
    };
  }

  function _getScriptBaseUrl() {
    const script =
      document.currentScript ||
      document.querySelector('script[src*="affiliate-embed"]');
    if (!script) return '';
    return script.src.replace(/affiliate-embed\.js.*$/, '');
  }

  const CSS_URL = _getScriptBaseUrl() + 'affiliate-embed.css';
  const HTML_URL = _getScriptBaseUrl() + 'affiliate-embed.html';

  class AffiliateWidget extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: 'open' });
      this._attrs = { email: '', token: '' };
    }

    async connectedCallback() {
      this._attrs = getScriptAttrs();

      const [cssText, htmlText] = await Promise.all([
        fetch(CSS_URL).then(r => r.text()).catch(e => { console.warn('[affiliate-embed] Could not load CSS:', e); return ''; }),
        fetch(HTML_URL).then(r => r.text()).catch(e => { console.warn('[affiliate-embed] Could not load HTML:', e); return ''; }),
      ]);

      const style = document.createElement('style');
      style.textContent = cssText;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:100%;height:100%;';
      wrapper.innerHTML = htmlText;

      this._shadow.appendChild(style);
      this._shadow.appendChild(wrapper);

      this._initFlow();
    }

    _q(selector) {
      return this._shadow.querySelector(selector);
    }

    _showPanel(id) {
      this._shadow.querySelectorAll('.af-panel').forEach(p => p.classList.remove('active'));
      this._q(`#af-panel-${id}`).classList.add('active');
    }

    _embedToken() {
      return this._attrs.embed_token || '';
    }

    async _fetchBalance(email) {
      const res = await fetch(`${BALANCE_URL}?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'X-Embed-Token': this._embedToken() },
      });
      return { res, json: await res.json() };
    }

    async _initFlow() {
      const email = this._attrs.email;

      if (!email) {
        this._showPanel('loading');
        return;
      }

      this._showPanel('loading');
      await this._autoRegister(email);
    }

    async _autoRegister(email) {
      const a = this._attrs;
      const data = {
        full_name: a.full_name || email.split('@')[0],
        email,
        password: a.password || '',
        currency_code: (a.currency_code || 'USD').toUpperCase(),
        commission_group_id: parseInt(a.commission_group_id, 10) || 1,
      };

      try {
        const res = await fetch(REGISTER_URL, {
          method: 'POST',
          headers: {
            'X-Embed-Token': this._embedToken(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        const json = await res.json();

        if (res.ok) {
          await this._loadBalanceAndShow(email);
        } else if (json.detail && json.detail.toLowerCase().includes('already exists')) {
          await this._loadBalanceAndShow(email);
        } else {
          console.warn('[affiliate-embed] Auto-register error:', json);
          const msg =
            json.message || json.error || json.detail ||
            (json.errors && (Array.isArray(json.errors) ? json.errors.map(e => e.message || e.msg || e).join(', ') : json.errors)) ||
            json.msg || `Registration failed (${res.status}).`;
          this._showPanel('balance');
          const alert = this._q('#af-balance-alert');
          if (alert) { alert.className = 'af-alert error-alert'; alert.textContent = msg; }
        }
      } catch (_) {
        this._showPanel('balance');
      }
    }

    async _loadBalanceAndShow(email) {
      this._showPanel('loading');
      try {
        const { res, json } = await this._fetchBalance(email);
        const payload = res.ok ? (json.data || json) : {};
        this._renderBalance({ ...payload, email });
      } catch (_) {
        this._renderBalance({ email });
      }
      this._showPanel('balance');
    }

    _renderBalance(data) {
      const email = data.email || this._attrs.email || '';
      const name = data.full_name || data.name || '';
      const initial = (name || email).charAt(0).toUpperCase();
      const currency = data.currency_code || data.currency || 'USD';
      const org = data.organization || '';
      const referralCode = data.referral_code || '';
      const baseUrl = this._attrs.url ;
      const referralUrl = referralCode
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}ref=${referralCode}`
        : '';

      this._q('#af-user-info').innerHTML = `
        <div class="af-profile-card">
          <div class="af-avatar">${initial}</div>
          <div>
            ${name ? `<div class="af-profile-name">${name}</div>` : ''}
            <div class="af-profile-email">${email}</div>
            ${org ? `<div class="af-profile-org">🏢 ${org}</div>` : ''}
          </div>
        </div>
      `;

      // ── Referral URL section ──
      const refSection = this._q('#af-referral-section');
      if (refSection) {
        if (referralUrl) {
          refSection.innerHTML = `
            <div class="af-referral-card">
              <div class="af-referral-card-title">🔗 Your Personal Referral Link</div>
              <div class="af-referral-card-desc">Share this link with anyone. When they sign up, your commission is added automatically.</div>
              <div class="af-referral-url-row">
                <div class="af-referral-url-text" id="af-ref-url-text">${referralUrl}</div>
                <button class="af-copy-btn" id="af-copy-btn">Copy Link</button>
              </div>
            </div>
          `;
          const copyBtn = this._q('#af-copy-btn');
          if (copyBtn) {
            copyBtn.addEventListener('click', () => {
              navigator.clipboard.writeText(referralUrl).then(() => {
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                  copyBtn.textContent = 'Copy';
                  copyBtn.classList.remove('copied');
                }, 2000);
              }).catch(() => {
                const el = this._q('#af-ref-url-text');
                if (el) {
                  const range = document.createRange();
                  range.selectNodeContents(el);
                  const sel = this._shadow.getSelection ? this._shadow.getSelection() : window.getSelection();
                  if (sel) { sel.removeAllRanges(); sel.addRange(range); }
                }
              });
            });
          }
        } else {
          refSection.innerHTML = '';
        }
      }

      // ── Balance grid ──
      const fmt = (val) => (val !== undefined && val !== null && val !== '') ? `${currency} ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${currency} 0.00`;

      this._q('#af-balance-grid').innerHTML = [
        { label: 'Awaiting Payout', desc: 'Earned but not yet paid out', value: fmt(data.pending_balance) },
        { label: 'Total Earned', desc: 'All-time commissions earned', value: fmt(data.total_commissions_earned), highlight: true },
        { label: 'Total Paid Out', desc: 'Already transferred to you', value: fmt(data.total_paid_out) },
      ].map(item => `
        <div class="af-balance-item${item.highlight ? ' highlight' : ''}">
          <div class="af-bitem-label" title="${item.desc}">${item.label}</div>
          <div class="af-bitem-value">${item.value}</div>
        </div>
      `).join('');
    }
  }

  if (!customElements.get('affiliate-widget')) {
  customElements.define('affiliate-widget', AffiliateWidget);
  }

  function mount(retries) {
    const attrs = getScriptAttrs();
    const targetId = attrs.target;
    if (!targetId) {
      console.error('[affiliate-embed] No target attribute specified. Widget not mounted.');
      return;
    }
    const root = document.getElementById(targetId);
    if (!root) {
      if (retries > 0) {
        setTimeout(() => mount(retries - 1), 50);
      } else {
      console.error(`[affiliate-embed] No element found with id="${targetId}". Widget not mounted.`);
      }
      return;
    }
    root.innerHTML = '';
    const widget = document.createElement('affiliate-widget');
    widget.style.cssText = 'display:block;width:100%;height:100%;';
    root.appendChild(widget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount(20));
  } else {
    mount(20);
  }
})();
