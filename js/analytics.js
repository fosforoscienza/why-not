// js/analytics.js — snippet di tracciamento privacy-first
// Nessun cookie, nessun IP. Session ID anonimo in sessionStorage.

(function () {
  'use strict';

  // Non tracciare in locale o su Vercel preview
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app') === false && host !== 'why-not-ochre.vercel.app') {
    // Traccia solo sul dominio di produzione (e preview Vercel per test)
    // Rimuovi questo blocco se usi un dominio custom
  }

  // Session ID anonimo — si azzera alla chiusura della tab
  function getSessionId() {
    let id = sessionStorage.getItem('_wn_sid');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('_wn_sid', id);
    }
    return id;
  }

  function track() {
    const payload = {
      page:      window.location.pathname,
      referrer:  document.referrer || '',
      sessionId: getSessionId(),
    };

    // Usa sendBeacon se disponibile (non blocca la navigazione)
    const body = JSON.stringify(payload);
    const url  = '/api/track';

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  // Avvia al caricamento della pagina
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', track);
  } else {
    track();
  }

  // SPA / soft navigation (per eventuali future integrazioni)
  window.__wnTrack = track;
})();
