// js/studio-core.js

// 1. CONFIGURACIÓN SUPABASE
const SUPABASE_URL = 'https://ljqwaovevfatkiigirhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allProducts = [];
let filteredProducts = [];
let gestorData = {};
let visibleCount = 12;

// 2. INICIALIZACIÓN
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
    
    const switches = ['toggle-format', 'toggle-white-bg', 'toggle-price', 'toggle-phone', 'toggle-delivery', 'toggle-warranty'];
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

// 7. RENDERIZAR VISTAS
async function refreshPreviews() {
    const container = document.getElementById('preview-grid');
    container.innerHTML = ""; 

    const options = {
        theme: document.getElementById('ctrl-theme').value,
        isStory: document.getElementById('toggle-format').checked,
        forceWhite: document.getElementById('toggle-white-bg').checked,
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
        
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
        drawProductCard(canvas, prod, options); // Async pero no bloqueante para UI
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

// --- 8. MOTOR GRÁFICO AVANZADO ---
async function drawProductCard(canvas, product, opt) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // --- CONFIGURACIÓN DE TEMA ---
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
    if (opt.forceWhite && !isImpact && !isDark) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
    } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, t.bgStart);
        grad.addColorStop(1, t.bgEnd);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // 2. HEADER (Marca)
    const headerH = opt.isStory ? 200 : 150;
    
    if (!isMinimal) {
        // En minimal no ponemos barra de color, solo texto
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

    // 3. IMAGEN DEL PRODUCTO
    // Calculamos área útil
    const footerH = opt.isStory ? 250 : 180;
    const availableH = H - headerH - footerH;
    const imgMargin = isMinimal ? 40 : 80;
    
    // Altura de imagen
    let imgH = availableH * 0.65; // Ocupa el 65% del espacio central
    let imgY = headerH + (availableH - imgH) / 2 - 100; // Centrado verticalmente tirando arriba

    const imgUrl = fixImageUrl(product.thumbnail);
    const img = new Image(); img.crossOrigin = "Anonymous"; img.src = imgUrl;

    try {
        await new Promise((r, j) => { img.onload = r; img.onerror = j; });

        // SOMBRA (Efecto Elevación)
        if (!isImpact) {
            ctx.shadowColor = isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.2)";
            ctx.shadowBlur = isMinimal ? 60 : 40;
            ctx.shadowOffsetY = 30;
        }

        // Si el tema es Minimal, no ponemos tarjeta blanca, la imagen flota limpia
        if (!isMinimal && !isDark && !isImpact) {
            ctx.fillStyle = "white";
            const cardSize = Math.min(W - 100, imgH + 100);
            const cardX = (W - cardSize) / 2;
            ctx.fillRect(cardX, imgY, cardSize, cardSize);
        }

        // DIBUJAR IMAGEN
        const targetSize = isMinimal ? W - 100 : Math.min(W - 150, imgH);
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = (W - drawW) / 2;
        const drawY = imgY + (targetSize - drawH) / 2; // Centrado en su área

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.shadowColor = "transparent"; // Reset sombra

    } catch (e) { /* Fallback */ }

    // 4. PRECIO (GIGANTE)
    if (opt.showPrice) {
        const priceY = imgY + imgH + (opt.isStory ? 100 : 50);
        
        ctx.textAlign = "center";
        
        // Estilo Precio
        if (isMinimal) {
            ctx.fillStyle = "#000000";
            ctx.font = `900 130px ${t.font}`;
            ctx.fillText(`$${product.precio}`, W/2, priceY);
            ctx.font = `500 40px ${t.font}`;
            ctx.fillStyle = "#86868b";
            ctx.fillText("USD / Efectivo", W/2, priceY + 60);
        } else {
            // Estilo Badge/Etiqueta
            const priceText = `$${product.precio} USD`;
            ctx.font = `900 110px ${t.font}`;
            const textMetrics = ctx.measureText(priceText);
            const bgW = textMetrics.width + 100;
            const bgH = 160;
            
            ctx.fillStyle = t.priceBg;
            
            // Sombra neón para Midnight
            if (isDark) {
                ctx.shadowColor = "#fbbf24";
                ctx.shadowBlur = 30;
            } else {
                ctx.shadowColor = "rgba(0,0,0,0.3)";
                ctx.shadowBlur = 20;
                ctx.shadowOffsetY = 10;
            }

            // Pastilla redondeada
            ctx.beginPath();
            ctx.roundRect((W - bgW)/2, priceY - bgH/1.5, bgW, bgH, 30);
            ctx.fill();
            ctx.shadowColor = "transparent";

            ctx.fillStyle = t.priceText || "#ffffff";
            ctx.fillText(priceText, W/2, priceY);
        }
    }

    // 5. NOMBRE DEL PRODUCTO
    const nameY = imgY + imgH + (opt.isStory ? 280 : 180);
    ctx.fillStyle = t.textMain;
    ctx.font = `800 ${opt.isStory ? 55 : 45}px ${t.font}`;
    const nameText = product.nombre.length > 40 ? product.nombre.substring(0, 37) + "..." : product.nombre;
    ctx.fillText(nameText, W/2, nameY);

    // 6. GARANTÍA REAL (SELLO DORADO)
    if (opt.showWarranty) {
        const badgeX = W - (opt.isStory ? 160 : 120);
        const badgeY = headerH + (opt.isStory ? 80 : 60);
        const r = opt.isStory ? 75 : 60;

        // Círculo Exterior
        ctx.fillStyle = isMinimal ? "#000000" : "#d97706"; // Dorado oscuro o Negro en minimal
        ctx.beginPath(); ctx.arc(badgeX, badgeY, r, 0, 2*Math.PI); ctx.fill();

        // Círculo Interior
        ctx.fillStyle = isMinimal ? "#ffffff" : "#fbbf24"; // Dorado claro
        ctx.beginPath(); ctx.arc(badgeX, badgeY, r - 5, 0, 2*Math.PI); ctx.fill();

        // Texto
        ctx.fillStyle = isMinimal ? "#000000" : "#78350f";
        ctx.font = `bold ${opt.isStory ? 22 : 18}px Arial`;
        ctx.fillText("GARANTÍA", badgeX, badgeY - 10);
        ctx.font = `900 ${opt.isStory ? 32 : 26}px Arial`;
        ctx.fillText("REAL", badgeX, badgeY + 20);
        
        // Estrellas decorativas
        ctx.font = "20px Arial";
        ctx.fillText("★ ★ ★", badgeX, badgeY + 45);
    }

    // 7. ENTREGA 24H (PASTILLA VERDE)
    if (opt.showDelivery) {
        const delX = (opt.isStory ? 160 : 120);
        const delY = headerH + (opt.isStory ? 80 : 60);
        
        // Pastilla
        ctx.fillStyle = isMinimal ? "#e5e5e5" : "#22c55e"; // Verde o Gris
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 10;
        
        const pillW = 220;
        const pillH = 60;
        ctx.beginPath();
        ctx.roundRect(delX - pillW/2, delY - pillH/2, pillW, pillH, 50);
        ctx.fill();
        ctx.shadowColor = "transparent";

        // Texto
        ctx.fillStyle = isMinimal ? "#000000" : "#ffffff";
        ctx.font = "bold 24px 'Manrope', sans-serif";
        ctx.fillText("🚀 ENTREGA 24H", delX, delY + 8);
    }

    // 8. FOOTER (CONTACTO)
    if (opt.showPhone) {
        const footerY = H - footerH;
        
        if (isMinimal) {
            // Estilo Apple: Footer gris muy claro
            ctx.fillStyle = "#f5f5f7";
            ctx.fillRect(0, footerY, W, footerH);
            ctx.fillStyle = "#1d1d1f";
        } else if (isDark) {
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(0, footerY, W, footerH);
            ctx.fillStyle = "#fbbf24";
        } else {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, footerY, W, footerH);
            ctx.fillStyle = "#ffffff";
        }

        // Icono WA
        const iconX = 120;
        const centerY = footerY + footerH/2;
        
        ctx.beginPath();
        ctx.arc(iconX, centerY, 50, 0, 2 * Math.PI);
        ctx.fillStyle = "#22c55e"; // Siempre verde el WA
        ctx.fill();
        
        ctx.fillStyle = "white";
        ctx.font = "bold 55px Arial";
        ctx.fillText("W", iconX, centerY + 20);

        // Texto Pedido
        ctx.textAlign = "left";
        const textColor = isMinimal ? "#000000" : (isDark ? "#ffffff" : "#ffffff");
        ctx.fillStyle = textColor;
        ctx.font = `bold ${opt.isStory ? 60 : 50}px 'Manrope', sans-serif`;
        ctx.fillText(`PEDIDOS: ${opt.gestorPhone}`, iconX + 80, centerY + 15);
        
        // Agente
        ctx.font = `500 ${opt.isStory ? 30 : 25}px 'Manrope', sans-serif`;
        ctx.fillStyle = isMinimal ? "#86868b" : "#94a3b8";
        ctx.fillText(`Agente Autorizado: ${opt.gestorName}`, iconX + 80, centerY - 45);
    }
}

// 9. DESCARGAR TODO
async function downloadAllImages() {
    const btn = document.getElementById('btn-download');
    const oldText = btn.innerText;
    btn.innerText = "⏳ GENERANDO PIXELES...";
    btn.disabled = true;

    try {
        if(typeof JSZip === 'undefined') throw new Error("Librería ZIP no cargada");

        const zip = new JSZip();
        const options = {
            theme: document.getElementById('ctrl-theme').value,
            isStory: document.getElementById('toggle-format').checked,
            forceWhite: document.getElementById('toggle-white-bg').checked,
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
        link.download = `Pack_${options.theme}_${new Date().toLocaleDateString().replace(/\//g,'-')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("✅ Pack Descargado Exitosamente");
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}
// --- FIN DEL ARCHIVO ---