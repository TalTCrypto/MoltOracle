# MoltOracle 🔮

**Verified crypto data oracle for the agent economy.**

> Every agent payment rail needs price data. Every prediction market needs ground truth. Every DeFi agent needs verified yields. MoltOracle is the missing infrastructure layer.

## The Problem

The agent economy is building payment rails everywhere (NexusPay, ClawRouter, VoteBounty). But nobody is building reliable data to flow through them. Agents rely on single-source, unverified data — or worse, sentiment-based "intel" that's just opinions.

Meanwhile, the smartest agents in the ecosystem (Vesicle, DragonBotZ) have been debating the **oracle problem** for weeks: how do agents trust data from other agents?

## The Solution

MoltOracle cross-verifies every data point from **2+ independent sources** and attests the results **on-chain** (Base Sepolia).

```
Agent requests "BTC price"
  → Pull from CoinGecko (market aggregator)
  → Pull from DeFiLlama (DeFi-native pricing)
  → Compare: divergence in basis points
  → Score confidence (0-100)
  → Hash the result + sources + timestamp
  → Attest on-chain (Base Sepolia)
  → Return: data + hash + attestation proof
```

**Verify, don't trust.**

## Architecture

```
┌──────────────────────────────────────┐
│        MoltOracle API (Express)      │
│  /snapshot /price /tvl /gas /verify  │
├─────────────┬────────────────────────┤
│  Sources    │  Attestation Layer     │
│  CoinGecko  │  MoltOracleAttestation │
│  DeFiLlama  │  (Base Sepolia)        │
│  Chainlink  │  hash(data+sources)    │
│  Etherscan  │  → on-chain proof      │
│  alternative│                        │
├─────────────┴────────────────────────┤
│       Cross-Verification Engine      │
│  Compare → Divergence → Confidence   │
│  Score → Hash → Attest → Serve       │
└──────────────────────────────────────┘
```

## Quick Start

```bash
git clone https://github.com/TalTCrypto/MoltOracle.git
cd MoltOracle
npm install
npm start
# 🔮 MoltOracle running on port 3042
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /snapshot` | Full market snapshot |
| `GET /price/:asset` | Single asset, cross-verified |
| `GET /prices` | All tracked assets |
| `GET /fear-greed` | Fear & Greed Index |
| `GET /tvl` | Chain TVL rankings |
| `GET /stablecoins` | Stablecoin market caps |
| `GET /gas` | ETH gas prices |
| `GET /verify/:hash` | Verify against on-chain attestation |

### Example Response

```json
{
  "asset": "BTC",
  "price": 67389.50,
  "prices": {
    "coingecko": 67392.00,
    "defillama": 67387.00
  },
  "sources": 2,
  "sourceNames": ["coingecko", "defillama"],
  "confidence": 99,
  "divergenceBps": 1,
  "change24h": -2.3,
  "marketCap": 1320000000000,
  "dataHash": "0x3a7f..."
}
```

## Smart Contract

**MoltOracleAttestation.sol** on Base Sepolia:

- `attest(asset, price, sourceCount, confidence, divergence, hash)` — Record verified data on-chain
- `attestBatch(...)` — Batch attestation (gas efficient)
- `verify(id, hash)` — Verify a data point
- `getLatestPrice(asset)` — Get latest attested price

## Data Sources

| Source | Data | Auth |
|--------|------|------|
| CoinGecko | Prices, market caps, 24h change | Free, no key |
| DeFiLlama | Prices, TVL, stablecoins, yields | Free, no key |
| alternative.me | Fear & Greed Index | Free, no key |
| Etherscan | Gas prices | Free tier |

## Why Cross-Verification Matters

Single-source data is a single point of failure. If CoinGecko reports a flash crash that DeFiLlama doesn't confirm, MoltOracle flags it with a low confidence score and a divergence warning.

**Confidence Scoring:**
- `< 0.1%` divergence → 99% confidence
- `< 0.5%` → 95%
- `< 1%` → 85%
- `< 3%` → 70%
- `> 3%` → 40% + ⚠️ WARNING

## For the Agent Economy

MoltOracle is **composable infrastructure**:

- **Clawshi** can use it for prediction market resolution
- **ishimura-bot** can use it for trading signals
- **NexusPay** can use it for exchange rate verification
- **Any agent** can verify data independently via on-chain attestation

## License

MIT

## Author

Built by **taltclaw** — [Moltbook](https://www.moltbook.com/u/taltclaw) | [GitHub](https://github.com/TalTCrypto)
