import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { TradingSignalRegistryClient } from './TradingSignalRegistryClient';
import type { TradingSignal } from '../types';
import { updateSignalBlockchain, updateSignalStatus, logEvent } from '../db';

const ALGORAND_APP_ID = parseInt(process.env.ALGORAND_APP_ID ?? '1008', 10);
const ALGORAND_NETWORK = process.env.ALGORAND_NETWORK ?? 'testnet';
const ALGORAND_MNEMONIC = process.env.ALGORAND_MNEMONIC ?? '';

// Explorer base URLs
const EXPLORER_URLS: Record<string, string> = {
  testnet: 'https://testnet.explorer.perawallet.app/tx',
  mainnet: 'https://explorer.perawallet.app/tx',
  localnet: 'http://localhost:8980',
};

interface AlgorandStatus {
  connected: boolean;
  network: string;
  appId: number;
  lastTxId?: string;
  lastError?: string;
}

let algorandStatus: AlgorandStatus = {
  connected: false,
  network: ALGORAND_NETWORK,
  appId: ALGORAND_APP_ID,
};

function getAlgorandClient(): AlgorandClient {
  if (ALGORAND_NETWORK === 'testnet') {
    return AlgorandClient.testNet();
  } else if (ALGORAND_NETWORK === 'mainnet') {
    return AlgorandClient.mainNet();
  } else {
    return AlgorandClient.defaultLocalNet();
  }
}

export async function registerSignalOnChain(signal: TradingSignal): Promise<{
  success: boolean;
  txId?: string;
  appId?: number;
  error?: string;
}> {
  if (!ALGORAND_MNEMONIC || ALGORAND_MNEMONIC.trim() === '') {
    if (process.env.DEMO_MODE === 'true') {
      console.warn('[ALGORAND] DEMO MODE: No mnemonic configured. Mocking blockchain registration.');
      const mockTxId = 'TX' + Math.random().toString(36).substring(2, 15).toUpperCase();
      const blockchainTimestamp = Date.now();
      updateSignalBlockchain(signal.id, ALGORAND_APP_ID, mockTxId, blockchainTimestamp);
      logEvent('ALGORAND', `[MOCK] Signal ${signal.id} registered on chain`, { txId: mockTxId, appId: ALGORAND_APP_ID });
      algorandStatus = {
        connected: true,
        network: ALGORAND_NETWORK,
        appId: ALGORAND_APP_ID,
        lastTxId: mockTxId,
      };
      return { success: true, txId: mockTxId, appId: ALGORAND_APP_ID };
    }
    
    console.warn('[ALGORAND] No mnemonic configured - skipping blockchain registration');
    algorandStatus.lastError = 'No mnemonic configured';
    return { success: false, error: 'No mnemonic configured' };
  }

  try {
    const client = getAlgorandClient();
    const account = await client.account.fromMnemonic(ALGORAND_MNEMONIC);

    const appClient = new TradingSignalRegistryClient({
      algorand: client,
      appId: BigInt(ALGORAND_APP_ID),
      defaultSender: account.addr,
      defaultSigner: account.signer,
    });

    // Convert price to integer (multiply by 10^6 to preserve 6 decimal places)
    const entryInt = BigInt(Math.round(signal.entry * 1_000_000));
    const slInt = BigInt(Math.round(signal.stopLoss * 1_000_000));
    const tpInt = BigInt(Math.round(signal.takeProfit * 1_000_000));
    const confInt = BigInt(Math.round(signal.confidence));

    // Check if signal already exists on-chain (gracefully handle missing box)
    let alreadyExists = false;
    try {
      const existsResult = await appClient.send.signalExists({
        args: { signalId: signal.id },
        boxReferences: [{ appId: BigInt(ALGORAND_APP_ID), name: `signal_${signal.id}` }],
      });
      alreadyExists = !!existsResult.return;
    } catch {
      // Box doesn't exist yet — that's expected for a new signal
      alreadyExists = false;
    }

    if (alreadyExists) {
      console.log(`[ALGORAND] Signal ${signal.id} already registered on chain`);
      return { success: true, appId: ALGORAND_APP_ID };
    }

    const result = await appClient.send.createSignal({
      args: {
        signalId: signal.id,
        asset: signal.symbol,
        direction: signal.direction,
        entry: entryInt,
        stopLoss: slInt,
        takeProfit: tpInt,
        confidence: confInt,
        strategy: signal.strategyDisplay,
        timestamp: BigInt(signal.timestamp),
      },
      boxReferences: [{ appId: BigInt(ALGORAND_APP_ID), name: `signal_${signal.id}` }],
    });

    const txId = result.transaction.txID();
    const blockchainTimestamp = Date.now();

    // Update database with blockchain info
    updateSignalBlockchain(signal.id, ALGORAND_APP_ID, txId, blockchainTimestamp);
    logEvent('ALGORAND', `Signal ${signal.id} registered on chain`, { txId, appId: ALGORAND_APP_ID });

    algorandStatus = {
      connected: true,
      network: ALGORAND_NETWORK,
      appId: ALGORAND_APP_ID,
      lastTxId: txId,
    };

    console.log(`[ALGORAND] ✅ Signal ${signal.id} registered | TxID: ${txId}`);
    return { success: true, txId, appId: ALGORAND_APP_ID };

  } catch (err) {
    const error = String(err);
    console.error('[ALGORAND] Registration failed:', err);
    algorandStatus.connected = false;
    algorandStatus.lastError = error;
    logEvent('ERROR', 'Algorand registration failed', { signalId: signal.id, error });
    return { success: false, error };
  }
}

