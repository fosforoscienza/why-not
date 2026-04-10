#!/usr/bin/env python3
"""
simulate-visits.py — Simulatore di visite umane per il sito Why Not?

Uso:
    python simulate-visits.py <numero_utenti>
    python simulate-visits.py <numero_utenti> --fast      # nessun delay, max parallele
    python simulate-visits.py <numero_utenti> --workers 5 # utenti paralleli (default 4)
    python simulate-visits.py <numero_utenti> --url https://why-not-ochre.vercel.app

Esempio:
    python simulate-visits.py 20
    python simulate-visits.py 100 --fast --workers 10
"""

import sys
import time
import random
import string
import argparse
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
except ImportError:
    print("⚠ Installa requests: pip install requests")
    sys.exit(1)

# ── Configurazione sito ──────────────────────────────────────────────────────

DEFAULT_URL = "https://why-not-ochre.vercel.app"

PAGES = ["/", "/progetto", "/partner", "/toolkit"]
PAGE_WEIGHTS = [0.45, 0.20, 0.15, 0.20]  # home più probabile, toolkit ben visitata

# Il PDF viene scaricato solo dalla pagina /toolkit
PDF_DOWNLOAD_PROB = 0.35  # 35% degli utenti su /toolkit scarica la guida

# ── Profili utente realistici ────────────────────────────────────────────────

USER_AGENTS = [
    # Chrome Desktop — Windows (25%)
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", 25),
    # Chrome Desktop — Mac (15%)
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", 15),
    # Safari Mobile — iPhone (20%)
    ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 "
     "(KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1", 20),
    # Chrome Mobile — Android (15%)
    ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36", 15),
    # Firefox Desktop (10%)
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) "
     "Gecko/20100101 Firefox/123.0", 10),
    # Edge Desktop (8%)
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0", 8),
    # Safari — iPad (7%)
    ("Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 "
     "(KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1", 7),
]

REFERRERS = [
    ("",                                    40),  # Direct
    ("https://www.google.it/",              20),  # Google IT
    ("https://www.google.com/",             10),  # Google
    ("https://www.facebook.com/",           10),  # Facebook
    ("https://www.instagram.com/",           8),  # Instagram
    ("https://www.linkedin.com/",            4),  # LinkedIn
    ("https://www.regione.marche.it/",       4),  # Regione Marche
    ("https://www.fosforoscienza.it/",       4),  # Fosforoscienza
]

# ── Statistiche globali (thread-safe) ───────────────────────────────────────

_lock = threading.Lock()
_stats = {"ok": 0, "err": 0, "downloads": 0, "pages_visited": 0}

def _inc(key, n=1):
    with _lock:
        _stats[key] += n

# ── Helpers ──────────────────────────────────────────────────────────────────

def weighted_choice(options):
    """Sceglie un'opzione in base al peso (lista di tuple (valore, peso))."""
    items, weights = zip(*options)
    return random.choices(items, weights=weights, k=1)[0]

def random_session_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=20))

def think(fast, min_s=3, max_s=40):
    """Pausa realistica tra pagine (saltata in --fast)."""
    if not fast:
        time.sleep(random.uniform(min_s, max_s))

# ── Tracking ─────────────────────────────────────────────────────────────────

def track(track_url, page, referrer, session_id, user_agent, label=""):
    """Invia evento di tracciamento all'API /api/track."""
    try:
        resp = requests.post(
            track_url,
            json={"page": page, "referrer": referrer, "sessionId": session_id},
            headers={"User-Agent": user_agent},
            timeout=10,
        )
        if resp.status_code == 200:
            _inc("ok")
            _inc("pages_visited")
            return True
        else:
            _inc("err")
            print(f"    ⚠ {page} → HTTP {resp.status_code}: {resp.text[:80]}")
            return False
    except Exception as e:
        _inc("err")
        print(f"    ✗ {page} → {e}")
        return False

