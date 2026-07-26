// js/studio-core.js

const SUPABASE_URL = 'https://ljqwaovevfatkiigirhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allProducts = [];
let filteredProducts =[];
let gestorData = {};
let visibleCount = 12;
let studioShortSlug = '';
let studioRole = { isSubgestor: false, pricingOwner: '' };
let studioCacheInfo = { catalogAt: null, pricesAt: null };
const selectedProductIds = new Set();
const studioStoragePrefix = 'pth_studio_';
let studioFavorites = new Set();
let studioRecent = [];
let studioMetrics = {
    shared: 0,
    copies: 0,
    downloads: 0
};

function studioReadStorage(key, fallback) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return parsed ?? fallback;
    } catch (error) {
        return fallback;
    }
}

function studioStorageKey(name) {
    const owner = studioNormalize(gestorData.nombre || 'gestor').replace(/[^a-z0-9]+/g, '_');
    return `${studioStoragePrefix}${owner}_${name}`;
}

function loadStudioLocalState() {
    studioFavorites = new Set(studioReadStorage(studioStorageKey('favorites'), []));
    studioRecent = studioReadStorage(studioStorageKey('recent'), []);
    studioMetrics = {
        shared: 0,
        copies: 0,
        downloads: 0,
        ...studioReadStorage(studioStorageKey('metrics'), {})
    };
}

// CACHÉ DE IMÁGENES LIMPIAS (Para que no procese 2 veces la misma foto)
const imageCache = {}; 
const whiteBgCache = {};

window.addEventListener('load', async () => {
    const session = JSON.parse(localStorage.getItem('pth_session') || '{}');
    if (!session.name) {
        alert("🔒 Acceso Denegado.");
        window.location.href = 'index.html';
        return;
    }
    gestorData = session.data || {};
    gestorData.nombre = session.name;
    loadStudioLocalState();

    await resolveStudioRole();
    await loadInventory();
    await loadStudioShortSlug();
    renderStudioMetrics();
    renderStudioCacheStatus();

    const urlParams = new URLSearchParams(window.location.search);
    const paramQuery = urlParams.get('q');
    const paramCat = urlParams.get('cat');

    if (paramQuery) document.getElementById('ctrl-search').value = paramQuery;
    
    if (paramCat) {
        setTimeout(() => {
            const select = document.getElementById('ctrl-category');
            if (select.querySelector(`option[value="${paramCat}"]`)) select.value = paramCat;
            applyFilters();
        }, 500);
    } else {
        applyFilters();
    }

    // Los controles que cambian qué productos se muestran deben volver a filtrar.
    document.getElementById('ctrl-search').addEventListener('input', applyFilters);
    document.getElementById('ctrl-category').addEventListener('change', applyFilters);
    document.getElementById('ctrl-collection').addEventListener('change', applyFilters);

    // El tema solo cambia el diseño; no altera la selección de productos.
    document.getElementById('ctrl-theme').addEventListener('change', () => {
        visibleCount = 12;
        refreshPreviews();
    });
    
    // El toggle de IA debe regenerar la vista
    const switches =['toggle-format', 'toggle-ai-bg', 'toggle-price', 'toggle-phone', 'toggle-delivery', 'toggle-warranty'];
    switches.forEach(id => document.getElementById(id).addEventListener('change', refreshPreviews));
});

async function resolveStudioRole() {
    const isSubgestor = Boolean(gestorData.parent_id);
    studioRole = {
        isSubgestor,
        pricingOwner: isSubgestor ? String(gestorData.parent_nombre || '') : gestorData.nombre
    };
    if (!isSubgestor || studioRole.pricingOwner) return;

    const cacheKey = studioStorageKey('parent_identity');
    const cached = studioReadStorage(cacheKey, null);
    if (cached?.nombre) {
        studioRole.pricingOwner = cached.nombre;
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('gestores')
            .select('nombre')
            .eq('id', gestorData.parent_id)
            .maybeSingle();
        if (!error && data?.nombre) {
            studioRole.pricingOwner = data.nombre;
            localStorage.setItem(cacheKey, JSON.stringify({ nombre: data.nombre }));
        }
    } catch (error) {
        console.warn('No se pudo resolver el gestor principal del subgestor.', error);
    }
}

async function loadInventory() {
    let data = studioReadStorage('pth_catalogo_cache', null);
    studioCacheInfo.catalogAt = Number(localStorage.getItem('pth_catalogo_cache_time')) || null;
    if (!Array.isArray(data) || !data.length) {
        const response = await supabaseClient.from('productos').select('*').eq('disponible', 'SI').order('nombre');
        if (response.error) return;
        data = response.data || [];
        localStorage.setItem('pth_catalogo_cache', JSON.stringify(data));
        localStorage.setItem('pth_catalogo_cache_time', Date.now().toString());
        studioCacheInfo.catalogAt = Date.now();
    } else {
        data = data.filter(product => String(product.disponible || '').toUpperCase() === 'SI');
        console.log('📦 Studio: catálogo reutilizado desde la caché local.');
    }
    
    allProducts = data.map(product => ({
        ...product,
        _studioBasePrice: Number(product.precio) || 0,
        _studioBaseCommission: Number(product.comision) || 0
    }));

    if (studioRole.isSubgestor && !studioRole.pricingOwner) {
        allProducts = [];
        studioToast('No se pudo validar la configuración del subgestor');
    }
    
    // === NUEVO: FUSIÓN DE PRECIOS PERSONALIZADOS PARA EL STUDIO ===
    if (gestorData && gestorData.nombre && studioRole.pricingOwner) {
        const customCacheKey = studioStorageKey('custom_prices');
        const customCache = studioReadStorage(customCacheKey, null);
        const twelveHours = 12 * 60 * 60 * 1000;
        let pricingLoadFailed = false;
        let preciosCustom = customCache?.savedAt
            && Date.now() - Number(customCache.savedAt) < twelveHours
            && Array.isArray(customCache.data)
            ? customCache.data
            : null;
        studioCacheInfo.pricesAt = Number(customCache?.savedAt) || null;

        if (!preciosCustom) {
            const response = await supabaseClient
                .from('precios_personalizados')
                .select('producto_id, nuevo_precio, comision_subgestor, visible_subgestor')
                .eq('gestor', studioRole.pricingOwner);
            preciosCustom = response.data || [];
            pricingLoadFailed = Boolean(response.error);
            if (!response.error) {
                localStorage.setItem(customCacheKey, JSON.stringify({
                    data: preciosCustom,
                    savedAt: Date.now()
                }));
                studioCacheInfo.pricesAt = Date.now();
            }
        } else {
            console.log('📦 Studio: precios personalizados reutilizados desde la caché local.');
        }

        if (studioRole.isSubgestor && pricingLoadFailed) {
            allProducts = [];
            studioToast('No se pudieron validar tus productos y ganancias');
        }

        if (preciosCustom) {
            if (studioRole.isSubgestor) {
                allProducts = allProducts.filter(product => {
                    const custom = preciosCustom.find(item => item.producto_id === product.id);
                    return !custom || custom.visible_subgestor !== false;
                });
            }

            allProducts.forEach(p => {
                const custom = preciosCustom.find(c => c.producto_id === p.id);
                const precioBase = Number(p._studioBasePrice) || 0;
                const precioNuevo = Number(custom?.nuevo_precio);
                const flexible = String(p.precio_flexible || '').toUpperCase() === 'SI';

                if (custom && flexible && Number.isFinite(precioNuevo) && precioNuevo >= precioBase) {
                    p.precio = precioNuevo;
                }

                if (studioRole.isSubgestor) {
                    // El subgestor solo recibe su propia comisión asignada.
                    p._studioPrivateCommission = Number(custom?.comision_subgestor) || 0;
                    delete p.comision;
                    delete p._studioBaseCommission;
                } else {
                    const extra = custom && flexible && precioNuevo >= precioBase ? precioNuevo - precioBase : 0;
                    p._studioPrivateCommission = p._studioBaseCommission + extra;
                }
            });
            console.log("✅ Precios de gestor aplicados correctamente en el Studio.");
        }
    }
    // ==============================================================

    allProducts.forEach(p => {
        if (!Number.isFinite(p._studioPrivateCommission)) {
            p._studioPrivateCommission = studioRole.isSubgestor ? 0 : p._studioBaseCommission;
        }
        if (studioRole.isSubgestor) {
            delete p.comision;
            delete p._studioBaseCommission;
        }
    });

    const cats =[...new Set(allProducts.map(p => p.categoria ? p.categoria.toUpperCase() : 'VARIOS'))].sort();
    const select = document.getElementById('ctrl-category');
    select.innerHTML = '<option value="TODOS">Todas las Categorías</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c; select.appendChild(opt);
    });
}

