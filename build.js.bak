const axios = require("axios");
const fs = require("fs");

const FRED_API_KEY = "eccd04335593c447c386fddb78096485";
const NEWS_API_KEY = "7ea8e60cce3a46c69ab552a7543f113c";

const FRED_SERIES = [
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%" },
  { id: "CPIAUCSL", label: "CPI (Inflation)", unit: "" },
  { id: "DGS10", label: "10Y Treasury Yield", unit: "%" },
  { id: "DTWEXBGS", label: "US Dollar Index", unit: "" },
];

const YAHOO_SYMBOLS = [
  { symbol: "BZ=F", label: "Brent Crude", key: "BRENT" },
  { symbol: "CL=F", label: "WTI Oil", key: "WTI" },
  { symbol: "GC=F", label: "Gold", key: "XAU" },
  { symbol: "BTC-USD", label: "Bitcoin", key: "BTC" },
  { symbol: "ETH-USD", label: "Ethereum", key: "ETH" },
  { symbol: "^GSPC", label: "S&P 500", key: "SPX" },
];

const NEWS_QUERIES = [
  { id: "newsEnergy", query: "oil price Brent WTI Hormuz OPEC" },
  { id: "newsMacro", query: "Federal Reserve interest rates inflation" },
  { id: "newsCrypto", query: "Bitcoin crypto market" },
];

async function fetchFred(id) {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`;
    const res = await axios.get(url, { timeout: 10000 });
    const obs = res.data.observations.filter(o => o.value !== ".");
    if (!obs.length) return null;
    return { value: parseFloat(obs[0].value).toFixed(2), date: obs[0].date };
  } catch(e) { return null; }
}

async function fetchYahoo(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await axios.get(url, { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } });
    const closes = res.data.chart.result[0].indicators.quote[0].close.filter(v => v != null);
    const current = closes[closes.length - 1];
    const prev = closes.length >= 2 ? closes[closes.length - 2] : current;
    const change = prev ? (current - prev) / prev * 100 : 0;
    return { price: current, change };
  } catch(e) { return null; }
}

async function fetchFearGreed() {
  try {
    const res = await axios.get("https://api.alternative.me/fng/?limit=1", { timeout: 10000 });
    return { value: res.data.data[0].value, label: res.data.data[0].value_classification };
  } catch(e) { return null; }
}

async function fetchNews(query) {
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    return res.data.articles || [];
  } catch(e) { return []; }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

async function build() {
  console.log("Fetching data...");
  
  const [fredResults, yahooResults, fearGreed, ...newsResults] = await Promise.all([
    Promise.all(FRED_SERIES.map(s => fetchFred(s.id))),
    Promise.all(YAHOO_SYMBOLS.map(s => fetchYahoo(s.symbol))),
    fetchFearGreed(),
    ...NEWS_QUERIES.map(q => fetchNews(q.query)),
  ]);

  const now = new Date();
  const nowStr = now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' }) + ' GMT+3';

  let html = fs.readFileSync('./index-template.html', 'utf8');

  // Inject market prices
  const marketCardsHtml = YAHOO_SYMBOLS.map((s, i) => {
    const d = yahooResults[i];
    if (!d) return `<div class="market-card"><div class="label">${s.key} — ${s.label}</div><div class="price" style="color:#666">Unavailable</div></div>`;
    const dir = d.change >= 0 ? 'up' : 'down';
    const arrow = d.change >= 0 ? '▲' : '▼';
    const fmt = d.price >= 10000 
      ? d.price.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0})
      : d.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    return `<div class="market-card"><div class="label">${s.key} — ${s.label}</div><div class="price">$${fmt}</div><div class="change ${dir}">${arrow} ${Math.abs(d.change).toFixed(2)}%</div></div>`;
  }).join('\n');
  html = html.replace('{{MARKET_CARDS}}', marketCardsHtml);

  // Inject macro
  const macroCardsHtml = FRED_SERIES.map((s, i) => {
    const d = fredResults[i];
    const val = d ? `${d.value}${s.unit}` : 'N/A';
    return `<div class="macro-card"><div class="macro-value">${val}</div><div class="macro-label">${s.label}</div></div>`;
  }).join('\n');
  html = html.replace('{{MACRO_CARDS}}', macroCardsHtml);

  // Inject fear & greed
  if (fearGreed) {
    html = html.replace('{{FG_VALUE}}', fearGreed.value);
    html = html.replace('{{FG_LABEL}}', fearGreed.label);
  } else {
    html = html.replace('{{FG_VALUE}}', 'N/A');
    html = html.replace('{{FG_LABEL}}', '');
  }

  // Inject news
  NEWS_QUERIES.forEach((q, i) => {
    const articles = newsResults[i];
    const newsHtml = articles.length > 0
      ? articles.map(a => `<div class="news-item"><a href="${a.url}" target="_blank" rel="noopener">${a.title}</a><div class="news-meta"><span class="news-source">${a.source?.name || ''}</span><span>${timeAgo(a.publishedAt)}</span></div></div>`).join('')
      : '<div style="color:var(--text-dim);font-size:12px">No articles</div>';
    html = html.replace(`{{NEWS_${q.id.toUpperCase()}}}`, newsHtml);
  });

  // Inject timestamp
  html = html.replace('{{LAST_UPDATED}}', nowStr);

  fs.writeFileSync('./index.html', html);
  console.log("✅ Built index.html with live data at", nowStr);
}

build().catch(e => { console.error("Build failed:", e.message); process.exit(1); });
