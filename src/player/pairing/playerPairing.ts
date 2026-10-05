import { X509Certificate, createHash } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import tls from 'node:tls';
import { splitFrames } from '../connection/infrastructure/remoteMessageFrames.ts';
import type { PlayerCredentials } from '../pairedPlayerFile.ts';
import { createClientCertificate } from './clientCertificate.ts';
import { pairingConfiguration, pairingOption, pairingRequest, pairingSecret, readPairingMessage } from './pairingMessages.ts';
import type { ReceivedPairingMessage } from './pairingMessages.ts';

const PAIRING_PORT = 6467;
const CLIENT_NAME = 'Homebridge Freebox Pop';
const CODE_REQUEST_TIMEOUT_MS = 10_000;
const PAIRING_CODE = /^[0-9a-f]{6}$/i;
const REJECTED_CODE = 'The player rejected this code. Pair again to get a new one.';

export interface PendingPairing {
  confirm(code: string): Promise<PlayerCredentials>;
  cancel(): void;
}

export async function requestPairingCode(host: string): Promise<PendingPairing> {
  const credentials = await createClientCertificate(CLIENT_NAME);
  // the player presents a self-signed certificate
  const socket = tls.connect({ host, port: PAIRING_PORT, ...credentials, rejectUnauthorized: false });
  const steps = new EventEmitter();
  const closed = new AbortController();
  const cancel = () => socket.destroy();
  let pending: Buffer = Buffer.alloc(0);

  socket.once('secureConnect', () => socket.write(pairingRequest(CLIENT_NAME)));
  socket.on('data', (chunk) => {
    const { frames, rest } = splitFrames(Buffer.concat([pending, chunk]));
    pending = rest;
    for (const frame of frames) answer(socket, steps, readPairingMessage(frame));
  });
  socket.on('error', cancel);
  socket.on('close', () => closed.abort());

  const confirm = async (code: string) => {
    if (!PAIRING_CODE.test(code)) throw new Error('The code is 6 characters, digits and letters A to F. Pair again to get a new one.');
    const secret = secretProving(code, [new X509Certificate(credentials.cert), socket.getPeerX509Certificate()]);
    if (!secret) {
      cancel();
      throw new Error(REJECTED_CODE);
    }
    const isPaired = once(steps, 'paired', { signal: closed.signal });
    socket.write(pairingSecret(secret));
    await isPaired.catch(() => Promise.reject(new Error(REJECTED_CODE)));
    return credentials;
  };

  const timeout = setTimeout(cancel, CODE_REQUEST_TIMEOUT_MS);
  await once(steps, 'codeShown', { signal: closed.signal })
    .catch(() => Promise.reject(new Error(`Player ${host} did not show a pairing code`)))
    .finally(() => clearTimeout(timeout));
  return { confirm, cancel };
}

function answer(socket: tls.TLSSocket, steps: EventEmitter, message: ReceivedPairingMessage): void {
  if (!message.isAccepted) {
    socket.destroy();
  } else if (message.pairingRequestAck) {
    socket.write(pairingOption());
  } else if (message.pairingOption) {
    socket.write(pairingConfiguration());
  } else if (message.pairingConfigurationAck) {
    steps.emit('codeShown');
  } else if (message.pairingSecretAck) {
    steps.emit('paired');
    socket.destroy();
  }
}

// the code's first byte is the first byte of the hash: a mistyped code is caught before it reaches the player
function secretProving(code: string, [client, player]: [X509Certificate, X509Certificate | undefined]): Buffer | undefined {
  if (!player) return undefined;
  const [check, ...nonce] = Buffer.from(code, 'hex');
  const hash = createHash('sha256');
  for (const number of [...rsaNumbers(client), ...rsaNumbers(player)]) hash.update(number);
  const secret = hash.update(Buffer.from(nonce)).digest();
  return secret[0] === check ? secret : undefined;
}

function rsaNumbers(certificate: X509Certificate): Buffer[] {
  const { n, e } = certificate.publicKey.export({ format: 'jwk' });
  if (!n || !e) throw new Error('Pairing needs RSA certificates');
  return [Buffer.from(n, 'base64url'), Buffer.from(e, 'base64url')];
}