async function loadStudioShortSlug() {
    const cacheKey = studioStorageKey('short_link');
    const cached = studioReadStorage(cacheKey, null);
    const sixMonths = 180 * 24 * 60 * 60 * 1000;
    if (cached?.slug && Date.now() - Number(cached.savedAt || 0) < sixMonths) {
        studioShortSlug = cached.slug;
        return;
    }

    const phone = String(gestorData.telefono || '5356071095').replace(/\D/g, '');
    const originalUrl = `https://paratuhogar.org/?gestor=${encodeURIComponent(gestorData.nombre)}&tel=${phone}`;
    try {
        const { data } = await supabaseClient.from('short_links')
            .select('slug')
            .eq('gestor', gestorData.nombre)
            .eq('original_url', originalUrl)
            .limit(1)
            .maybeSingle();

        if (data?.slug) {
            studioShortSlug = data.slug;
        } else {
            const newSlug = Math.random().toString(36).slice(2, 9);
            const { error } = await supabaseClient.from('short_links').insert([{
                slug: newSlug,
                original_url: originalUrl,
                gestor: gestorData.nombre
            }]);
            if (!error) studioShortSlug = newSlug;
        }

        if (studioShortSlug) {
            localStorage.setItem(cacheKey, JSON.stringify({ slug: studioShortSlug, savedAt: Date.now() }));
        }
    } catch (error) {
        console.info('Se usará el enlace atribuido sin acortar.', error);
    }
}

function studioNormalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function studioProductId(product) {
    return String(product.id);
}

function studioRecommendationScore(product) {
    const favorite = studioFavorites.has(studioProductId(product)) ? 10 : 0;
    const commission = Math.min(Number(product._studioPrivateCommission) || 0, 30);
    const accessiblePrice = Number(product.precio) < 100 ? 8 : 0;
    const freshness = studioRecent.includes(studioProductId(product)) ? 2 : 5;
    const dailyRotation = studioDailyNumber(product) % 7;
    return favorite + commission + accessiblePrice + freshness + dailyRotation;
}

function studioDailyNumber(product) {
    const now = new Date();
    const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    return [...`${day}:${studioProductId(product)}`].reduce((total, character) => {
        return ((total * 31) + character.charCodeAt(0)) >>> 0;
    }, 7);
}

function applyFilters() {
    const search = document.getElementById('ctrl-search').value.toLowerCase();
    const cat = document.getElementById('ctrl-category').value;
    const collection = document.getElementById('ctrl-collection').value;
    const recommendationIds = new Set(
        [...allProducts].sort((a, b) => studioRecommendationScore(b) - studioRecommendationScore(a))
            .slice(0, 5).map(studioProductId)
    );
    const commissions = allProducts.map(p => Number(p._studioPrivateCommission) || 0).sort((a, b) => b - a);
    const highCommissionThreshold = commissions[Math.min(Math.floor(commissions.length * .25), Math.max(0, commissions.length - 1))] || 0;

    filteredProducts = allProducts.filter(p => {
        const matchSearch = String(p.nombre || '').toLowerCase().includes(search);
        const matchCat = cat === 'TODOS' || (p.categoria && p.categoria.toUpperCase() === cat);
        const id = studioProductId(p);
        const matchCollection = collection === 'TODOS'
            || (collection === 'RECOMENDADOS' && recommendationIds.has(id))
            || (collection === 'MENOS_100' && Number(p.precio) < 100)
            || (collection === 'ENTREGA_HOY' && String(p.mensajeria || '').toLowerCase().match(/24|hoy|rápid|rapid/))
            || (collection === 'ALTA_COMISION' && Number(p._studioPrivateCommission) >= highCommissionThreshold)
            || (collection === 'FAVORITOS' && studioFavorites.has(id))
            || (collection === 'RECIENTES' && studioRecent.includes(id));
        return matchSearch && matchCat && matchCollection;
    });
    if (collection === 'RECOMENDADOS') {
        filteredProducts.sort((a, b) => studioRecommendationScore(b) - studioRecommendationScore(a));
    } else if (collection === 'ALTA_COMISION') {
        filteredProducts.sort((a, b) => Number(b._studioPrivateCommission) - Number(a._studioPrivateCommission));
    } else if (collection === 'RECIENTES') {
        filteredProducts.sort((a, b) => studioRecent.indexOf(studioProductId(a)) - studioRecent.indexOf(studioProductId(b)));
    }
    document.getElementById('count-label').innerText = filteredProducts.length;
    visibleCount = 12; 
    renderDailyRecommendation();
    refreshPreviews();
}

function fixImageUrl(url) {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
        return 'https://placehold.co/600x600?text=No+Image';
    }

    let nombreArchivo = url;
    if (url.includes('/')) nombreArchivo = url.split('/').pop(); 
    nombreArchivo = nombreArchivo.split('?')[0]; 

    try { nombreArchivo = decodeURIComponent(nombreArchivo); } catch(e) {}
    nombreArchivo = nombreArchivo.trim().replace(/['"]/g, '');
    nombreArchivo = nombreArchivo.replace(/\s+/g, ''); 

    const GITHUB_USER = 'paratuhogar'; 
    const REPO = 'paratuhogar-fotos'; 
    const BRANCH = 'main'; 

    return `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/${BRANCH}/img_productos/${nombreArchivo}`;
}

function studioFindProduct(encodedId) {
    const id = decodeURIComponent(encodedId);
    return allProducts.find(product => studioProductId(product) === id);
}

function studioEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[character]));
}

function studioPlainText(value) {
    const holder = document.createElement('div');
    holder.innerHTML = String(value || '');
    return (holder.textContent || '').replace(/\s+/g, ' ').trim();
}

function studioPrimaryBenefit(product) {
    const description = studioPlainText(product.descripcion);
    const firstSentence = description.split(/[.!?]/).map(part => part.trim()).find(part => part.length >= 20);
    const technicalSentence = firstSentence && ((firstSentence.match(/:/g) || []).length >= 2 || firstSentence.length > 150);
    if (firstSentence && !technicalSentence) return firstSentence.slice(0, 125);

    const category = studioNormalize(product.categoria);
    const name = studioNormalize(product.nombre);
    if (name.includes('impresora')) return 'Imprime, copia y escanea con más comodidad y menor costo por página';
    if (category.includes('frio') || category.includes('climat')) return 'Más confort para tu hogar con entrega rápida y respaldo local';
    if (category.includes('energia')) return 'Energía confiable para mantener lo importante funcionando';
    if (category.includes('cocina')) return 'Cocina más fácil, rápida y cómoda todos los días';
    if (category.includes('lavado')) return 'Ahorra tiempo en casa con un equipo práctico y confiable';
    return 'Una solución práctica para mejorar tu hogar desde hoy';
}

function studioSellingPoints(product) {
    const source = studioNormalize(`${product.nombre || ''} ${studioPlainText(product.descripcion)}`);
    const points = [];
    const add = (condition, label) => {
        if (condition && !points.includes(label) && points.length < 3) points.push(label);
    };

    add(/wi.?fi|inalambr/.test(source), 'Conexión Wi‑Fi');
    add(/movil|móvil|smartphone|app/.test(source), 'Control desde el móvil');
    add(/escane|scanner/.test(source), 'Escanea y copia');
    add(/ecotank|tinta continua|recargable/.test(source), 'Tinta recargable');
    add(/inverter/.test(source), 'Tecnología inverter');
    add(/bajo consumo|ahorro|eficien/.test(source), 'Ahorro de energía');
    add(/control remoto/.test(source), 'Control remoto');
    add(/acero inoxidable/.test(source), 'Acero inoxidable');

    const category = studioNormalize(product.categoria);
    if (points.length < 3 && category.includes('cocina')) add(true, 'Lista para estrenar');
    if (points.length < 3 && (category.includes('frio') || category.includes('climat'))) add(true, 'Confort para el hogar');
    if (points.length < 3) add(true, 'Producto nuevo');
    return points;
}

function studioProductSubtitle(product) {
    const name = studioNormalize(product.nombre);
    if (name.includes('impresora')) return 'IMPRESORA MULTIFUNCIÓN';
    if (name.includes('refrigerador')) return 'REFRIGERACIÓN PARA EL HOGAR';
    if (name.includes('cocina')) return 'COCINA PARA EL HOGAR';
    if (name.includes('bateria') || name.includes('batería') || name.includes('estacion')) return 'ENERGÍA CUANDO LA NECESITAS';
    return studioCategory(product).toUpperCase();
}

