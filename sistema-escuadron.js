// sistema-escuadron.js - Lógica de Liderazgo, Reclutamiento y Economía

// CONFIGURACIÓN
const SALES_REQ_FREE = 30; // Ventas para desbloqueo gratuito
const COSTO_VIP = 10;      // Costo desbloqueo manual

// 1. INICIALIZACIÓN DEL SISTEMA
// sistema-escuadron.js

const SQUAD_SALES_REQ = 10; 

async function initSquadSystem() {
    const gestor = window.gestorName;
    
    // --- 🔒 CANDADO DE DESARROLLO (SOLO LEVELING MODE) ---
    // Solo tú puedes pasar. El resto ve la pantalla de bloqueo.
    if (gestor !== "Marcel Montano") {
        renderSystemLockScreen();
        return; // Detenemos el código aquí para los mortales
    }

    // --- CÓDIGO NORMAL PARA TI (EL MONARCA) ---
    // (Aquí sigue la lógica normal que tenías)
    const ventas = window.gestorSalesCount || 0;
    
    // Tu lógica de desbloqueo normal...
    renderRecruitmentZone();
    renderRecruitmentLink();
    renderSquadPendingOrders();
    renderSquadRequests();
    renderSquadMonitor();
}

// FUNCIÓN PARA DIBUJAR LA PANTALLA DE BLOQUEO ESTILO SYSTEM
function renderSystemLockScreen() {
    const container = document.getElementById('sub-dash-escuadron');
    // Aseguramos que el contenedor sea visible pero con el contenido bloqueado
    container.classList.remove('hidden');
    
    container.innerHTML = `
    <div class="relative w-full min-h-[400px] flex flex-col items-center justify-center bg-[#020617] rounded-3xl border border-blue-900/50 overflow-hidden p-8 text-center group">
        
        <!-- Fondo Animado (Grid) -->
        <div class="absolute inset-0 opacity-20" 
             style="background-image: linear-gradient(#1e3a8a 1px, transparent 1px), linear-gradient(90deg, #1e3a8a 1px, transparent 1px); background-size: 20px 20px;">
        </div>

        <!-- Círculo Mágico / Escudo -->
        <div class="relative mb-6">
            <div class="absolute inset-0 bg-blue-500 blur-[60px] opacity-20 animate-pulse"></div>
            <span class="material-symbols-outlined text-8xl text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-bounce">
                lock_clock
            </span>
        </div>

        <!-- Caja de Mensaje del Sistema -->
        <div class="relative z-10 bg-blue-950/40 border border-blue-500/50 p-6 rounded-lg backdrop-blur-sm max-w-md mx-auto shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            
            <!-- Encabezado del Sistema -->
            <div class="flex items-center gap-2 mb-3 border-b border-blue-500/30 pb-2">
                <span class="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
                <p class="text-[10px] font-mono text-blue-300 tracking-[0.2em] uppercase">SYSTEM ALERT</p>
            </div>

            <h2 class="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter mb-2 italic">
                MAZMORRA EN CONSTRUCCIÓN
            </h2>
            
            <p class="text-sm text-blue-200 font-medium leading-relaxed mb-4">
                El <span class="text-blue-400 font-bold">Arquitecto</span> está diseñando la zona de Gremios.
                Esta función se desbloqueará en la próxima actualización del Sistema.
            </p>

            <div class="inline-block px-4 py-1 bg-blue-500/20 rounded border border-blue-500/50">
                <p class="text-[10px] text-blue-300 font-mono">STATUS: <span class="animate-pulse font-bold text-white">LOCKED</span></p>
            </div>
        </div>

    </div>`;
}

