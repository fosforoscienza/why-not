/* ================================================
   WHY NOT? — Main JS
   i18n · Scroll animations · Nav · YouTube
   ================================================ */

/* ── i18n ─────────────────────────────────────── */
const I18N = {
  current: 'it',

  init() {
    this.current = localStorage.getItem('whynot-lang') || 'it';
    this.apply();
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.addEventListener('click', () => this.toggle());
    });
  },

  toggle() {
    this.current = this.current === 'it' ? 'en' : 'it';
    localStorage.setItem('whynot-lang', this.current);
    this.apply();
    // Animate the swap
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.15s ease';
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 150);
  },

  t(key) {
    return (T[this.current] && T[this.current][key]) || (T['it'] && T['it'][key]) || key;
  },

  apply() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key);
      if (val && val !== key) el.textContent = val;
    });
    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const val = this.t(el.getAttribute('data-i18n-placeholder'));
      if (val) el.placeholder = val;
    });
    // Aria labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const val = this.t(el.getAttribute('data-i18n-aria'));
      if (val) el.setAttribute('aria-label', val);
    });
    // HTML content
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const val = this.t(el.getAttribute('data-i18n-html'));
      if (val) el.innerHTML = val;
    });
    // Update html lang attr
    document.documentElement.lang = this.current;
    // Update page title suffix
    const titleSuffix = this.current === 'it' ? 'Progetto Giovani' : 'Youth Project';
    document.title = `Why Not? — ${titleSuffix}`;
  }
};

/* ── Navigation ──────────────────────────────── */
const NAV = {
  init() {
    const nav = document.getElementById('nav');
    const burger = document.getElementById('navBurger');
    const mobile = document.getElementById('navMobile');

    // Scroll → frosted glass effect
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }, { passive: true });

    // Burger menu
    if (burger && mobile) {
      burger.addEventListener('click', () => {
        const isOpen = mobile.classList.toggle('open');
        burger.setAttribute('aria-expanded', isOpen);
        // Animate burger to X
        const spans = burger.querySelectorAll('span');
        if (isOpen) {
          spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
          spans[1].style.opacity = '0';
          spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
          spans[0].style.transform = '';
          spans[1].style.opacity = '';
          spans[2].style.transform = '';
        }
      });
      // Close on link click
      mobile.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          mobile.classList.remove('open');
          burger.querySelectorAll('span').forEach(s => {
            s.style.transform = '';
            s.style.opacity = '';
          });
        });
      });
    }

    // Active link
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav__links a, .nav__mobile a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }
};

/* ── Scroll Animations ───────────────────────── */
const SCROLL = {
  observer: null,

  init() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          this.observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    // Stagger siblings inside grid/list containers
    document.querySelectorAll('.stagger-children').forEach(parent => {
      Array.from(parent.children).forEach((child, i) => {
        child.classList.add('reveal');
        child.style.transitionDelay = `${i * 0.08}s`;
        this.observer.observe(child);
      });
    });

    // Individual reveal elements
    document.querySelectorAll('.reveal').forEach(el => {
      this.observer.observe(el);
    });
  }
};

/* ── Hero entrance animation ─────────────────── */
const HERO = {
  init() {
    const els = document.querySelectorAll(
      '.hero__eyebrow, .hero__logo-text, .hero__subtitle, .hero__desc, .hero__actions'
    );
    // Trigger CSS animations by adding class after a short tick
    requestAnimationFrame(() => {
      els.forEach(el => el.classList.add('animated'));
    });
  }
};

/* ── Parallax (subtle) ───────────────────────── */
const PARALLAX = {
  init() {
    const orbs = document.querySelectorAll('.hero__orb');
    if (!orbs.length) return;
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      orbs.forEach((orb, i) => {
        const factor = (i + 1) * 0.5;
        orb.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
      });
    }, { passive: true });
  }
};

/* ── Counter animation ───────────────────────── */
const COUNTER = {
  init() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
  },

  animate(el) {
    const target = parseInt(el.getAttribute('data-count'));
    const duration = 1200;
    const start = performance.now();
    const update = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
};

