// js/studio-core.js

const SUPABASE_URL = 'https://ljqwaovevfatkiigirhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allProducts = [];
let filteredProducts = [];
let gestorData = {};
let visibleCount = 12;

// CACHÉ DE IMÁGENES LIMPIAS (Para que no procese 2 veces la misma foto)
const imageCache = {}; 

window.addEventListener('load', async () => {
    const session = JSON.parse(localStorage.getItem('pth_session') || '{}');
    if (!session.name) {
        alert("🔒 Acceso Denegado.");
        window.location.href = 'index.html';
        return;
    }
    gestorData = session.data || {};
    gestorData.nombre = session.name;

    await loadInventory();

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

    // Listeners
    ['ctrl-search', 'ctrl-category', 'ctrl-theme'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if(id !== 'ctrl-search') visibleCount = 12; 
            if(id === 'ctrl-search') applyFilters();
            else refreshPreviews();
        });
    });
    
    // El toggle de IA debe regenerar la vista
    const switches = ['toggle-format', 'toggle-ai-bg', 'toggle-price', 'toggle-phone', 'toggle-delivery', 'toggle-warranty'];
    switches.forEach(id => document.getElementById(id).addEventListener('change', refreshPreviews));
});

async function loadInventory() {
    const { data, error } = await supabaseClient.from('productos').select('*').eq('disponible', 'SI').order('nombre');
    if (error) return;
    allProducts = data;
    
    const cats = [...new Set(data.map(p => p.categoria ? p.categoria.toUpperCase() : 'VARIOS'))].sort();
    const select = document.getElementById('ctrl-category');
    select.innerHTML = '<option value="TODOS">Todas las Categorías</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c; select.appendChild(opt);
    });
}

function applyFilters() {
    const search = document.getElementById('ctrl-search').value.toLowerCase();
    const cat = document.getElementById('ctrl-category').value;
    filteredProducts = allProducts.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(search);
        const matchCat = cat === 'TODOS' || (p.categoria && p.categoria.toUpperCase() === cat);
        return matchSearch && matchCat;
    });
    document.getElementById('count-label').innerText = filteredProducts.length;
    visibleCount = 12; 
    refreshPreviews();
}

