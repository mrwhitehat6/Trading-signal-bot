# 🤖 TradeSense AI

**An AI-powered trading signal platform that analyzes live market data, generates high-confidence signals using ICT/SMC methodology, stores every signal immutably on the Algorand blockchain, and broadcasts alerts through Telegram.**

> Built for the **Algorand Hackathon 2026** 🏆

---

## 🎯 Problem

Retail traders face three fundamental problems:
1. **Information overload**: Hundreds of indicators, zero signal
2. **Accountability gap**: Trading signals are unverifiable and ephemeral
3. **Trust deficit**: Signal providers can fabricate performance history

## 💡 Solution

TradeSense AI combines:
- **Deterministic market analysis** (no hallucinated signals)
- **Blockchain immutability** (every signal is permanently recorded on Algorand)
- **Transparent scoring** (every signal explains exactly WHY it was generated)

---

## 🏗️ Architecture

```
LIVE MARKET DATA (Binance)
        │
        ▼
TECHNICAL ENGINE (EMA, RSI, MACD, ATR, VWAP)
        │
        ▼
ICT/SMC ENGINE (BOS, CHOCH, FVG, Order Blocks, Liquidity Sweeps)
        │
        ▼
CONFIDENCE ENGINE (7-dimensional weighted scoring)
        │
        ▼
SIGNAL DECISION
        │
   ┌────┴────┐
   ▼         ▼
ALGORAND   TELEGRAM
REGISTRY    BOT
        │
        ▼
LIVE DASHBOARD
```

---

## 🔬 Signal Generation

### Technical Analysis
| Indicator | Purpose |
|-----------|---------|
| EMA 9/20/50/200 | Trend alignment & momentum |
| RSI (14) | Overbought/oversold conditions |
| MACD (12/26/9) | Momentum confirmation |
| ATR (14) | Volatility & stop loss sizing |
| VWAP | Institutional price reference |
| Volume | Participation confirmation |

### ICT/Smart Money Concepts
| Concept | Description |
|---------|-------------|
| BOS | Break of Structure – trend continuation |
| CHOCH | Change of Character – reversal signal |
| FVG | Fair Value Gap – inefficiency zones |
| Order Block | Institutional supply/demand zones |
| Liquidity Sweep | Stop hunt confirmation |
| HH/HL/LH/LL | Market structure classification |

### Confidence Scoring (7 Dimensions)
| Dimension | Weight |
|-----------|--------|
| Technical Trend | 20% |
| Market Structure | 20% |
| Momentum (RSI/MACD) | 15% |
| ICT/SMC Confluence | 15% |
| Volume | 10% |
| Liquidity | 10% |
| Risk/Reward | 10% |

**Signals only generated above 75% confidence with minimum 1.5:1 Risk/Reward.**

---

## ⛓️ Algorand Integration

- **App ID**: 1008 (deployed on Algorand Testnet)
- **Contract**: `TradingSignalRegistry` – BoxMap-based immutable signal storage
- **Methods**: `createSignal`, `getSignal`, `updateStatus`, `signalExists`
- **Verification**: Every signal links to a Pera Explorer URL

---

## 📱 Telegram Bot

Commands:
- `/start` – Welcome & subscribe
- `/status` – System status
- `/latest` – Latest signal
- `/signals` – Last 5 signals
- `/active` – Active signals
- `/performance` – Win rate & stats

---

## 🖥️ Dashboard

- **Live Signal Card** – Current active signal with full breakdown
- **Market Overview** – BTC/ETH prices with 24h stats
- **Confidence Visualization** – 7-dimension score display
- **Signal Feed** – Real-time signal table with blockchain links
- **Performance Panel** – Win rate, profit factor, strategy stats
- **Blockchain Verification** – Live Algorand status
- **Hackathon Demo Panel** – One-click demo for judges

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- Algorand Testnet account with ALGO (from [dispenser](https://dispenser.testnet.aws.algodev.network/))
- Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
# 1. Clone & navigate
cd Trading-signal-bot

# 2. Setup backend
cd backend
cp .env.example .env
# Edit .env with your ALGORAND_MNEMONIC and TELEGRAM_BOT_TOKEN
npm install
npm run build

# 3. Setup frontend
cd ../frontend
npm install
npm run build
```

### Running for Development

**Terminal 1 – Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 – Frontend:**
```bash
cd frontend
npm run dev
```

Dashboard opens at: **http://localhost:3000**
Backend API at: **http://localhost:3001/api**

### Running for Production

```bash
# Backend serves the built frontend
cd backend
npm run build
cd ../frontend
npm run build
cd ../backend
npm start
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALGORAND_MNEMONIC` | Yes (for chain) | 25-word mnemonic for signing transactions |
| `ALGORAND_APP_ID` | Yes | App ID (default: 1008) |
| `ALGORAND_NETWORK` | Yes | `testnet` or `mainnet` |
| `TELEGRAM_BOT_TOKEN` | Yes (for bot) | Bot token from BotFather |
| `DEMO_MODE` | No | `true` to enable judge demo panel |
| `SCAN_INTERVAL_MS` | No | Market scan interval (default: 300000) |
| `SYMBOLS` | No | Comma-separated symbols (default: BTC/USDT,ETH/USDT) |

---

## 🎮 Demo Mode

Set `DEMO_MODE=true` in `.env`. The dashboard's **Hackathon Live Demo** panel allows judges to:

1. **🚀 Full Demo** – Run the complete pipeline end-to-end
2. **📡 Live Analysis** – Trigger real market analysis
3. **✅ Simulate TP** – Simulate take profit (with real blockchain update)
4. **❌ Simulate SL** – Simulate stop loss (with real blockchain update)
5. **📱 Send Telegram** – Broadcast the latest signal

> **Note**: Demo Mode does NOT fake blockchain transactions. All Algorand interactions are real.

---

## 📊 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| GET | `/api/signals` | List all signals |
| GET | `/api/signals/active` | Active signals |
| GET | `/api/performance` | Performance stats |
| GET | `/api/market/prices` | Current market prices |
| POST | `/api/analyze` | Trigger live analysis |
| POST | `/api/demo/generate` | Generate demo signal |
| POST | `/api/demo/simulate-tp` | Simulate TP hit |
| POST | `/api/demo/simulate-sl` | Simulate SL hit |
| GET | `/api/events` | SSE stream for real-time updates |

---

## 🧪 Smart Contract

```
App ID: 1008
Network: Algorand Testnet
Creator: DJJB3VD2K23TNIKHCNSCNTYRUZGJQEXBJKBPMSVQM5TRPNMISP5ORNC26I
```

Contract methods:
```typescript
createSignal(signalId, asset, direction, entry, stopLoss, takeProfit, confidence, strategy, timestamp)
getSignal(signalId)
updateStatus(signalId, status, outcome)
signalExists(signalId)
```

---

## 🔮 Future Improvements

1. **Options/Futures support** – Delta-hedged signal generation
2. **Multi-timeframe confluence** – MTF analysis (4H + 1H + 15M)
3. **AI explanation engine** – LLM-powered signal narratives
4. **Portfolio risk management** – Correlated position sizing
5. **NFT signal certificates** – On-chain signal performance NFTs
6. **DAO governance** – Community-driven strategy parameters
7. **Backtesting engine** – Historical signal replay with TEAL validation

---

## ⚠️ Disclaimer

This platform is for educational and demonstration purposes. Trading involves significant financial risk. Past performance does not guarantee future results. Never risk capital you cannot afford to lose.

---

*Built with ❤️ on Algorand*
