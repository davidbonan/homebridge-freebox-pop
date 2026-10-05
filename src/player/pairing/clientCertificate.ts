import { X509Certificate, createSign, generateKeyPair, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { PlayerCredentials } from '../pairedPlayerFile.ts';

const generateKeys = promisify(generateKeyPair);

const SEQUENCE = 0x30;
const SET = 0x31;
const INTEGER = 0x02;
const BIT_STRING = 0x03;
const NULL = 0x05;
const OBJECT_ID = 0x06;
const UTF8_STRING = 0x0c;
const UTC_TIME = 0x17;
const GENERALIZED_TIME = 0x18;
const VERSION = 0xa0;

const X509_V3 = der(VERSION, der(INTEGER, Buffer.from([2])));
const SHA256_WITH_RSA = der(SEQUENCE, der(OBJECT_ID, Buffer.from('2a864886f70d01010b', 'hex')), der(NULL));
const COMMON_NAME = der(OBJECT_ID, Buffer.from('550403', 'hex'));
// starts in the past: the player's clock may be behind the one of Homebridge
const VALIDITY = der(SEQUENCE, der(UTC_TIME, Buffer.from('250101000000Z')), der(GENERALIZED_TIME, Buffer.from('20991231235959Z')));

export async function createClientCertificate(commonName: string): Promise<PlayerCredentials> {
  const { publicKey, privateKey } = await generateKeys('rsa', { modulusLength: 2048 });
  const name = der(SEQUENCE, der(SET, der(SEQUENCE, COMMON_NAME, der(UTF8_STRING, Buffer.from(commonName)))));
  const serialNumber = der(INTEGER, Buffer.from([1]), randomBytes(19));
  const body = der(
    SEQUENCE,
    X509_V3,
    serialNumber,
    SHA256_WITH_RSA,
    name,
    VALIDITY,
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const signature = createSign('sha256').update(body).sign(privateKey);
  const certificate = der(SEQUENCE, body, SHA256_WITH_RSA, der(BIT_STRING, Buffer.from([0]), signature));

  return {
    cert: new X509Certificate(certificate).toString(),
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function der(tag: number, ...contents: Buffer[]): Buffer {
  const content = Buffer.concat(contents);
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const hex = length.toString(16);
  const bytes = Buffer.from(hex.padStart(hex.length + (hex.length % 2), '0'), 'hex');
  return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
}
