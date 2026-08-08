import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { TradingSignalRegistryFactory } from './src/algorand/TradingSignalRegistryClient';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

async function main() {
  console.log('Deploying Trading Signal Registry to Testnet...');

  if (!process.env.ALGORAND_MNEMONIC) {
    console.error('No mnemonic found in .env');
    return;
  }

  const client = AlgorandClient.testNet();
  const account = await client.account.fromMnemonic(process.env.ALGORAND_MNEMONIC);

  console.log('Deployer address:', account.addr);

  const factory = new TradingSignalRegistryFactory({
    algorand: client,
    defaultSender: account.addr,
    defaultSigner: account.signer,
  });

  try {
    const result = await factory.send.create.bare();
    const appId = result.appClient.appId;

    console.log(`✅ Deployed successfully! App ID: ${appId}`);
    console.log(`Transaction ID: ${result.result.transaction.txID()}`);

    // Update .env file
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace ALGORAND_APP_ID
    if (envContent.includes('ALGORAND_APP_ID=')) {
      envContent = envContent.replace(/ALGORAND_APP_ID=.*/g, `ALGORAND_APP_ID=${appId}`);
    } else {
      envContent += `\nALGORAND_APP_ID=${appId}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with new ALGORAND_APP_ID');

  } catch (error) {
    console.error('Deployment failed:', error);
  }
}

main().catch(console.error);
