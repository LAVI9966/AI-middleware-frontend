/* eslint-disable */
/**
 * Tracker.js — UTM Attribution SDK
 *
 * Flow:
 *   1. Script loads on gtwy.ai → checks URL for utm_source
 *   2. If utm_source found → generates session_id, stores in cookies with domain=.gtwy.ai
 *      (cookies are accessible on both gtwy.ai and app.gtwy.ai)
 *   3. When identify() called on app.gtwy.ai → reads cookies, logs userDetails to console
 *      (API integration pending)
 *   4. Clears cookies (attribution complete)
 *   5. Next UTM visit → new session_id, cycle repeats
 *
 * Usage:
 *   <script src="/tracker.js"></script>
 *
 *   // Later, when user logs in (on app.gtwy.ai):
 *   Tracker.identify({ userId: "123", email: "user@email.com" })
 */
(function () {
    'use strict';

    var COOKIE_SESSION_ID = '_trk_session_id';
    var COOKIE_REFERRAL_ID = '_trk_referral_id';
    var COOKIE_EXPIRY_DAYS = 30;
    var _cookieDomain = '';

    function uuid() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    function getParam(name) {
        try {
            return new URLSearchParams(window.location.search).get(name);
        } catch (e) {
            return null;
        }
    }

    function setCookie(name, value, days) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + encodeURIComponent(value) + expires +
            '; path=/' +
            (_cookieDomain ? '; domain=' + _cookieDomain : '') +
            '; SameSite=Lax';
    }

    function getCookie(name) {
        var nameEQ = name + '=';
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var c = cookies[i].trim();
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length));
            }
        }
        return null;
    }

    function deleteCookie(name) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC' +
            '; path=/' +
            (_cookieDomain ? '; domain=' + _cookieDomain : '') +
            '; SameSite=Lax';
    }

    function init() {

        var hostname = window.location.hostname;
        if (hostname && hostname !== 'localhost') {
            var parts = hostname.split('.');
            _cookieDomain = parts.length > 2
                ? '.' + parts.slice(-2).join('.')
                : '.' + hostname;
        }

        var existingSession = getCookie(COOKIE_SESSION_ID);

        if (existingSession) {
            return;
        }

        var referralId = getParam('ref');
        if (referralId) {
            var sessionId = uuid();
            setCookie(COOKIE_SESSION_ID, sessionId, COOKIE_EXPIRY_DAYS);
            setCookie(COOKIE_REFERRAL_ID, referralId, COOKIE_EXPIRY_DAYS);
        }
    }

    function identify(params) {
        if (!params || !params.customer_id) {
            console.warn('[Tracker] identify() requires at least a customer_id.');
            return;
        }

        var sessionId = getCookie(COOKIE_SESSION_ID);
        var referralId = getCookie(COOKIE_REFERRAL_ID);
        if (!sessionId) {
            return;
        }

        var payload = {
            customer_id: String(params.customer_id),
            email: params.email || null,
            full_name: params.fullName || null,
            status: params.status || 'active',
            referral_id: referralId
        };
     if(sessionId && referralId){
      fetch('https://apireftest.hostnsoft.com/api/v1/webhooks/customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) {
                if (!res.ok) throw new Error('API responded with ' + res.status);
                deleteCookie(COOKIE_SESSION_ID);
                deleteCookie(COOKIE_REFERRAL_ID);
                return res.json();
            })
            .catch(function (err) {
                console.error('[Tracker] identify() API call failed:', err.message);
            });
        }
     }

    window.Tracker = {
        identify: identify,
        _getSessionId: function () { return getCookie(COOKIE_SESSION_ID); },
        _getReferralId: function () { return getCookie(COOKIE_REFERRAL_ID); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
