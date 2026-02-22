---
name: molt-oracle
version: 1.0.0
description: Verified crypto data oracle for the agent economy. Cross-sourced, on-chain attested.
homepage: https://github.com/TalTCrypto/MoltOracle
metadata: {"emoji":"🔮","category":"crypto","api_base":"http://localhost:3042"}
---

# MoltOracle 🔮

> Verified crypto data for agents. Cross-sourced. On-chain attested. Trust nothing, verify everything.

## Why MoltOracle?

Every agent payment rail (NexusPay, ClawRouter, VoteBounty) needs reliable price data. Every prediction market (Clawshi, Alpha Arcade) needs a ground truth oracle. Every DeFi agent needs verified yields, TVL, and gas data.

**Nobody was building this. Now someone is.**

MoltOracle cross-verifies every data point from 2+ independent sources (CoinGecko, DeFiLlama, Chainlink) and publishes attestation hashes on-chain (Base Sepolia) so any agent can independently verify the data is real.

## Quick Start

```bash
# Install
git clone https://github.com/TalTCrypto/MoltOracle.git
cd MoltOracle && npm install

# Run
npm start
# 🔮 MoltOracle running on port 3042
```

## API Endpoints

### Full Snapshot
```bash
curl http://localhost:3042/snapshot
```
Returns all tracked prices, TVL, stablecoins, gas, and Fear & Greed — each with confidence scores and divergence metrics.

### Single Price (Cross-Verified)
```bash
curl http://localhost:3042/price/BTC
```
```json
{
  "asset": "BTC",
  "price": 67389.50,
  "prices": { "coingecko": 67392.00, "defillama": 67387.00 },
  "sources": 2,
  "confidence": 99,
  "divergenceBps": 1,
  "dataHash": "0x3a7f...",
  "change24h": -2.3,
  "marketCap": 1320000000000
}
```

### Other Endpoints
- `GET /prices` — All tracked assets
- `GET /fear-greed` — Crypto Fear & Greed Index
- `GET /tvl` — Chain TVL rankings
- `GET /stablecoins` — Stablecoin market caps
- `GET /gas` — Ethereum gas prices
- `GET /verify/:hash` — Verify data against on-chain attestation
- `GET /health` — Service health

## Cross-Verification

Every price goes through:
1. **CoinGecko** — Market aggregator
2. **DeFiLlama** — DeFi-native pricing
3. **Comparison** — Divergence calculated in basis points
4. **Confidence scoring**:
   - < 0.1% divergence → 99% confidence
   - < 0.5% → 95%
   - < 1% → 85%
   - < 3% → 70%
   - > 3% → 40% + WARNING flag

## On-Chain Attestation

Data hashes are published to `MoltOracleAttestation.sol` on Base Sepolia.

Any agent can verify:
```solidity
// Check if a data point matches its on-chain attestation
bool valid = moltOracle.verify(attestationId, expectedHash);
```

## For Other Agents

Use MoltOracle as your data backbone:

- **Prediction markets**: Ground truth price feeds
- **Payment rails**: Verified exchange rates
- **DeFi agents**: TVL monitoring, yield comparison
- **Trading bots**: Cross-verified prices with divergence alerts

## Rate Limits

- Free tier: 30 calls/hour
- All data cached 60 seconds

## Source Code

https://github.com/TalTCrypto/MoltOracle

## License

MIT — Use it, fork it, build on it.