// 2. NUEVA TARJETA: ENLACE DE RECLUTAMIENTO
function renderRecruitmentLink() {
    // Buscamos dónde inyectarlo. Lo pondremos antes de la lista de reclutas.
    const container = document.getElementById('sub-dash-escuadron');
    // Evitamos duplicados
    if (document.getElementById('card-recruit-link')) return;

    const miNombre = window.gestorName;
    const link = `${window.location.origin}${window.location.pathname}?registro=true&lider=${encodeURIComponent(miNombre)}`;

    const html = `
    <div id="card-recruit-link" class="bg-gradient-to-r from-indigo-900 to-slate-900 p-5 rounded-2xl border border-indigo-500/30 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
        <div class="flex items-center gap-4">
            <div class="bg-indigo-600 p-3 rounded-xl text-white">
                <span class="material-symbols-outlined text-2xl">group_add</span>
            </div>
            <div>
                <h3 class="text-white font-black uppercase text-sm">Tu Enlace de Líder</h3>
                <p class="text-[10px] text-indigo-300">Envía este link. Quien se registre será tu soldado automáticamente.</p>
            </div>
        </div>
        <div class="flex w-full md:w-auto gap-2">
            <input type="text" value="${link}" readonly class="bg-black/30 border border-indigo-500/30 text-indigo-200 text-xs rounded-lg px-3 py-2 w-full md:w-64 font-mono">
            <button onclick="navigator.clipboard.writeText('${link}').then(()=>alert('Link copiado'))" class="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase transition-colors">
                Copiar
            </button>
        </div>
    </div>`;

    // Insertar al principio del contenedor
    container.insertAdjacentHTML('afterbegin', html);
}

// 3. RENDERIZAR MERCADO DE FICHAJES (Intacto)
async function renderRecruitmentZone() {
    const container = document.getElementById('recruitment-list');
    container.innerHTML = `<span class="loader border-cyan-500"></span>`;

    // Limpieza de Bloqueos Expirados
    const ahora = new Date().toISOString();
    await supabaseClient
        .from('leads_reclutamiento')
        .update({ estado: 'disponible', bloqueado_por: null, bloqueado_hasta: null })
        .lt('bloqueado_hasta', ahora)
        .eq('estado', 'bloqueado');

    // Cargar Lista
    const { data: leads, error } = await supabaseClient
        .from('leads_reclutamiento')
        .select('*')
        .neq('estado', 'reclutado')
        .order('id', { ascending: false })
        .limit(50); // Limitamos a 50 para no saturar

    if (error || !leads || leads.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-xs text-slate-500 py-4">No hay agentes libres disponibles.</p>`;
        return;
    }

    const miNombre = window.gestorName;

    container.innerHTML = leads.map(lead => {
        const esMio = lead.bloqueado_por === miNombre;
        const estaBloqueado = lead.estado === 'bloqueado';
        
        let cardClass = "border-slate-700 bg-slate-800/50 hover:border-cyan-500/50";
        let btnAction = "";
        let statusBadge = `<span class="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">DISPONIBLE</span>`;
        let numeroDisplay = lead.telefono.substring(0, 4) + "****"; 

        if (esMio) {
            cardClass = "border-cyan-500 bg-cyan-900/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]";
            numeroDisplay = lead.telefono; 
            const fin = new Date(lead.bloqueado_hasta);
            const restantes = Math.max(0, Math.floor((fin - new Date()) / (1000 * 60 * 60)));
            statusBadge = `<span class="text-[9px] bg-cyan-500 text-black font-black px-2 py-0.5 rounded animate-pulse">TU OBJETIVO (${restantes}h)</span>`;
            btnAction = `<button onclick="contactLead('${lead.telefono}')" class="w-full mt-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5c] text-white text-[10px] font-black uppercase flex items-center justify-center gap-2"><i class="fab fa-whatsapp text-sm"></i> Contactar</button>`;
        } else if (estaBloqueado) {
            cardClass = "border-red-900/30 bg-red-900/10 opacity-60 grayscale";
            statusBadge = `<span class="text-[9px] bg-red-900 text-red-300 px-2 py-0.5 rounded">BLOQUEADO</span>`;
            btnAction = `<button disabled class="w-full mt-3 py-2 rounded-lg bg-slate-800 text-slate-500 text-[10px] font-bold cursor-not-allowed">Cazado por otro</button>`;
        } else {
            btnAction = `<button onclick="lockLead('${lead.id}', '${lead.telefono}')" class="w-full mt-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 group"><span class="material-symbols-outlined text-sm group-hover:animate-ping">lock</span> Cazar (48h)</button>`;
        }

        return `
        <div class="p-4 rounded-2xl border ${cardClass} transition-all relative overflow-hidden">
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                    <div class="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300"><span class="material-symbols-outlined text-sm">person_search</span></div>
                    <div>
                        <p class="text-xs font-black text-white uppercase">${lead.nombre_referencia || 'Agente'}</p>
                        <p class="text-[10px] font-mono text-slate-400 tracking-wider">${numeroDisplay}</p>
                    </div>
                </div>
                ${statusBadge}
            </div>
            ${btnAction}
        </div>`;
    }).join('');
}

