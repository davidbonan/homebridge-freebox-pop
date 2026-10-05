import protobuf from 'protobufjs';

const PairingMessage = protobuf.parse(`
  syntax = "proto3";

  message PairingRequest {
    string service_name = 1;
    string client_name = 2;
  }
  message PairingRequestAck {
    string server_name = 1;
  }
  message PairingEncoding {
    int32 type = 1;
    uint32 symbol_length = 2;
  }
  message PairingOption {
    repeated PairingEncoding input_encodings = 1;
    repeated PairingEncoding output_encodings = 2;
    int32 preferred_role = 3;
  }
  message PairingConfiguration {
    PairingEncoding encoding = 1;
    int32 client_role = 2;
  }
  message PairingConfigurationAck {
  }
  message PairingSecret {
    bytes secret = 1;
  }
  message PairingSecretAck {
    bytes secret = 1;
  }
  message PairingMessage {
    int32 protocol_version = 1;
    int32 status = 2;
    PairingRequest pairing_request = 10;
    PairingRequestAck pairing_request_ack = 11;
    PairingOption pairing_option = 20;
    PairingConfiguration pairing_configuration = 30;
    PairingConfigurationAck pairing_configuration_ack = 31;
    PairingSecret pairing_secret = 40;
    PairingSecretAck pairing_secret_ack = 41;
  }
`).root.lookupType('PairingMessage');

const PROTOCOL_VERSION = 2;
const STATUS_OK = 200;
const INPUT_ROLE = 1;
const HEXADECIMAL_CODE = { type: 3, symbolLength: 6 };

export interface ReceivedPairingMessage {
  isAccepted: boolean;
  pairingRequestAck?: object;
  pairingOption?: object;
  pairingConfigurationAck?: object;
  pairingSecretAck?: object;
}

export function readPairingMessage(frame: Uint8Array): ReceivedPairingMessage {
  const { status, ...steps } = PairingMessage.decodeDelimited(frame).toJSON();
  return { ...steps, isAccepted: status === STATUS_OK };
}

export function pairingRequest(clientName: string): Uint8Array {
  return encoded({ pairingRequest: { serviceName: clientName, clientName } });
}

export function pairingOption(): Uint8Array {
  return encoded({ pairingOption: { preferredRole: INPUT_ROLE, inputEncodings: [HEXADECIMAL_CODE] } });
}

export function pairingConfiguration(): Uint8Array {
  return encoded({ pairingConfiguration: { clientRole: INPUT_ROLE, encoding: HEXADECIMAL_CODE } });
}

export function pairingSecret(secret: Uint8Array): Uint8Array {
  return encoded({ pairingSecret: { secret } });
}

function encoded(step: object): Uint8Array {
  const message = PairingMessage.fromObject({ ...step, status: STATUS_OK, protocolVersion: PROTOCOL_VERSION });
  return PairingMessage.encodeDelimited(message).finish();
}
