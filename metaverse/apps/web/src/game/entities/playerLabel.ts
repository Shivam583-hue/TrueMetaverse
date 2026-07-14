export function resolvePlayerLabel(
  userId: string,
  username?: string | null,
): string {
  const normalized = username?.trim();
  return normalized || userId.slice(0, 8) || "player";
}
