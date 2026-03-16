const axios = require("axios");

const FRED_API_KEY = "eccd04335593c447c386fddb78096485";

const FRED_SERIES = [
  { id: "FEDFUNDS", label: "Fed Funds Rate", emoji: "🏦", unit: "%" },
  { id: "CPIAUCSL", label: "CPI (Inflation)", emoji: "📈", unit: "" },
  { id: "DGS10", label: "10Y Treasury Yield", emoji: "🏛️", unit: "%" },
  { id: "DTWEXBGS", label: "US Dollar Index", emoji: "💵", unit: "" },
];

const YAHOO_SYMBOLS = [
  { symbol: "BTC-USD", label: "Bitcoin", emoji: "₿" },
  { symbol: "ETH-USD", label: "Ethereum", emoji: "⟠" },
  { symbol: "GC=F", label: "Gold", emoji: "🥇" },
  { symbol: "CL=F", label: "WTI Oil", emoji: "🛢️" },
  { symbol: "^GSPC", label: "S&P 500", emoji: "📊" },
];

async function fetchFredSeries(seriesId) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`;
  try {
    const res = await axios.get(url, { timeout: 10000 });
    const obs = res.data.observations.filter((o) => o.value !== ".");
    if (obs.length === 0) return null;
    const latest = parseFloat(obs[0].value);
    const prev = obs.length > 1 ? parseFloat(obs[1].value) : null;
    return { value: latest, prev, date: obs[0].date };
  } catch (e) {
    console.error(`  FRED error (${seriesId}): ${e.message}`);
    return null;
  }
}

async function fetchYahooPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const result = res.data.chart.result[0];
    const meta = result.meta;
    const closes = result.indicators.quote[0].close.filter((v) => v != null);
    const current = meta.regularMarketPrice;
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    return { current, prevClose };
  } catch (e) {
    console.error(`  Yahoo error (${symbol}): ${e.message}`);
    return null;
  }
}

function fmt(num, decimals = 2) {
  if (num == null) return "N/A";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pctChange(current, prev) {
  if (prev == null || prev === 0) return "";
  const pct = ((current - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return ` (${sign}${pct.toFixed(2)}%)`;
}

function generateMacroSignal(fredData) {
  const signals = [];
  const fedRate = fredData.find((d) => d.id === "FEDFUNDS");
  const cpi = fredData.find((d) => d.id === "CPIAUCSL");
  const yield10 = fredData.find((d) => d.id === "DGS10");
  const dxy = fredData.find((d) => d.id === "DTWEXBGS");

  if (fedRate && fedRate.data) {
    if (fedRate.data.value >= 5)
      signals.push("Fed rate elevated — tight monetary policy");
    else if (fedRate.data.value <= 2)
      signals.push("Fed rate low — accommodative stance");
    else signals.push(`Fed holding at ${fmt(fedRate.data.value)}%`);
  }

  if (cpi && cpi.data && cpi.data.prev) {
    const mom =
      ((cpi.data.value - cpi.data.prev) / cpi.data.prev) * 100;
    if (mom > 0.4) signals.push("CPI running hot month-over-month");
    else if (mom < 0.1) signals.push("CPI cooling — disinflation signal");
    else signals.push("CPI steady");
  }

  if (yield10 && yield10.data) {
    if (yield10.data.value > 4.5) signals.push("10Y yield high — bond market stress");
    else if (yield10.data.value < 3.5) signals.push("10Y yield low — risk-on environment");
  }

  if (dxy && dxy.data && dxy.data.prev) {
    const chg = dxy.data.value - dxy.data.prev;
    if (chg > 0.5) signals.push("Dollar strengthening");
    else if (chg < -0.5) signals.push("Dollar weakening — EM tailwind");
  }

  return signals.length > 0
    ? signals.join(" | ")
    : "Macro conditions stable — no major shifts";
}

async function run() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  console.log("Fetching data...\n");

  // Fetch all in parallel
  const [fredResults, yahooResults] = await Promise.all([
    Promise.all(
      FRED_SERIES.map(async (s) => ({
        ...s,
        data: await fetchFredSeries(s.id),
      }))
    ),
    Promise.all(
      YAHOO_SYMBOLS.map(async (s) => ({
        ...s,
        data: await fetchYahooPrice(s.symbol),
      }))
    ),
  ]);

  // Build briefing
  const lines = [];
  lines.push(`🌍 DAILY MARKET BRIEFING`);
  lines.push(`${dateStr}`);
  lines.push("");

  // Macro section
  lines.push("— MACRO DATA (FRED) —");
  for (const s of fredResults) {
    if (s.data) {
      const change = pctChange(s.data.value, s.data.prev);
      const unit = s.unit;
      lines.push(
        `${s.emoji} ${s.label}: ${fmt(s.data.value)}${unit}${change}  (${s.data.date})`
      );
    } else {
      lines.push(`${s.emoji} ${s.label}: unavailable`);
    }
  }
  lines.push("");

  // Markets section
  lines.push("— LIVE MARKETS —");
  for (const s of yahooResults) {
    if (s.data) {
      const decimals = s.symbol.includes("BTC") || s.symbol.includes("ETH") ? 2 : 2;
      const change = pctChange(s.data.current, s.data.prevClose);
      lines.push(`${s.emoji} ${s.label}: $${fmt(s.data.current, decimals)}${change}`);
    } else {
      lines.push(`${s.emoji} ${s.label}: unavailable`);
    }
  }
  lines.push("");

  // Signal
  lines.push("— MACRO SIGNAL —");
  lines.push(`🧠 ${generateMacroSignal(fredResults)}`);
  lines.push("");
  lines.push(`⏰ Updated: ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`);

  const briefing = lines.join("\n");
  console.log(briefing);

  return briefing;
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
