// api/track.js — riceve eventi di tracciamento e li scrive su Vercel KV
// Nessun cookie, nessun IP salvato. Country da header CDN Vercel.

const KV_URL   = process.env.UPSTASH_REDIS_REST_URL  || process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function kvPipeline(commands) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function parseDevice(ua) {
  ua = ua || '';
  if (/mobile|android|iphone/i.test(ua) && !/ipad/i.test(ua)) return 'Mobile';
  if (/tablet|ipad/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

function parseBrowser(ua) {
  ua = ua || '';
  if (/edg\//i.test(ua))   return 'Edge';
  if (/opr\//i.test(ua))   return 'Opera';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/chrome/i.test(ua))  return 'Chrome';
  if (/safari/i.test(ua))  return 'Safari';
  return 'Other';
}

function parseReferrer(ref) {
  if (!ref) return 'Direct';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (/google\./i.test(h))       return 'Google';
    if (/facebook|fb\./i.test(h))  return 'Facebook';
    if (/instagram/i.test(h))      return 'Instagram';
    if (/twitter|t\.co/i.test(h))  return 'Twitter/X';
    if (/linkedin/i.test(h))       return 'LinkedIn';
    if (/youtube/i.test(h))        return 'YouTube';
    return h;
  } catch { return 'Direct'; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'KV not configured' });
  }

  const body      = req.body || {};
  const page      = ('/' + String(body.page || '/').replace(/[^a-z0-9\-_/]/gi, '')).slice(0, 100);
  const referrer  = String(body.referrer || '');
  const sessionId = String(body.sessionId || '');

  const ua      = req.headers['user-agent'] || '';
  const country = req.headers['x-vercel-ip-country'] || 'XX';
  const device  = parseDevice(ua);
  const browser = parseBrowser(ua);
  const source  = parseReferrer(referrer);

  const now  = new Date();
  const date = now.toISOString().split('T')[0];
  const hour = String(now.getUTCHours());
  const ttl  = 90 * 24 * 3600;

  const commands = [
    ['INCR',    `views:${date}`],
    ['EXPIRE',  `views:${date}`, ttl],
    ['HINCRBY', `pages:${date}`,     page,    1],
    ['EXPIRE',  `pages:${date}`,     ttl],
    ['HINCRBY', `referrers:${date}`, source,  1],
    ['EXPIRE',  `referrers:${date}`, ttl],
    ['HINCRBY', `countries:${date}`, country, 1],
    ['EXPIRE',  `countries:${date}`, ttl],
    ['HINCRBY', `devices:${date}`,   device,  1],
    ['EXPIRE',  `devices:${date}`,   ttl],
    ['HINCRBY', `browsers:${date}`,  browser, 1],
    ['EXPIRE',  `browsers:${date}`,  ttl],
    ['HINCRBY', `hours:${date}`,     hour,    1],
    ['EXPIRE',  `hours:${date}`,     ttl],
  ];

  if (sessionId) {
    commands.push(['SADD',   `sessions:${date}`, sessionId]);
    commands.push(['EXPIRE', `sessions:${date}`, ttl]);
  }

  try {
    await kvPipeline(commands);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('track error:', err.message);
    return res.status(500).json({ error: 'store failed' });
  }
};
