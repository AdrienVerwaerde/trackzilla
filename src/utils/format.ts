function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatTime(at: number) {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${pad(seconds % 60)}s`;

  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}