// 4. ACCIÓN DE COMPRA (PAYWALL)
async function buyRecruitmentAccess() {
    const miNombre = window.gestorName;
    if (!confirm(`¿Deseas desbloquear la lista de agentes?\n\n💰 Costo: $${COSTO_VIP} USD\n\nEste monto se descontará automáticamente de tu saldo.`)) return;

    const btn = event.currentTarget;
    btn.innerHTML = "Procesando...";
    btn.disabled = true;

    try {
        // A. Registrar Cobro
        const { error } = await supabaseClient.from('caja_gestores').insert([{
            gestor: miNombre, type: 'Adelanto', monto: COSTO_VIP, nota: 'COMPRA: Acceso Zona de Caza'
        }]);
        if (error) throw error;

        // B. Activar Permiso
        const { error: err2 } = await supabaseClient.from('gestores').update({ acceso_vip_caza: true }).eq('nombre', miNombre);
        if (err2) throw err2;

        alert("✅ ¡Compra exitosa! Acceso desbloqueado.");
        location.reload(); 
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.innerHTML = "Reintentar";
    }
}

// 5. ACCIONES DE CAZA
async function lockLead(id, telefono) {
    if(!confirm("¿Bloquear este número por 48h?")) return;
    const miNombre = window.gestorName;
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() + 48);

    const { error } = await supabaseClient
        .from('leads_reclutamiento')
        .update({ estado: 'bloqueado', bloqueado_por: miNombre, bloqueado_hasta: fechaLimite.toISOString() })
        .eq('id', id).eq('estado', 'disponible');

    if (error) alert("¡Alguien más lo tomó primero!");
    else contactLead(telefono);
    renderRecruitmentZone();
}

