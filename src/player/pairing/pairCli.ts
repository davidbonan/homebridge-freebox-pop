#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import certificates from 'androidtv-remote/dist/certificate/CertificateGenerator.js';
import pairing from 'androidtv-remote/dist/pairing/PairingManager.js';
import { credentialsPath, writeCredentials } from '../credentialsFile.ts';

const PAIRING_PORT = 6467;
const CLIENT_NAME = 'Homebridge Freebox Pop';

const [host, storagePath = '/var/lib/homebridge'] = process.argv.slice(2);
if (!host) {
  console.error('usage: freebox-pop-pair <player-host> [homebridge-storage-path]');
  process.exit(2);
}

const credentials = certificates.CertificateGenerator.generateFull(CLIENT_NAME, 'FR', 'FR', 'Home', 'Home', 'Home');
const manager = new pairing.PairingManager(host, PAIRING_PORT, credentials, CLIENT_NAME);
const prompt = createInterface({ input: process.stdin, output: process.stdout });

manager.on('secret', async () => {
  const code = await prompt.question('Code shown on the TV: ');
  if (!manager.sendCode(code.trim())) console.error('Code rejected by the player');
});

const isPaired = await manager.start().catch(() => false);
prompt.close();
if (!isPaired) {
  console.error(`Pairing with ${host} failed`);
  process.exit(1);
}

await writeCredentials(storagePath, credentials);
console.log(`Paired, credentials saved to ${credentialsPath(storagePath)}. Restart Homebridge.`);
