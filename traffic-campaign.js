/* ======================================================
   MÓDULO DE CAMPAÑA: TENDENCIAS DE VENTAS v4.3 (PRO)
   Cinta de Noticias de Productos con mayor demanda y caché local segura.
   ====================================================== */

// Contenedor seguro para evitar bloqueos del navegador en entornos locales (file://)
const safeStorage = {
    getItem: function(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("⚠️ [SISTEMA] El navegador bloquea localStorage localmente. Usando datos en vivo.");
            return null;
        }
    },
    setItem: function(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }
};

const TrafficCampaign = {
    topProducts: [],

    init: async function() {
        this.topProducts = await this.fetchTopSoldProducts();
        this.injectGlobalRibbon();
    },

    // --- 1. PROCESAR Y FILTRAR VENTAS CON CACHÉ SEGURA ---
    fetchTopSoldProducts: async function() {
        const cacheKey = 'pth_top_5_products';
        const cacheTimeKey = 'pth_top_5_products_time';
        const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 Horas

        const cachedData = safeStorage.getItem(cacheKey);
        const cachedTime = safeStorage.getItem(cacheTimeKey);

        // Verificación de caché tolerante a fallos
        if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < ONE_DAY_MS)) {
            console.log("⚡ [SISTEMA] Cargando tendencias desde caché local.");
            return JSON.parse(cachedData);
        }

        console.log("☁️ [SISTEMA] Consultando Supabase para actualizar tendencias.");
        try {
            // Obtenemos los últimos 100 pedidos ordenados por 'fecha'
            const { data, error } = await supabaseClient
                .from('pedidos')
                .select('producto, fecha')
                .neq('estado', 'Cancelado')
                .order('fecha', { ascending: false })
                .limit(100);

            if (error) throw error;
            if (!data || data.length === 0) return [];

            const oneDayAgo = Date.now() - ONE_DAY_MS;
            const sevenDaysAgo = Date.now() - (7 * ONE_DAY_MS);

            // Filtrar las ventas de las últimas 24 horas usando la columna fecha
            let ordersToParse = data.filter(p => {
                if (!p.fecha) return false;
                const orderTime = new Date(p.fecha).getTime();
                return orderTime >= oneDayAgo;
            });

            let isFallback = false;

            // FALLBACK: Si no hay ventas en 24h, ampliamos el rango a la última semana
            if (ordersToParse.length === 0) {
                ordersToParse = data.filter(p => {
                    if (!p.fecha) return false;
                    const orderTime = new Date(p.fecha).getTime();
                    return orderTime >= sevenDaysAgo;
                });
                isFallback = true;
            }

            const productCounts = {};
            ordersToParse.forEach(p => {
                if (!p.producto) return;
                const parts = p.producto.split(' + ');
                parts.forEach(part => {
                    const match = part.trim().match(/^(\d+)x\s+(.+?)(\[|$)/);
                    if (match) {
                        const qty = parseInt(match[1]) || 1;
                        const name = match[2].trim();
                        productCounts[name] = (productCounts[name] || 0) + qty;
                    } else {
                        const cleanName = part.trim().split('[')[0].trim();
                        if (cleanName) {
                            productCounts[cleanName] = (productCounts[cleanName] || 0) + 1;
                        }
                    }
                });
            });

            const sorted = Object.entries(productCounts)
                .map(([name, qty]) => ({ name, qty }))
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5)
                .map(item => ({
                    ...item,
                    isFallback: isFallback
                }));

            safeStorage.setItem(cacheKey, JSON.stringify(sorted));
            safeStorage.setItem(cacheTimeKey, Date.now().toString());

            return sorted;
        } catch (e) {
            console.error("Error procesando tendencias de venta:", e);
            return [];
        }
    },

    // --- 2. CONSTRUIR CINTA DE NOTICIAS PREMIUM (NOTAS DE DISEÑO: RAJDHANI/NEÓN) ---
    injectGlobalRibbon: function() {
        const mainContainer = document.querySelector('main');
        if (!mainContainer) return;

        const oldRibbon = document.getElementById('traffic-global-ribbon');
        if (oldRibbon) oldRibbon.remove();

        if (!document.getElementById('sl-ticker-styles')) {
            const style = document.createElement('style');
            style.id = 'sl-ticker-styles';
            style.innerHTML = `
                @keyframes ticker {
                    0% { transform: translate3d(100%, 0, 0); }
                    100% { transform: translate3d(-100%, 0, 0); }
                }
                .sl-ticker-wrap {
                    width: 100%;
                    overflow: hidden;
                    position: relative;
                    margin-bottom: 20px;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    background-color: #020617; 
                    border: 1px solid #06b6d4; 
                    box-shadow: 0 0 15px rgba(6, 182, 212, 0.15), inset 0 0 20px rgba(6, 182, 212, 0.05);
                    border-radius: 4px;
                }
                .sl-ticker-move {
                    display: inline-block;
                    padding-left: 30%; 
                    animation: ticker 25s linear infinite;
                }
                .sl-ticker-move:hover {
                    animation-play-state: paused; 
                }
                .sl-ticker-item {
                    display: inline-flex;
                    align-items: center;
                    color: #e2e8f0;
                    font-family: 'Rajdhani', sans-serif;
                    font-weight: 700;
                    font-size: 14px;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    padding: 10px 0;
                }
                .sl-text-glow { text-shadow: 0 0 8px rgba(34, 211, 238, 0.8); }
                .sl-amber-glow { text-shadow: 0 0 8px rgba(245, 158, 11, 0.8); }
            `;
            document.head.appendChild(style);
        }

        let tickerContent = "";

        if (this.topProducts && this.topProducts.length > 0) {
            const isFallback = this.topProducts[0].isFallback;
            const headerLabel = isFallback 
                ? `<span class="text-amber-500 font-black mr-3 sl-amber-glow">[🏆 RECOMENDADOS DE LA SEMANA]</span>`
                : `<span class="text-cyan-400 font-black mr-3 sl-text-glow">[⚡ TOP 5 ÚLTIMAS 24 HORAS]</span>`;

            const medalEmojis = ["🥇", "🥈", "🥉", "⚡", "🔥"];

            const productsString = this.topProducts.map((p, index) => {
                const medal = medalEmojis[index] || "▪️";
                return `<span class="text-white">${medal} ${index + 1}. <span class="text-cyan-300 font-black">${p.name.toUpperCase()}</span> <span class="text-amber-400 font-black tracking-wide">¡LO MÁS CALIENTE CON ALTÍSIMA DEMANDA AHORA MISMO! 🔥</span></span>`;
            }).join(' <span class="text-slate-600 mx-6">|</span> ');

            tickerContent = `
            <div id="traffic-global-ribbon" class="sl-ticker-wrap font-system">
                <div class="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2 border-cyan-400 z-20"></div>
                <div class="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2 border-cyan-400 z-20"></div>
                
                <div class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#020617] via-[#020617] to-transparent w-16 z-10 flex items-center pl-4 pointer-events-none">
                    <span class="text-xl animate-pulse">🔥</span>
                </div>

                <div class="sl-ticker-move">
                    <div class="sl-ticker-item pl-12">
                        ${headerLabel}
                        <span class="mr-6">PROMUEVE ESTO PARA ASEGURAR TUS VENTAS:</span>
                        ${productsString}
                        <span class="ml-12 text-purple-400 font-black tracking-widest">[COMPARTE TU ENLACE Y LLÉVATE LAS COMISIONES]</span>
                    </div>
                </div>
            </div>`;
        } else {
            tickerContent = `
            <div id="traffic-global-ribbon" class="sl-ticker-wrap font-system border-slate-700 shadow-none">
                <div class="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2 border-slate-500 z-20"></div>
                <div class="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2 border-slate-500 z-20"></div>
                <div class="sl-ticker-move">
                    <div class="sl-ticker-item pl-16 text-slate-400">
                        <span class="text-amber-500 font-black mr-3">[SISTEMA]</span>
                        <span>BUSCANDO NUEVOS DATOS DE MERCADO... COMPARTE TU ENLACE PARA AGILIZAR LA CACERÍA.</span>
                    </div>
                </div>
            </div>`;
        }

        mainContainer.insertAdjacentHTML('afterbegin', tickerContent);
    }
};

window.addEventListener('load', () => {
    setTimeout(() => TrafficCampaign.init(), 100);
});