function contactLead(telefono) {
    const miNombre = window.gestorName;
    const linkRegistro = `${window.location.origin}${window.location.pathname}?registro=true&lider=${encodeURIComponent(miNombre)}`;
    const mensaje = `Hola! Soy ${miNombre}, del equipo de selección de paratuhogar.\nEstamos buscando vendedores comerciales.\n\nRegístrate aquí para ver el catálogo y precios:\n${linkRegistro}`;
    window.open(`https://wa.me/53${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// 6. MONITOR DE PEDIDOS (Intacto con tu lógica matemática)
async function renderSquadPendingOrders() {
    const container = document.getElementById('squad-pending-orders');
    const miNombre = window.gestorName;
    
    const { data: pedidos } = await supabaseClient
        .from('pedidos')
        .select('*')
        .eq('gestor', miNombre)
        .neq('sub_gestor', null)
        .eq('estado_interno', 'revision');

    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic text-center py-4">Todo tranquilo. Tu equipo no ha enviado pedidos nuevos.</p>`;
        return;
    }

    container.innerHTML = pedidos.map(p => `
        <div class="bg-orange-50 border border-orange-200 p-4 rounded-xl relative group hover:shadow-md transition-all mb-3">
            <div class="flex justify-between items-start mb-2">
                <div><span class="text-[9px] font-black uppercase text-orange-600 bg-white px-2 py-0.5 rounded border border-orange-100">POR REVISAR</span>
                <h4 class="text-sm font-black text-slate-800 mt-1">${p.producto}</h4></div>
                <div class="text-right"><p class="text-xs font-bold text-slate-500 uppercase">Sub-Agente</p><p class="text-sm font-black text-indigo-600">${p.sub_gestor}</p></div>
            </div>
            <div class="text-[10px] text-slate-600 space-y-1 mb-3 bg-white/50 p-2 rounded border border-orange-100">
                <p>👤 <b>Cliente:</b> ${p.cliente}</p>
                <p>📍 <b>Dirección:</b> ${p.direccion} (${p.municipio})</p>
                <p>💰 <b>Precio Venta:</b> $${p.total}</p>
                <p class="text-red-500 font-bold">🚚 Envío Cobrado: $${p.costo_mensajeria}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="rejectSubOrder('${p.id}')" class="flex-1 py-2 rounded-lg border border-red-200 text-red-500 font-bold text-[10px] hover:bg-red-50 uppercase">Rechazar</button>
                <button onclick="approveSubOrder('${p.id}')" class="flex-[2] py-2 rounded-lg bg-emerald-500 text-white font-black text-[10px] hover:bg-emerald-600 uppercase shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"><span class="material-symbols-outlined text-sm">check_circle</span> Aprobar y Generar Vale</button>
            </div>
        </div>`).join('');
}

// 7. FUNCIONES DE APROBACIÓN (TU LÓGICA INTACTA)
async function rejectSubOrder(id) {
    if(!confirm("¿Rechazar este pedido?")) return;
    await supabaseClient.from('pedidos').update({ estado: 'Cancelado', estado_interno: 'rechazado' }).eq('id', id);
    alert("Pedido rechazado.");
    renderSquadPendingOrders();
}

async function approveSubOrder(id) {
    const btn = event.currentTarget;
    btn.innerHTML = "⏳ Calculando..."; btn.disabled = true;
    try {
        const { data: pedido } = await supabaseClient.from('pedidos').select('*').eq('id', id).single();
        const prov = pedido.proveedor || 'General';
        
        // --- TU CÁLCULO MATEMÁTICO INTACTO ---
        const { data: ultimos } = await supabaseClient.from('pedidos').select('orden_dia').eq('proveedor', prov).not('orden_dia', 'like', '%TEMP%').order('fecha', { ascending: false }).limit(20);
        let maxNum = 0;
        if(ultimos) maxNum = Math.max(...ultimos.map(p => { const s = p.orden_dia.split('-'); return parseInt(s[s.length-1]) || 0; }), 0);
        const codFinal = `${prov}-${maxNum + 1}`;
        // -------------------------------------

        await supabaseClient.from('pedidos').update({ orden_dia: codFinal, estado_interno: 'aprobado' }).eq('id', id);

        // Mensaje WhatsApp
        const miTel = getAgentPhone(); 
        let msg = `🧾 *NUEVO PEDIDO #${codFinal}*\n📅 ${new Date().toLocaleDateString()}\n\n👤 *CLIENTE*\n${pedido.cliente}\nTel: ${pedido.telefono}\n${pedido.direccion}, ${pedido.municipio}\n\n🛒 ${pedido.producto}\n💰 TOTAL: $${pedido.total}\n\n👮‍♂️ *DATOS INTERNOS*\nAgente: ${window.gestorName}\nComisión: $${pedido.comision_total}\nSub-Agente: ${pedido.sub_gestor}`;
        
        window.open(`https://api.whatsapp.com/send?phone=5356071095&text=${encodeURIComponent(msg)}`, '_blank');
        
        alert(`✅ Pedido Aprobado: ${codFinal}`);
        renderSquadPendingOrders();
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false; btn.innerHTML = "Reintentar";
    }
}

