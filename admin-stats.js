// admin-stats.js - VERSIÓN PRO CON FILTROS Y NUEVAS MÉTRICAS

// CONFIGURACIÓN: Lista negra de agentes para no ensuciar las estadísticas
const EXCLUDED_AGENTS = ['Marcel Montano', 'Administrador', 'Soporte Técnico'];

/**
 * FUNCIÓN PRINCIPAL
 */
async function initTrafficDashboard() {
    const container = document.getElementById('cnt-trafico');
    if (!container) return;

    // 1. Inyectar HTML Estructurado (Diseño Dashboard)
    container.innerHTML = `
        <!-- FILA 1: KPIs CLAVE (TARJETAS) -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <!-- Visitas Totales -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                <div class="absolute right-0 top-0 p-3 opacity-10"><span class="material-symbols-outlined text-4xl">ads_click</span></div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tráfico Total</p>
                <h3 id="stat-total-clicks" class="text-3xl font-black text-indigo-600">...</h3>
                <p id="stat-growth" class="text-[10px] font-bold mt-2">Calculando...</p>
            </div>

            <!-- Tasa de Conversión -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                <div class="absolute right-0 top-0 p-3 opacity-10"><span class="material-symbols-outlined text-4xl">funnel_metrics</span></div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Conversión (Ventas/Clics)</p>
                <h3 id="stat-conversion" class="text-3xl font-black text-emerald-500">...</h3>
                <p class="text-[10px] text-gray-400 font-medium mt-2">Eficiencia del sitio</p>
            </div>

            <!-- Hora Pico -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                <div class="absolute right-0 top-0 p-3 opacity-10"><span class="material-symbols-outlined text-4xl">schedule</span></div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hora Pico (Mejor Hora)</p>
                <h3 id="stat-peak-hour" class="text-3xl font-black text-orange-500">...</h3>
                <p class="text-[10px] text-gray-400 font-medium mt-2">Hora local del servidor</p>
            </div>

            <!-- Top País -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                <div class="absolute right-0 top-0 p-3 opacity-10"><span class="material-symbols-outlined text-4xl">public</span></div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">País Principal</p>
                <h3 id="stat-top-country" class="text-2xl font-black text-blue-500 truncate">...</h3>
                <div class="w-full bg-gray-100 h-1.5 mt-4 rounded-full overflow-hidden">
                    <div id="bar-country-dominance" class="bg-blue-500 h-full" style="width: 0%"></div>
                </div>
            </div>
        </div>

        <!-- FILA 2: GRÁFICAS GRANDES -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            <!-- EL RELOJ DE ORO (HORARIOS) -->
            <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-xs font-black uppercase text-gray-500 flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg">bar_chart</span> Actividad por Hora (Calor)
                    </h4>
                </div>
                <div class="h-64">
                    <canvas id="chart-hours"></canvas>
                </div>
            </div>

            <!-- SISTEMAS OPERATIVOS -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h4 class="text-xs font-black uppercase text-gray-500 mb-4">📱 Tecnología Cliente</h4>
                <div class="h-48 flex justify-center">
                    <canvas id="chart-os"></canvas>
                </div>
                <div class="mt-4 text-center text-[10px] text-gray-400 italic">
                    *Ayuda a saber si optimizar para iPhone o Android
                </div>
            </div>
        </div>

        <!-- FILA 3: TABLAS DETALLADAS -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- TOP AGENTES (SIN TI) -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h4 class="text-xs font-black uppercase text-gray-500 mb-4">🏆 Mejores Agentes (Tráfico)</h4>
                <div class="overflow-y-auto max-h-60 custom-scrollbar">
                    <table class="w-full text-left">
                        <tbody id="table-agents-body" class="text-xs font-bold text-gray-600 dark:text-gray-300 divide-y dark:divide-gray-700"></tbody>
                    </table>
                </div>
            </div>

            <!-- INTERÉS DE PRODUCTOS (VISTAS) -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h4 class="text-xs font-black uppercase text-gray-500 mb-4">👁️ Lo más mirado (Interés)</h4>
                <div class="overflow-y-auto max-h-60 custom-scrollbar">
                    <table class="w-full text-left">
                        <tbody id="table-products-body" class="text-xs font-bold text-gray-600 dark:text-gray-300 divide-y dark:divide-gray-700"></tbody>
                    </table>
                </div>
            </div>

            <!-- PAÍSES -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h4 class="text-xs font-black uppercase text-gray-500 mb-4">🌍 Geografía</h4>
                <div class="overflow-y-auto max-h-60 custom-scrollbar">
                    <table class="w-full text-left">
                        <tbody id="table-countries-body" class="text-xs font-bold text-gray-600 dark:text-gray-300 divide-y dark:divide-gray-700"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // 2. CARGA DE DATOS MULTI-TABLA
    try {
        // A. Clics (Filtrando columnas innecesarias para velocidad)
        const { data: analytics } = await supabaseClient
            .from('link_analytics')
            .select('agent_name, pais, timestamp, os')
            .order('timestamp', { ascending: false });

        // B. Ventas (Para conversión)
        const { count: totalVentas } = await supabaseClient
            .from('pedidos')
            .select('*', { count: 'exact', head: true });

        // C. Vistas de Productos
        const { data: vistasProductos } = await supabaseClient
            .from('metricas_vistas')
            .select('nombre_producto');

        if (!analytics || analytics.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">No hay datos suficientes para generar inteligencia.</div>`;
            return;
        }

        // 3. Procesar
        processAndRenderAdvancedStats(analytics, totalVentas || 0, vistasProductos || []);

    } catch (e) {
        console.error("Error Dashboard:", e);
        container.innerHTML = `<div class="p-10 text-center text-red-400">Error de conexión: ${e.message}</div>`;
    }
}