function studioDisplayName(product) {
    return String(product.nombre || 'Producto').replace(/\s+-\s+/g, '‑').trim();
}

function studioWarrantyText(product) {
    return String(product.garantia || 'INCLUIDA').trim().toUpperCase();
}

function studioStockLine(product) {
    const rawStock = product.stock ?? product.cantidad ?? product.existencias;
    const stock = Number(rawStock);
    if (Number.isFinite(stock) && stock > 0 && stock <= 5) return `⚠️ Quedan ${stock} disponibles`;
    return '';
}

function studioQualityIssues(product) {
    const issues = [];
    const phone = String(gestorData.telefono || '').replace(/\D/g, '');
    const image = String(product.thumbnail || '').trim();
    const description = studioPlainText(product.descripcion);
    if (!image || image === 'null' || image === 'undefined') issues.push('sin foto');
    if (!(Number(product.precio) > 0)) issues.push('sin precio');
    if (!String(product.garantia || '').trim()) issues.push('sin garantía');
    if (description.length < 24) issues.push('descripción muy corta');
    if ((description.match(/:/g) || []).length >= 3 || description.length > 260) issues.push('texto muy técnico');
    if (phone.length < 8) issues.push('teléfono incompleto');
    return issues;
}

function studioRelativeTime(timestamp) {
    if (!timestamp) return 'pendiente';
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 2) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    return `hace ${Math.round(hours / 24)} d`;
}

function renderStudioCacheStatus() {
    const status = document.getElementById('studio-cache-status');
    const role = document.getElementById('studio-role-status');
    if (status) {
        status.textContent = `Catálogo: ${studioRelativeTime(studioCacheInfo.catalogAt)} · Precios: ${studioRelativeTime(studioCacheInfo.pricesAt)}`;
    }
    if (role) {
        role.textContent = studioRole.isSubgestor
            ? '🔒 Vista Subgestor · solo ves tu propia ganancia'
            : '🔒 Vista privada del gestor';
    }
}

window.refreshStudioData = function() {
    localStorage.removeItem('pth_catalogo_cache');
    localStorage.removeItem('pth_catalogo_cache_time');
    localStorage.removeItem(studioStorageKey('custom_prices'));
    const button = document.getElementById('btn-refresh-studio-data');
    if (button) {
        button.disabled = true;
        button.textContent = 'Actualizando…';
    }
    window.location.reload();
};

function studioCustomerCopy(product) {
    const delivery = String(product.mensajeria || '').trim() || 'Entrega rápida disponible';
    const stockLine = studioStockLine(product);
    const link = studioReferralLink(product, {
        gestorName: gestorData.nombre,
        gestorPhone: gestorData.telefono || '5356071095'
    });
    return [
        `✨ *${studioDisplayName(product).toUpperCase()}*`,
        '',
        `✅ ${studioPrimaryBenefit(product)}`,
        `💵 Precio: *$${product.precio} USD*`,
        `🛡️ Garantía: ${product.garantia || 'incluida'}`,
        `🚚 ${delivery}`,
        stockLine,
        '',
        '¿Quieres reservarlo o confirmar la entrega? Escríbeme por aquí 👇',
        link
    ].filter(Boolean).join('\n');
}

function studioPersistMetrics() {
    localStorage.setItem(studioStorageKey('metrics'), JSON.stringify(studioMetrics));
    renderStudioMetrics();
}

function studioIncrementMetric(name) {
    studioMetrics[name] = (Number(studioMetrics[name]) || 0) + 1;
    studioPersistMetrics();
}

