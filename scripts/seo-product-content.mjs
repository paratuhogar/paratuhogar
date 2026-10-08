// Copy reviewed against the public product pages on 2026-10-08.
// Only use model facts while the same catalogue identity and description remain.
export const stripHtml = value => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ').trim();

export const truncate = (value, max) => {
  const clean = stripHtml(value);
  return clean.length <= max ? clean : clean.slice(0, max).replace(/\s+\S*$/, '').replace(/[,:;.!?\s]+$/, '');
};

export function metaDescription(value, fallback, max = 158) {
  const clean = stripHtml(value);
  if (clean.length >= 45 && clean.length <= max) return clean;
  if (clean.length > max) {
    // A decimal point is not the end of a sentence. Keep a contiguous prefix;
    // never skip the model/name to select a shorter sentence from the middle.
    const sentences = (clean.match(/.+?[.!?](?=\s|$)/g) || []).map(sentence => sentence.trim());
    let complete = '';
    for (const sentence of sentences) {
      if (!clean.startsWith(`${complete} ${sentence}`.trim())) break;
      const next = `${complete} ${sentence}`.trim();
      if (next.length > max) break;
      complete = next;
    }
    if (complete.length >= 70) return complete;
  }
  return truncate(fallback, max);
}

const reviewed = [
  {
    id: 'e591c61c-7495-4e56-8d77-8f492a7a5df6',
    name: 'Panel 30V 400W',
    required: [/JCN-M400/i, /Monocristalino/i, /400\s*W/i],
    title: 'Panel solar 400 W JCN-M400 en Cuba | ParaTuHogar',
    description: 'Panel solar monocristalino JCN-M400 de 400 W. Consulta características, precio en USD y disponibilidad en Cuba con ParaTuHogar.'
  },
  {
    id: 'd0c5644d-7be3-4504-be6d-dee3d5d300b8',
    name: 'Panel Solar 590W WAAREE',
    required: [/BiN-08-590/i, /TOPCon/i, /Bifacialidad:\s*S[ií]/i, /590\s*W/i],
    title: 'Panel solar bifacial WAAREE 590 W en Cuba | ParaTuHogar',
    description: 'Panel solar bifacial WAAREE BiN-08-590 de 590 W, N-Type TOPCon. Consulta características, precio en USD y disponibilidad en Cuba con ParaTuHogar.'
  }
];

export function reviewedProductCopy(product) {
  const text = stripHtml(product.descripcion || product.description);
  const match = reviewed.find(item => String(product.id) === item.id
    && String(product.nombre || product.name).trim() === item.name
    && item.required.every(pattern => pattern.test(text)));
  return match || {};
}

export const isSolarPanel = product => /^energ[ií]a$/i.test(String(product.categoria || product.category || '').trim())
  && /^panel(?:es)?\s+(?:solar(?:es)?\b|\d+\s*[vw]\b)/i.test(String(product.nombre || product.name || '').trim());

export function relatedProducts(product, products, isAvailable, hasValidPrice, limit = 4) {
  const price = Number(product.precio) || 0;
  const panels = isSolarPanel(product);
  return products.filter(other => other !== product && isAvailable(other) && hasValidPrice(other))
    .map(other => ({
      product: other,
      // Solar pages recommend panels before accessories or backup equipment.
      kind: panels && !isSolarPanel(other) ? 1 : 0,
      score: (String(other.categoria || '').toLowerCase() === String(product.categoria || '').toLowerCase() ? 0 : 4)
        + (price ? Math.abs((Number(other.precio) || 0) - price) / price : 1)
    })).sort((a, b) => a.kind - b.kind || a.score - b.score).slice(0, limit).map(item => item.product);
}
