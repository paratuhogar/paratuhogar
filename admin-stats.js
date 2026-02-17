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
function processAndRenderAdvancedStats(data, totalVentas, vistasProd) {
    
    // --- FILTRO DE LIMPIEZA (EXCLUIRTE A TI) ---
    // Filtramos los datos crudos antes de calcular nada
    const cleanData = data.filter(row => !EXCLUDED_AGENTS.includes(row.agent_name));
    
    const totalClicks = cleanData.length;
    if(totalClicks === 0) return; // Si solo estabas tú, mostrar vacío

    // 1. KPI: CRECIMIENTO (Hoy vs Ayer)
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const countToday = cleanData.filter(d => d.timestamp.startsWith(todayStr)).length;
    const countYest = cleanData.filter(d => d.timestamp.startsWith(yesterdayStr)).length;
    
    // Cálculo de porcentaje
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

    // 2. KPI: TASA DE CONVERSIÓN
    // (Ventas Totales / Clics Limpios) * 100
    // Nota: Es una aproximación porque ventas incluye manuales, pero sirve de referencia.
    const conversionRate = ((totalVentas / totalClicks) * 100).toFixed(1);
    document.getElementById('stat-conversion').innerText = `${conversionRate}%`;

    // 3. AGREGACIONES (Mapas de conteo)
    const hours = Array(24).fill(0);
    const osMap = {};
    const countryMap = {};
    const agentMap = {};

    cleanData.forEach(row => {
        // Hora (Extraer HH de timestamp)
        const date = new Date(row.timestamp);
        // Ajuste horario simple (asumiendo que los usuarios están mayormente en una zona)
        // O usamos hora local del navegador del jefe
        hours[date.getHours()]++;

        // OS
        const os = row.os || "Otro";
        osMap[os] = (osMap[os] || 0) + 1;

        // País
        const pais = row.pais || "Desconocido";
        countryMap[pais] = (countryMap[pais] || 0) + 1;

        // Agente
        const ag = row.agent_name || "Directo";
        agentMap[ag] = (agentMap[ag] || 0) + 1;
    });

    // 4. KPI: HORA PICO
    const maxVisitsHour = Math.max(...hours);
    const peakHourIndex = hours.indexOf(maxVisitsHour);
    const ampm = peakHourIndex >= 12 ? 'PM' : 'AM';
    const displayHour = peakHourIndex % 12 || 12; // Formato 12h
    document.getElementById('stat-peak-hour').innerText = `${displayHour}:00 ${ampm}`;

    // 5. KPI: PAÍS TOP
    const sortedCountries = Object.entries(countryMap).sort((a,b) => b[1] - a[1]);
    if(sortedCountries.length > 0) {
        document.getElementById('stat-top-country').innerText = sortedCountries[0][0];
        // Barra de dominancia
        const dominance = (sortedCountries[0][1] / totalClicks) * 100;
        document.getElementById('bar-country-dominance').style.width = `${dominance}%`;
    }

    // --- GRÁFICAS ---

    // A. GRÁFICA DE HORAS (Barras)
    const ctxHours = document.getElementById('chart-hours').getContext('2d');
    new Chart(ctxHours, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}h`), // 0h, 1h... 23h
            datasets: [{
                label: 'Visitas',
                data: hours,
                backgroundColor: (context) => {
                    // Gradiente bonito para las barras
                    const val = context.raw;
                    const alpha = (val / maxVisitsHour) * 0.8 + 0.2; // Opacidad basada en altura
                    return `rgba(79, 70, 229, ${alpha})`; // Indigo
                },
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { display: false }, 
                x: { grid: { display: false }, ticks: { font: { size: 9 } } } 
            }
        }
    });

    // B. GRÁFICA OS (Dona)
    const sortedOS = Object.entries(osMap).sort((a,b) => b[1] - a[1]);
    const ctxOS = document.getElementById('chart-os').getContext('2d');
    new Chart(ctxOS, {
        type: 'doughnut',
        data: {
            labels: sortedOS.map(x => x[0]),
            datasets: [{
                data: sortedOS.map(x => x[1]),
                backgroundColor: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444'], // Colores variados
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', // Dona más fina
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } }
        }
    });

    // --- TABLAS DE DATOS ---

    // 1. TABLA AGENTES (Sin ti)
    const sortedAgents = Object.entries(agentMap).sort((a,b) => b[1] - a[1]).slice(0, 10); // Top 10
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

    // 2. TABLA PAÍSES
    document.getElementById('table-countries-body').innerHTML = sortedCountries.slice(0, 10).map(([name, count], i) => {
        let flag = "🏳️";
        if(name.includes("Cuba")) flag = "🇨🇺";
        else if(name.includes("United States") || name.includes("USA")) flag = "🇺🇸";
        else if(name.includes("Spain") || name.includes("España")) flag = "🇪🇸";
        else if(name.includes("Mexico")) flag = "🇲🇽";
        
        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="py-2 pl-2 text-gray-600 font-bold text-[11px] flex items-center gap-2">
                <span>${flag}</span> ${name}
            </td>
            <td class="py-2 text-right pr-2">
                <span class="font-black text-slate-800">${count}</span>
            </td>
        </tr>`;
    }).join('');

    // 3. TABLA PRODUCTOS MÁS VISTOS
    if (vistasProd && vistasProd.length > 0) {
        const prodMap = {};
        vistasProd.forEach(v => {
            prodMap[v.nombre_producto] = (prodMap[v.nombre_producto] || 0) + 1;
        });
        const sortedProds = Object.entries(prodMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
        
        document.getElementById('table-products-body').innerHTML = sortedProds.map(([name, count], i) => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
                <td class="py-3 pl-2 align-middle">
                    <!-- CORRECCIÓN: Quitamos 'truncate' y 'max-w' para permitir múltiples líneas -->
                    <span class="text-emerald-600 font-black uppercase text-[10px] leading-snug block">${name}</span>
                </td>
                <td class="py-3 text-right pr-2 align-middle w-16">
                    <div class="flex items-center justify-end gap-1 text-[10px] text-gray-400 font-bold">
                        <span class="material-symbols-outlined text-[14px]">visibility</span> ${count}
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        document.getElementById('table-products-body').innerHTML = `<tr><td class="p-4 text-center text-gray-400">Sin datos de vistas aún</td></tr>`;
    }
}