function renderStudioMetrics() {
    const values = {
        'metric-selected': selectedProductIds.size,
        'metric-shared': studioMetrics.shared,
        'metric-copies': studioMetrics.copies,
        'metric-downloads': studioMetrics.downloads
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    const label = document.getElementById('download-label');
    if (label) label.textContent = selectedProductIds.size
        ? `Descargar seleccionados (${selectedProductIds.size})`
        : 'Descargar Pack';
}

function studioToast(message) {
    const toast = document.getElementById('studio-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(studioToast.timeout);
    studioToast.timeout = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function studioRememberProduct(product) {
    const id = studioProductId(product);
    studioRecent = [id, ...studioRecent.filter(recentId => recentId !== id)].slice(0, 30);
    localStorage.setItem(studioStorageKey('recent'), JSON.stringify(studioRecent));
}

function studioRenderProductTools(product) {
    const id = studioProductId(product);
    const encodedId = encodeURIComponent(id);
    const selected = selectedProductIds.has(id);
    const favorite = studioFavorites.has(id);
    const privateCommission = Number(product._studioPrivateCommission) || 0;
    const qualityIssues = studioQualityIssues(product);
    const tools = document.createElement('div');
    tools.className = 'rounded-xl border border-white/10 bg-slate-900/90 p-3 space-y-3';
    tools.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <label class="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300 cursor-pointer">
                <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleProductSelection('${encodedId}')" class="accent-indigo-500">
                Seleccionar
            </label>
            <button type="button" onclick="toggleStudioFavorite('${encodedId}')" class="text-lg leading-none" title="Favorito">${favorite ? '⭐' : '☆'}</button>
        </div>
        <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 flex items-center justify-between">
            <span class="text-[9px] font-black uppercase tracking-wider text-emerald-300">🔒 Tu ganancia privada</span>
            <span class="text-sm font-black text-emerald-400">$${privateCommission.toFixed(2)}</span>
        </div>
        ${qualityIssues.length
            ? `<div class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[9px] font-bold text-amber-300">⚠️ Revisa: ${studioEscapeHtml(qualityIssues.join(' · '))}</div>`
            : '<div class="text-[9px] font-bold text-emerald-400">✓ Promoción lista para compartir</div>'}
        <div class="grid grid-cols-2 gap-2">
            <button type="button" onclick="copyStudioOffer('${encodedId}')" class="rounded-lg bg-sky-600 hover:bg-sky-500 px-2 py-2 text-[10px] font-black uppercase">Copiar texto</button>
            <button type="button" onclick="shareStudioOffer('${encodedId}')" class="rounded-lg bg-[#25D366] hover:brightness-110 px-2 py-2 text-[10px] font-black uppercase text-white">WhatsApp</button>
            <button type="button" onclick="shareStudioPackage('${encodedId}')" class="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2 py-2 text-[10px] font-black uppercase">Imagen + texto</button>
            <button type="button" onclick="downloadStudioProduct('${encodedId}')" class="rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-2 text-[10px] font-black uppercase">Descargar diseño</button>
        </div>`;
    return tools;
}

function renderDailyRecommendation() {
    const panel = document.getElementById('daily-recommendation');
    if (!panel || !allProducts.length) return;
    const recommended = [...allProducts]
        .sort((a, b) => studioRecommendationScore(b) - studioRecommendationScore(a))
        .slice(0, 5);
    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
                <p class="text-[10px] uppercase tracking-[.2em] font-black text-indigo-300">Sugerencias privadas para hoy</p>
                <h3 class="font-black mt-1">Puedes publicar: ${studioEscapeHtml(recommended.map(p => p.nombre).join(' · '))}</h3>
                <p class="text-[10px] text-slate-400 mt-1">Calculado localmente con precio, favoritos, uso reciente y potencial de ganancia. No consulta pedidos ni estadísticas.</p>
            </div>
            <button type="button" onclick="showDailyRecommendations()" class="shrink-0 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-xs font-black uppercase">Ver los 5</button>
        </div>`;
}

window.showDailyRecommendations = function() {
    document.getElementById('ctrl-collection').value = 'RECOMENDADOS';
    applyFilters();
};

window.toggleProductSelection = function(encodedId) {
    const product = studioFindProduct(encodedId);
    if (!product) return;
    const id = studioProductId(product);
    if (selectedProductIds.has(id)) selectedProductIds.delete(id);
    else selectedProductIds.add(id);
    renderStudioMetrics();
    refreshPreviews();
};

window.selectVisibleProducts = function() {
    filteredProducts.slice(0, visibleCount).forEach(product => selectedProductIds.add(studioProductId(product)));
    renderStudioMetrics();
    refreshPreviews();
};

window.clearProductSelection = function() {
    selectedProductIds.clear();
    renderStudioMetrics();
    refreshPreviews();
};

window.toggleStudioFavorite = function(encodedId) {
    const product = studioFindProduct(encodedId);
    if (!product) return;
    const id = studioProductId(product);
    if (studioFavorites.has(id)) studioFavorites.delete(id);
    else studioFavorites.add(id);
    localStorage.setItem(studioStorageKey('favorites'), JSON.stringify([...studioFavorites]));
    studioToast(studioFavorites.has(id) ? 'Guardado en favoritos' : 'Eliminado de favoritos');
    if (document.getElementById('ctrl-collection').value === 'FAVORITOS') applyFilters();
    else refreshPreviews();
};

window.copyStudioOffer = async function(encodedId) {
    const product = studioFindProduct(encodedId);
    if (!product) return;
    const copy = studioCustomerCopy(product);
    try {
        await navigator.clipboard.writeText(copy);
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = copy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }
    studioRememberProduct(product);
    studioIncrementMetric('copies');
    studioToast('Texto de venta copiado');
};

window.shareStudioOffer = function(encodedId) {
    const product = studioFindProduct(encodedId);
    if (!product) return;
    studioRememberProduct(product);
    studioIncrementMetric('shared');
    window.open(`https://wa.me/?text=${encodeURIComponent(studioCustomerCopy(product))}`, '_blank', 'noopener');
};

window.shareStudioPackage = async function(encodedId) {
    const product = studioFindProduct(encodedId);
    if (!product) return;
    const options = studioCurrentOptions();
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = options.isStory ? 1920 : 1080;
    await drawProductCard(canvas, product, options);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
    const fileName = `${String(product.nombre || 'oferta').replace(/[^a-z0-9]/gi, '_').slice(0, 45)}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    const shareData = {
        title: product.nombre,
        text: studioCustomerCopy(product),
        files: [file]
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        try {
            await navigator.share(shareData);
            studioRememberProduct(product);
            studioIncrementMetric('shared');
            return;
        } catch (error) {
            if (error && error.name === 'AbortError') return;
        }
    }

    await window.downloadStudioProduct(encodedId);
    await window.copyStudioOffer(encodedId);
    studioToast('Imagen descargada y texto copiado');
};

window.downloadStudioProduct = async function(encodedId) {
    const product = studioFindProduct(encodedId);
    if (!product) return;
    const options = studioCurrentOptions();
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = options.isStory ? 1920 : 1080;
    await drawProductCard(canvas, product, options);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/jpeg', .95);
    link.download = `${String(product.nombre || 'producto').replace(/[^a-z0-9]/gi, '_').slice(0, 45)}.jpg`;
    link.click();
    studioRememberProduct(product);
    studioIncrementMetric('downloads');
    studioToast('Diseño descargado');
};

function studioCurrentOptions() {
    return {
        theme: document.getElementById('ctrl-theme').value,
        useAI: document.getElementById('toggle-ai-bg').checked,
        isStory: document.getElementById('toggle-format').checked,
        showPrice: document.getElementById('toggle-price').checked,
        showPhone: document.getElementById('toggle-phone').checked,
        showDelivery: document.getElementById('toggle-delivery').checked,
        showWarranty: document.getElementById('toggle-warranty').checked,
        gestorName: gestorData.nombre,
        gestorPhone: gestorData.telefono || '5356071095'
    };
}

async function refreshPreviews() {
    const container = document.getElementById('preview-grid');
    container.innerHTML = ""; 

    const options = studioCurrentOptions();

    const productsToShow = filteredProducts.slice(0, visibleCount);

    if (productsToShow.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10">No hay productos.</div>`;
        return;
    }

    for (const prod of productsToShow) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col gap-2 relative group animate-fade-in";
        if (selectedProductIds.has(studioProductId(prod))) wrapper.classList.add('product-selected');
        
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = options.isStory ? 1920 : 1080;
        canvas.className = "canvas-preview w-full h-auto bg-slate-800 rounded-lg shadow-lg border border-slate-700";
        
        const media = document.createElement('div');
        if(options.useAI && !imageCache[prod.id]) {
            media.innerHTML = `<div class="w-full aspect-[9/16] flex items-center justify-center bg-slate-800 rounded-lg text-slate-500 text-xs animate-pulse">🤖 IA Trabajando...</div>`;
        } else {
            media.appendChild(canvas);
        }
        wrapper.appendChild(media);
        wrapper.appendChild(studioRenderProductTools(prod));
        container.appendChild(wrapper);

        if(options.useAI && !imageCache[prod.id]) {
            drawProductCard(canvas, prod, options).then(() => {
                media.innerHTML = '';
                media.appendChild(canvas);
            });
        } else {
            drawProductCard(canvas, prod, options);
        }
    }

    if (visibleCount < filteredProducts.length) {
        const remaining = filteredProducts.length - visibleCount;
        const btnDiv = document.createElement('div');
        btnDiv.className = "col-span-full flex justify-center py-8";
        btnDiv.innerHTML = `<button onclick="loadMoreItems()" class="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">Mostrar más (${remaining})</button>`;
        container.appendChild(btnDiv);
    }
}

window.loadMoreItems = function() { visibleCount += 12; refreshPreviews(); };

async function getSmartImage(product, useAI) {
    if (useAI && imageCache[product.id]) return imageCache[product.id];

    const originalUrl = fixImageUrl(product.thumbnail);
    
    if (!useAI) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = originalUrl;
        return new Promise((resolve) => {
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
        });
    }

    try {
        console.log("🤖 Procesando IA para: " + product.nombre);
        const blob = await imgly.removeBackground(originalUrl);
        const urlLimpia = URL.createObjectURL(blob);
        
        const imgLimpia = new Image();
        imgLimpia.src = urlLimpia;
        
        await new Promise(r => imgLimpia.onload = r);
        
        imageCache[product.id] = imgLimpia;
        return imgLimpia;

    } catch (e) {
        console.warn("Fallo IA, usando original:", e);
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = originalUrl;
        return new Promise(r => img.onload = () => r(img));
    }
}

// --- FUNCIÓN EXTRACTORA DE SPECS (INTELIGENCIA PARA VIÑETAS) ---
function extractTechSpecs(htmlDesc, maxItems = 4) {
    if (!htmlDesc) return [];
    
    // 1. Reemplazamos etiquetas de salto de línea por un caracter especial (\n)
    let clean = htmlDesc
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<li>/gi, "\n")
        .replace(/<\/li>/gi, "")
        .replace(/&nbsp;/g, " ");

    // 2. Quitamos el resto del HTML
    clean = clean.replace(/<[^>]*>?/gm, '');

    // 3. Cortamos por líneas y filtramos
    let lines = clean.split('\n')
        .map(line => line.replace(/^[•\-\*]\s*/, '').trim()) // Quitamos viñetas viejas
        .filter(line => line.length > 5 && line.length < 40); // Solo líneas medias (Ni 1 palabra, ni un párrafo gigante)

    return lines.slice(0, maxItems).map(l => l.toUpperCase()); // Máximo 4 items en MAYÚSCULAS
}

// --- MOTOR GRÁFICO 2.0: composiciones pensadas para redes sociales ---
const STUDIO_PALETTES = {
    techno: {
        bg1: '#FFFFFF', bg2: '#F4F8FF', ink: '#0A2540', muted: '#60758A',
        accent: '#1463FF', accent2: '#DCE8FF', priceInk: '#FFFFFF', label: 'PRECIO ESPECIAL'
    },
    minimal: {
        bg1: '#FFFFFF', bg2: '#FAFAFA', ink: '#111111', muted: '#717171',
        accent: '#111111', accent2: '#EEEEEE', priceInk: '#FFFFFF', label: 'PRECIO'
    },
    midnight: {
        bg1: '#FFFFFF', bg2: '#F5F5F7', ink: '#16181D', muted: '#696D75',
        accent: '#24262D', accent2: '#E3E4E8', priceInk: '#FFFFFF', label: 'SELECCIÓN PREMIUM'
    },
    classic: {
        bg1: '#FFFFFF', bg2: '#F4FBF7', ink: '#12372A', muted: '#587166',
        accent: '#118A55', accent2: '#DDF5E8', priceInk: '#FFFFFF', label: 'RECOMENDADO'
    },
    impact: {
        bg1: '#FFFFFF', bg2: '#FFF7F1', ink: '#27170E', muted: '#7D685C',
        accent: '#FF5A1F', accent2: '#FFE5D6', priceInk: '#FFFFFF', label: 'OFERTA DESTACADA'
    }
};

function studioRoundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function studioFitFont(ctx, text, maxWidth, preferred, min, weight = 800, family = 'Manrope, Arial, sans-serif') {
    let size = preferred;
    do {
        ctx.font = `${weight} ${size}px ${family}`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
    } while (size > min);
    return size;
}

function studioWrapLines(ctx, text, maxWidth, maxLines = 3) {
    const words = String(text || '').trim().split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
            if (lines.length === maxLines - 1) break;
        } else {
            line = test;
        }
    }
    const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const rest = words.slice(consumed).join(' ');
    if (lines.length < maxLines && rest) lines.push(rest);
    if (lines.length > maxLines) lines.length = maxLines;
    if (lines.length === maxLines && ctx.measureText(lines[maxLines - 1]).width > maxWidth) {
        let last = lines[maxLines - 1];
        while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = `${last.trim()}…`;
    }
    return lines;
}

