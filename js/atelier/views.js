// Views taken with the field camera in the country: small JPEGs kept on
// this device only, ready to develop as a tintype or a daguerreotype.

const KEY = 'altlab-views-v1';
const MAX = 4;

export function views() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

export function keepView(place, dataUrl) {
  const v = views();
  v.unshift({ place, ts: new Date().toISOString(), src: dataUrl });
  while (v.length > MAX) v.pop();
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* full: keep what fits */ }
}

export function viewImage(view) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      res(c);
    };
    img.onerror = rej;
    img.src = view.src;
  });
}
