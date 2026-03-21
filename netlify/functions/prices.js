const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const sym = event.queryStringParameters?.sym || 'GC=F';
  try {
    const data = await fetchUrl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`);
    const closes = data.chart.result[0].indicators.quote[0].close.filter(v => v != null);
    const current = closes[closes.length - 1];
    const prev = closes.length >= 2 ? closes[closes.length - 2] : current;
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ price: current, change: prev ? (current - prev) / prev * 100 : 0 })
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