/* ── YouTube Playlist ────────────────────────── */
const YOUTUBE = {
  init() {
    const container = document.getElementById('youtube-gallery');
    if (!container) return;
    const playlistId = container.getAttribute('data-playlist-id');
    if (!playlistId || playlistId === 'PLAYLIST_ID_HERE') return;

    // Use pre-fetched data from build step (js/playlist-data.js)
    const data = (typeof YOUTUBE_PLAYLIST !== 'undefined') ? YOUTUBE_PLAYLIST : null;
    if (data && data.videos && data.videos.length) {
      this.renderGallery(container, data.videos, playlistId);
    } else {
      this.renderEmbed(container, playlistId);
    }
  },

  renderGallery(container, videos, playlistId) {
    const placeholder = container.querySelector('.video__placeholder');
    if (placeholder) placeholder.remove();

    const wrap = document.createElement('div');
    wrap.className = 'video__slider-wrap';

    const strip = document.createElement('div');
    strip.className = 'video__strip';

    const CARD_W = 196; // card width 180 + gap 16
    let currentIndex = 0;
    let autoTimer = null;
    let paused = false;

    videos.forEach(({ id, title, thumb, url }) => {
      const card = document.createElement('a');
      card.className = 'video__card';
      card.href = url || `https://www.youtube.com/watch?v=${id}`;
      card.target = '_blank';
      card.rel = 'noopener';
      card.setAttribute('aria-label', title);
      card.innerHTML = `
        <div class="video__thumb">
          <img src="${thumb}" alt="${title}" loading="lazy">
          <span class="video__play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </div>
        <p class="video__card-title">${title}</p>
      `;
      strip.appendChild(card);
    });

    const total = videos.length;

    function scrollTo(index) {
      currentIndex = ((index % total) + total) % total;
      strip.scrollTo({ left: currentIndex * CARD_W, behavior: 'smooth' });
      updateDots();
    }

    function startAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => { scrollTo(currentIndex + 1); }, 4000);
    }

    // Dots
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'video__dots';
    const dots = videos.map((_, i) => {
      const d = document.createElement('button');
      d.className = 'video__dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', `Video ${i + 1}`);
      d.addEventListener('click', () => { scrollTo(i); startAuto(); });
      dotsWrap.appendChild(d);
      return d;
    });

    function updateDots() {
      dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
    }

    strip.addEventListener('scroll', () => {
      const idx = Math.round(strip.scrollLeft / CARD_W);
      if (idx !== currentIndex) { currentIndex = idx % total; updateDots(); }
    }, { passive: true });

    const btnPrev = document.createElement('button');
    btnPrev.className = 'video__slider-btn video__slider-btn--prev';
    btnPrev.setAttribute('aria-label', 'Video precedente');
    btnPrev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>';
    btnPrev.addEventListener('click', () => { scrollTo(currentIndex - 1); startAuto(); });

    const btnNext = document.createElement('button');
    btnNext.className = 'video__slider-btn video__slider-btn--next';
    btnNext.setAttribute('aria-label', 'Video successivo');
    btnNext.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><polyline points="9 18 15 12 9 6"/></svg>';
    btnNext.addEventListener('click', () => { scrollTo(currentIndex + 1); startAuto(); });

    wrap.addEventListener('mouseenter', () => { paused = true; clearInterval(autoTimer); });
    wrap.addEventListener('mouseleave', () => { paused = false; startAuto(); });

    wrap.appendChild(btnPrev);
    wrap.appendChild(strip);
    wrap.appendChild(btnNext);
    container.appendChild(wrap);
    container.appendChild(dotsWrap);

    const footer = document.createElement('div');
    footer.className = 'video__strip-footer';
    footer.innerHTML = `<a href="https://www.youtube.com/playlist?list=${playlistId}" target="_blank" rel="noopener" class="btn btn--ghost">Guarda tutta la playlist →</a>`;
    container.appendChild(footer);

    startAuto();
  },

  renderEmbed(container, playlistId) {
    const placeholder = container.querySelector('.video__placeholder');
    if (placeholder) placeholder.remove();
    const embedDiv = document.createElement('div');
    embedDiv.innerHTML = `
      <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px;">
        <iframe
          src="https://www.youtube.com/embed/videoseries?list=${playlistId}&rel=0"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
          allowfullscreen loading="lazy"
          title="Why Not? — Video dei partecipanti"
        ></iframe>
      </div>`;
    container.appendChild(embedDiv);
  }
};

/* ── Smooth scroll for anchor links ─────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* ── Logo fallbacks ──────────────────────────── */
const LOGOS = {
  // Called by onerror on img tags when image file is missing
  fallback(img) {
    const alt = img.getAttribute('alt') || '';
    const isFooter = img.classList.contains('footer__logo-img') || img.classList.contains('funder__logo-img');
    const span = document.createElement('span');
    span.className = isFooter ? 'logo-text-small' : 'logo-text-fallback';
    span.textContent = alt;
    img.replaceWith(span);
  }
};

/* ── Version badge ───────────────────────────── */
function initVersion() {
  const v = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.1';
  document.querySelectorAll('#app-version').forEach(el => {
    el.textContent = `v${v}`;
  });
}

/* ── Boot ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  I18N.init();
  NAV.init();
  HERO.init();
  SCROLL.init();
  PARALLAX.init();
  COUNTER.init();
  YOUTUBE.init();
  initSmoothScroll();
  initVersion();
});
