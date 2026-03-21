const https = require('https');

const cache = {};
const CACHE_TTL = 15 * 60 * 1000; // 15min cache

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
    'Cache-Control': 'public, max-age=900'
  };

  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  const query = event.queryStringParameters?.q;
  if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'q required' }) };

  const cacheKey = query;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cached.data) };
  }

  try {
    const data = await fetchUrl(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`
    );
    if (data.status !== 'ok') throw new Error(data.message || 'NewsAPI error');
    const out = { articles: data.articles };
    cache[cacheKey] = { ts: Date.now(), data: out };
    return { statusCode: 200, headers, body: JSON.stringify(out) };
  } catch(e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: e.message }) };
  }
};