function fixImageUrl(url) {
    if (!url) return 'https://placehold.co/600x600?text=No+Image';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/productos/${url}`;
}

async function refreshPreviews() {
    const container = document.getElementById('preview-grid');
    container.innerHTML = ""; 

    const options = {
        theme: document.getElementById('ctrl-theme').value,
        useAI: document.getElementById('toggle-ai-bg').checked, // NUEVO
        isStory: document.getElementById('toggle-format').checked,
        showPrice: document.getElementById('toggle-price').checked,
        showPhone: document.getElementById('toggle-phone').checked,
        showDelivery: document.getElementById('toggle-delivery').checked,
        showWarranty: document.getElementById('toggle-warranty').checked,
        gestorName: gestorData.nombre,
        gestorPhone: gestorData.telefono || "5356071095"
    };

    const productsToShow = filteredProducts.slice(0, visibleCount);

    if (productsToShow.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10">No hay productos.</div>`;
        return;
    }

    for (const prod of productsToShow) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col gap-2 relative group animate-fade-in";
        
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = options.isStory ? 1920 : 1080;
        canvas.className = "canvas-preview w-full h-auto bg-slate-800 rounded-lg shadow-lg border border-slate-700";
        
        // Loader visual si la IA está activa
        if(options.useAI && !imageCache[prod.id]) {
            wrapper.innerHTML = `<div class="w-full aspect-[9/16] flex items-center justify-center bg-slate-800 rounded-lg text-slate-500 text-xs animate-pulse">🤖 IA Trabajando...</div>`;
        } else {
            wrapper.appendChild(canvas);
        }
        
        container.appendChild(wrapper);

        // Si hay IA pendiente, dibujamos y luego reemplazamos el loader
        if(options.useAI && !imageCache[prod.id]) {
            drawProductCard(canvas, prod, options).then(() => {
                wrapper.innerHTML = '';
                wrapper.appendChild(canvas);
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

// --- FUNCIÓN INTELIGENTE DE CARGA DE IMAGEN ---
async function getSmartImage(product, useAI) {
    // 1. Si ya tenemos la imagen limpia en caché, devolverla
    if (useAI && imageCache[product.id]) {
        return imageCache[product.id];
    }

    const originalUrl = fixImageUrl(product.thumbnail);
    
    // 2. Si NO piden IA, devolver la original
    if (!useAI) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = originalUrl;
        return new Promise((resolve) => {
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
        });
    }

    // 3. SI PIDEN IA y no está en caché: PROCESAR
    try {
        console.log("🤖 Procesando IA para: " + product.nombre);
        // Usamos la librería imgly que ya importamos en el HTML
        const blob = await imgly.removeBackground(originalUrl);
        const urlLimpia = URL.createObjectURL(blob);
        
        const imgLimpia = new Image();
        imgLimpia.src = urlLimpia;
        
        await new Promise(r => imgLimpia.onload = r);
        
        // Guardar en caché para no volver a gastar CPU
        imageCache[product.id] = imgLimpia;
        return imgLimpia;

    } catch (e) {
        console.warn("Fallo IA, usando original:", e);
        // Fallback a original si falla la IA
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = originalUrl;
        return new Promise(r => img.onload = () => r(img));
    }
}

// --- MOTOR GRÁFICO ---
async function drawProductCard(canvas, product, opt) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

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

    // --- CARGA DE IMAGEN INTELIGENTE (IA o NORMAL) ---
    const img = await getSmartImage(product, opt.useAI);

    if (img) {
        // SOMBRA
        if (!isImpact) {
            ctx.shadowColor = isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.2)";
            ctx.shadowBlur = isMinimal ? 60 : 40;
            ctx.shadowOffsetY = 30;
        }

        // Si NO estamos usando IA y NO es Minimal, ponemos la tarjeta blanca de fondo
        // para que no se vea feo el recorte cuadrado de la foto original
        if (!opt.useAI && !isMinimal && !isDark && !isImpact) {
            ctx.fillStyle = "white";
            const cardSize = Math.min(W - 100, imgH + 100);
            const cardX = (W - cardSize) / 2;
            ctx.fillRect(cardX, imgY, cardSize, cardSize);
        }

        // DIBUJO
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
    ctx.font = `800 ${opt.isStory ? 55 : 45}px ${t.font}`;
    const nameText = product.nombre.length > 40 ? product.nombre.substring(0, 37) + "..." : product.nombre;
    ctx.fillText(nameText, W/2, nameY);

    // 6. GARANTÍA
    if (opt.showWarranty) {
        const badgeX = W - (opt.isStory ? 160 : 120);
        const badgeY = headerH + (opt.isStory ? 80 : 60);
        const r = opt.isStory ? 75 : 60;

        ctx.fillStyle = isMinimal ? "#000000" : "#d97706";
        ctx.beginPath(); ctx.arc(badgeX, badgeY, r, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = isMinimal ? "#ffffff" : "#fbbf24";
        ctx.beginPath(); ctx.arc(badgeX, badgeY, r - 5, 0, 2*Math.PI); ctx.fill();

        ctx.fillStyle = isMinimal ? "#000000" : "#78350f";
        ctx.font = `bold ${opt.isStory ? 22 : 18}px Arial`;
        ctx.fillText("GARANTÍA", badgeX, badgeY - 10);
        ctx.font = `900 ${opt.isStory ? 32 : 26}px Arial`;
        ctx.fillText("REAL", badgeX, badgeY + 20);
    }

    // 7. ENTREGA 24H
    if (opt.showDelivery) {
        const delX = (opt.isStory ? 160 : 120);
        const delY = headerH + (opt.isStory ? 80 : 60);
        
        ctx.fillStyle = isMinimal ? "#e5e5e5" : "#22c55e";
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 10;
        const pillW = 220; const pillH = 60;
        ctx.beginPath(); ctx.roundRect(delX - pillW/2, delY - pillH/2, pillW, pillH, 50); ctx.fill();
        ctx.shadowColor = "transparent";

        ctx.fillStyle = isMinimal ? "#000000" : "#ffffff";
        ctx.font = "bold 24px 'Manrope', sans-serif";
        ctx.fillText("🚀 ENTREGA 24H", delX, delY + 8);
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
        ctx.fillText(`Agente Autorizado: ${opt.gestorName}`, iconX + 80, centerY - 45);
    }
}

async function downloadAllImages() {
    const btn = document.getElementById('btn-download');
    const oldText = btn.innerText;
    btn.innerText = "⏳ GENERANDO...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        const options = {
            theme: document.getElementById('ctrl-theme').value,
            useAI: document.getElementById('toggle-ai-bg').checked,
            isStory: document.getElementById('toggle-format').checked,
            showPrice: document.getElementById('toggle-price').checked,
            showPhone: document.getElementById('toggle-phone').checked,
            showDelivery: document.getElementById('toggle-delivery').checked,
            showWarranty: document.getElementById('toggle-warranty').checked,
            gestorName: gestorData.nombre,
            gestorPhone: gestorData.telefono || "5356071095"
        };

        for (const prod of filteredProducts) {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = options.isStory ? 1920 : 1080;
            await drawProductCard(canvas, prod, options);
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
            const cleanName = prod.nombre.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            zip.file(`${cleanName}.jpg`, blob);
        }

        const content = await zip.generateAsync({type:"blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Pack_${options.theme}.zip`;
        link.click();
        alert("✅ Pack Descargado");
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}