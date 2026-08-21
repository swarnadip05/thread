export function fallbackPollingInterval(connected: boolean): number {
  return connected ? 60_000 : 15_000;
}
