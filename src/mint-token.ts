import { getExplorerLink } from '@solana-developers/helpers';
import { createMint, getMint } from '@solana/spl-token';
import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js';
import 'dotenv/config';
import fs from 'fs';

const network = (process.env.SOLANA_NETWORK as 'devnet' | 'testnet' | 'mainnet-beta') ?? 'devnet';
const connection = new Connection(clusterApiUrl(network));

// Load payer wallet from file
const payerFile = process.env.PAYER_FILE ?? 'src/wallet/payer.json';
const secretKey = JSON.parse(fs.readFileSync(payerFile, 'utf-8'));
const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

const decimals = parseInt(process.env.DECIMALS ?? '9', 10);

// Load vanity address keypair (this will be the **mint account**)
if (!process.env.VANITY_FILE) {
  throw new Error('❌ Missing VANITY_FILE in .env');
}
const vanityFile = process.env.VANITY_FILE;
const vanitySecretKey = JSON.parse(fs.readFileSync(vanityFile, 'utf-8'));
const vanityKeypair = Keypair.fromSecretKey(Uint8Array.from(vanitySecretKey));
const vanityAddress = vanityKeypair.publicKey;

(async () => {
  try {
    // Try fetching existing mint
    const mintInfo = await getMint(connection, vanityAddress);
    console.log('ℹ️ Mint already exists at:', vanityAddress.toBase58());
    console.log('   Decimals:', mintInfo.decimals);
    console.log('   Supply:', mintInfo.supply.toString());
    console.log('🔗 Explorer:', getExplorerLink('address', vanityAddress.toBase58(), network));
    return;
  } catch (err) {
    // getMint throws if account doesn't exist → safe to create
    console.log('No existing mint found. Creating new one...');
  }

  const tokenMint = await createMint(
    connection,
    payer, // payer for transaction fees
    payer.publicKey, // mint authority
    null, // freeze authority
    decimals,
    vanityKeypair
  );

  console.log('✅ Token mint created at:', tokenMint.toBase58());
  console.log('🔗 Explorer link:', getExplorerLink('address', tokenMint.toBase58(), network));
})();
