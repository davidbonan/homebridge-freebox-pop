import certificates from 'androidtv-remote/dist/certificate/CertificateGenerator.js';
import pairing from 'androidtv-remote/dist/pairing/PairingManager.js';
import type { PlayerCredentials } from '../pairedPlayerFile.ts';

const PAIRING_PORT = 6467;
const CLIENT_NAME = 'Homebridge Freebox Pop';
const CODE_REQUEST_TIMEOUT_MS = 10_000;
const PAIRING_CODE = /^[0-9a-f]{6}$/i;

export interface PendingPairing {
  confirm(code: string): Promise<PlayerCredentials>;
  cancel(): void;
}

export function requestPairingCode(host: string): Promise<PendingPairing> {
  const credentials = certificates.CertificateGenerator.generateFull(CLIENT_NAME, 'FR', 'FR', 'Home', 'Home', 'Home');
  const manager = new pairing.PairingManager(host, PAIRING_PORT, credentials, CLIENT_NAME);
  const isPaired = manager.start().catch(() => false);
  const cancel = () => manager.client?.destroy();

  const confirm = async (code: string) => {
    if (!PAIRING_CODE.test(code)) throw new Error('The code is 6 characters, digits and letters A to F. Pair again to get a new one.');
    if (!manager.sendCode(code) || !(await isPaired)) throw new Error('The player rejected this code. Pair again to get a new one.');
    return credentials;
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(cancel, CODE_REQUEST_TIMEOUT_MS);
    manager.once('secret', () => {
      clearTimeout(timeout);
      resolve({ confirm, cancel });
    });
    void isPaired.then(() => {
      clearTimeout(timeout);
      reject(new Error(`Player ${host} did not show a pairing code`));
    });
  });
}
