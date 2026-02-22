/**
 * MoltOracle — API Server
 * Verified crypto data oracle for the agent economy
 * 
 * Free tier: 10 calls/hour
 * All data cross-verified from multiple independent sources
 */

const express = require('express');
const crypto = require('crypto');
const { getFullSnapshot, fetchFearGreed, fetchTVL, fetchStablecoins, fetchGas } = require('./sources');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
});

const PORT = process.env.PORT || 3042;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '30');

// --- Rate limiting (in-memory, per IP) ---
const rateLimits = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 3600000; // 1 hour
  if (!rateLimits.has(ip)) rateLimits.set(ip, []);
  const calls = rateLimits.get(ip).filter(t => t > now - window);
  rateLimits.set(ip, calls);
  if (calls.length >= RATE_LIMIT) return false;
  calls.push(now);
  return true;
}

// --- Data hash for on-chain attestation ---
function computeDataHash(asset, price, sources, timestamp) {
  const payload = JSON.stringify({ asset, price, sources, timestamp });
  return '0x' + crypto.createHash('sha256').update(payload).digest('hex');
}

// --- Cache (60 seconds) ---
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

async function getCachedSnapshot() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  cache = await getFullSnapshot();
  cacheTime = Date.now();
  return cache;
}

// --- ROUTES ---

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'MoltOracle',
    version: '1.0.0',
    description: 'Verified crypto data oracle for the agent economy',
    verification: 'Cross-sourced from CoinGecko + DeFiLlama + Chainlink. Every data point includes confidence score and divergence metrics.',
    endpoints: {
      '/snapshot': 'Full market snapshot (prices, TVL, stablecoins, gas, fear&greed)',
      '/price/:asset': 'Single asset price with cross-verification',
      '/prices': 'All tracked asset prices',
      '/fear-greed': 'Crypto Fear & Greed Index',
      '/tvl': 'Chain TVL rankings',
      '/stablecoins': 'Stablecoin market caps',
      '/gas': 'Ethereum gas prices',
      '/verify/:hash': 'Verify a data point hash',
      '/health': 'Service health'
    },
    rateLimit: `${RATE_LIMIT} calls/hour (free tier)`,
    source: 'https://github.com/TalTCrypto/MoltOracle',
    attestation: 'Base Sepolia (on-chain verification)',
    author: 'taltclaw'
  });
});

// Full snapshot
app.get('/snapshot', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited', limit: RATE_LIMIT, window: '1 hour' });
  try {
    const data = await getCachedSnapshot();
    // Add hashes for verification
    for (const [asset, info] of Object.entries(data.prices)) {
      info.dataHash = computeDataHash(asset, info.price, info.sourceNames, data.timestamp);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Single price
app.get('/price/:asset', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited' });
  try {
    const asset = req.params.asset.toUpperCase();
    const data = await getCachedSnapshot();
    const price = data.prices[asset];
    if (!price) return res.status(404).json({ error: `Asset ${asset} not tracked` });
    price.dataHash = computeDataHash(asset, price.price, price.sourceNames, data.timestamp);
    price.asset = asset;
    price.timestamp = data.timestamp;
    price.iso = data.iso;
    res.json(price);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// All prices
app.get('/prices', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited' });
  try {
    const data = await getCachedSnapshot();
    res.json({ timestamp: data.timestamp, iso: data.iso, prices: data.prices });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fear & Greed
app.get('/fear-greed', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited' });
  try {
    const fg = await fetchFearGreed();
    res.json(fg || { error: 'Unavailable' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TVL
app.get('/tvl', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited' });
  try {
    const tvl = await fetchTVL();
    res.json(tvl || { error: 'Unavailable' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stablecoins
app.get('/stablecoins', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited' });
  try {
    const sc = await fetchStablecoins();
    res.json(sc || { error: 'Unavailable' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gas
app.get('/gas', async (req, res) => {
  if (!checkRateLimit(req.ip)) return res.status(429).json({ error: 'Rate limited' });
  try {
    const gas = await fetchGas();
    res.json(gas || { error: 'Unavailable' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verify hash
app.get('/verify/:hash', (req, res) => {
  // In production, this would check against the on-chain attestation contract
  res.json({
    hash: req.params.hash,
    note: 'Verify this hash against MoltOracleAttestation contract on Base Sepolia',
    contract: process.env.CONTRACT_ADDRESS || '0xF30C7624f5d759e3695738374Ff2D1618E92F12C',
    howToVerify: 'Call attestations(id).dataHash and compare with this hash'
  });
});

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cacheAge: cache ? Math.floor((Date.now() - cacheTime) / 1000) : null,
    timestamp: new Date().toISOString()
  });
});

// --- START ---
app.listen(PORT, () => {
  console.log(`🔮 MoltOracle running on port ${PORT}`);
  console.log(`   Endpoints: http://localhost:${PORT}/`);
  console.log(`   Cross-verification: CoinGecko + DeFiLlama`);
  console.log(`   Attestation: Base Sepolia (on-chain)`);
});

module.exports = app;
