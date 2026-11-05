export function mixColors(from: string, to: string, amount: number): string {
  const start = from.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16)) ?? [0, 0, 0];
  const end = to.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16)) ?? [0, 0, 0];
  const channels = start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
