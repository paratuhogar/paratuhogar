/* Deterministic catalogue artwork. No submitted content becomes HTML or code. */
(function (root) {
 'use strict';
 const themes = {
  essential: { name: 'Azul esencial', ink: '#193f74', accent: '#204a86', paper: '#f0f5fc' },
  premium: { name: 'Grafito premium', ink: '#ffffff', accent: '#acc8ec', paper: '#131d2c' },
  technical: { name: 'Ficha clara', ink: '#193f74', accent: '#204a86', paper: '#ffffff' },
  editorial: { name: 'Hogar editorial', ink: '#273f35', accent: '#273f35', paper: '#f5f2eb' }
 };
 const aliases = { techno: 'essential', midnight: 'premium', minimal: 'technical', classic: 'editorial', impact: 'essential' };
 const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
 const money = value => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
 function facts(product) {
  const description = clean(product.descripcion), name = clean(product.nombre), source = name + ' ' + description;
  const rows = [], add = (label, value) => { if (value && !rows.some(row => row[1] === value)) rows.push([label, value]); };
  let match = source.match(/(\d+(?:[.,]\d+)?)\s*(?:pies(?:\s+c[úu]bicos)?|cu\.?\s*ft)/i);
  if (match) add('Capacidad', match[1] + ' pies cúbicos');
  else if ((match = source.match(/(\d+(?:[.,]\d+)?)\s*(?:litros?\b|L\b)/i))) add('Capacidad', match[1] + ' litros');
  if ((match = source.match(/(\d[\d,.]*)\s*BTU\b/i))) add('Capacidad', match[1] + ' BTU');
  if (/\binverter\b/i.test(source) && !/\b(?:no|sin)\s+(?:tecnolog[ií]a\s+)?inverter\b/i.test(source)) add('Tecnología', 'Inverter');
  if (/side\s*by\s*side/i.test(source)) add('Formato', 'Side by Side');
  if ((match = source.match(/(\d[\d,.]*)\s*(?:W\b|watts?\b|vatios?\b)/i))) add('Potencia', match[1] + ' W');
  if ((match = source.match(/(\d{2,3}(?:\s*[-/]\s*\d{2,3})?)\s*(?:V\b|voltios?\b)/i))) add('Voltaje', match[1] + ' V');
  if ((match = description.match(/(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?)\s*(mm|cm)/i))) add('Medidas', match[1] + ' ' + match[2]);
  const warranty = clean(product.garantia);
  if (warranty && !/^(null|undefined|no|n\/a)$/i.test(warranty)) add('Garantía', warranty);
  return rows.slice(0, 6);
 }
 function conditions(product, options = {}) {
  const result = [], warranty = clean(product.garantia), delivery = clean(product.mensajeria);
  if (options.showWarranty !== false && warranty && !/^(null|undefined|no|n\/a)$/i.test(warranty)) result.push('Garantía: ' + warranty);
  if (options.showDelivery !== false && delivery && !/^(null|undefined|no|n\/a)$/i.test(delivery)) result.push(delivery);
  return result;
 }
 function imageURL(value) {
  const raw = clean(value);
  if (!raw || /^(null|undefined)$/i.test(raw)) throw Error('Este producto no tiene una fotografía.');
  let filename = raw.split('/').pop().split('?')[0];
  try { filename = decodeURIComponent(filename); } catch (_) {}
  filename = filename.replace(/[\s'"]/g, '');
  return 'https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/' + encodeURIComponent(filename);
 }
 function photo(url, signal) {
  return new Promise((resolve, reject) => {
   const img = new Image(); img.crossOrigin = 'anonymous';
   const finish = error => { clearTimeout(timer); signal?.removeEventListener('abort', abort); img.onload = img.onerror = null; if (error) { img.src = ''; reject(error); } else resolve(img); };
   const abort = () => finish(new DOMException('Preparación cancelada.', 'AbortError'));
   const timer = setTimeout(() => finish(Error('La fotografía tardó demasiado. Comprueba la conexión y vuelve a preparar.')), 15000);
   img.onload = () => finish(); img.onerror = () => finish(Error('No se pudo cargar la fotografía. No se generó una imagen incompleta.'));
   signal?.addEventListener('abort', abort, { once: true });
   if (signal?.aborted) return abort();
   img.src = url;
  });
 }
 let fontPromise;
 function font() {
  if (!fontPromise) fontPromise = (async () => {
   const face = new FontFace('PTHManrope', 'url(assets/fonts/Manrope.ttf)', { weight: '200 800' });
   let timer;
   try { await Promise.race([face.load(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('No se pudo cargar la fuente del diseño. Vuelve a preparar.')), 10000); })]); document.fonts.add(face); }
   catch (error) { fontPromise = null; throw error; } finally { clearTimeout(timer); }
  })();
  return fontPromise;
 }
 function box(ctx, x, y, w, h, radius, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
 function text(ctx, value, x, y, size, width, color, weight = 800) {
  const valueText = clean(value); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = color;
  ctx.font = weight + ' ' + size + 'px PTHManrope, sans-serif';
  // Never abbreviate a price: fit the complete verified amount and currency.
  if (/\$\d/.test(valueText)) {
   let fitted = size;
   while (fitted > 18 && ctx.measureText(valueText).width > width) { fitted--; ctx.font = weight + ' ' + fitted + 'px PTHManrope, sans-serif'; }
   ctx.fillText(valueText, x, y, width); return;
  }
  let shown = valueText;
  while (shown.length && ctx.measureText(shown).width > width) shown = shown.slice(0, -1);
  if (shown !== valueText) { shown = shown.slice(0, -1) + '…'; }
  ctx.fillText(shown, x, y);
 }
 function lines(ctx, value, x, y, size, width, color, max = 2, weight = 800) {
  ctx.font = weight + ' ' + size + 'px PTHManrope, sans-serif';
  const words = clean(value).split(' '); let line = '', row = 0;
  while (words.length && row < max) {
   const word = words.shift(), trial = line ? line + ' ' + word : word;
   if (line && ctx.measureText(trial).width > width) { text(ctx, line, x, y + row++ * size * 1.2, size, width, color, weight); line = word; }
   else line = trial;
   if (row === max - 1) { line += words.length ? ' ' + words.join(' ') : ''; words.length = 0; }
  }
  if (line && row < max) text(ctx, line, x, y + row * size * 1.2, size, width, color, weight);
 }
 function brand(ctx, x, y, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x + 4, y + 22); ctx.lineTo(x + 23, y + 7); ctx.lineTo(x + 42, y + 22); ctx.moveTo(x + 10, y + 19); ctx.lineTo(x + 10, y + 40); ctx.lineTo(x + 36, y + 40); ctx.lineTo(x + 36, y + 19); ctx.moveTo(x + 20, y + 40); ctx.lineTo(x + 20, y + 28); ctx.lineTo(x + 27, y + 28); ctx.lineTo(x + 27, y + 40); ctx.stroke();
  text(ctx, 'paratuhogar', x + 56, y, 43, 360, color);
 }
 function image(ctx, img, x, y, w, h, radius = 28) {
  box(ctx, x, y, w, h, radius, '#fff'); ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.clip();
  const scale = Math.min((w - 40) / img.naturalWidth, (h - 40) / img.naturalHeight);
  const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
 }
 function contact(ctx, options, x, y, w, h, theme) {
  box(ctx, x, y, w, h, 24, theme.accent);
  const fg = theme === themes.premium ? '#131d2c' : '#fff';
  text(ctx, 'Consulta con tu gestor', x + 30, y + 22, 35, w - 100, fg);
  const phone = options.showPhone !== false ? String(options.gestorPhone || '').replace(/\D/g, '') : '';
  text(ctx, phone ? 'WhatsApp +' + phone : 'paratuhogar.org', x + 30, y + 69, 27, w - 80, fg, 600);
  arrow(ctx, x + w - 65, y + 37, 34, fg);
 }
 function arrow(ctx, x, y, size, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x + size, y); ctx.moveTo(x, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + size); ctx.stroke();
 }
 async function single(canvas, product, options = {}, signal) {
  await font(); const img = await photo(imageURL(product.thumbnail), signal);
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  canvas.width = 1080; canvas.height = options.isStory === false ? 1080 : 1920;
  const ctx = canvas.getContext('2d'), theme = themes[aliases[options.theme] || options.theme] || themes.essential;
  ctx.fillStyle = theme.paper; ctx.fillRect(0, 0, 1080, canvas.height);
  const rows = facts(product).filter(row => row[0] !== 'Garantía' || options.showWarranty !== false);
  const legal = conditions(product, options).join(' · '), price = options.showPrice !== false ? money(product.precio) + ' USD' : '';
  if (canvas.height === 1920) {
   const essential = theme === themes.essential;
   if (essential) { box(ctx, 0, 0, 1080, 725, 0, theme.accent); ctx.strokeStyle = '#315d96'; ctx.lineWidth = 85; ctx.beginPath(); ctx.arc(1060, 80, 405, 0, Math.PI * 2); ctx.stroke(); }
   if (theme === themes.technical) { ctx.strokeStyle = theme.accent; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 1068, 1908); }
   brand(ctx, 72, 160, essential ? '#fff' : theme.ink);
   text(ctx, clean(product.categoria).toUpperCase(), 620, 171, 25, 380, essential ? '#d2e1f6' : theme.ink, 600);
   const name = clean(product.nombre), sideBySide = essential ? name.match(/side\s*by\s*side/i) : null;
   if (sideBySide && sideBySide.index > 0 && sideBySide.index < 30) {
    text(ctx, name.slice(0, sideBySide.index), 72, 277, 77, 936, '#fff');
    text(ctx, sideBySide[0], 72, 380, 42, 936, '#d2e1f6', 600);
   } else lines(ctx, name, 72, 277, 70, 936, essential ? '#fff' : theme.ink, 2);
   if (theme === themes.technical) {
    image(ctx, img, 72, 464, 936, 670);
    rows.slice(0, 3).forEach((row, i) => { box(ctx, 72, 1160 + i * 69, 936, 61, 10, '#eef3fb'); text(ctx, row[0], 90, 1177 + i * 69, 25, 250, theme.ink, 600); text(ctx, row[1], 358, 1173 + i * 69, 30, 624, theme.ink); });
   } else if (theme === themes.editorial) {
    image(ctx, img, 72, 464, 570, 865, [190, 190, 24, 24]);
    rows.slice(0, 3).forEach((row, i) => { text(ctx, row[0].toUpperCase(), 686, 520 + i * 223, 22, 320, theme.ink, 600); lines(ctx, row[1], 686, 566 + i * 223, 40, 320, theme.ink, 3); });
   } else {
    image(ctx, img, 72, 457, 936, 751, theme === themes.premium ? [110, 30, 30, 30] : 36);
    rows.slice(0, 2).forEach((row, i) => { box(ctx, 72 + i * 475, 1236, 457, 74, 18, theme === themes.premium ? '#233249' : '#e3edfb'); text(ctx, row[1], 94 + i * 475, 1254, 31, 410, theme.ink); });
   }
   if (price) text(ctx, 'PRECIO DEL CATÁLOGO', 72, 1380, 26, 590, theme.ink, 600);
   text(ctx, price, 72, 1423, 110, 620, theme.ink);
   lines(ctx, legal, 715, 1418, 25, 293, theme.ink, 4, 600);
   contact(ctx, options, 72, 1571, 936, 133, theme);
  } else if (theme === themes.essential) {
   brand(ctx, 64, 52, theme.ink); text(ctx, product.categoria, 650, 64, 25, 360, theme.ink, 600);
   lines(ctx, product.nombre, 64, 179, 61, 470, theme.ink, 3);
   rows.slice(0, 2).forEach((row, i) => { box(ctx, 64, 451 + i * 81, 465, 67, 16, '#e0eafa'); text(ctx, row[1], 84, 470 + i * 81, 27, 420, theme.ink); });
   image(ctx, img, 593, 151, 425, 630);
   lines(ctx, legal, 64, 734, 23, 946, theme.ink, 2, 600);
   box(ctx, 0, 836, 1080, 244, 0, theme.accent); text(ctx, price, 64, 875, 91, 590, '#fff');
   text(ctx, 'Consulta este equipo', 665, 904, 28, 305, '#fff'); arrow(ctx, 987, 908, 24, '#fff'); text(ctx, 'paratuhogar.org', 665, 955, 26, 350, '#cfdff6', 600);
   if (options.showPhone !== false && options.gestorPhone) text(ctx, '+' + String(options.gestorPhone).replace(/\D/g, ''), 64, 1005, 27, 920, '#fff', 600);
  } else if (theme === themes.premium) {
   brand(ctx, 64, 56, theme.ink); text(ctx, product.categoria, 64, 156, 25, 450, theme.accent, 600);
   lines(ctx, product.nombre, 64, 207, 64, 451, theme.ink, 4);
   rows.slice(0, 2).forEach((row, i) => text(ctx, row[1], 64, 537 + i * 53, 27, 440, theme.accent, 600));
   image(ctx, img, 591, 176, 430, 652, [130, 30, 30, 30]); if (price) text(ctx, 'PRECIO DEL CATÁLOGO', 64, 673, 23, 430, theme.accent, 600); text(ctx, price, 64, 718, 69, 465, theme.ink);
   contact(ctx, options, 64, 864, 952, 120, theme); lines(ctx, legal, 64, 1008, 21, 940, theme.accent, 2, 600);
  } else if (theme === themes.technical) {
   ctx.strokeStyle = theme.accent; ctx.lineWidth = 14; ctx.strokeRect(7, 7, 1066, 1066);
   brand(ctx, 48, 36, theme.ink); text(ctx, 'FICHA DEL EQUIPO', 672, 48, 24, 360, theme.ink, 600);
   lines(ctx, product.nombre, 48, 128, 57, 960, theme.ink, 2); image(ctx, img, 576, 290, 445, 500);
   rows.slice(0, 5).forEach((row, i) => { box(ctx, 48, 288 + i * 98, 470, 91, 7, i % 2 ? '#fff' : '#f0f5fc'); text(ctx, row[0].toUpperCase(), 65, 300 + i * 98, 21, 430, theme.ink, 600); text(ctx, row[1], 65, 333 + i * 98, 30, 430, theme.ink); });
   if (options.showDelivery !== false) text(ctx, clean(product.mensajeria), 48, 808, 23, 960, theme.ink, 600);
   box(ctx, 14, 865, 1052, 201, 0, theme.accent); text(ctx, price, 48, 901, 82, 600, '#fff'); text(ctx, 'Consulta este equipo', 668, 919, 28, 305, '#fff'); arrow(ctx, 990, 923, 24, '#fff'); text(ctx, options.showPhone !== false && options.gestorPhone ? '+' + String(options.gestorPhone).replace(/\D/g, '') : 'paratuhogar.org', 668, 971, 25, 350, '#fff', 600);
  } else {
   brand(ctx, 62, 42, theme.ink); text(ctx, 'EQUIPAR EL HOGAR', 690, 56, 23, 327, theme.ink, 600);
   text(ctx, 'Para tu hogar.', 62, 157, 80, 956, theme.ink);
   image(ctx, img, 60, 330, 455, 601, [180, 180, 24, 24]);
   lines(ctx, product.nombre, 565, 333, 46, 455, theme.ink, 3);
   rows.slice(0, 2).forEach((row, i) => lines(ctx, row[1], 565, 520 + i * 82, 30, 446, theme.ink, 2, 600));
   text(ctx, price, 565, 734, 68, 450, theme.ink); lines(ctx, legal, 565, 832, 23, 450, theme.ink, 3, 600);
   contact(ctx, options, 60, 949, 960, 115, theme);
  }
  // Canvas receives only whitelisted public catalogue content and verified contact.
  return canvas;
 }
 async function composition(canvas, products, options = {}, signal) {
  await font(); const images = [];
  for (const product of products) images.push(await photo(imageURL(product.thumbnail), signal));
  canvas.width = 1080; canvas.height = options.isStory === false ? 1080 : 1920;
  const ctx = canvas.getContext('2d'), theme = themes[options.theme] || themes.essential, story = canvas.height === 1920;
  ctx.fillStyle = theme.paper; ctx.fillRect(0, 0, 1080, canvas.height);
  const top = story ? 160 : 45; brand(ctx, 60, top, theme.ink);
  const title = clean(options.compositionTitle) || (options.mode === 'compare' ? 'Compara estos equipos' : 'Equipos para tu hogar');
  lines(ctx, title, 60, top + 95, story ? 62 : 49, 960, theme.ink, 2);
  const cols = products.length > 1 ? 2 : 1, rowCount = Math.ceil(products.length / cols), start = top + 250;
  const bottom = story ? 1390 : 812, cellH = (bottom - start) / rowCount, cellW = 960 / cols;
  products.forEach((product, index) => {
   const x = 60 + (index % cols) * cellW, y = start + Math.floor(index / cols) * cellH, w = cellW - 16;
   const photoH = Math.max(56, cellH - (options.mode === 'compare' ? 175 : 120));
   image(ctx, images[index], x, y, w, photoH, 18);
   lines(ctx, product.nombre, x + 8, y + photoH + 8, story ? 26 : 23, w - 16, theme.ink, 2);
   if (options.showPrice !== false) text(ctx, money(product.precio) + ' USD', x + 8, y + cellH - (options.mode === 'compare' ? 70 : 37), story ? 29 : 25, w - 16, theme.ink);
   if (options.mode === 'compare') text(ctx, facts(product).slice(0, 2).map(row => row[1]).join(' · '), x + 8, y + cellH - 31, 20, w - 16, theme.ink, 600);
  });
  if (['bundle', 'multi'].includes(options.mode) && options.showPrice !== false) text(ctx, 'Total: ' + money(options.promoPrice > 0 ? options.promoPrice : products.reduce((sum, p) => sum + Number(p.precio), 0)) + ' USD', 60, story ? 1434 : 847, story ? 61 : 40, 960, theme.ink);
  // Conditions varying by product belong in the accompanying text, never a blanket promise.
  contact(ctx, options, 60, story ? 1571 : 942, 960, story ? 133 : 120, theme);
  return canvas;
 }
 root.PTHStudioDesigns = { themes, clean, money, facts, conditions, imageURL, single, composition };
})(window);
