const https = require('https');

const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1hr — FRED data doesn't change often

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
    'Cache-Control': 'public, max-age=3600'
  };

  const FRED_API_KEY = process.env.FRED_API_KEY;
  const id = event.queryStringParameters?.id;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };

  const cached = cache[id];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cached.data) };
  }

  try {
    const data = await fetchUrl(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`
    );
    const obs = data?.observations?.filter(o => o.value !== '.');
    if (!obs?.length) throw new Error('No data');
    const out = { value: parseFloat(obs[0].value).toFixed(2), date: obs[0].date };
    cache[id] = { ts: Date.now(), data: out };
    return { statusCode: 200, headers, body: JSON.stringify(out) };
  } catch(e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: e.message }) };
  }
};
