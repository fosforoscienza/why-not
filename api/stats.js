// api/stats.js — restituisce statistiche aggregate degli ultimi N giorni

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

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

function parseHash(result) {
  if (!Array.isArray(result)) return {};
  const obj = {};
  for (let i = 0; i < result.length; i += 2) {
    obj[result[i]] = parseInt(result[i + 1]) || 0;
  }
  return obj;
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function mergeHash(a, b) {
  const out = Object.assign({}, a);
  for (const k of Object.keys(b)) {
    out[k] = (out[k] || 0) + b[k];
  }
  return out;
}

function topN(obj, n) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(function(e) { return { label: e[0], count: e[1] }; });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'KV not configured' });
  }

  const period = Math.min(parseInt(req.query && req.query.period) || 7, 90);
  const days   = lastNDays(period);

  const commands = [];
  for (const day of days) {
    commands.push(['GET',     'views:'     + day]);
    commands.push(['SCARD',   'sessions:'  + day]);
    commands.push(['HGETALL', 'pages:'     + day]);
    commands.push(['HGETALL', 'referrers:' + day]);
    commands.push(['HGETALL', 'countries:' + day]);
    commands.push(['HGETALL', 'devices:'   + day]);
    commands.push(['HGETALL', 'browsers:'  + day]);
    commands.push(['HGETALL', 'hours:'     + day]);
  }

  let raw;
  try {
    const data = await kvPipeline(commands);
    raw = data.map ? data.map(function(r) { return r.result !== undefined ? r.result : r; }) : [];
  } catch (err) {
    console.error('stats error:', err.message);
    return res.status(500).json({ error: 'fetch failed' });
  }

  const dailyViews    = [];
  const dailySessions = [];
  let totalViews    = 0;
  let totalSessions = 0;
  let allPages      = {};
  let allReferrers  = {};
  let allCountries  = {};
  let allDevices    = {};
  let allBrowsers   = {};
  let allHours      = {};

  for (let i = 0; i < days.length; i++) {
    const base     = i * 8;
    const views    = parseInt(raw[base])     || 0;
    const sessions = parseInt(raw[base + 1]) || 0;
    const pages    = parseHash(raw[base + 2]);
    const refs     = parseHash(raw[base + 3]);
    const countries= parseHash(raw[base + 4]);
    const devices  = parseHash(raw[base + 5]);
    const browsers = parseHash(raw[base + 6]);
    const hours    = parseHash(raw[base + 7]);

    dailyViews.push({ date: days[i], count: views });
    dailySessions.push({ date: days[i], count: sessions });
    totalViews    += views;
    totalSessions += sessions;
    allPages      = mergeHash(allPages,     pages);
    allReferrers  = mergeHash(allReferrers, refs);
    allCountries  = mergeHash(allCountries, countries);
    allDevices    = mergeHash(allDevices,   devices);
    allBrowsers   = mergeHash(allBrowsers,  browsers);
    allHours      = mergeHash(allHours,     hours);
  }

  const activeDays = dailyViews.filter(function(d) { return d.count > 0; }).length || 1;
  const avgPerDay  = Math.round(totalViews / activeDays);

  const hoursArray = [];
  for (let h = 0; h < 24; h++) {
    hoursArray.push(allHours[String(h)] || 0);
  }

  // Normalizza nomi pagine
  const pagesNamed = {};
  for (const k of Object.keys(allPages)) {
    const label = k === '/' ? 'Home'
      : k.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    pagesNamed[label] = (pagesNamed[label] || 0) + allPages[k];
  }

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=60');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    period,
    updatedAt: new Date().toISOString(),
    overview: {
      totalViews,
      totalSessions,
      avgPerDay,
      topPage: (topN(pagesNamed, 1)[0] || {}).label || '—',
    },
    daily: {
      views:    dailyViews,
      sessions: dailySessions,
    },
    hours: hoursArray,
    pages:     topN(pagesNamed, 10),
    referrers: topN(allReferrers, 10),
    countries: topN(allCountries, 10),
    devices:   topN(allDevices,   5),
    browsers:  topN(allBrowsers,  5),
  });
};
