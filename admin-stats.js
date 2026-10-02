/* Existing internal traffic records, queried over an explicit rolling window. */
let pthTrafficController = null;
let pthTrafficRefreshTimer = null;
let pthTrafficGeneration = 0;
function trafficVisible(host) {
    return Boolean(host && !host.classList.contains('hidden') && !host.closest('#sec-admin-master')?.classList.contains('hidden') && !document.hidden);
}
function stopTrafficDashboard() {
    pthTrafficGeneration++;
    pthTrafficController?.abort();
    clearTimeout(pthTrafficRefreshTimer); pthTrafficRefreshTimer = null;
    for (const name of ['myChartHours', 'myChartOS']) { window[name]?.destroy(); window[name] = null; }
}
function trafficCard(label, id, note) {
    return `<div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border shadow-sm"><p class="admin-note">${label}</p><h3 id="${id}" class="text-3xl font-black text-primary">—</h3><p class="admin-note">${note}</p></div>`;
}
async function initTrafficDashboard() {
    stopTrafficDashboard();
    const host = document.getElementById('cnt-trafico');
    if (!trafficVisible(host)) return;
    host.innerHTML = `
        <div class="admin-toolbar">
            <label for="traffic-period" class="admin-note">Período</label>
            <select id="traffic-period" class="admin-control"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option><option value="90">Últimos 90 días</option></select>
            <button id="traffic-refresh" type="button" class="admin-control">Actualizar</button>
        </div>
        <p class="admin-note">Fuente: registros internos de enlaces y vistas de productos. Son entradas registradas, no personas únicas ni todas las visitas de Google Analytics. No permiten atribuir cada pedido a una visita.</p>
        <p id="traffic-status" class="admin-note" role="status" aria-live="polite">Consultando…</p>
        <p id="traffic-window" class="admin-note"></p>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            ${trafficCard('Entradas registradas', 'stat-total-clicks', 'En el período elegido')}
            ${trafficCard('Pedidos registrados', 'stat-orders', 'Mismo período; incluye todos los estados')}
            ${trafficCard('Hora de mayor actividad', 'stat-peak-hour', 'Horario de Cuba')}
            ${trafficCard('País más registrado', 'stat-top-country', 'Según el país guardado; sin inferir IP')}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border"><h4 class="font-bold text-primary">Entradas por hora · Cuba</h4><div class="h-64"><canvas id="chart-hours"></canvas></div></div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-3xl border"><h4 class="font-bold text-primary">Sistemas registrados</h4><div class="h-48"><canvas id="chart-os"></canvas></div></div>
        </div>
        <p id="traffic-chart-status" class="admin-note"></p>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            ${['Gestores con más entradas', 'Productos más vistos', 'Países registrados'].map((label,i)=>`<div class="bg-white dark:bg-gray-800 p-5 rounded-3xl border"><h4 class="font-bold text-primary">${label}</h4><div class="overflow-y-auto max-h-60"><table class="w-full"><tbody id="traffic-table-${i}"></tbody></table></div></div>`).join('')}
        </div>`;
    document.getElementById('traffic-refresh').addEventListener('click', refreshTrafficDashboard);
    document.getElementById('traffic-period').addEventListener('change', refreshTrafficDashboard);
    await refreshTrafficDashboard();
}
function trafficTable(id, values) {
    const host = document.getElementById(id); host.replaceChildren();
    for (const [label, count] of values.slice(0,25)) {
        const tr = document.createElement('tr');
        for (const value of [label, count.toLocaleString('es-CU')]) { const td = document.createElement('td'); td.className = 'py-3 admin-note'; td.textContent = value; if (tr.children.length) { td.style.whiteSpace = 'nowrap'; td.style.paddingLeft = '12px'; } tr.append(td); }
        host.append(tr);
    }
    if (!values.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 2; td.className = 'admin-note'; td.textContent = 'Sin registros en este período'; tr.append(td); host.append(tr); }
}
async function refreshTrafficDashboard() {
    const host = document.getElementById('cnt-trafico');
    if (!trafficVisible(host)) return;
    pthTrafficController?.abort(); clearTimeout(pthTrafficRefreshTimer); pthTrafficRefreshTimer = null;
    const generation = ++pthTrafficGeneration, controller = new AbortController(); pthTrafficController = controller;
    const current = () => generation === pthTrafficGeneration && trafficVisible(host);
    const days = Number(document.getElementById('traffic-period').value), data = PTHAdminData;
    const until = new Date().toISOString(), from = new Date(Date.parse(until) - days*data.DAY).toISOString();
    const button = document.getElementById('traffic-refresh'), status = document.getElementById('traffic-status');
    status.textContent = 'Consultando registros…'; button.disabled = true;
    const timeout = setTimeout(()=>controller.abort(),45000);
    try {
        const work = Promise.all([
            data.pages(()=>supabaseClient.from('link_analytics').select('id,agent_name,pais,timestamp,os').gte('timestamp',from).lte('timestamp',until).order('timestamp',{ascending:true}).order('id',{ascending:true}),{signal:controller.signal}),
            data.pages(()=>supabaseClient.from('metricas_vistas').select('id,nombre_producto,fecha').gte('fecha',from).lte('fecha',until).order('fecha',{ascending:true}).order('id',{ascending:true}),{signal:controller.signal}),
            supabaseClient.from('pedidos').select('id',{count:'exact',head:true}).gte('fecha',from).lte('fecha',until)
        ]);
        const canceled = new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('La consulta se interrumpió o tardó demasiado. Vuelve a actualizar.')),{once:true}));
        const [traffic, views, orders] = await Promise.race([work,canceled]);
        if (!current()) return;
        if (orders.error || !Number.isInteger(orders.count) || orders.count<0) throw Error('No se pudieron comprobar los pedidos. Vuelve a actualizar.');
        const stats = data.aggregate(traffic), productCounts = new Map();
        for (const row of views) { const name = String(row.nombre_producto || 'Sin nombre registrado'); productCounts.set(name,(productCounts.get(name)||0)+1); }
        document.getElementById('stat-total-clicks').textContent = stats.total.toLocaleString('es-CU');
        document.getElementById('stat-orders').textContent = orders.count.toLocaleString('es-CU');
        const peak = Math.max(...stats.hours), peaks = stats.hours.flatMap((n,i)=>n===peak?[`${String(i).padStart(2,'0')}:00`]:[]);
        document.getElementById('stat-peak-hour').textContent = !peak?'Sin datos':peaks.length===1?peaks[0]:'Varias horas';
        document.getElementById('stat-top-country').textContent = stats.countries[0]?.[0] || 'Sin datos';
        trafficTable('traffic-table-0',stats.agents); trafficTable('traffic-table-1',[...productCounts].sort((a,b)=>b[1]-a[1])); trafficTable('traffic-table-2',stats.countries);
        const latest = traffic.reduce((max,row)=>data.timestamp(row.timestamp)>data.timestamp(max)?row.timestamp:max,from);
        status.textContent = `Consultado: ${data.date(new Date().toISOString())}. ${traffic.length ? `Última entrada del período: ${data.date(latest)}.` : 'No hay entradas en este período.'} Se vuelve a comprobar cada minuto mientras esta pestaña está visible.`;
        document.getElementById('traffic-window').textContent = `Desde ${data.date(from)} hasta ${data.date(until)} · horario de Cuba. Listas: hasta 25 resultados por cantidad.`;
        for (const name of ['myChartHours','myChartOS']) { window[name]?.destroy(); window[name]=null; }
        const chartNote = document.getElementById('traffic-chart-status'); chartNote.textContent = '';
        try {
            await window.PTHAssets.load('charts');
            if (!current()) return;
            window.myChartHours = new Chart(document.getElementById('chart-hours').getContext('2d'),{type:'bar',data:{labels:Array.from({length:24},(_,i)=>`${i}:00`),datasets:[{label:'Entradas',data:stats.hours,backgroundColor:'#1a4789'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
            window.myChartOS = new Chart(document.getElementById('chart-os').getContext('2d'),{type:'doughnut',data:{labels:stats.systems.map(x=>x[0]),datasets:[{data:stats.systems.map(x=>x[1]),backgroundColor:['#1a4789','#2c6fb5','#16a34a','#ea580c','#7c3aed']}]},options:{responsive:true,maintainAspectRatio:false}});
        } catch (_) { if(current())chartNote.textContent='No se pudieron cargar las gráficas. Las cifras y listas están disponibles; pulsa Actualizar para reintentar.'; }
    } catch (error) {
        if (current()) {
            status.textContent = error.message;
            document.getElementById('traffic-window').textContent = 'Datos sin actualizar. No se muestran resultados incompletos.';
            for (const id of ['stat-total-clicks','stat-orders','stat-peak-hour','stat-top-country']) document.getElementById(id).textContent='—';
            for (let i=0;i<3;i++) document.getElementById('traffic-table-'+i).replaceChildren();
            for (const name of ['myChartHours','myChartOS']) { window[name]?.destroy(); window[name]=null; }
        }
    } finally {
        clearTimeout(timeout);
        if(current()) { button.disabled=false; pthTrafficRefreshTimer=setTimeout(refreshTrafficDashboard,60000); }
    }
}
document.addEventListener('visibilitychange',()=>{const host=document.getElementById('cnt-trafico');if(host&&!host.classList.contains('hidden')){if(document.hidden)stopTrafficDashboard();else refreshTrafficDashboard();}});

window.addEventListener('pth:session-changed',()=>{stopTrafficDashboard();const host=document.getElementById('cnt-trafico');if(host)host.replaceChildren();});
