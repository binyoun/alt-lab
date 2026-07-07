// The Master looks over the finished print and says what he sees.
// The verdict is computed from the real state of the ritual.

const DEFAULT_REMARKS = {
  thin: 'The coating is thin as a rumour. Charge the brush properly and go again.',
  pale: 'It hardly saw the sun. A shy print; give the next one more time.',
  fine: 'A fine print. I would not be ashamed to hang it in the window.',
  over: 'You have cooked it. See how the shadows close over; the sun keeps what you give it.',
  fair: 'Honest work, near the mark. A little more care with the light and it will sing.',
};

export function judge(config, result) {
  const eff = (result.exposure * result.adj) / config.idealExposure;
  let tier;
  if (result.coverage < 0.15) tier = 'thin';
  else if (eff < 0.62) tier = 'pale';
  else if (eff >= 0.72 && eff <= 1.45) tier = 'fine';
  else if (eff > 1.6) tier = 'over';
  else tier = 'fair';
  const remark = (config.remarks && config.remarks[tier]) || DEFAULT_REMARKS[tier];
  return { tier, remark, eff, seal: tier === 'fine' };
}
