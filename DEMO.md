# 🎯 3-Minute Judge Demo Script

## Pre-Demo Setup (5 minutes before)

```bash
# Terminal 1 – Start backend
cd Trading-signal-bot/backend
npm run dev

# Terminal 2 – Start frontend (optional, backend serves built frontend)
cd Trading-signal-bot/frontend
npm run dev

# Verify health
curl http://localhost:3001/api/health
```

Open browser: **http://localhost:3000**

---

## ⏱️ Demo Timeline

### 0:00 – 0:20 | THE PROBLEM

> "Every day, retail traders are bombarded with trading signals with zero accountability. Anyone can claim a 90% win rate. There's no way to verify. We built a system where EVERY trading signal is permanently recorded on the Algorand blockchain the moment it's generated."

*[Point to the dashboard header showing Algorand status]*

---

### 0:20 – 0:45 | THE ARCHITECTURE

> "Our platform combines three engines:"
> - "ICT Smart Money Concept analysis – detecting institutional footprints"
> - "Multi-dimensional confidence scoring – 7 independent factors, no black box"
> - "Real-time Algorand blockchain verification – immutable audit trail"

*[Point to the Live Signal Card showing confidence breakdown scores]*

---

### 0:45 – 1:15 | LIVE MARKET DATA + ANALYSIS

> "We're pulling LIVE data from Binance right now."

*[Point to Market Overview showing real BTC/ETH prices]*

**Click: [Generate Live Analysis] button**

> "Watch the system analyze: EMA alignment, RSI momentum, market structure breaks, fair value gaps, liquidity sweeps..."

*[Wait for result – if no signal, explain why: conditions weren't right, which proves integrity]*

---

### 1:15 – 1:35 | SIGNAL GENERATED

**If no live signal: Click [Full Demo] in the Hackathon Demo Panel**

> "A BTC LONG signal just generated. Let's look at WHY:"

*[Point to the confidence breakdown]*
> - "Technical: 18/20 – EMA alignment confirmed"
> - "Structure: 16/20 – Bullish BOS detected"
> - "ICT: 13/15 – Liquidity sweep confirmed"
> - "Overall confidence: 87% – well above our 75% threshold"

---

### 1:35 – 2:00 | ALGORAND BLOCKCHAIN

*[The blockchain registration happens automatically – point to the Blockchain Verification panel]*

> "The moment the signal was generated, it was recorded on Algorand. Here's the transaction:"

*[Click "View on Explorer" link]*

> "App ID 1008. Signal ID visible on-chain. Timestamp immutable. No one – not even us – can alter this record."

---

### 2:00 – 2:15 | TELEGRAM NOTIFICATION

*[Click [Send Telegram] or show the Telegram channel on your phone]*

> "Simultaneously, 500+ subscribers received this signal on Telegram. The message includes the blockchain transaction link so anyone can verify it independently."

---

### 2:15 – 2:35 | OUTCOME TRACKING

> "Let's show the complete cycle. When price hits the target..."

**Click: [Simulate TP]**

> "Take profit hit. The blockchain is updated with the outcome. This creates an immutable, public performance record. No more fake win rate screenshots."

*[Point to the signal row in Signal Feed showing 'TP_HIT' with blockchain link]*

---

### 2:35 – 2:50 | PERFORMANCE DASHBOARD

*[Point to Performance panel]*

> "All historical signals, win rate, profit factor – all backed by on-chain data. This is the first trading signal platform where performance is cryptographically verifiable."

---

### 2:50 – 3:00 | VISION

> "We're building the trust layer for algorithmic trading. Imagine a future where every signal provider must stake ALGO against their predictions. Bad actors get slashed. Good analysts build an immutable reputation on-chain. That's where this is going."

---

## 🎯 Key Points to Emphasize

1. **Real blockchain** – Every transaction is verifiable on Pera Explorer
2. **Real market data** – Live Binance prices, not simulated
3. **Transparent scoring** – Every number has a formula, nothing is hidden
4. **Anti-spam** – We won't generate random signals every 5 seconds
5. **Demo mode is honest** – When labeled [DEMO], market conditions are simulated but blockchain is always real

---

## 🔗 Key URLs to Show Judges

- Dashboard: `http://localhost:3000`
- API Health: `http://localhost:3001/api/health`
- Latest Signal: `http://localhost:3001/api/signals`
- Pera Explorer: `https://testnet.explorer.perawallet.app/application/1008`
- Algorand Creator: `DJJB3VD2K23TNIKHCNSCNTYRUZGJQEXBJKBPMSVQM5TRPNMISP5ORNC26I`

---

## 🚨 Troubleshooting

**Backend won't start:**
```bash
# Check .env exists
ls backend/.env
# Start with debug
cd backend && npm run dev
```

**"Market data unavailable":**
- Binance API might be rate-limited. Wait 30s and try again.
- Use Demo Signal which uses cached data.

**Algorand transaction fails:**
- Ensure `ALGORAND_MNEMONIC` is set in `.env`
- Ensure the account has testnet ALGO
- Get free ALGO: https://dispenser.testnet.aws.algodev.network/

**Telegram bot offline:**
- Set `TELEGRAM_BOT_TOKEN` in `.env`
- The system works without Telegram; signals still generate and store on chain.
