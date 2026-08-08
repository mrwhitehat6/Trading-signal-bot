import { AlgorandClient, algos } from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Funding App...');

  if (!process.env.ALGORAND_MNEMONIC) {
    console.error('No mnemonic found in .env');
    return;
  }

  const client = AlgorandClient.testNet();
  const account = await client.account.fromMnemonic(process.env.ALGORAND_MNEMONIC);

  const appId = parseInt(process.env.ALGORAND_APP_ID || '768749542', 10);
  const appAddress = algosdk.getApplicationAddress(appId);
  const appAddressString = appAddress.toString();

  console.log(`App ID: ${appId}`);
  console.log(`App Address: ${appAddressString}`);

  try {
    const result = await client.send.payment({
      sender: account.addr,
      receiver: appAddressString,
      amount: algos(2),
      signer: account.signer
    });

    console.log(`✅ Funded App! TxID: ${result.transaction.txID()}`);
  } catch (error) {
    console.error('Funding failed:', error);
  }
}

main().catch(console.error);
