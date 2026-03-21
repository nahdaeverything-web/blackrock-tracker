const https = require('https');
const FRED_KEY = 'eccd04335593c447c386fddb78096485';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
  const id = event.queryStringParameters?.id || 'FEDFUNDS';
  try {
    const data = await fetchUrl(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=2`);
    const obs = data.observations.filter(o => o.value !== '.');
    const value = obs.length > 0 ? parseFloat(obs[0].value).toFixed(2) : null;
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ value, date: obs[0]?.date })
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