function studioDrawPill(ctx, text, x, y, bg, fg, fontSize, paddingX = 24, height = 52) {
    ctx.font = `800 ${fontSize}px Manrope, Arial, sans-serif`;
    const width = ctx.measureText(text).width + paddingX * 2;
    ctx.fillStyle = bg;
    studioRoundRect(ctx, x, y, width, height, height / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + paddingX, y + height / 2 + 1);
    return width;
}

function studioCleanPhone(phone) {
    let clean = String(phone || '').replace(/\D/g, '');
    if (clean.startsWith('53') && clean.length > 8) clean = clean.slice(2);
    return clean ? `+53 ${clean}` : '';
}

function studioCategory(product) {
    const raw = String(product.categoria || 'Hogar').trim();
    const replacements = {
        'REFRIGERACIÓN': 'Refrigeración', 'CLIMATIZACIÓN': 'Climatización',
        'LAVADO': 'Lavado', 'SMART': 'Tecnología'
    };
    return replacements[raw.toUpperCase()] || raw;
}

function studioReferralLink(product, opt) {
    if (studioShortSlug) {
        return `https://paratuhogar.org/?s=${encodeURIComponent(studioShortSlug)}`;
    }
    const params = new URLSearchParams({
        search: String(product.nombre || ''),
        gestor: String(opt.gestorName || ''),
        tel: String(opt.gestorPhone || '').replace(/\D/g, ''),
        src: 'studio'
    });
    return `https://paratuhogar.org/?${params.toString()}`;
}