export async function updateSignalStatusOnChain(
  signal: TradingSignal,
  status: string,
  outcome: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  if (!ALGORAND_MNEMONIC || ALGORAND_MNEMONIC.trim() === '') {
    if (process.env.DEMO_MODE === 'true') {
      console.warn('[ALGORAND] DEMO MODE: No mnemonic configured. Mocking blockchain update.');
      const mockTxId = 'TX' + Math.random().toString(36).substring(2, 15).toUpperCase();
      return { success: true, txId: mockTxId };
    }
    return { success: false, error: 'No mnemonic configured' };
  }

  if (!signal.algorandTxId) {
    return { success: false, error: 'Signal not registered on chain' };
  }

  try {
    const client = getAlgorandClient();
    const account = await client.account.fromMnemonic(ALGORAND_MNEMONIC);

    const appClient = new TradingSignalRegistryClient({
      algorand: client,
      appId: BigInt(ALGORAND_APP_ID),
      defaultSender: account.addr,
      defaultSigner: account.signer,
    });

    const result = await appClient.send.updateStatus({
      args: { signalId: signal.id, status, outcome },
      boxReferences: [{ appId: BigInt(ALGORAND_APP_ID), name: `signal_${signal.id}` }],
    });

    const txId = result.transaction.txID();

    // Update database
    updateSignalStatus(signal.id, status, outcome, txId);
    logEvent('ALGORAND', `Signal ${signal.id} status updated on chain`, { txId, status, outcome });

    algorandStatus.lastTxId = txId;
    console.log(`[ALGORAND] ✅ Status updated for ${signal.id} → ${status}/${outcome} | TxID: ${txId}`);
    return { success: true, txId };

  } catch (err) {
    console.error('[ALGORAND] Status update failed:', err);
    return { success: false, error: String(err) };
  }
}

export function getExplorerUrl(txId: string): string {
  const base = EXPLORER_URLS[ALGORAND_NETWORK] ?? EXPLORER_URLS.testnet;
  return `${base}/${txId}`;
}

export function getAlgorandStatus(): AlgorandStatus {
  return algorandStatus;
}

export { ALGORAND_APP_ID, ALGORAND_NETWORK };
