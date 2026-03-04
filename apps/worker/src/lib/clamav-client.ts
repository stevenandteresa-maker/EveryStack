/**
 * Lightweight ClamAV TCP client using the INSTREAM protocol.
 *
 * Connects to ClamAV daemon (clamd) and streams file data for virus scanning.
 * Protocol: zINSTREAM\0 → [4-byte-length + chunk]... → [4-zero-bytes] → response
 */

import * as net from 'node:net';

const CHUNK_SIZE = 8192;
const SCAN_TIMEOUT_MS = 30_000;

export interface ClamScanResult {
  isInfected: boolean;
  virusName?: string;
}

export interface ClamAvConfig {
  host: string;
  port: number;
}

function getClamAvConfig(): ClamAvConfig {
  return {
    host: process.env['CLAMAV_HOST'] ?? 'localhost',
    port: Number(process.env['CLAMAV_PORT'] ?? '3310'),
  };
}

/**
 * Scan a buffer for viruses using ClamAV daemon via TCP INSTREAM command.
 *
 * @throws Error if connection refused or scan times out
 */
export async function scanBuffer(
  buffer: Buffer,
  config?: ClamAvConfig,
): Promise<ClamScanResult> {
  const { host, port } = config ?? getClamAvConfig();

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let response = '';

    socket.connect(port, host, () => {
      // Send INSTREAM command (null-terminated)
      socket.write('zINSTREAM\0');

      // Send data in chunks with 4-byte big-endian length prefix
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.subarray(i, i + CHUNK_SIZE);
        const lengthBuf = Buffer.alloc(4);
        lengthBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lengthBuf);
        socket.write(chunk);
      }

      // Send end marker (4 zero bytes)
      socket.write(Buffer.alloc(4));
    });

    socket.on('data', (data: Buffer) => {
      response += data.toString();
    });

    socket.on('end', () => {
      const trimmed = response.replace(/\0/g, '').trim();
      if (trimmed.endsWith('OK')) {
        resolve({ isInfected: false });
      } else if (trimmed.includes('FOUND')) {
        const match = /stream:\s+(.+)\s+FOUND/.exec(trimmed);
        resolve({ isInfected: true, virusName: match?.[1] ?? 'unknown' });
      } else {
        reject(new Error(`Unexpected ClamAV response: ${trimmed}`));
      }
    });

    socket.on('error', (err: Error) => {
      reject(err);
    });

    socket.setTimeout(SCAN_TIMEOUT_MS, () => {
      socket.destroy();
      reject(new Error('ClamAV scan timed out'));
    });
  });
}
