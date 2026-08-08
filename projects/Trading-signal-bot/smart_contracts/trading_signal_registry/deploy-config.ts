import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TradingSignalRegistryFactory } from '../artifacts/trading_signal_registry/TradingSignalRegistryClient'

export async function deploy() {
  console.log('=== Deploying TradingSignalRegistry ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(
    TradingSignalRegistryFactory,
    {
      defaultSender: deployer.addr,
    },
  )

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
  }

  console.log(
    `TradingSignalRegistry deployed with app id ${appClient.appId}`,
  )
}