import { clusterApiUrl, Connection, Keypair, PublicKey } from '@solana/web3.js';
import { disableMintAuthority, disableFreezeAuthority, getMint } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const network = (process.env.SOLANA_NETWORK as 'devnet' | 'testnet' | 'mainnet-beta') ?? 'devnet';
const connection = new Connection(clusterApiUrl(network), 'confirmed');

// Load payer (who will sign the transactions)
const payerSecret = JSON.parse(fs.readFileSync(process.env.PAYER_FILE!, 'utf-8'));
const payer = Keypair.fromSecretKey(Uint8Array.from(payerSecret));

// Load vanity mint
const vanitySecret = JSON.parse(fs.readFileSync(process.env.VANITY_FILE!, 'utf-8'));
const mintPubkey = Keypair.fromSecretKey(Uint8Array.from(vanitySecret)).publicKey;

(async () => {
  try {
    const mintInfo = await getMint(connection, mintPubkey);
    console.log('ℹ️ Current Mint Info:', mintInfo);

    // Disable Mint Authority
    await disableMintAuthority(connection, payer, mintPubkey, payer.publicKey);
    console.log('✅ Mint authority disabled!');

    // Disable Freeze Authority (optional)
    if (mintInfo.freezeAuthority) {
      await disableFreezeAuthority(connection, payer, mintPubkey, payer.publicKey);
      console.log('✅ Freeze authority disabled!');
    } else {
      console.log('ℹ️ No freeze authority set.');
    }
  } catch (err) {
    console.error('❌ Error disabling authorities:', err);
  }
})();
