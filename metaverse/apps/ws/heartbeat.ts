export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_HEARTBEAT_INTERVAL_MS = 100;

export const resolveHeartbeatInterval = (
  raw: string | undefined,
  fallback = DEFAULT_HEARTBEAT_INTERVAL_MS,
): number => {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_HEARTBEAT_INTERVAL_MS) {
    return fallback;
  }
  return parsed;
};

type Pingable = {
  ping(): void;
  terminate(): void;
};

type ClientSource<T> = { clients: Iterable<T> };

export type Heartbeat<T> = {
  markAlive(client: T): void;
  sweep(): T[];
  stop(): void;
};

export function createHeartbeat<T extends Pingable>(
  source: ClientSource<T>,
  intervalMs = resolveHeartbeatInterval(process.env.WS_HEARTBEAT_INTERVAL_MS),
): Heartbeat<T> {
  const alive = new WeakSet<object>();

  const markAlive = (client: T) => {
    alive.add(client);
  };

  const sweep = (): T[] => {
    const terminated: T[] = [];
    for (const client of source.clients) {
      if (!alive.has(client)) {
        terminated.push(client);
        client.terminate();
        continue;
      }
      alive.delete(client);
      client.ping();
    }
    return terminated;
  };

  const timer = setInterval(sweep, intervalMs);
  timer.unref?.();

  return { markAlive, sweep, stop: () => clearInterval(timer) };
}