async function studioCreateQR(text, size) {
    if (typeof QRCode === 'undefined') return null;
    const holder = document.createElement('div');
    new QRCode(holder, {
        text,
        width: size,
        height: size,
        colorDark: '#101828',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    const canvas = holder.querySelector('canvas');
    if (canvas) return canvas;
    const image = holder.querySelector('img');
    if (!image) return null;
    if (!image.complete) await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
    return image;
}

// Recorta únicamente el fondo claro conectado a los bordes. A diferencia de
// borrar todos los píxeles blancos, conserva los blancos reales del producto.
function studioRemoveEdgeBackground(img, cacheKey) {
    if (whiteBgCache[cacheKey]) return whiteBgCache[cacheKey];

    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const work = document.createElement('canvas');
    work.width = w;
    work.height = h;
    const workCtx = work.getContext('2d', { willReadFrequently: true });
    workCtx.drawImage(img, 0, 0, w, h);

    try {
        const imageData = workCtx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
        const samples = corners.map(([x, y]) => {
            const i = (y * w + x) * 4;
            return [data[i], data[i + 1], data[i + 2]];
        });
        const bg = [0, 1, 2].map(c => samples.reduce((sum, s) => sum + s[c], 0) / samples.length);
        const brightness = (bg[0] + bg[1] + bg[2]) / 3;
        const neutral = Math.max(...bg) - Math.min(...bg) < 42;

        // Solo aplica el recorte rápido cuando la fotografía tiene fondo claro neutro.
        if (brightness > 205 && neutral) {
            const visited = new Uint8Array(w * h);
            const queue = new Int32Array(w * h);
            let head = 0;
            let tail = 0;
            const enqueue = (pos) => {
                if (!visited[pos]) {
                    visited[pos] = 1;
                    queue[tail++] = pos;
                }
            };
            for (let x = 0; x < w; x++) { enqueue(x); enqueue((h - 1) * w + x); }
            for (let y = 1; y < h - 1; y++) { enqueue(y * w); enqueue(y * w + w - 1); }

            while (head < tail) {
                const pos = queue[head++];
                const i = pos * 4;
                const dr = data[i] - bg[0];
                const dg = data[i + 1] - bg[1];
                const db = data[i + 2] - bg[2];
                const distance = Math.sqrt(dr * dr + dg * dg + db * db);
                const pixelBrightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (distance > 78 || pixelBrightness < 170) continue;

                data[i + 3] = Math.max(0, Math.min(255, (distance - 22) * 4.6));
                const x = pos % w;
                const y = (pos / w) | 0;
                if (x > 0) enqueue(pos - 1);
                if (x < w - 1) enqueue(pos + 1);
                if (y > 0) enqueue(pos - w);
                if (y < h - 1) enqueue(pos + w);
            }
            workCtx.putImageData(imageData, 0, 0);
        }
    } catch (error) {
        console.warn('No se pudo limpiar el fondo rápido:', error);
    }

    whiteBgCache[cacheKey] = work;
    return work;
}

async function drawProductCard(canvas, product, opt) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const story = opt.isStory;
    const p = STUDIO_PALETTES[opt.theme] || STUDIO_PALETTES.techno;
    const dark = false;
    const margin = story ? 72 : 62;
    const topArea = story ? 190 : 145;
    const footerH = story ? 300 : 220;

    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    // Fondo editorial con luz, grano visual y formas de marca.
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, p.bg1);
    bg.addColorStop(1, p.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * .78, H * .26, 0, W * .78, H * .26, W * .72);
    glow.addColorStop(0, `${p.accent}12`);
    glow.addColorStop(.45, `${p.accent}05`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = opt.theme === 'minimal' ? .06 : .08;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = story ? 55 : 42;
    ctx.beginPath();
    ctx.arc(W * .96, H * .17, story ? 340 : 250, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Marca y categoría.
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'left';
    ctx.font = `900 ${story ? 43 : 34}px Manrope, Arial, sans-serif`;
    ctx.fillText('PARATUHOGAR', margin, story ? 105 : 78);
    ctx.fillStyle = p.accent;
    ctx.fillRect(margin, story ? 125 : 94, story ? 105 : 82, 7);
    ctx.fillStyle = p.muted;
    ctx.font = `700 ${story ? 22 : 18}px Manrope, Arial, sans-serif`;
    ctx.fillText('EQUIPOS PARA VIVIR MEJOR', margin, story ? 165 : 126);

    const category = studioCategory(product).toUpperCase();
    ctx.font = `800 ${story ? 17 : 15}px Manrope, Arial, sans-serif`;
    const categoryW = ctx.measureText(category).width + 40;
    studioDrawPill(ctx, category, W - margin - categoryW, story ? 77 : 57,
        p.accent2, p.ink, story ? 19 : 16, 22, story ? 52 : 44);

    // Escenario del producto.
    const stageX = margin;
    const stageY = topArea;
    const stageW = W - margin * 2;
    const stageH = story ? 900 : 570;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, .08)';
    ctx.shadowBlur = story ? 34 : 24;
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    studioRoundRect(ctx, stageX, stageY, stageW, stageH, story ? 34 : 26);
    ctx.fill();
    ctx.restore();
    const halo = ctx.createRadialGradient(W / 2, stageY + stageH * .48, 10, W / 2, stageY + stageH * .48, stageW * .5);
    halo.addColorStop(0, `${p.accent2}34`);
    halo.addColorStop(1, `${p.accent2}00`);
    ctx.fillStyle = halo;
    ctx.fillRect(stageX, stageY, stageW, stageH);

    if (opt.showDelivery) {
        studioDrawPill(ctx, 'ENTREGA RÁPIDA', stageX, stageY + 20,
            p.accent2, '#08251C', story ? 22 : 17, story ? 28 : 21, story ? 60 : 48);
    }
    const truthfulStock = studioStockLine(product);
    if (truthfulStock) {
        ctx.font = `800 ${story ? 20 : 16}px Manrope, Arial, sans-serif`;
        const stockWidth = ctx.measureText(truthfulStock.toUpperCase()).width + (story ? 50 : 38);
        studioDrawPill(ctx, truthfulStock.toUpperCase(), stageX + stageW - stockWidth, stageY + 20,
            '#FEE2E2', '#991B1B', story ? 20 : 16, story ? 25 : 19, story ? 60 : 48);
    }

    const img = await getSmartImage(product, false);
    if (img) {
        const cleanImg = img;
        const imgW = img.width;
        const imgH = img.height;
        const maxW = stageW * (story ? 1.04 : .60);
        const maxH = stageH * (story ? .94 : .90);
        const scale = Math.min(maxW / imgW, maxH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = story ? (W - drawW) / 2 : stageX + (stageW * .57 - drawW) / 2;
        const drawY = stageY + (stageH - drawH) / 2 + (story ? 38 : 18);
        ctx.save();
        ctx.drawImage(cleanImg, drawX, drawY, drawW, drawH);
        ctx.restore();
    }

    // En cuadrado, la información comparte el escenario sin perder legibilidad.
    if (!story) {
        const infoX = stageX + stageW * .61;
        const infoW = stageW * .37;
        ctx.fillStyle = p.ink;
        ctx.textAlign = 'left';
        ctx.font = '800 17px Manrope, Arial, sans-serif';
        ctx.fillStyle = p.accent;
        ctx.fillText(studioProductSubtitle(product), infoX, stageY + 105);
        ctx.fillStyle = p.ink;
        const displayName = studioDisplayName(product).toUpperCase();
        const fontSize = studioFitFont(ctx, displayName, infoW, 44, 31, 900);
        ctx.font = `900 ${fontSize}px Manrope, Arial, sans-serif`;
        const lines = studioWrapLines(ctx, displayName, infoW, 3);
        lines.forEach((line, i) => ctx.fillText(line, infoX, stageY + 155 + i * (fontSize + 9)));

        const points = studioSellingPoints(product);
        ctx.font = '800 19px Manrope, Arial, sans-serif';
        points.forEach((point, index) => {
            ctx.fillStyle = p.accent;
            ctx.fillText('✓', infoX, stageY + 350 + index * 40);
            ctx.fillStyle = p.ink;
            ctx.fillText(point, infoX + 28, stageY + 350 + index * 40);
        });

        ctx.font = '700 18px Manrope, Arial, sans-serif';
        ctx.fillStyle = p.muted;
        const benefitLines = studioWrapLines(ctx, studioPrimaryBenefit(product), infoW, 2);
        benefitLines.forEach((line, i) => ctx.fillText(line, infoX, stageY + 485 + i * 25));
        if (opt.showWarranty) {
            ctx.font = '800 16px Manrope, Arial, sans-serif';
            ctx.fillStyle = p.accent;
            ctx.fillText(`GARANTÍA · ${studioWarrantyText(product)}`, infoX, stageY + 550);
        }
    }

    // Información debajo del producto en Story.
    if (story) {
        const infoY = stageY + stageH + 28;
        ctx.textAlign = 'left';
        ctx.fillStyle = p.accent;
        ctx.font = '800 22px Manrope, Arial, sans-serif';
        ctx.fillText(studioProductSubtitle(product), margin, infoY);
        ctx.fillStyle = p.ink;
        const name = studioDisplayName(product).toUpperCase();
        const nameSize = studioFitFont(ctx, name, W - margin * 2, 62, 44, 900);
        ctx.font = `900 ${nameSize}px Manrope, Arial, sans-serif`;
        const nameLines = studioWrapLines(ctx, name, W - margin * 2, 2);
        nameLines.forEach((line, i) => ctx.fillText(line, margin, infoY + 58 + i * (nameSize + 8)));

        const benefits = studioSellingPoints(product);
        let pillX = margin;
        const pillY = infoY + 58 + nameLines.length * (nameSize + 8) + 20;
        benefits.slice(0, 3).forEach((benefit) => {
            const label = `✓ ${benefit}`;
            ctx.font = '700 20px Manrope, Arial, sans-serif';
            const w = ctx.measureText(label).width + 38;
            if (pillX + w <= W - margin) {
                studioDrawPill(ctx, label, pillX, pillY,
                    p.accent2, p.ink, 20, 22, 54);
                pillX += w + 12;
            }
        });
        ctx.font = '700 27px Manrope, Arial, sans-serif';
        ctx.fillStyle = p.muted;
        const benefitLines = studioWrapLines(ctx, studioPrimaryBenefit(product), W - margin * 2, 2);
        benefitLines.forEach((line, i) => ctx.fillText(line, margin, pillY + 96 + i * 36));
        if (opt.showWarranty) {
            ctx.font = '800 19px Manrope, Arial, sans-serif';
            ctx.fillStyle = p.accent;
            ctx.fillText(`GARANTÍA · ${studioWarrantyText(product)}`,
                margin, pillY + 178);
        }
    }

    // Banda inferior: precio como protagonista y CTA directo.
    const footerY = H - footerH;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(0, footerY + (story ? 55 : 30));
    ctx.lineTo(W, footerY);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    if (opt.showPrice) {
        const rawPrice = `$${product.precio}`;
        ctx.fillStyle = p.priceInk;
        ctx.textAlign = 'left';
        const priceSize = studioFitFont(ctx, rawPrice, story ? 430 : 390,
            story ? 136 : 102, story ? 104 : 78, 900);
        ctx.font = `900 ${priceSize}px Manrope, Arial, sans-serif`;
        ctx.fillText(rawPrice, margin, H - (story ? 68 : 42));
        const priceW = ctx.measureText(rawPrice).width;
        ctx.font = `900 ${story ? 29 : 23}px Manrope, Arial, sans-serif`;
        ctx.fillText('USD', margin + priceW + 14, H - (story ? 75 : 48));
        ctx.font = `800 ${story ? 19 : 15}px Manrope, Arial, sans-serif`;
        ctx.fillText(p.label, margin, footerY + (story ? 103 : 72));
    }

    if (opt.showPhone) {
        const phone = studioCleanPhone(opt.gestorPhone);
        const referralLink = studioReferralLink(product, opt);
        const qrSize = story ? 124 : 86;
        const qrPadding = story ? 10 : 8;
        const qrX = W - margin - qrSize;
        const qrY = footerY + (story ? 105 : 74);
        const rightX = qrX - (story ? 30 : 20);
        ctx.textAlign = 'right';
        ctx.fillStyle = p.priceInk;
        ctx.font = `800 ${story ? 22 : 17}px Manrope, Arial, sans-serif`;
        ctx.fillText('PÍDELO POR WHATSAPP', rightX, footerY + (story ? 92 : 70));
        ctx.font = `900 ${story ? 46 : 33}px Manrope, Arial, sans-serif`;
        ctx.fillText(phone, rightX, footerY + (story ? 146 : 111));
        const seller = String(opt.gestorName || 'Tu gestor').toUpperCase();
        const sellerText = `ATENCIÓN DIRECTA · ${seller}`;
        const sellerSize = studioFitFont(ctx, sellerText, story ? 360 : 270,
            story ? 18 : 14, story ? 14 : 11, 800);
        ctx.font = `800 ${sellerSize}px Manrope, Arial, sans-serif`;
        ctx.fillText(sellerText, rightX, footerY + (story ? 184 : 140));
        ctx.font = `700 ${story ? 15 : 11}px Manrope, Arial, sans-serif`;
        ctx.fillText('ESCANEA PARA VER EL CATÁLOGO', rightX, footerY + (story ? 218 : 165));

        const qr = await studioCreateQR(referralLink, qrSize);
        if (qr) {
            ctx.fillStyle = '#FFFFFF';
            studioRoundRect(ctx, qrX - qrPadding, qrY - qrPadding,
                qrSize + qrPadding * 2, qrSize + qrPadding * 2, story ? 14 : 10);
            ctx.fill();
            ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
        }
    }

    // Filete final que aporta acabado de campaña.
    ctx.fillStyle = p.accent2;
    ctx.fillRect(0, H - (story ? 12 : 8), W, story ? 12 : 8);
}

// Motor anterior conservado como referencia para facilitar mantenimiento.
async function drawLegacyProductCard(canvas, product, opt) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const isStory = opt.isStory;

    // =======================================================
    // 🌟 INTERCEPTOR: TEMA TECHNO RETAIL
    // =======================================================
    if (opt.theme === 'techno') {
        const bgColor = '#002b5e'; // Azul corporativo (Confianza)
        const yellowAccent = '#fdf84c'; // Amarillo limón (Llamada a la acción)
        const redAlert = '#ef4444'; // Rojo (Urgencia)
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        // ---------------------------------------------------
        // 1. CARGAR TU LOGO REAL CIRCULAR
        // ---------------------------------------------------
        const logoImg = new Image();
        logoImg.crossOrigin = "Anonymous";
        // URL ABSOLUTA PARA EVITAR PROBLEMAS DE RUTAS
        logoImg.src = "https://paratuhogar.org/log.jpeg"; 
        
        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve; 
        });

        if (logoImg.complete && logoImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(105, 105, 55, 0, Math.PI * 2, true); 
            ctx.closePath();
            ctx.clip(); 
            ctx.drawImage(logoImg, 50, 50, 110, 110);
            ctx.restore();
            
            ctx.beginPath();
            ctx.arc(105, 105, 55, 0, Math.PI * 2, true);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(50, 50, 110, 110);
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 24px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("TU", 105, 95);
            ctx.fillText("LOGO", 105, 125);
        }

        ctx.beginPath();
        ctx.moveTo(190, 70);
        ctx.lineTo(190, 140);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '400 32px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText("Tienda Online", 210, 115);

        // ---------------------------------------------------
        // 2. TÍTULOS INCLINADOS
        // ---------------------------------------------------
        ctx.save();
        // MOVIDO HACIA ARRIBA para que no quede totalmente oculto por el producto
        ctx.translate(isStory ? W/2 : 580, isStory ? 170 : 120); 
        ctx.rotate(-7 * Math.PI / 180); 
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic 700 35px Arial, sans-serif';
        ctx.textAlign = isStory ? 'center' : 'left';
        ctx.fillText("Calidad y precio en", 0, 0);
        
        let mainTitle = product.categoria ? product.categoria.toUpperCase().split(' ')[0] : "OFERTA";
        if(mainTitle === "LAVADO") mainTitle = "LAVADORAS";
        if(mainTitle === "REFRIGERACIÓN") mainTitle = "NEVERAS";
        if(mainTitle === "CLIMATIZACIÓN") mainTitle = "SPLITS";
        if(mainTitle === "SMART") mainTitle = "TELEVISORES";
        
        // TAMAÑO DE FUENTE LIGERAMENTE REDUCIDO
        ctx.font = 'italic 900 110px Impact, sans-serif'; 
        ctx.fillText(mainTitle, 0, 110); 
        ctx.restore();

        // ---------------------------------------------------
        // 3. IMAGEN DEL PRODUCTO
        // ---------------------------------------------------
        let imgH_base = isStory ? 800 : 700;
        let imgY = isStory ? 320 : 250; 
        
        const img = await getSmartImage(product, opt.useAI);
        if (img) {
            ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 25;
            
            let imgW = isStory ? 900 : 550;
            let imgX = isStory ? (W - imgW) / 2 : 20;
            
            const scale = Math.min(imgW / img.width, imgH_base / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = imgX + (imgW - w) / 2;
            const y = imgY + (imgH_base - h) / 2;
            
            ctx.drawImage(img, x, y, w, h);
            ctx.shadowColor = "transparent";
        }

        // ---------------------------------------------------
        // 4. NOMBRE EXACTO DEL EQUIPO
        // ---------------------------------------------------
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px Arial, sans-serif'; 
        ctx.textAlign = 'left';
        
        let textStartX = isStory ? 100 : 600;
        let textStartY = isStory ? 1160 : 350; 
        
        let nextY = window.wrapText(ctx, product.nombre.toUpperCase(), textStartX, textStartY, isStory ? W - 200 : 450, 42);

        // ---------------------------------------------------
        // 5. VIÑETAS DE BENEFICIOS
        // ---------------------------------------------------
        let features = [];
        
        if(opt.showDelivery) features.push('ENTREGA INMEDIATA EN LA HABANA');
        if(opt.showWarranty) features.push(`GARANTÍA: ${product.garantia || '1 MES'}`.toUpperCase());
        features.push('NUEVO EN CAJA SELLADA');

        const extractedSpecs = extractTechSpecs(product.descripcion, 2); 
        extractedSpecs.forEach(f => {
            let cleanFeat = f.replace(/MARCA:|CARACTERÍSTICAS:/gi, '').trim();
            if(cleanFeat.length > 2) features.push(cleanFeat);
        });

        let bulletY = nextY + 35; 
        
        features.slice(0, 5).forEach((feat, index) => {
            ctx.fillStyle = yellowAccent; 
            ctx.font = '400 35px Arial, sans-serif'; 
            ctx.fillText("•", textStartX, bulletY + (index * 45));
            
            ctx.fillStyle = '#d7f2a5'; 
            ctx.font = '600 28px Arial, sans-serif'; 
            ctx.fillText(feat.substring(0, 40), textStartX + 35, bulletY + (index * 45));
        });

        // ---------------------------------------------------
        // 6. CAJA AMARILLA DEL PRECIO
        // ---------------------------------------------------
        ctx.fillStyle = yellowAccent;
        ctx.beginPath();
        if (isStory) {
            // Ajustado para dar espacio al precio tachado sin chocar con las viñetas
            ctx.moveTo(0, H - 420);    
            ctx.lineTo(W, H - 500);    
            ctx.lineTo(W, H); 
            ctx.lineTo(0, H); 
        } else {
            ctx.moveTo(550, 680);   
            ctx.lineTo(W, 600);     
            ctx.lineTo(W, 880);     
            ctx.lineTo(950, 880);   
            ctx.lineTo(880, H);     
            ctx.lineTo(450, H);     
        }
        ctx.closePath();
        ctx.fill();

        // ---------------------------------------------------
        // 7. PRECIO GIGANTE Y ESCASEZ (Neuromarketing Aleatorio)
        // ---------------------------------------------------
        if (opt.showPrice) {
            let pX = isStory ? W/2 : 820;
            let pY = isStory ? H - 120 : 830; 
            let priceStr = `$${product.precio}`;

            // DECISIÓN DETERMINISTA: ¿Aplica escasez? (~33% de probabilidad basada en el nombre)
            const isHotSale = (product.nombre.length + Number(product.precio)) % 3 === 0;

            if (isHotSale) {
                // PRECIO TACHADO (Efecto Anclaje - 15% más caro, no tan exagerado)
                let oldPrice = Math.round(product.precio * 1.15);
                let oldY = pY - (isStory ? 240 : 180); // Posición Y del precio viejo
                
                ctx.fillStyle = '#94a3b8'; // Gris
                ctx.font = '700 50px Impact, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`$${oldPrice}`, pX, oldY);
                
                // Línea roja tachando el precio viejo
                let oldW = ctx.measureText(`$${oldPrice}`).width;
                ctx.strokeStyle = redAlert;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(pX - (oldW/2) - 10, oldY - 15);
                ctx.lineTo(pX + (oldW/2) + 10, oldY - 15);
                ctx.stroke();

                // ETIQUETA ROJA DE STOCK LIMITADO (Justo encima del precio viejo)
                let badgeY = oldY - 55;
                let badgeW = 200;
                let badgeH = 34;
                
                ctx.fillStyle = redAlert;
                ctx.beginPath();
                // Si existe ctx.roundRect nativo se usa, sino el polyfill fallback no es estricto aquí, pero ctx.roundRect es estándar en navegadores modernos.
                if (ctx.roundRect) {
                    ctx.roundRect(pX - (badgeW/2), badgeY - (badgeH/2), badgeW, badgeH, 17);
                } else {
                    window.roundRect(ctx, pX - (badgeW/2), badgeY - (badgeH/2), badgeW, badgeH, 17);
                }
                ctx.fill();
                
                ctx.fillStyle = '#ffffff';
                ctx.font = '900 15px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("🔥 STOCK LIMITADO", pX, badgeY + 1);
                ctx.textBaseline = 'alphabetic'; // Resetear baseline
            }

            // PRECIO REAL
            let mainPriceSize = isStory ? 240 : 180;
            ctx.fillStyle = bgColor; 
            ctx.font = `900 ${mainPriceSize}px Impact, sans-serif`; 
            let priceWidth = ctx.measureText(priceStr).width;
            
            let usdSize = isStory ? 60 : 45;
            ctx.font = `900 ${usdSize}px Impact, sans-serif`;
            let usdWidth = ctx.measureText("USD").width;

            let totalWidth = priceWidth + 15 + usdWidth;
            let startX = pX - (totalWidth / 2);

            ctx.textAlign = 'left';
            ctx.font = `900 ${mainPriceSize}px Impact, sans-serif`; 
            ctx.fillText(priceStr, startX, pY);
            
            ctx.font = `900 ${usdSize}px Impact, sans-serif`;
            ctx.fillText("USD", startX + priceWidth + 15, pY - (isStory ? 30 : 20));
        }

        // ---------------------------------------------------
        // 8. DATOS DE CONTACTO
        // ---------------------------------------------------
        if (opt.showPhone) {
            let cleanPhone = opt.gestorPhone.replace(/\D/g, '');
            if (cleanPhone.startsWith('53') && cleanPhone.length > 8) {
                cleanPhone = cleanPhone.substring(2);
            }
            let phoneFormat = `+53 ${cleanPhone}`;
            
            if (isStory) {
                ctx.fillStyle = bgColor;
                ctx.font = '900 40px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`WhatsApp: ${phoneFormat}`, W/2, H - 35);
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.font = '400 22px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText("Dirección de envíos:", 620, 930);
                
                ctx.font = '900 35px Arial, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(phoneFormat, 620, 970);
                
                ctx.font = '700 20px Arial, sans-serif';
                ctx.fillText("www.paratuhogar.org", 620, 1010);
            }
        }

        return; // FIN DEL TEMA TECHNO
    }
    // =======================================================
    // FIN INTERCEPTOR TECHNO
    // =======================================================

    const themes = {
        classic: { bgStart: "#f8fafc", bgEnd: "#e2e8f0", textMain: "#0f172a", textAccent: "#1a4789", priceBg: "#e11d48", font: "'Manrope', sans-serif" },
        minimal: { bgStart: "#ffffff", bgEnd: "#ffffff", textMain: "#1d1d1f", textAccent: "#86868b", priceBg: "#000000", font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
        midnight: { bgStart: "#0f172a", bgEnd: "#020617", textMain: "#ffffff", textAccent: "#94a3b8", priceBg: "#fbbf24", priceText: "#000000", font: "'Manrope', sans-serif" },
        impact:   { bgStart: "#ff0000", bgEnd: "#990000", textMain: "#ffffff", textAccent: "#fbbf24", priceBg: "#fbbf24", priceText: "#000000", font: "Impact, sans-serif" }
    };
    
    const t = themes[opt.theme];
    const isMinimal = opt.theme === 'minimal';
    const isDark = opt.theme === 'midnight';
    const isImpact = opt.theme === 'impact';

    // 1. FONDO
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, t.bgStart);
    grad.addColorStop(1, t.bgEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2. HEADER
    const headerH = opt.isStory ? 200 : 150;
    if (!isMinimal) {
        ctx.fillStyle = isImpact ? "#fbbf24" : (isDark ? "#1e293b" : "#1a4789");
        if(isDark) ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 0, W, headerH);
    }
    ctx.fillStyle = isMinimal ? "#000000" : (isImpact ? "#990000" : "#ffffff");
    ctx.font = `900 ${isMinimal ? 50 : 60}px ${t.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "2px";
    ctx.fillText("PARATUHOGAR", W/2, headerH/2);

    // 3. IMAGEN
    const footerH = opt.isStory ? 250 : 180;
    const availableH = H - headerH - footerH;
    let imgH = availableH * 0.65;
    let imgY = headerH + (availableH - imgH) / 2 - 100;

    const img = await getSmartImage(product, opt.useAI);

    if (img) {
        // SOMBRA
        if (!isImpact) {
            ctx.shadowColor = isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.2)";
            ctx.shadowBlur = isMinimal ? 60 : 40;
            ctx.shadowOffsetY = 30;
        }

        if (!opt.useAI && !isMinimal && !isDark && !isImpact) {
            ctx.fillStyle = "white";
            const cardSize = Math.min(W - 100, imgH + 100);
            const cardX = (W - cardSize) / 2;
            ctx.fillRect(cardX, imgY, cardSize, cardSize);
        }

        const targetSize = isMinimal ? W - 100 : Math.min(W - 150, imgH);
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = (W - drawW) / 2;
        const drawY = imgY + (targetSize - drawH) / 2;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.shadowColor = "transparent";
    }

    // 4. PRECIO
    if (opt.showPrice) {
        const priceY = imgY + imgH + (opt.isStory ? 100 : 50);
        ctx.textAlign = "center";
        
        if (isMinimal) {
            ctx.fillStyle = "#000000";
            ctx.font = `900 130px ${t.font}`;
            ctx.fillText(`$${product.precio}`, W/2, priceY);
            ctx.font = `500 40px ${t.font}`;
            ctx.fillStyle = "#86868b";
            ctx.fillText("USD / Efectivo", W/2, priceY + 60);
        } else {
            const priceText = `$${product.precio} USD`;
            ctx.font = `900 110px ${t.font}`;
            const textMetrics = ctx.measureText(priceText);
            const bgW = textMetrics.width + 100;
            const bgH = 160;
            
            ctx.fillStyle = t.priceBg;
            if (isDark) { ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 30; } 
            else { ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10; }

            ctx.beginPath();
            ctx.roundRect((W - bgW)/2, priceY - bgH/1.5, bgW, bgH, 30);
            ctx.fill();
            ctx.shadowColor = "transparent";

            ctx.fillStyle = t.priceText || "#ffffff";
            ctx.fillText(priceText, W/2, priceY);
        }
    }

    // 5. NOMBRE 
    const nameY = imgY + imgH + (opt.isStory ? 280 : 180);
    ctx.fillStyle = t.textMain;
    ctx.font = `800 ${opt.isStory ? 50 : 40}px ${t.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    let maxWidth = W - 120;
    let lineHeight = opt.isStory ? 60 : 50; 
    window.wrapText(ctx, product.nombre, W/2, nameY, maxWidth, lineHeight);

    // 6. GARANTÍA
    if (opt.showWarranty) {
        const badgeW = 340;
        const badgeH = 60;
        const badgeX = W - badgeW - 40; 
        const badgeY = headerH + 30; 
        
        ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        let gradGarantia = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
        gradGarantia.addColorStop(0, isMinimal ? "#000000" : "#d97706"); 
        gradGarantia.addColorStop(1, isMinimal ? "#333333" : "#f59e0b"); 
        
        ctx.fillStyle = gradGarantia;
        window.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 30); 
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px 'Manrope', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛡️ GARANTÍA Y FACTURA", badgeX + (badgeW / 2), badgeY + (badgeH / 2) + 2); 
    }

    // 7. ENTREGA 24H
    if (opt.showDelivery) {
        const badgeW = 260;
        const badgeH = 60;
        const badgeX = 40; 
        const badgeY = headerH + 30; 
        
        ctx.shadowColor = "rgba(16, 185, 129, 0.4)"; 
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        let grad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
        grad.addColorStop(0, isMinimal ? "#e5e5e5" : "#059669");
        grad.addColorStop(1, isMinimal ? "#ffffff" : "#10b981");
        
        ctx.fillStyle = grad;
        window.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 30);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = isMinimal ? "#000000" : "#ffffff";
        ctx.font = "bold 22px 'Manrope', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🚀 ENTREGA 24H", badgeX + (badgeW / 2), badgeY + (badgeH / 2) + 2);
    }

    // 8. FOOTER
    if (opt.showPhone) {
        const footerY = H - footerH;
        if (isMinimal) { ctx.fillStyle = "#f5f5f7"; ctx.fillRect(0, footerY, W, footerH); ctx.fillStyle = "#1d1d1f"; }
        else if (isDark) { ctx.fillStyle = "#1e293b"; ctx.fillRect(0, footerY, W, footerH); ctx.fillStyle = "#fbbf24"; }
        else { ctx.fillStyle = "#0f172a"; ctx.fillRect(0, footerY, W, footerH); ctx.fillStyle = "#ffffff"; }

        const iconX = 120;
        const centerY = footerY + footerH/2;
        ctx.beginPath(); ctx.arc(iconX, centerY, 50, 0, 2 * Math.PI); ctx.fillStyle = "#22c55e"; ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "bold 55px Arial"; ctx.fillText("W", iconX, centerY + 20);

        ctx.textAlign = "left";
        const textColor = isMinimal ? "#000000" : (isDark ? "#ffffff" : "#ffffff");
        ctx.fillStyle = textColor;
        ctx.font = `bold ${opt.isStory ? 60 : 50}px 'Manrope', sans-serif`;
        ctx.fillText(`PEDIDOS: ${opt.gestorPhone}`, iconX + 80, centerY + 15);
        ctx.font = `500 ${opt.isStory ? 30 : 25}px 'Manrope', sans-serif`;
        ctx.fillStyle = isMinimal ? "#86868b" : "#94a3b8";
        ctx.fillText(`Comercial: ${opt.gestorName}`, iconX + 80, centerY - 45);
    }
}

async function downloadAllImages() {
    const btn = document.getElementById('btn-download');
    const oldText = btn.innerText;
    btn.innerText = "⏳ GENERANDO...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        const options = studioCurrentOptions();
        const productsToDownload = selectedProductIds.size
            ? allProducts.filter(product => selectedProductIds.has(studioProductId(product)))
            : filteredProducts;

        if (!productsToDownload.length) {
            throw new Error('No hay productos para descargar.');
        }

        let index = 1; 

        for (const prod of productsToDownload) {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = options.isStory ? 1920 : 1080;
            await drawProductCard(canvas, prod, options);
            
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
            const cleanName = prod.nombre.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            
            zip.file(`${index}_${cleanName}.jpg`, blob); 
            
            index++; 
        }

        const content = await zip.generateAsync({type:"blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Pack_${options.theme}.zip`;
        link.click();
        productsToDownload.forEach(studioRememberProduct);
        studioIncrementMetric('downloads');
        alert("✅ Pack Descargado");
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}
