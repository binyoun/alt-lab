// The sky over the whole studio, from the wall clock, so every visitor sees
// the same hour and the same clouds. A day passes every fifteen minutes.
// Exposures out in the light run faster at noon, slower at dawn and dusk,
// and slower still under cloud, as they did.

export const DAY = 15 * 60;

export function skyNow(ms = Date.now()) {
  const t = ms / 1000;
  const time = ((t / DAY) + 0.3) % 1;
  // a slow, even drift between clear and overcast
  const n = Math.sin(t / 97) * 0.5 + Math.sin(t / 233 + 1.7) * 0.35 + Math.sin(t / 41 + 0.4) * 0.15;
  const cover = Math.min(1, Math.max(0, (n - 0.05) * 1.25));
  return { time, cover };
}

// how much faster (over 1) or slower (under 1) the sun prints right now
export function lightFactor({ time, cover }) {
  const elev = Math.sin(time * Math.PI);
  return (0.45 + elev * 0.85) * (1 - cover * 0.55);
}

export function skyWords({ time, cover }) {
  const part = time < 0.2 ? 'Morning' : time < 0.4 ? 'Late morning' : time < 0.6 ? 'Midday' : time < 0.8 ? 'Afternoon' : 'Evening';
  const sky = cover > 0.6 ? 'overcast' : cover > 0.3 ? 'hazy sun' : 'bright sun';
  return `${part}, ${sky}`;
}

export function lightWords(sky) {
  const f = lightFactor(sky);
  return f > 1.05 ? 'strong light: the print comes up quickly'
    : f > 0.75 ? 'fair light'
    : f > 0.5 ? 'weak light: expect a longer exposure'
    : 'poor light: this will take patience';
}
