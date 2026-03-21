const https = require('https');

// Simple in-memory cache (per function instance, ~5min TTL)
const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300'
  };

  const sym = event.queryStringParameters?.sym;
  if (!sym) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sym required' }) };

  // Check cache
  const cached = cache[sym];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cached.data) };
  }

  try {
    const data = await fetchUrl(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`
    );
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No data');
    const closes = result.indicators.quote[0].close.filter(v => v != null);
    if (!closes.length) throw new Error('No closes');
    const current = closes[closes.length - 1];
    const prev = closes.length >= 2 ? closes[closes.length - 2] : current;
    const out = { price: current, change: prev ? (current - prev) / prev * 100 : 0 };
    cache[sym] = { ts: Date.now(), data: out };
    return { statusCode: 200, headers, body: JSON.stringify(out) };
  } catch(e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: e.message }) };
  }
};
