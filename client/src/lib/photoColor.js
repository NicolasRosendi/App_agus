// Saca el color de la carrocería de una foto: muestrea la zona central (donde suele estar
// el auto), agrupa por tono los píxeles saturados y promedia el grupo dominante.
// Si el auto es blanco/gris/negro, decide por luminancia.

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max / 255 };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** @returns {Promise<{ color: string, kind: 'color'|'neutral' }>} */
export async function colorFromPhoto(fileOrUrl) {
  const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  try {
    const img = await loadImage(url);
    const S = 72;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S);
    const { data } = ctx.getImageData(Math.round(S * 0.15), Math.round(S * 0.3), Math.round(S * 0.7), Math.round(S * 0.5));

    const bins = Array.from({ length: 18 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    const lum = [];
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const { h, s, v } = hsv(r, g, b);
      total++;
      lum.push(v);
      if (s < 0.32 || v < 0.18) continue;
      const bin = bins[Math.floor(h / 20) % 18];
      const w = s * v;
      bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
    }
    const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
    // Suficiente "pintura" saturada como para ser el color del auto
    if (best.w / total > 0.06) {
      return { color: toHex(best.r / best.w, best.g / best.w, best.b / best.w), kind: 'color' };
    }
    lum.sort((a, b) => a - b);
    const mid = lum[Math.floor(lum.length * 0.6)];
    return { color: mid > 0.7 ? '#efefef' : mid > 0.38 ? '#8e949b' : '#1d1e21', kind: 'neutral' };
  } finally {
    if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url);
  }
}