/**
 * MOTOR DE PROCESAMIENTO DE DATOS
 */
// --- PEGAR ESTO EN admin-stats.js ---

// --- PEGAR EN admin-stats.js ---

// 1. FUNCIÓN MAESTRA PARA ADIVINAR EL PAÍS (Basada en tu CSV)
// --- PEGAR EN admin-stats.js (Reemplaza la función inferirPais existente) ---

function inferirPais(ip) {
    if (!ip) return "Desconocido";
    
    // 1. RANGOS CUBA (ETECSA + NAUTA HOGAR)
    // Agregados: 181.177, 190, 186
    if (ip.startsWith("152.") || ip.startsWith("153.") || 
        ip.startsWith("181.") || ip.startsWith("169.159.") ||
        ip.startsWith("190.") || ip.startsWith("186.")) {
        return "Cuba";
    }

    // 2. RANGOS DE LA APP DE FACEBOOK/INSTAGRAM
    // Estos usuarios probablemente están en Cuba usando la app
    if (ip.startsWith("173.252.") || ip.startsWith("66.220.") || 
        ip.startsWith("31.13.") || ip.startsWith("54.") || ip.startsWith("34.")) {
        return "Facebook App (Posible Cuba)";
    }

    // 3. RANGOS VPN / PROXY COMUNES
    // 129.222 es OVH (VPN muy usada), 104 es Cloudflare
    if (ip.startsWith("129.") || ip.startsWith("174.") || 
        ip.startsWith("104.") || ip.startsWith("172.") || ip.startsWith("35.")) {
        return "VPN / Estados Unidos";
    }

    // 4. EUROPA (Datos sueltos que vi en tu CSV, ej: 83.x, 88.x)
    if (ip.startsWith("83.") || ip.startsWith("88.") || ip.startsWith("5.") || ip.startsWith("37.")) {
        return "Europa";
    }

    return "Internacional";
}