# ── Simulazione singolo utente ───────────────────────────────────────────────

def simulate_user(user_num, total, track_url, fast, prefix=""):
    """Simula la sessione completa di un utente."""
    session_id  = random_session_id()
    user_agent  = weighted_choice(USER_AGENTS)
    first_ref   = weighted_choice(REFERRERS)
    n_pages     = random.randint(1, 5)
    downloaded  = False
    path        = []

    # Pagina di atterraggio
    current = weighted_choice(list(zip(PAGES, PAGE_WEIGHTS)))

    tag = f"{prefix}[{user_num:>3}/{total}]"
    print(f"  {tag} 👤 session={session_id[:8]}… ref={first_ref[:30] or 'direct':<30} pages={n_pages}")

    for i in range(n_pages):
        ref = first_ref if i == 0 else DEFAULT_URL + path[-1] if path else ""
        ok = track(track_url, current, ref, session_id, user_agent)
        if ok:
            print(f"  {tag}   📄 {current}")
        path.append(current)

        # Simulazione download PDF (solo su /toolkit)
        if current == "/toolkit" and not downloaded and random.random() < PDF_DOWNLOAD_PROB:
            think(fast, 5, 20)  # legge la pagina prima di scaricare
            track(track_url, "/download/pdf", DEFAULT_URL + "/toolkit", session_id, user_agent)
            _inc("downloads")
            downloaded = True
            print(f"  {tag}   📥 PDF scaricato")

        # Pausa lettura pagina
        think(fast, 3, 40)

        # Scegli prossima pagina (escludi corrente)
        remaining = [(p, w) for p, w in zip(PAGES, PAGE_WEIGHTS) if p != current]
        if not remaining:
            break
        current = weighted_choice(remaining)

    print(f"  {tag} ✓ {' → '.join(path)}{' + PDF' if downloaded else ''}")

# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Simulatore visite Why Not?")
    parser.add_argument("users",    type=int,  help="Numero di utenti distinti da simulare")
    parser.add_argument("--fast",   action="store_true", help="Nessun delay (test rapido)")
    parser.add_argument("--workers",type=int,  default=4,  help="Utenti paralleli (default 4)")
    parser.add_argument("--url",    type=str,  default=DEFAULT_URL, help="URL base del sito")
    args = parser.parse_args()

    if args.users < 1:
        print("Errore: inserisci almeno 1 utente"); sys.exit(1)

    track_url = args.url.rstrip("/") + "/api/track"
    workers   = min(args.workers, args.users)

    print(f"\n{'─'*60}")
    print(f"🚀 Why Not? — Simulatore visite")
    print(f"   Utenti:   {args.users}")
    print(f"   Paralleli:{workers}")
    print(f"   Target:   {track_url}")
    print(f"   Modalità: {'⚡ fast' if args.fast else '🐢 realistica'}")
    print(f"   Avvio:    {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'─'*60}\n")

    t0 = time.time()

    if workers == 1:
        for i in range(1, args.users + 1):
            simulate_user(i, args.users, track_url, args.fast)
            if i < args.users and not args.fast:
                time.sleep(random.uniform(0.5, 2))
    else:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = {
                ex.submit(simulate_user, i, args.users, track_url, args.fast, f"W{((i-1)%workers)+1}/"): i
                for i in range(1, args.users + 1)
            }
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as e:
                    print(f"  ✗ errore utente: {e}")

    elapsed = time.time() - t0
    print(f"\n{'─'*60}")
    print(f"✅ Simulazione completata in {elapsed:.1f}s")
    print(f"   Visite inviate:  {_stats['pages_visited']}")
    print(f"   PDF scaricati:   {_stats['downloads']}")
    print(f"   Errori API:      {_stats['err']}")
    print(f"   Dashboard:       {args.url.rstrip('/')}/dashboard")
    print(f"{'─'*60}\n")

if __name__ == "__main__":
    main()
