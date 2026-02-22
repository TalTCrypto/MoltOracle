/**
 * MoltOracle — Data Source Aggregator
 * Cross-verifies crypto data from multiple independent sources
 */

const https = require('https');
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MoltOracle/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error from ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// --- SOURCE 1: CoinGecko (free, no auth) ---
async function fetchCoinGecko(assets) {
  const ids = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
    BNB: 'binancecoin', XRP: 'ripple', ADA: 'cardano',
    AVAX: 'avalanche-2', DOGE: 'dogecoin', DOT: 'polkadot',
    MATIC: 'matic-network', LINK: 'chainlink', UNI: 'uniswap',
    AAVE: 'aave', ARB: 'arbitrum', OP: 'optimism',
    BASE: 'base', USDT: 'tether', USDC: 'usd-coin'
  };

  const geckoIds = assets.map(a => ids[a]).filter(Boolean).join(',');
  if (!geckoIds) return {};

  try {
    const data = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    );
    const result = {};
    for (const [ticker, geckoId] of Object.entries(ids)) {
      if (data[geckoId]) {
        result[ticker] = {
          price: data[geckoId].usd,
          change24h: data[geckoId].usd_24h_change,
          marketCap: data[geckoId].usd_market_cap,
          source: 'coingecko'
        };
      }
    }
    return result;
  } catch (e) {
    console.error('CoinGecko error:', e.message);
    return {};
  }
}

// --- SOURCE 2: DeFiLlama (free, no auth) ---
async function fetchDeFiLlama(assets) {
  const llamaIds = {
    BTC: 'coingecko:bitcoin', ETH: 'coingecko:ethereum',
    SOL: 'coingecko:solana', BNB: 'coingecko:binancecoin',
    XRP: 'coingecko:ripple', ADA: 'coingecko:cardano',
    AVAX: 'coingecko:avalanche-2', DOGE: 'coingecko:dogecoin',
    LINK: 'coingecko:chainlink', UNI: 'coingecko:uniswap',
    AAVE: 'coingecko:aave', ARB: 'coingecko:arbitrum',
    OP: 'coingecko:optimism'
  };

  const coins = assets.map(a => llamaIds[a]).filter(Boolean).join(',');
  if (!coins) return {};

  try {
    const data = await fetch(`https://coins.llama.fi/prices/current/${coins}`);
    const result = {};
    for (const [ticker, llamaId] of Object.entries(llamaIds)) {
      if (data.coins && data.coins[llamaId]) {
        result[ticker] = {
          price: data.coins[llamaId].price,
          confidence: data.coins[llamaId].confidence || 0.99,
          source: 'defillama'
        };
      }
    }
    return result;
  } catch (e) {
    console.error('DeFiLlama error:', e.message);
    return {};
  }
}

// --- SOURCE 3: Fear & Greed Index ---
async function fetchFearGreed() {
  try {
    const data = await fetch('https://api.alternative.me/fng/?limit=1');
    return {
      value: parseInt(data.data[0].value),
      label: data.data[0].value_classification,
      timestamp: parseInt(data.data[0].timestamp),
      source: 'alternative.me'
    };
  } catch (e) {
    console.error('Fear&Greed error:', e.message);
    return null;
  }
}

// --- SOURCE 4: DeFiLlama TVL ---
async function fetchTVL() {
  try {
    const data = await fetch('https://api.llama.fi/v2/chains');
    const top = data
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 15)
      .map(c => ({ chain: c.name, tvl: c.tvl }));
    return { chains: top, source: 'defillama' };
  } catch (e) {
    console.error('TVL error:', e.message);
    return null;
  }
}

// --- SOURCE 5: DeFiLlama Stablecoins ---
async function fetchStablecoins() {
  try {
    const data = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true');
    const top = data.peggedAssets
      .sort((a, b) => {
        const aVal = a.circulating?.peggedUSD || 0;
        const bVal = b.circulating?.peggedUSD || 0;
        return bVal - aVal;
      })
      .slice(0, 10)
      .map(s => ({
        name: s.name,
        symbol: s.symbol,
        circulating: s.circulating?.peggedUSD || 0,
        price: s.price
      }));
    return { stablecoins: top, source: 'defillama' };
  } catch (e) {
    console.error('Stablecoins error:', e.message);
    return null;
  }
}

// --- SOURCE 6: ETH Gas ---
async function fetchGas() {
  try {
    const data = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle');
    if (data.status === '1') {
      return {
        low: parseInt(data.result.SafeGasPrice),
        standard: parseInt(data.result.ProposeGasPrice),
        fast: parseInt(data.result.FastGasPrice),
        source: 'etherscan'
      };
    }
    return null;
  } catch (e) {
    console.error('Gas error:', e.message);
    return null;
  }
}

// --- CROSS-VERIFICATION ENGINE ---
function crossVerify(coinGecko, deFiLlama, asset) {
  const cg = coinGecko[asset];
  const dl = deFiLlama[asset];

  if (!cg && !dl) return null;
  if (!cg) return { price: dl.price, sources: 1, sourceNames: ['defillama'], confidence: 60, divergenceBps: 0 };
  if (!dl) return { price: cg.price, sources: 1, sourceNames: ['coingecko'], confidence: 60, divergenceBps: 0 };

  const avg = (cg.price + dl.price) / 2;
  const diff = Math.abs(cg.price - dl.price);
  const divergenceBps = Math.round((diff / avg) * 10000);

  let confidence;
  if (divergenceBps <= 10) confidence = 99;       // < 0.1% diff
  else if (divergenceBps <= 50) confidence = 95;   // < 0.5%
  else if (divergenceBps <= 100) confidence = 85;  // < 1%
  else if (divergenceBps <= 300) confidence = 70;  // < 3%
  else confidence = 40;                             // > 3% = suspicious

  return {
    price: avg,
    prices: { coingecko: cg.price, defillama: dl.price },
    sources: 2,
    sourceNames: ['coingecko', 'defillama'],
    confidence,
    divergenceBps,
    change24h: cg.change24h,
    marketCap: cg.marketCap,
    warning: divergenceBps > 300 ? `HIGH DIVERGENCE: ${divergenceBps}bps between sources` : null
  };
}

// --- MAIN ORACLE FUNCTION ---
async function getFullSnapshot(assets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'LINK', 'AAVE', 'ARB', 'OP', 'UNI']) {
  const [coinGecko, deFiLlama, fearGreed, tvl, stablecoins, gas] = await Promise.all([
    fetchCoinGecko(assets),
    fetchDeFiLlama(assets),
    fetchFearGreed(),
    fetchTVL(),
    fetchStablecoins(),
    fetchGas()
  ]);

  const prices = {};
  for (const asset of assets) {
    const verified = crossVerify(coinGecko, deFiLlama, asset);
    if (verified) prices[asset] = verified;
  }

  return {
    timestamp: Math.floor(Date.now() / 1000),
    iso: new Date().toISOString(),
    oracle: 'MoltOracle v1.0.0',
    verification: 'cross-sourced',
    prices,
    fearGreed,
    tvl,
    stablecoins,
    gas
  };
}

module.exports = {
  getFullSnapshot,
  fetchCoinGecko,
  fetchDeFiLlama,
  fetchFearGreed,
  fetchTVL,
  fetchStablecoins,
  fetchGas,
  crossVerify
};