// 2. PROCESAMIENTO DE DATOS (Arreglado para forzar el cálculo de país)
function processAndRenderAdvancedStats(data, totalVentas, vistasProd) {
    
    // A. Usamos TODOS los datos (sin filtrar a Marcel ni Admin para que veas movimiento)
    const cleanData = data; 
    
    const totalClicks = cleanData.length;
    if(totalClicks === 0) {
        // Si está vacío, limpiamos la pantalla
        document.getElementById('stat-total-clicks').innerText = "0";
        return;
    }

    // --- CÁLCULO DE KPIS BÁSICOS ---
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const countToday = cleanData.filter(d => d.timestamp.startsWith(todayStr)).length;
    const countYest = cleanData.filter(d => d.timestamp.startsWith(yesterdayStr)).length;
    
    let growthHtml = "";
    if (countYest === 0) {
        growthHtml = `<span class="text-emerald-500">🚀 Primeros datos hoy</span>`;
    } else {
        const diff = ((countToday - countYest) / countYest) * 100;
        const color = diff >= 0 ? "text-emerald-500" : "text-red-500";
        const icon = diff >= 0 ? "trending_up" : "trending_down";
        growthHtml = `<span class="${color} flex items-center gap-1"><span class="material-symbols-outlined text-sm">${icon}</span> ${Math.abs(diff).toFixed(1)}% vs ayer</span>`;
    }
    
    document.getElementById('stat-total-clicks').innerText = totalClicks.toLocaleString();
    document.getElementById('stat-growth').innerHTML = growthHtml;

    // Tasa de Conversión
    const conversionRate = totalClicks > 0 ? ((totalVentas / totalClicks) * 100).toFixed(1) : "0.0";
    document.getElementById('stat-conversion').innerText = `${conversionRate}%`;

    // --- AGREGACIONES (MAPAS) ---
    const hours = Array(24).fill(0);
    const osMap = {};
    const countryMap = {};
    const agentMap = {};

    cleanData.forEach(row => {
        // 1. Hora
        const date = new Date(row.timestamp);
        let hour = date.getHours(); 
        hours[hour]++;

        // 2. OS
        const os = row.os || "Otro";
        osMap[os] = (osMap[os] || 0) + 1;

        // 3. PAÍS (AQUÍ ESTÁ LA CORRECCIÓN CLAVE)
        // Ignoramos lo que diga la base de datos si está vacío y calculamos SIEMPRE
        let paisCalculado = row.pais;
        
        // Si viene vacío de la base de datos, usamos la función de emergencia
        if (!paisCalculado || paisCalculado === "Desconocido" || paisCalculado === null) {
            paisCalculado = inferirPais(row.ip_address);
        }
        
        countryMap[paisCalculado] = (countryMap[paisCalculado] || 0) + 1;

        // 4. Agente
        const ag = row.agent_name || "Directo";
        agentMap[ag] = (agentMap[ag] || 0) + 1;
    });

    // --- RENDERIZADO DE TARJETAS SUPERIORES ---
    
    // Hora Pico
    const maxVisitsHour = Math.max(...hours);
    const peakHourIndex = hours.indexOf(maxVisitsHour);
    const ampm = peakHourIndex >= 12 ? 'PM' : 'AM';
    const displayHour = peakHourIndex % 12 || 12; 
    document.getElementById('stat-peak-hour').innerText = `${displayHour}:00 ${ampm}`;

    // País Top
    const sortedCountries = Object.entries(countryMap).sort((a,b) => b[1] - a[1]);
    if(sortedCountries.length > 0) {
        document.getElementById('stat-top-country').innerText = sortedCountries[0][0];
        const dominance = (sortedCountries[0][1] / totalClicks) * 100;
        document.getElementById('bar-country-dominance').style.width = `${dominance}%`;
    }

    // --- ACTUALIZAR GRÁFICAS (Chart.js) ---
    if (window.myChartHours) window.myChartHours.destroy();
    if (window.myChartOS) window.myChartOS.destroy();

    // Gráfica Horas
    const ctxHours = document.getElementById('chart-hours').getContext('2d');
    window.myChartHours = new Chart(ctxHours, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}h`),
            datasets: [{
                label: 'Visitas',
                data: hours,
                backgroundColor: 'rgba(79, 70, 229, 0.6)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { display: false }, x: { grid: { display: false } } }
        }
    });

    // Gráfica OS
    const sortedOS = Object.entries(osMap).sort((a,b) => b[1] - a[1]);
    const ctxOS = document.getElementById('chart-os').getContext('2d');
    window.myChartOS = new Chart(ctxOS, {
        type: 'doughnut',
        data: {
            labels: sortedOS.map(x => x[0]),
            datasets: [{
                data: sortedOS.map(x => x[1]),
                backgroundColor: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } }
        }
    });

    // --- TABLAS DE DETALLE ---

    // 1. TABLA AGENTES
    const sortedAgents = Object.entries(agentMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    document.getElementById('table-agents-body').innerHTML = sortedAgents.map(([name, count], i) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="py-2 pl-2 flex items-center gap-2">
                <span class="text-gray-300 font-bold w-4">${i+1}</span>
                <span class="text-indigo-600 font-bold uppercase truncate max-w-[120px]">${name}</span>
            </td>
            <td class="py-2 text-right pr-2">
                <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black">${count}</span>
            </td>
        </tr>
    `).join('');

    // 2. TABLA PAÍSES (Ahora sí se llenará)
    document.getElementById('table-countries-body').innerHTML = sortedCountries.slice(0, 10).map(([name, count], i) => {
        let flag = "🏳️";
        if(name === "Cuba") flag = "🇨🇺";
        else if(name.includes("Estados Unidos") || name.includes("USA")) flag = "🇺🇸";
        else if(name.includes("España")) flag = "🇪🇸";
        
        // Calculamos porcentaje para barra visual
        const percent = Math.round((count / totalClicks) * 100);
        
        return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
            <td class="py-3 pl-2 text-gray-600 font-bold text-[11px] align-middle">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${flag}</span> 
                    <span>${name}</span>
                </div>
            </td>
            <td class="py-3 text-right pr-2 align-middle w-24">
                <div class="flex flex-col items-end">
                    <span class="font-black text-slate-800">${count}</span>
                    <div class="w-full bg-gray-100 h-1 rounded-full mt-1">
                        <div class="bg-blue-500 h-full rounded-full" style="width: ${percent}%"></div>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');

    // 3. TABLA DE INTERÉS (PRODUCTOS) - LISTA COMPLETA
    if (vistasProd && vistasProd.length > 0) {
        const prodMap = {};
        vistasProd.forEach(v => { prodMap[v.nombre_producto] = (prodMap[v.nombre_producto] || 0) + 1; });
        
        // ORDENAMOS PERO NO CORTAMOS (.slice ELIMINADO)
        const sortedProds = Object.entries(prodMap).sort((a,b) => b[1] - a[1]);
        
        document.getElementById('table-products-body').innerHTML = sortedProds.map(([name, count], i) => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
                <td class="py-3 pl-2 align-middle">
                    <div class="flex items-start gap-2">
                        <span class="text-[9px] font-bold text-gray-300 mt-0.5">#${i+1}</span>
                        <span class="text-emerald-600 font-black uppercase text-[10px] leading-snug block">${name}</span>
                    </div>
                </td>
                <td class="py-3 text-right pr-2 align-middle w-16">
                    <div class="flex items-center justify-end gap-1 text-[10px] text-gray-400 font-bold">
                        <span class="material-symbols-outlined text-[14px]">visibility</span> ${count}
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        document.getElementById('table-products-body').innerHTML = `<tr><td class="p-4 text-center text-gray-400">Sin datos de interés aún</td></tr>`;
    }
}