// 8. GESTIÓN DE SOLICITUDES
async function renderSquadRequests() {
    const container = document.getElementById('list-squad-requests');
    const box = document.getElementById('box-squad-requests');
    const miNombre = window.gestorName;

    const { data: reclutas } = await supabaseClient.from('gestores').select('*').eq('jefe_id', miNombre).eq('estado', 'pendiente');

    if (!reclutas || reclutas.length === 0) {
        box.classList.add('hidden'); return;
    }
    box.classList.remove('hidden');
    container.innerHTML = reclutas.map(r => `
        <div class="flex justify-between items-center bg-indigo-900/40 p-3 rounded-xl border border-indigo-500/30">
            <div><p class="text-xs font-black text-white uppercase">${r.nombre}</p><p class="text-[10px] text-indigo-300">${r.telefono}</p></div>
            <div class="flex gap-2"><button onclick="activateRecruit('${r.id}', '${r.nombre}')" class="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Aceptar</button></div>
        </div>`).join('');
}

async function activateRecruit(id, nombre) {
    if(!confirm(`¿Aceptar a ${nombre}?`)) return;
    await supabaseClient.from('gestores').update({ estado: 'activo' }).eq('id', id);
    renderSquadRequests(); renderSquadMonitor();
}

// 9. MONITOR DE RENDIMIENTO (LIMPIO Y CORRECTO)
async function renderSquadMonitor() {
    const container = document.getElementById('squad-monitor-list');
    const miNombre = window.gestorName;

    const { data: soldados } = await supabaseClient.from('gestores').select('*').eq('jefe_id', miNombre).eq('estado', 'activo');
    if (!soldados || soldados.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic text-center p-4">No tienes subgestores activos.</p>`; return;
    }

    const { data: ventas } = await supabaseClient.from('pedidos').select('sub_gestor, created_at, total').eq('gestor', miNombre).eq('estado', 'Entregado');

    container.innerHTML = soldados.map(s => {
        const susVentas = ventas ? ventas.filter(v => v.sub_gestor === s.nombre) : [];
        const total = susVentas.reduce((acc, v) => acc + (v.total || 0), 0);
        let dias = 0;
        if (susVentas.length > 0) {
            susVentas.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            dias = Math.floor((new Date() - new Date(susVentas[0].created_at)) / (1000 * 60 * 60 * 24));
        } else {
            dias = Math.floor((new Date() - new Date(s.created_at)) / (1000 * 60 * 60 * 24));
        }

        let color = dias > 30 ? "text-red-500 animate-pulse" : "text-emerald-500";

        return `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-3 shadow-sm">
            <div class="flex justify-between mb-2">
                <div><p class="text-xs font-black text-slate-700 uppercase">${s.nombre}</p><p class="text-[10px] text-slate-400">Ventas: ${susVentas.length} | $${total}</p></div>
                <div class="text-right"><p class="text-[9px] font-bold text-slate-400">Inactivo</p><p class="text-xs ${color} font-bold">${dias} Días</p></div>
            </div>
            <div class="flex gap-2">
                <button onclick="showDashSection('precios')" class="flex-1 py-1.5 rounded text-[9px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100">⚙️ Configurar Comisiones</button>
                ${dias >= 30 ? `<button onclick="kickSoldier('${s.id}')" class="flex-1 py-1.5 rounded text-[9px] font-bold text-red-500 bg-red-50 border border-red-100">🚫 BAJA</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

async function kickSoldier(id) {
    if(!confirm("¿Dar de baja por inactividad?")) return;
    await supabaseClient.from('gestores').update({ estado: 'bloqueado' }).eq('id', id);
    renderSquadMonitor();
}