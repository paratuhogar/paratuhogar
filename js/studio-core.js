// js/studio-core.js

const SUPABASE_URL = 'https://ljqwaovevfatkiigirhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allProducts = [];
let filteredProducts =[];
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
    const switches =['toggle-format', 'toggle-ai-bg', 'toggle-price', 'toggle-phone', 'toggle-delivery', 'toggle-warranty'];
    switches.forEach(id => document.getElementById(id).addEventListener('change', refreshPreviews));
});

async function loadInventory() {
    const { data, error } = await supabaseClient.from('productos').select('*').eq('disponible', 'SI').order('nombre');
    if (error) return;
    allProducts = data;
    
    const cats =[...new Set(data.map(p => p.categoria ? p.categoria.toUpperCase() : 'VARIOS'))].sort();
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

async function refreshPreviews() {
    const container = document.getElementById('preview-grid');
    container.innerHTML = ""; 

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
        
        if(options.useAI && !imageCache[prod.id]) {
            wrapper.innerHTML = `<div class="w-full aspect-[9/16] flex items-center justify-center bg-slate-800 rounded-lg text-slate-500 text-xs animate-pulse">🤖 IA Trabajando...</div>`;
        } else {
            wrapper.appendChild(canvas);
        }
        
        container.appendChild(wrapper);

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

// --- MOTOR GRÁFICO ---
async function drawProductCard(canvas, product, opt) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const isStory = opt.isStory;

    // =======================================================
    // 🌟 INTERCEPTOR: TEMA TECHNO RETAIL
    // =======================================================
    // =======================================================
    // 🌟 INTERCEPTOR: TEMA TECHNO RETAIL (NOMBRE + GARANTÍA VISIBLE)
    // =======================================================
    if (opt.theme === 'techno') {
        const bgColor = '#002b5e'; // Azul corporativo
        const yellowAccent = '#fdf84c'; // Amarillo limón
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        // ---------------------------------------------------
        // 1. CARGAR TU LOGO REAL (log.jpeg) CIRCULAR
        // ---------------------------------------------------
        const logoImg = new Image();
        logoImg.crossOrigin = "Anonymous";
        logoImg.src = "log.jpeg"; 
        
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
        // 2. TÍTULOS INCLINADOS (Categoría General)
        // ---------------------------------------------------
        ctx.save();
        ctx.translate(isStory ? W/2 + 20 : 580, isStory ? 230 : 120); 
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
        
        ctx.font = 'italic 900 120px Impact, sans-serif'; 
        ctx.fillText(mainTitle, 0, 125); 
        ctx.restore();

        // ---------------------------------------------------
        // 3. IMAGEN DEL PRODUCTO
        // ---------------------------------------------------
        const img = await getSmartImage(product, opt.useAI);
        if (img) {
            ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 25;
            
            let imgW = isStory ? 900 : 550;
            let imgH = isStory ? 800 : 700;
            let imgX = isStory ? (W - imgW) / 2 : 20;
            let imgY = isStory ? 350 : 250; 
            
            const scale = Math.min(imgW / img.width, imgH / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = imgX + (imgW - w) / 2;
            const y = imgY + (imgH - h) / 2;
            
            ctx.drawImage(img, x, y, w, h);
            ctx.shadowColor = "transparent";
        }

        // ---------------------------------------------------
        // 4. NOMBRE EXACTO DEL EQUIPO (NUEVO Y PROMINENTE)
        // ---------------------------------------------------
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px Arial, sans-serif'; 
        ctx.textAlign = 'left';
        
        let textStartX = isStory ? 100 : 600;
        let textStartY = isStory ? 1200 : 350;
        
        // window.wrapText devuelve la coordenada Y donde terminó de escribir
        // Así sabemos exactamente dónde empezar a dibujar las viñetas debajo
        let nextY = window.wrapText(ctx, product.nombre.toUpperCase(), textStartX, textStartY, isStory ? W - 200 : 450, 42);

        // ---------------------------------------------------
        // 5. VIÑETAS DE BENEFICIOS (Garantía y Entrega OBLIGATORIOS)
        // ---------------------------------------------------
        let features = [];
        
        // 1ro: Prioridades Innegociables
        if(opt.showDelivery) features.push('ENTREGA INMEDIATA EN LA HABANA');
        if(opt.showWarranty) features.push(`GARANTÍA: ${product.garantia || '1 MES'}`.toUpperCase());
        features.push('EQUIPO NUEVO EN CAJA SELLADA');

        // 2do: Detalles técnicos (Extraídos limpiamente)
        const extractedSpecs = extractTechSpecs(product.descripcion, 3); // Max 3 para no saturar
        extractedSpecs.forEach(f => {
            let cleanFeat = f.replace(/MARCA:|CARACTERÍSTICAS:/gi, '').trim();
            if(cleanFeat.length > 2) features.push(cleanFeat);
        });

        // Dibujar viñetas debajo del nombre
        let bulletY = nextY + 35; // Dejamos 35px de respiración después del nombre
        
        features.slice(0, 6).forEach((feat, index) => {
            ctx.fillStyle = yellowAccent; 
            ctx.font = '400 35px Arial, sans-serif'; 
            ctx.fillText("•", textStartX, bulletY + (index * 45));
            
            ctx.fillStyle = '#d7f2a5'; 
            ctx.font = '600 28px Arial, sans-serif'; // Letra clara y fuerte
            ctx.fillText(feat.substring(0, 42), textStartX + 35, bulletY + (index * 45));
        });

        // ---------------------------------------------------
        // 6. CAJA AMARILLA DEL PRECIO
        // ---------------------------------------------------
        ctx.fillStyle = yellowAccent;
        ctx.beginPath();
        if (isStory) {
            ctx.moveTo(0, H - 420);    
            ctx.lineTo(W, H - 520);    
            ctx.lineTo(W, H); 
            ctx.lineTo(0, H); 
        } else {
            // Bajamos un poco el corte para que las viñetas nuevas quepan bien
            ctx.moveTo(600, 660);   
            ctx.lineTo(W, 620);     
            ctx.lineTo(W, 850);     
            ctx.lineTo(950, 850);   
            ctx.lineTo(880, H);     
            ctx.lineTo(550, H);     
        }
        ctx.closePath();
        ctx.fill();

        // ---------------------------------------------------
        // 7. PRECIO GIGANTE CON USD MATEMÁTICAMENTE SEPARADO
        // ---------------------------------------------------
        if (opt.showPrice) {
            ctx.fillStyle = bgColor; 
            
            let pX = isStory ? W/2 : 820;
            let pY = isStory ? H - 180 : 800; // Ajustado para Post
            let priceStr = `$${product.precio}`;

            // Calculamos anchos para evitar que choquen
            ctx.font = '900 240px Impact, sans-serif'; 
            let priceWidth = ctx.measureText(priceStr).width;
            
            ctx.font = '900 60px Impact, sans-serif';
            let usdWidth = ctx.measureText("USD").width;

            let totalWidth = priceWidth + 15 + usdWidth;
            let startX = pX - (totalWidth / 2);

            // Dibujar Precio
            ctx.textAlign = 'left';
            ctx.font = '900 240px Impact, sans-serif'; 
            ctx.fillText(priceStr, startX, pY);
            
            // Dibujar USD (Nunca chocará)
            ctx.font = '900 60px Impact, sans-serif';
            ctx.fillText("USD", startX + priceWidth + 15, pY - 30);
        }

        // ---------------------------------------------------
        // 8. DATOS DE CONTACTO (Anti-Duplicado)
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
                ctx.fillText(`WhatsApp: ${phoneFormat}`, W/2, H - 50);
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

        let index = 1; 

        for (const prod of filteredProducts) {
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
        alert("✅ Pack Descargado");
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}