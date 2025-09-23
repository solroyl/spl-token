import { burn, getMint, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js';
import 'dotenv/config';
import fs from 'fs';

const network = process.env.SOLANA_NETWORK ?? 'devnet';
const url = clusterApiUrl(network as 'devnet' | 'testnet' | 'mainnet-beta');
const connection = new Connection(url);

// Load payer wallet (also the token holder & authority)
const payerFile = process.env.PAYER_FILE ?? 'src/wallet/payer.json';
const payerSecretKey = JSON.parse(fs.readFileSync(payerFile, 'utf-8'));
const payer = Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));

// Load vanity mint address
if (!process.env.VANITY_FILE) {
  throw new Error('❌ Missing VANITY_FILE in .env');
}
const vanityFile = process.env.VANITY_FILE;
const vanitySecretKey = JSON.parse(fs.readFileSync(vanityFile, 'utf-8'));
const vanityKeypair = Keypair.fromSecretKey(Uint8Array.from(vanitySecretKey));
const mintAddress = vanityKeypair.publicKey;

// Amount to burn
const burnAmount = BigInt(process.env.BURN_AMOUNT ?? '0');

(async () => {
  // Get current mint info
  const mintInfo = await getMint(connection, mintAddress);
  console.log('ℹ️ Current supply:', mintInfo.supply.toString());

  if (burnAmount <= 0n) {
    console.log('❌ Invalid burn amount, set BURN_AMOUNT in .env');
    return;
  }

  // Get payer's ATA for this mint
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    payer.publicKey
  );

  console.log('💳 Your ATA:', ata.address.toBase58());
  console.log('🔥 Attempting to burn', burnAmount.toString(), 'tokens...');

  // Burn tokens
  await burn(
    connection,
    payer,
    ata.address,
    mintAddress,
    payer, // owner of ATA
    burnAmount
  );

  const updatedMint = await getMint(connection, mintAddress);
  console.log('✅ Burn successful!');
  console.log('   New supply:', updatedMint.supply.toString());
})();
