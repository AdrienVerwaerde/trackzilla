function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatTime(at: number) {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
