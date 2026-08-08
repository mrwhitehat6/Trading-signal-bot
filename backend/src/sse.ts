import type { Response } from 'express';
import type { SSEEvent } from './types';

const clients = new Set<Response>();

export function addSSEClient(res: Response): void {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

export function broadcast(event: SSEEvent): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
}
