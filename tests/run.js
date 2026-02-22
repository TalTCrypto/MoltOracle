/**
 * MoltOracle Tests — Verify cross-verification engine works correctly
 */

const { crossVerify, fetchCoinGecko, fetchDeFiLlama, fetchFearGreed, getFullSnapshot } = require('../src/sources');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
}

async function runTests() {
  console.log('\n🔮 MoltOracle Test Suite\n');

  // --- Cross-verification logic tests ---
  console.log('--- Cross-Verification Engine ---');

  // Test: Both sources agree (< 0.1% diff)
  const result1 = crossVerify(
    { BTC: { price: 67000, change24h: -2.3, marketCap: 1.3e12, source: 'coingecko' } },
    { BTC: { price: 67005, confidence: 0.99, source: 'defillama' } },
    'BTC'
  );
  assert(result1.confidence === 99, 'High confidence when sources agree (<0.1%)');
  assert(result1.sources === 2, 'Reports 2 sources');
  assert(result1.divergenceBps < 10, `Low divergence: ${result1.divergenceBps}bps`);

  // Test: Sources diverge moderately (1%)
  const result2 = crossVerify(
    { ETH: { price: 2000, change24h: -1.5, marketCap: 2.4e11, source: 'coingecko' } },
    { ETH: { price: 2020, confidence: 0.99, source: 'defillama' } },
    'ETH'
  );
  assert(result2.confidence === 85, `Moderate confidence at 1% divergence: ${result2.confidence}`);

  // Test: Sources diverge heavily (5%)
  const result3 = crossVerify(
    { SOL: { price: 100, change24h: 5.0, marketCap: 4e10, source: 'coingecko' } },
    { SOL: { price: 105, confidence: 0.95, source: 'defillama' } },
    'SOL'
  );
  assert(result3.confidence === 40, `Low confidence at 5% divergence: ${result3.confidence}`);
  assert(result3.warning !== null, 'Warning flag on high divergence');

  // Test: Single source only
  const result4 = crossVerify(
    { ADA: { price: 0.45, change24h: 1.0, marketCap: 1.5e10, source: 'coingecko' } },
    {},
    'ADA'
  );
  assert(result4.confidence === 60, 'Single source = 60% confidence');
  assert(result4.sources === 1, 'Reports 1 source');

  // Test: No sources
  const result5 = crossVerify({}, {}, 'UNKNOWN');
  assert(result5 === null, 'Returns null for unknown asset');

  // --- Live API tests ---
  console.log('\n--- Live Source Tests ---');

  try {
    const cg = await fetchCoinGecko(['BTC', 'ETH']);
    assert(cg.BTC && cg.BTC.price > 0, `CoinGecko BTC: $${cg.BTC?.price?.toLocaleString()}`);
    assert(cg.ETH && cg.ETH.price > 0, `CoinGecko ETH: $${cg.ETH?.price?.toLocaleString()}`);
  } catch (e) {
    assert(false, `CoinGecko failed: ${e.message}`);
  }

  try {
    const dl = await fetchDeFiLlama(['BTC', 'ETH']);
    assert(dl.BTC && dl.BTC.price > 0, `DeFiLlama BTC: $${dl.BTC?.price?.toLocaleString()}`);
    assert(dl.ETH && dl.ETH.price > 0, `DeFiLlama ETH: $${dl.ETH?.price?.toLocaleString()}`);
  } catch (e) {
    assert(false, `DeFiLlama failed: ${e.message}`);
  }

  try {
    const fg = await fetchFearGreed();
    assert(fg && fg.value >= 0 && fg.value <= 100, `Fear & Greed: ${fg?.value} (${fg?.label})`);
  } catch (e) {
    assert(false, `Fear & Greed failed: ${e.message}`);
  }

  // --- Full snapshot test ---
  console.log('\n--- Full Snapshot ---');

  try {
    const snapshot = await getFullSnapshot(['BTC', 'ETH', 'SOL']);
    assert(snapshot.prices.BTC !== undefined, 'BTC in snapshot');
    assert(snapshot.prices.ETH !== undefined, 'ETH in snapshot');
    assert(snapshot.prices.BTC.confidence > 0, `BTC confidence: ${snapshot.prices.BTC.confidence}%`);
    assert(snapshot.fearGreed !== null, 'Fear & Greed present');
    assert(snapshot.tvl !== null, 'TVL data present');
    assert(snapshot.timestamp > 0, `Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
  } catch (e) {
    assert(false, `Full snapshot failed: ${e.message}`);
  }

  // --- Results ---
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
