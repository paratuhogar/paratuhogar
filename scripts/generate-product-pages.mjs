#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import process from 'node:process';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SITE_URL = String(process.env.SITE_URL || 'https://paratuhogar.org').replace(/\/+$/, '');
// Son credenciales públicas de navegador (RLS debe seguir protegiendo las tablas).
// Las variables de entorno permiten reemplazarlas en CI sin editar el archivo.
const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://ljqwaovevfatkiigirhf.supabase.co').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt');
const JSON_PATH = process.argv.find(arg => arg.startsWith('--json='))?.slice(7)
  || process.env.PRODUCTS_JSON || '';
const TEMPLATE_PATH = join(ROOT, 'templates', 'product-page.html');
const CATEGORY_TEMPLATE_PATH = join(ROOT, 'templates', 'category-page.html');
const OUTPUT_ROOT = join(ROOT, 'producto');
const CATEGORY_OUTPUT_ROOT = join(ROOT, 'categoria');

const htmlEscape = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const attr = htmlEscape;
const stripHtml = value => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ').trim();
const truncate = (value, max) => {
  const clean = stripHtml(value);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};
const slugify = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
const absoluteUrl = value => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `${SITE_URL}/${text.replace(/^\/+/, '')}`;
};
const productImageUrl = value => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\/(?:raw\.githubusercontent\.com|images\.unsplash\.com|res\.cloudinary\.com|.*\.supabase\.co)\//i.test(text)) return text;
  let filename = text.split('/').pop().split('?')[0];
  try { filename = decodeURIComponent(filename); } catch {}
  filename = filename.trim().replace(/['"]/g, '').replace(/\s+/g, '');
  return `https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/${encodeURIComponent(filename)}`;
};
const isAvailable = product => {
  const value = String(product.disponible ?? product.available ?? 'SI').trim().toUpperCase();
  return ['SI', 'SÍ', 'YES', 'TRUE', '1', 'DISPONIBLE', 'EN STOCK'].includes(value);
};
const getImages = product => [...new Set([
  product.thumbnail, product.image1, product.image2, product.image3,
  ...(Array.isArray(product.imagenes) ? product.imagenes : []),
  ...(Array.isArray(product.fotos_reales) ? product.fotos_reales : [])
].filter(Boolean).map(productImageUrl))];

function sanitizeHtml(input) {
  let html = String(input ?? '').trim();
  if (!html) return '';
  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\shref\s*=\s*(["'])\s*(?:javascript|data):[\s\S]*?\1/gi, ' href="#"')
    .replace(/\ssrc\s*=\s*(["'])\s*(?:javascript|data:text\/html):[\s\S]*?\1/gi, '');
  return html;
}

async function loadProducts() {
  if (JSON_PATH) {
    const parsed = JSON.parse(await readFile(resolve(ROOT, JSON_PATH), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.products || parsed.productos || [];
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Define PRODUCTS_JSON/--json o SUPABASE_URL + SUPABASE_ANON_KEY.');
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=*&order=nombre.asc`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}: ${await response.text()}`);
  return response.json();
}

async function loadVerifiedReviews() {
  if (JSON_PATH || !SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  const query = 'select=id,producto_id,producto_nombre,producto_imagen_url,comentario,valoracion_atencion,valoracion_mensajeria,municipio,mostrar_municipio,foto_url,foto_autorizada,fecha_entrega&aprobada=eq.true&consentimiento_publicacion=eq.true&order=fecha_entrega.desc';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/opiniones_verificadas?${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!response.ok) return [];
  return response.json();
}

function parseSpecifications(product) {
  const source = product.especificaciones ?? product.specifications ?? product.caracteristicas;
  if (!source) return [];
  if (Array.isArray(source)) return source.map((item, index) => (
    typeof item === 'object' ? [item.nombre || item.label || `Dato ${index + 1}`, item.valor || item.value || '']
      : [`Dato ${index + 1}`, item]
  ));
  if (typeof source === 'object') return Object.entries(source);
  return String(source).split(/\r?\n|;/).map(line => {
    const [key, ...rest] = line.split(':');
    return rest.length ? [key, rest.join(':')] : ['', key];
  }).filter(([, value]) => String(value).trim());
}

function productDescription(product) {
  return sanitizeHtml(product.descripcion || product.description || '')
    || `<p>${htmlEscape(`${product.nombre}. Consulta sus características, garantía y opciones de entrega con nuestro equipo.`)}</p>`;
}

function relatedProducts(product, products, limit = 4) {
  const price = Number(product.precio) || 0;
  return products.filter(other => other !== product && isAvailable(other))
    .map(other => ({
      product: other,
      score: (String(other.categoria || '').toLowerCase() === String(product.categoria || '').toLowerCase() ? 0 : 4)
        + (price ? Math.abs((Number(other.precio) || 0) - price) / price : 1)
    })).sort((a, b) => a.score - b.score).slice(0, limit).map(item => item.product);
}

function render(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => values[key] ?? '');
}

function renderProduct(template, product, products, reviews, usedSlugs) {
  const baseSlug = slugify(product.slug || product.nombre) || `producto-${product.id || usedSlugs.size + 1}`;
  let slug = baseSlug, suffix = 2;
  while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
  usedSlugs.add(slug);

  const name = String(product.nombre || product.name || 'Producto ParaTuHogar').trim();
  const category = String(product.categoria || product.category || 'Productos').trim();
  const price = Number(product.precio ?? product.price) || 0;
  const available = isAvailable(product);
  const images = getImages(product);
  const mainImage = images[0] || `${SITE_URL}/log.jpeg`;
  const canonical = `${SITE_URL}/producto/${slug}/`;
  const categoryCanonical = `${SITE_URL}/categoria/${slugify(category) || 'productos'}/`;
  const rawDescription = stripHtml(product.seo_description || product.descripcion || '');
  const descriptionText = truncate(
    rawDescription.length >= 45
      ? rawDescription
      : `${name} disponible en ParaTuHogar, Cuba. Consulta precio en USD, fotografías, garantía, entrega y atención personalizada.`,
    158
  );
  const seoTitle = truncate(product.seo_title || `${name} | Precio y detalles en Cuba`, 60);
  const warranty = String(product.garantia || 'Garantía disponible').trim();
  const delivery = String(product.mensajeria || 'Entrega coordinada').trim();
  const updated = product.inventario_actualizado_en || product.updated_at || product.fecha_actualizacion;
  const updatedText = updated ? `Inventario actualizado el ${new Intl.DateTimeFormat('es-CU', { dateStyle: 'medium' }).format(new Date(updated))}.` : 'Disponibilidad sujeta a confirmación al realizar el pedido.';
  const specs = parseSpecifications(product);
  const sheet = absoluteUrl(product.ficha_tecnica_url || product.ficha_tecnica || product.pdf_url || '');
  const related = relatedProducts(product, products);
  const productReviews = reviews.filter(review =>
    (review.producto_id && String(review.producto_id) === String(product.id))
    || String(review.producto_nombre || '').trim().toLowerCase() === name.toLowerCase()
  );
  const buyBase = `${SITE_URL}/?search=${encodeURIComponent(name)}&accion=pedido`;
  const consultBase = `${SITE_URL}/?search=${encodeURIComponent(name)}&accion=consultar`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${canonical}#product`,
        name,
        description: descriptionText,
        url: canonical,
        image: images.length ? images : [mainImage],
        sku: String(product.sku || product.id || slug),
        category,
        offers: {
          '@type': 'Offer',
          url: canonical,
          priceCurrency: 'USD',
          price: price.toFixed(2),
          availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: 'ParaTuHogar', url: SITE_URL }
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: category, item: categoryCanonical },
          { '@type': 'ListItem', position: 3, name, item: canonical }
        ]
      }
    ]
  };
  if (product.marca) jsonLd['@graph'][0].brand = { '@type': 'Brand', name: String(product.marca) };
  if (product.gtin) jsonLd['@graph'][0].gtin = String(product.gtin);
  if (product.mpn) jsonLd['@graph'][0].mpn = String(product.mpn);
  if (productReviews.length) {
    jsonLd['@graph'][0].review = productReviews.map(review => ({
      '@type': 'Review',
      reviewBody: stripHtml(review.comentario),
      datePublished: review.fecha_entrega ? new Date(review.fecha_entrega).toISOString().slice(0, 10) : undefined,
      author: { '@type': 'Person', name: 'Cliente verificado' },
      ...(Number(review.valoracion_atencion) > 0 ? {
        reviewRating: {
          '@type': 'Rating',
          ratingValue: Number(review.valoracion_atencion),
          bestRating: 5,
          worstRating: 1
        }
      } : {})
    }));
    const rated = productReviews.filter(review => Number(review.valoracion_atencion) > 0);
    if (rated.length) {
      jsonLd['@graph'][0].aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: (rated.reduce((sum, review) => sum + Number(review.valoracion_atencion), 0) / rated.length).toFixed(1),
        reviewCount: rated.length,
        bestRating: 5,
        worstRating: 1
      };
    }
  }

  const thumbnails = images.map((image, index) =>
    `<button class="thumb" type="button" data-src="${attr(image)}" data-alt="${attr(`${name}, foto ${index + 1}`)}" aria-label="Ver foto ${index + 1}"><img src="${attr(image)}" alt="" width="72" height="72" ${index ? 'loading="lazy"' : ''}></button>`
  ).join('');
  const specificationsSection = specs.length ? `<section class="section"><h2>Especificaciones</h2><div class="specs">${
    specs.map(([key, value]) => `<div class="spec">${key ? `<strong>${htmlEscape(key)}</strong><br>` : ''}${htmlEscape(value)}</div>`).join('')
  }</div></section>` : '';
  const datasheetSection = sheet ? `<section class="section"><h2>Ficha técnica</h2><div class="sheet"><div><strong>Documento oficial del equipo</strong><br><small>Consulta o descarga sus especificaciones completas.</small></div><a class="js-attributed-link" href="${attr(sheet)}" target="_blank" rel="noopener">Abrir PDF</a></div></section>` : '';
  const relatedSection = related.length ? `<section class="section"><h2>También podría interesarte</h2><div class="related">${
    related.map(item => {
      const itemSlug = slugify(item.slug || item.nombre);
      const image = getImages(item)[0] || `${SITE_URL}/log.jpeg`;
      return `<a class="card" href="/producto/${attr(itemSlug)}/"><img src="${attr(image)}" alt="${attr(item.nombre)}" width="320" height="320" loading="lazy"><div class="cardbody"><h3>${htmlEscape(item.nombre)}</h3><strong>$${(Number(item.precio) || 0).toFixed(0)} USD</strong></div></a>`;
    }).join('')
  }</div></section>` : '';
  const reviewsSection = productReviews.length ? `<section class="section"><h2>Opiniones de compras verificadas</h2><div class="reviews">${
    productReviews.map(review => {
      const rating = Math.max(0, Math.min(5, Number(review.valoracion_atencion) || 0));
      const stars = rating ? `<div class="stars" aria-label="${rating} de 5 estrellas">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>` : '';
      const place = review.mostrar_municipio && review.municipio ? ` · ${htmlEscape(review.municipio)}` : '';
      const date = review.fecha_entrega
        ? new Intl.DateTimeFormat('es-CU', { month: 'long', year: 'numeric' }).format(new Date(review.fecha_entrega))
        : 'Entrega verificada';
      const photo = review.foto_autorizada && review.foto_url
        ? `<img src="${attr(absoluteUrl(review.foto_url))}" alt="Foto real autorizada de la compra entregada" width="560" height="360" loading="lazy">`
        : '';
      return `<article class="review"><div class="verified">✓ Compra entregada</div>${stars}<blockquote>“${htmlEscape(review.comentario)}”</blockquote><small>${htmlEscape(date)}${place} · Identidad protegida</small>${photo}</article>`;
    }).join('')
  }</div></section>` : '';

  return {
    slug,
    product,
    canonical,
    mainImage,
    available,
    updated: updated || '',
    html: render(template, {
      SEO_TITLE: htmlEscape(seoTitle),
      SEO_DESCRIPTION: attr(descriptionText),
      CANONICAL_URL: attr(canonical),
      SOCIAL_IMAGE: attr(mainImage),
      PRODUCT_NAME: htmlEscape(name),
      PRICE_AMOUNT: price.toFixed(2),
      PRICE_DISPLAY: price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      JSON_LD: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      CATEGORY: htmlEscape(category),
      CATEGORY_URL: attr(categoryCanonical),
      MAIN_IMAGE: attr(mainImage),
      THUMBNAILS: thumbnails,
      STATUS_TEXT: available ? '● Disponible ahora' : 'Temporalmente agotado',
      STATUS_BG: available ? '#ecfdf5' : '#f1f5f9',
      STATUS_COLOR: available ? '#047857' : '#64748b',
      SUMMARY: htmlEscape(descriptionText),
      WARRANTY: htmlEscape(warranty),
      DELIVERY: htmlEscape(delivery),
      CONSULT_URL: attr(consultBase),
      BUY_URL: available ? attr(buyBase) : '#',
      BUY_CLASS: available ? 'buy' : 'disabled',
      BUY_TEXT: available ? 'Pedir ahora' : 'No disponible',
      UPDATED_TEXT: htmlEscape(updatedText),
      DESCRIPTION_HTML: productDescription(product),
      SPECIFICATIONS_SECTION: specificationsSection,
      DATASHEET_SECTION: datasheetSection,
      REVIEWS_SECTION: reviewsSection,
      RELATED_SECTION: relatedSection,
      SUPABASE_URL_JSON: JSON.stringify(SUPABASE_URL),
      SUPABASE_ANON_KEY_JSON: JSON.stringify(SUPABASE_ANON_KEY)
    })
  };
}

async function main() {
  const [template, categoryTemplate, products, reviews] = await Promise.all([
    readFile(TEMPLATE_PATH, 'utf8'),
    readFile(CATEGORY_TEMPLATE_PATH, 'utf8'),
    loadProducts(),
    loadVerifiedReviews()
  ]);
  if (!products.length) throw new Error('No se encontraron productos para generar.');
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const usedSlugs = new Set();
  const generated = [];
  for (const product of products) {
    const page = renderProduct(template, product, products, reviews, usedSlugs);
    const directory = join(OUTPUT_ROOT, page.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), page.html, 'utf8');
    generated.push(page);
  }
  await mkdir(CATEGORY_OUTPUT_ROOT, { recursive: true });
  const categories = [...new Set(products.map(product => String(product.categoria || 'Productos').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  const generatedCategories = [];
  for (const category of categories) {
    const categorySlug = slugify(category) || 'productos';
    const categoryProducts = products.filter(product =>
      String(product.categoria || 'Productos').trim() === category && isAvailable(product)
    );
    if (!categoryProducts.length) continue;
    const canonical = `${SITE_URL}/categoria/${categorySlug}/`;
    const title = truncate(`${category} en Cuba | Precios y equipos disponibles`, 60);
    const description = truncate(`Compra ${category.toLowerCase()} en Cuba con precios en USD, fotografías reales, garantía, entrega coordinada y atención personalizada de ParaTuHogar.`, 158);
    const itemList = categoryProducts.slice(0, 50).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}/producto/${slugify(product.slug || product.nombre)}/`,
      name: product.nombre
    }));
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'CollectionPage', name: category, url: canonical, description },
        { '@type': 'ItemList', itemListElement: itemList },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: category, item: canonical }
          ]
        }
      ]
    };
    const cards = categoryProducts.map(product => {
      const productSlug = slugify(product.slug || product.nombre);
      const image = getImages(product)[0] || `${SITE_URL}/log.jpeg`;
      return `<article class="card"><a href="/producto/${attr(productSlug)}/"><img src="${attr(image)}" alt="${attr(product.nombre)}" width="420" height="420" loading="lazy"><div><h2>${htmlEscape(product.nombre)}</h2><strong>$${(Number(product.precio) || 0).toFixed(0)} USD</strong><span>Ver detalles</span></div></a></article>`;
    }).join('');
    const html = render(categoryTemplate, {
      SEO_TITLE: htmlEscape(title),
      SEO_DESCRIPTION: attr(description),
      CANONICAL_URL: attr(canonical),
      CATEGORY: htmlEscape(category),
      PRODUCT_COUNT: String(categoryProducts.length),
      PRODUCT_CARDS: cards,
      JSON_LD: JSON.stringify(jsonLd).replace(/</g, '\\u003c')
    });
    const directory = join(CATEGORY_OUTPUT_ROOT, categorySlug);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html, 'utf8');
    generatedCategories.push({ canonical, category });
  }
  const xmlEscape = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const toIsoDate = value => {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  const staticUrls = [
    { loc: `${SITE_URL}/`, lastmod: toIsoDate(new Date()) },
    { loc: `${SITE_URL}/gestores.html`, lastmod: toIsoDate(new Date()) }
  ];
  const sitemapEntries = [
    ...staticUrls.map(item => `  <url><loc>${xmlEscape(item.loc)}</loc><lastmod>${item.lastmod}</lastmod></url>`),
    ...generatedCategories.map(item => `  <url><loc>${xmlEscape(item.canonical)}</loc><lastmod>${toIsoDate(new Date())}</lastmod></url>`),
    ...generated.map(page => {
      const lastmod = toIsoDate(page.updated) || toIsoDate(new Date());
      const image = page.mainImage
        ? `<image:image><image:loc>${xmlEscape(page.mainImage)}</image:loc><image:title>${xmlEscape(page.product.nombre)}</image:title></image:image>`
        : '';
      return `  <url><loc>${xmlEscape(page.canonical)}</loc><lastmod>${lastmod}</lastmod>${image}</url>`;
    })
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${sitemapEntries.join('\n')}\n</urlset>\n`;
  await writeFile(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

  const manifest = generated.map(page => ({
    id: page.product.id,
    slug: page.slug,
    nombre: page.product.nombre,
    categoria: page.product.categoria || '',
    disponible: page.available,
    url: page.canonical,
    updated_at: page.updated || null
  }));
  await writeFile(join(ROOT, 'producto', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`SEO: ${generated.length} páginas generadas en ${OUTPUT_ROOT}`);
  console.log(generated.slice(0, 5).map(page => page.canonical).join('\n'));
  if (generated.length > 5) console.log(`… y ${generated.length - 5} más.`);
  console.log(`Sitemap: ${sitemapEntries.length} URLs canónicas.`);
  console.log(`Categorías SEO: ${generatedCategories.length}.`);
}

main().catch(error => {
  console.error(`Error generando páginas SEO: ${error.message}`);
  process.exitCode = 1;
});
