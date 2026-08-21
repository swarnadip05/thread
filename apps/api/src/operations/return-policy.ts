export function isWithinReturnWindow(
  deliveredAt: Date,
  windowDays: number,
  now = new Date(),
): boolean {
  if (!Number.isInteger(windowDays) || windowDays < 1 || now < deliveredAt) return false;
  return now.getTime() <= deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1_000;
}
