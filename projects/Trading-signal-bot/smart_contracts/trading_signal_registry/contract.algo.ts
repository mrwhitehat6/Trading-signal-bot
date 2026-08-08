import {
  BoxMap,
  Contract,
  uint64,
  assert,
  clone,
} from '@algorandfoundation/algorand-typescript'

type TradingSignal = {
  asset: string
  direction: string
  entry: uint64
  stopLoss: uint64
  takeProfit: uint64
  confidence: uint64
  strategy: string
  timestamp: uint64
  status: string
  outcome: string
}

export class TradingSignalRegistry extends Contract {
  public signals = BoxMap<string, TradingSignal>({
    keyPrefix: 'signal_',
  })

  public createSignal(
    signalId: string,
    asset: string,
    direction: string,
    entry: uint64,
    stopLoss: uint64,
    takeProfit: uint64,
    confidence: uint64,
    strategy: string,
    timestamp: uint64,
  ): boolean {
    assert(!this.signals(signalId).exists, 'Signal already exists')

    this.signals(signalId).value = {
      asset,
      direction,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      strategy,
      timestamp,
      status: 'ACTIVE',
      outcome: 'PENDING',
    }

    return true
  }

  public getSignal(signalId: string): TradingSignal {
    assert(this.signals(signalId).exists, 'Signal not found')
    return this.signals(signalId).value
  }

  public updateStatus(
    signalId: string,
    status: string,
    outcome: string,
  ): boolean {
    assert(this.signals(signalId).exists, 'Signal not found')

    const signal = clone(this.signals(signalId).value)
    this.signals(signalId).value = {
      asset: signal.asset,
      direction: signal.direction,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      confidence: signal.confidence,
      strategy: signal.strategy,
      timestamp: signal.timestamp,
      status: status,
      outcome: outcome,
    }

    return true
  }

  public signalExists(signalId: string): boolean {
    return this.signals(signalId).exists
  }
}