const systemCards = [
        {
            rank: "EL DESPERTAR",
            icon: "swords", // Icono Material Symbols
            title: "BIENVENIDO, GESTOR",
            text: "El Sistema te ha elegido. Esto no es una tienda normal, es tu <span class='sl-highlight'>Campo de Batalla</span>. <br>Nuestra misión es darte las armas. <br>Tu misión: Generar ventas para subir de nivel.",
            btn: "ACEPTAR MISIÓN"
        },
        {
            rank: "HABILIDAD PASIVA",
            icon: "link",
            title: "VÍNCULO INVISIBLE",
            text: "Tu enlace de afiliado tiene memoria. Cuando un cliente entra con tu link, se le pega una <span class='sl-highlight'>Etiqueta Mágica</span> (Cookie).<br>Si no compra hoy, pero vuelve en 10 días... <span class='sl-highlight'>¡LA COMISIÓN ES TUYA!</span>",
            btn: "ENTENDIDO"
        },
        {
            rank: "REGLAS DEL TIEMPO",
            icon: "hourglass_top",
            title: "DURACIÓN DEL VÍNCULO",
            text: "El poder de tu etiqueta depende de tu Nivel:<br>🔹 <span class='sl-highlight'>Nivel 0:</span> Dura 1 Semana.<br>🔹 <span class='sl-highlight'>Nivel 3:</span> Dura 1 Mes.<br>🟣 <span class='sl-highlight-p'>Nivel 5:</span> ETERNO (Para siempre).<br>¡Sube de rango para atrapar clientes de por vida!",
            btn: "QUIERO ETERNIDAD"
        },
        {
            rank: "INVENTARIO OCULTO",
            icon: "lock_open",
            title: "HERRAMIENTAS SELLADAS",
            text: "Hay funciones poderosas disponibles: <span class='sl-highlight'>Magic Studio</span>, <span class='sl-highlight'>Radar de Riesgos</span> y <span class='sl-highlight'>CRM de Clientes</span>.<br>El Sistema te mostrará cada herramienta según tu flujo de trabajo.",
            btn: "ROMPE EL SELLO"
        },
        {
            rank: "OBJETIVO FINAL",
            icon: "rocket_launch",
            title: "CONVIÉRTETE EN MONARCA",
            text: "El camino está abierto. <br>Cada venta es se acumula. Cada nivel te da más herramientas y mejores habilidades.<br>¿Hasta dónde serás capaz de llegar, Gestor?",
            btn: "COMENZAR CACERÍA"
        }
    ];

    let currentSysSlide = 0;

    // Función de inicialización segura
    function initSystemTutorial() {
        // 1. VERIFICACIÓN DE SEGURIDAD: ¿Es un Gestor?
        // Usamos la variable global window.gestorName que ya existe en tu código
        if (!window.gestorName) {
            // Si no hay gestor logueado, destruimos el tutorial para ahorrar memoria
            // console.log("Sistema: Usuario es Cliente. Tutorial desactivado.");
            return;
        }

        // 2. VERIFICAR SI YA LO VIO
        const tutorialDone = localStorage.getItem('sl_tutorial_completed_v1');
        if (tutorialDone) return;

        // 3. LANZAR SISTEMA
        const overlay = document.getElementById('sl-system-overlay');
        overlay.classList.remove('sl-hidden');

        // Pequeño delay para la animación de entrada
        setTimeout(() => {
            overlay.classList.add('sl-visible');
            renderSystemSlide();
        }, 1000);
    }

    function renderSystemSlide() {
        const card = systemCards[currentSysSlide];

        // Elementos
        document.getElementById('sl-card-rank').innerText = card.rank;
        document.getElementById('sl-card-icon').innerText = card.icon;
        document.getElementById('sl-card-title').innerText = card.title;
        document.getElementById('sl-card-text').innerHTML = card.text;
        document.getElementById('sl-action-btn').innerText = card.btn;
        document.getElementById('sl-step-count').innerText = `${currentSysSlide + 1} / ${systemCards.length}`;

        // Barra XP
        const percent = ((currentSysSlide + 1) / systemCards.length) * 100;
        document.getElementById('sl-xp-fill').style.width = `${percent}%`;

        // Colores según nivel de la tarjeta
        const rankText = document.getElementById('sl-card-rank');
        if (currentSysSlide >= 2) rankText.style.color = "#bc13fe"; // Purple
        else rankText.style.color = "#00f0ff"; // Blue
    }

    function nextSystemSlide() {
        if (currentSysSlide < systemCards.length - 1) {
            // Animación de transición simple (Opacidad)
            const textContainer = document.querySelector('.sl-text-container');
            textContainer.style.opacity = '0';

            setTimeout(() => {
                currentSysSlide++;
                renderSystemSlide();
                textContainer.style.opacity = '1';
            }, 200);
        } else {
            closeSystemTutorial();
        }
    }

    function closeSystemTutorial() {
        const overlay = document.getElementById('sl-system-overlay');
        overlay.classList.remove('sl-visible');
        setTimeout(() => overlay.classList.add('sl-hidden'), 500);

        // MARCAR COMO VISTO
        localStorage.setItem('sl_tutorial_completed_v1', 'true');
    }

    // Ejecutar al cargar la página (se integra con tu window.onload existente)
    window.addEventListener('load', () => {
        // Le damos un momento a tu script principal para que determine si hay sesión
        setTimeout(initSystemTutorial, 2000);
    });

    // --- FUNCIONES DE EDICIÓN PARA GESTOR ---

function openGestorEdit(id) {
    // Buscar el pedido en la memoria local (myOrdersData se carga en loadProDashboard)
    const p = myOrdersData.find(item => item.id === id);
    if (!p) return alert("Error: No se encuentra el pedido.");

    // Llenar formulario
    document.getElementById('g-edit-id').value = id;
    document.getElementById('g-edit-cliente').value = p.cliente || '';
    document.getElementById('g-edit-tel').value = p.telefono || '';
    document.getElementById('g-edit-ci').value = p.ci || '';
    document.getElementById('g-edit-municipio').value = p.municipio || '';

    // Limpiamos la dirección de la nota (si la tiene pegada) para que sea más fácil editar
    let dirLimpia = p.direccion || '';
    // Opcional: Si quieres separar la nota visualmente, podrías hacerlo, pero editar el string completo es más seguro.
    document.getElementById('g-edit-dir').value = dirLimpia;

    // Mostrar
    document.getElementById('modal-gestor-edit').classList.remove('hidden');
}

async function saveGestorEdit() {
    const id = document.getElementById('g-edit-id').value;
    const btn = document.getElementById('btn-save-gestor');

    // Recoger datos
    const updates = {
        cliente: document.getElementById('g-edit-cliente').value,
        telefono: document.getElementById('g-edit-tel').value,
        ci: document.getElementById('g-edit-ci').value,
        municipio: document.getElementById('g-edit-municipio').value,
        direccion: document.getElementById('g-edit-dir').value
    };

    btn.innerHTML = "Guardando...";
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('pedidos')
            .update(updates)
            .eq('id', id)
            .eq('estado', 'Pendiente'); // SEGURIDAD EXTRA: Solo si sigue pendiente

        if (error) throw error;

        alert("✅ Datos corregidos exitosamente.");
        document.getElementById('modal-gestor-edit').classList.add('hidden');

        // Recargar dashboard
        const gestor = window.gestorName;
        if(gestor) loadProDashboard(gestor);

    } catch (e) {
        console.error(e);
        alert("❌ Error: " + e.message);
    } finally {
        btn.innerHTML = "Guardar Corrección";
        btn.disabled = false;
    }
}

// Función para auto-completar el prefijo del almacén
function formatearConsecutivo(input) {
    let valor = input.value.trim().toUpperCase(); // Lo que escribiste (ej: "17")
    const proveedor = document.getElementById('edit-proveedor').value.trim().toUpperCase(); // El proveedor (ej: "B" o "CA")

    // 1. Si está vacío o no hay proveedor, no hacemos nada
    if (!valor || !proveedor) return;

    // 2. Si escribiste SOLO números (ej: "17")
    if (/^\d+$/.test(valor)) {
        // Tomamos la primera palabra del proveedor como código (ej: "CA" de "CA Almacén")
        // O usamos todo el proveedor si es corto (ej: "B")
        const codigo = proveedor.split(' ')[0];

        // Actualizamos el campo automáticamente
        input.value = `${codigo}-${valor}`;
    }
}

// --- FUNCIÓN 1: BORRADO ABSOLUTO ---
async function deleteOrderMaster() {
    const id = document.getElementById('edit-order-id').value;

    if (!id) return;

    // Confirmación de seguridad
    const confirmacion = confirm("⚠️ ¡ADVERTENCIA DE SEGURIDAD! ⚠️\n\nEstás a punto de ELIMINAR este pedido permanentemente de la base de datos.\n\n- Desaparecerá del historial.\n- Desaparecerá de la nómina del gestor.\n- No se puede deshacer.\n\n¿Estás seguro de borrarlo?");

    if (!confirmacion) return;

    try {
        const { error } = await supabaseClient
            .from('pedidos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("🗑️ Pedido eliminado correctamente.");
        document.getElementById('modal-edit-finance').classList.add('hidden');

        // Recargamos la tabla maestra para que desaparezca visualmente
        loadAdminData();

    } catch (e) {
        console.error(e);
        alert("❌ Error al eliminar: " + e.message);
    }
}

// --- FUNCIÓN 2: EDICIÓN SIN RESTRICCIONES ---
async function saveFinancialChanges() {
    const btn = document.getElementById('btn-save-finance');
    const originalText = btn.innerHTML;
    const id = document.getElementById('edit-order-id').value;

    btn.innerHTML = "GUARDANDO...";
    btn.disabled = true;

    try {
        // Recogemos TODOS los datos del formulario (Poder Absoluto)
        const updates = {
            // Identificación
            orden_dia: document.getElementById('edit-orden-dia').value,
            estado: document.getElementById('edit-estado').value, // Aquí cambias el estado a lo que quieras
            proveedor: document.getElementById('edit-proveedor').value,

            // Cliente
            cliente: document.getElementById('edit-cliente').value,
            telefono: document.getElementById('edit-telefono').value,
            ci: document.getElementById('edit-ci').value,
            municipio: document.getElementById('edit-municipio').value,
            direccion: document.getElementById('edit-direccion').value,

            // Producto y Dinero
            producto: document.getElementById('edit-producto').value,
            total: parseFloat(document.getElementById('edit-total').value) || 0,
            costo_mensajeria: parseFloat(document.getElementById('edit-mensajeria').value) || 0,
            comision_total: parseFloat(document.getElementById('edit-comision').value) || 0
        };

        // Enviamos el UPDATE directo a Supabase
        const { error } = await supabaseClient
            .from('pedidos')
            .update(updates)
            .eq('id', id);

        if(error) throw error;

        // Éxito
        alert("✅ Cambios aplicados con éxito.");
        document.getElementById('modal-edit-finance').classList.add('hidden');

        // Refrescamos la vista
        loadAdminData();

    } catch(e) {
        console.error(e);
        alert("❌ Error al guardar: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
// =========================================================
// 1. CARGA Y LIMPIEZA DE GESTORES (ZOMBIES)
// =========================================================
let pendingGestoresCache = [];
let pendingGestorFilter = 'all';
let pendingGestoresLoading = false;
let pendingGestoresGeneration = 0;
let pendingGestoresUpdatedAt = null;
let pendingGestoresRefreshFailed = false;
function setPendingGestorFilter(value) {
    if (!['recent', 'history', 'unknown', 'all'].includes(value)) return;
    pendingGestorFilter = value;
    renderPendingGestores();
}
function openPendingGestorReview() {
    setPendingGestorFilter('all');
    const filter = document.getElementById('admin-pending-filter');
    if (filter) filter.value = 'all';
    changeAdminTab('aprobaciones');
    filter?.focus();
    filter?.scrollIntoView({ block: 'nearest' });
}
function setPendingGestorReviewState(message) {
    const status = document.getElementById('admin-pending-review-state');
    if (status) status.textContent = message;
}
function renderPendingGestores() {
    const host = document.getElementById('list-admin-aprobaciones');
    if (!host) return;
    const now = Date.now(), data = PTHAdminData;
    const review = data.pendingReview(pendingGestoresCache, now);
    const counts = Object.fromEntries(['recent', 'history', 'unknown'].map(filter => [filter, review.rows.filter(row => data.bucket(row, now) === filter).length]));
    const badge = document.getElementById('admin-pending-count');
    if (badge) { badge.hidden = !review.total || pendingGestoresRefreshFailed; badge.textContent = String(review.total); badge.setAttribute('aria-label', `${review.total} solicitudes pendientes en total`); }
    const lastUpdate = pendingGestoresUpdatedAt ? data.date(new Date(pendingGestoresUpdatedAt).toISOString()) : 'Pendiente de actualización';
    const card = document.getElementById('admin-pending-review');
    if (card) {
        card.hidden = !review.total;
        document.getElementById('admin-pending-review-total').textContent = `${review.total} ${review.total === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`;
        document.getElementById('admin-pending-review-age').textContent = `${review.over24h} esperan más de 24 horas · ${review.over48h} más de 48 horas.${review.oldest ? ` La más antigua: ${data.date(review.oldest)}.` : ''}${review.unknown ? ` ${review.unknown} con fecha por revisar.` : ''}`;
        setPendingGestorReviewState(pendingGestoresRefreshFailed ? 'No se pudieron actualizar las solicitudes. Este contador es de la última consulta; vuelve a actualizar.' : `Actualizado: ${lastUpdate}.`);
    }
    const summary = document.getElementById('admin-pending-summary');
    if (summary) summary.textContent = `${counts.recent} recientes · ${counts.history} en el historial · ${counts.unknown} con fecha por revisar. ${pendingGestoresRefreshFailed ? 'La última actualización falló; estos datos pueden estar desactualizados.' : `Actualizado: ${lastUpdate}.`}`;
    host.replaceChildren();
    const rows = review.rows.filter(row => pendingGestorFilter === 'all' || data.bucket(row, now) === pendingGestorFilter);
    if (!rows.length) { host.innerHTML = '<tr><td colspan="4" class="p-6 text-center admin-note">No hay solicitudes en esta vista.</td></tr>'; return; }
    for (const row of rows) {
        const tr = document.createElement('tr');
        tr.className = 'text-xs border-b dark:border-gray-700';
        for (const value of [row.nombre, row.telefono || 'Sin teléfono', data.bucket(row, now) === 'unknown' ? 'Fecha por revisar' : data.date(row.created_at)]) {
            const td = document.createElement('td'); td.className = 'p-4 admin-note'; td.textContent = value; tr.append(td);
        }
        const actions = document.createElement('td'); actions.className = 'p-4 text-right';
        for (const [label, action] of [['Activar', () => approveGestorOnly(row.id, row.nombre)], ['Rechazar', () => approveGestor(row.id, 'bloqueado')]]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'admin-control'; button.textContent = label; button.addEventListener('click', action); actions.append(button);
        }
        tr.append(actions); host.append(tr);
    }
}
async function loadPendingGestores() {
    if (pendingGestoresLoading) return;
    pendingGestoresLoading = true;
    setPendingGestorReviewState('Actualizando solicitudes; el contador anterior puede haber cambiado…');
    const generation = ++pendingGestoresGeneration;
    try {
    const gestoresDB = await PTHAdminData.pages(() => supabaseClient.from('gestores')
        .select('*').in('estado', ['pendiente', 'activo', 'bloqueado', 'ausente_definitivo'])
        .order('nombre', { ascending: true }).order('id', { ascending: true }));
    if (generation !== pendingGestoresGeneration) return;

    const { data: clicsDB } = await supabaseClient
    .from('link_analytics')
    .select('agent_name, timestamp')
    .order('timestamp', { ascending: false })
    .limit(2000); // <-- AGREGAR LÍMITE EVITA EL ERROR 400

    // La política anterior de “zombies” a los 3 días fue retirada. La baja por
    // inactividad ahora se ejecuta mediante la función SQL auditada de 30 días,
    // con fecha base 6 de agosto de 2026 y solo para gestores principales.

    const pendientes = gestoresDB.filter(g => !g.parent_id && g.estado === 'pendiente');
    const activos = gestoresDB.filter(g => !g.parent_id && (g.estado === 'activo' || g.estado === 'ausente_definitivo'));

    if (generation !== pendingGestoresGeneration) return;
    pendingGestoresCache = pendientes;
    pendingGestoresUpdatedAt = Date.now();
    pendingGestoresRefreshFailed = false;
    renderPendingGestores();

    const todosLosPedidos = (typeof pedidosRawAdmin !== 'undefined') ? pedidosRawAdmin : [];

    globalAgentsList = activos.map(g => {
        const nombreGestorNorm = g.nombre.trim().toLowerCase();

        const misVentas = todosLosPedidos.filter(p => {
            const nombrePedido = (p.gestor || "").trim().toLowerCase();
            return nombrePedido === nombreGestorNorm && p.estado === 'Entregado';
        });

        const misClics = clicsDB ? clicsDB.filter(c => (c.agent_name || "").trim().toLowerCase() === nombreGestorNorm) : [];

        let fechaUltimaVenta = null;
        if (misVentas.length > 0) {
            misVentas.sort((a,b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));
            fechaUltimaVenta = new Date(misVentas[0].created_at || misVentas[0].fecha);
        }

        let fechaUltimoAcceso = new Date(g.created_at);
        if (misClics.length > 0) {
            const ultimoClic = new Date(misClics[0].timestamp);
            if (ultimoClic > fechaUltimoAcceso) fechaUltimoAcceso = ultimoClic;
        }
        if (fechaUltimaVenta && fechaUltimaVenta > fechaUltimoAcceso) fechaUltimoAcceso = fechaUltimaVenta;

        const diasInactivo = Math.floor((new Date() - fechaUltimoAcceso) / (1000 * 60 * 60 * 24));

        return {
            id: g.id,
            nombre: g.nombre,
            telefono: g.telefono,
            password: g.password,
            estado_db: g.estado,
            ventas: misVentas.length,
            clics: misClics.length,
            conversion: misClics.length > 0 ? ((misVentas.length / misClics.length) * 100).toFixed(1) : "0.0",
            ultimaVenta: fechaUltimaVenta,
            ultimoAcceso: fechaUltimoAcceso,
            diasInactivo: diasInactivo,
            fechaRegistro: g.created_at
        };
    });

    renderAgentTeamTable();
    } catch (error) {
        if (generation !== pendingGestoresGeneration) return;
        pendingGestoresRefreshFailed = true;
        const summary = document.getElementById('admin-pending-summary');
        if (summary) summary.textContent = 'No se pudieron actualizar las solicitudes. Vuelve a intentar; los datos anteriores pueden estar desactualizados.';
        setPendingGestorReviewState('No se pudieron actualizar las solicitudes. Este contador es de la última consulta; vuelve a actualizar.');
        const badge = document.getElementById('admin-pending-count'); if (badge) badge.hidden = true;
    } finally { if (generation === pendingGestoresGeneration) pendingGestoresLoading = false; }

}

window.addEventListener('pth:session-changed', () => {
    pendingGestoresGeneration++; pendingGestoresLoading = false;
    pendingGestoresCache = []; pendingGestorFilter = 'all';
    pendingGestoresUpdatedAt = null; pendingGestoresRefreshFailed = false;
    document.getElementById('list-admin-aprobaciones')?.replaceChildren();
    const badge = document.getElementById('admin-pending-count'); if (badge) badge.hidden = true;
    const card = document.getElementById('admin-pending-review'); if (card) card.hidden = true;
    for (const id of ['admin-pending-review-total', 'admin-pending-review-age', 'admin-pending-review-state', 'admin-pending-summary']) document.getElementById(id)?.replaceChildren();
    const filter = document.getElementById('admin-pending-filter'); if (filter) filter.value = 'all';
});

// =========================================================
// 2. RENDERIZADO DE TABLA (FILTROS Y ZOMBIES)
// =========================================================
function renderAgentTeamTable() {
    const container = document.getElementById('list-admin-activos');
    if (!container) return;

    const dateDesde = document.getElementById('f-agent-desde')?.value;
    const dateHasta = document.getElementById('f-agent-hasta')?.value;
    const searchText = document.getElementById('search-agent-input')?.value.toLowerCase() || "";

    let listaFiltrada = [...globalAgentsList];

    // 1. FILTRO DE SEGURIDAD: OCULTAR A MARCEL MONTANO
    listaFiltrada = listaFiltrada.filter(g =>
        g.nombre !== 'Marcel Montano' &&
        !g.telefono.includes('58183649')
    );

    // 2. FILTRO POR TEXTO (Nombre o Teléfono)
    if (searchText) {
        listaFiltrada = listaFiltrada.filter(g =>
            g.nombre.toLowerCase().includes(searchText) ||
            g.telefono.includes(searchText)
        );
    }

    // 3. Filtro de Fechas
    if (dateDesde || dateHasta) {
        listaFiltrada = listaFiltrada.filter(g => {
            const fReg = g.fechaRegistro ? new Date(g.fechaRegistro).toISOString().split('T')[0] : null;
            let pasaDesde = true; let pasaHasta = true;
            if (dateDesde && fReg) pasaDesde = fReg >= dateDesde;
            if (dateHasta && fReg) pasaHasta = fReg <= dateHasta;
            return pasaDesde && pasaHasta;
        });
    }

    // 4. Filtro por botones de estado
    if (currentAgentFilter === 'ZOMBIES') {
        listaFiltrada = listaFiltrada.filter(g => g.estado_db === 'ausente_definitivo');
    } else {
        listaFiltrada = listaFiltrada.filter(g => g.estado_db !== 'ausente_definitivo');
        if (currentAgentFilter === 'TOP') listaFiltrada.sort((a,b) => b.ventas - a.ventas);
        else if (currentAgentFilter === 'ONLINE') listaFiltrada = listaFiltrada.filter(g => g.diasInactivo <= 3);
        else if (currentAgentFilter === 'OFFLINE') listaFiltrada = listaFiltrada.filter(g => g.diasInactivo > 3 && g.diasInactivo <= 30);
        else if (currentAgentFilter === 'PELIGRO') listaFiltrada = listaFiltrada.filter(g => g.diasInactivo > 30);
        else listaFiltrada.sort((a,b) => a.nombre.localeCompare(b.nombre));
    }

    if (listaFiltrada.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-400 text-xs font-bold uppercase italic">No se encontraron gestores.</td></tr>`;
        return;
    }

    // 5. RENDERIZADO CON DISEÑO RESPONSIVO
    container.innerHTML = listaFiltrada.map(g => {
        // --- 1. LIMPIEZA DE VARIABLES PARA EVITAR ERRORES EN BOTONES ---
        const safeName = g.nombre.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safePass = (g.password || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");

        let semaforo = "bg-gray-400";
        let estadoTexto = "💤 Inactivo";
        if (g.estado_db === 'ausente_definitivo') {
            semaforo = "bg-slate-700"; estadoTexto = "👻 Sin Respuesta";
        } else {
            if (g.diasInactivo <= 2) { semaforo = "bg-emerald-500 shadow-[0_0_8px_#10b981]"; estadoTexto = "🟢 Online"; }
            else if (g.diasInactivo <= 7) { semaforo = "bg-emerald-400"; estadoTexto = "Hace días"; }
            else if (g.diasInactivo <= 30) { semaforo = "bg-yellow-400"; estadoTexto = "⚠️ Ausente"; }
            else { semaforo = "bg-red-500 animate-pulse"; estadoTexto = "🔴 Peligro"; }
        }

        const txtVenta = g.ultimaVenta ? timeAgo(g.ultimaVenta) : "Nunca";
        const txtAcceso = g.diasInactivo === 0 ? "Hoy" : `Hace ${g.diasInactivo} días`;
        const filaClase = g.estado_db === 'ausente_definitivo' ? 'opacity-50 grayscale' : '';

        return `
        <tr class="text-xs border-b dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-slate-50 transition-all group ${filaClase} flex flex-col md:table-row p-4 md:p-0">

            <!-- NOMBRE Y AVATAR -->
            <td class="md:p-4 align-middle w-full md:w-1/4 mb-2 md:mb-0">
                <div class="flex items-center gap-3">
                    <div class="relative flex-shrink-0">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200 uppercase">${g.nombre.charAt(0)}</div>
                        <div class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${semaforo}"></div>
                    </div>
                    <div class="min-w-0">
                        <p class="font-black text-slate-700 dark:text-white uppercase text-[11px] truncate">${g.nombre}</p>
                        <span class="text-[9px] text-gray-400 font-bold bg-gray-50 px-1.5 rounded border border-gray-100">${estadoTexto}</span>
                    </div>
                </div>
            </td>

            <!-- WHATSAPP -->
            <td class="md:p-4 align-middle mb-2 md:mb-0">
                <a href="https://wa.me/${g.telefono.replace(/\D/g,'')}" target="_blank" class="flex items-center gap-2 text-slate-500 hover:text-[#25D366] transition-colors bg-gray-50 md:bg-transparent p-2 md:p-0 rounded-lg">
                    <span class="material-symbols-outlined text-lg">chat</span>
                    <span class="font-bold text-[10px]">${g.telefono}</span>
                </a>
            </td>

            <!-- ACTIVIDAD (TIEMPOS) -->
            <td class="md:p-4 align-middle mb-2 md:mb-0">
                <div class="flex flex-row md:flex-col gap-2 md:gap-1">
                    <div class="flex-1 flex justify-between items-center text-[9px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        <span class="text-slate-400 font-bold uppercase mr-2">Web:</span><span class="text-slate-700 font-black">${txtAcceso}</span>
                    </div>
                    <div class="flex-1 flex justify-between items-center text-[9px] bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                        <span class="text-emerald-400 font-bold uppercase mr-2">Venta:</span><span class="text-emerald-700 font-black">${txtVenta}</span>
                    </div>
                </div>
            </td>

            <!-- VENTAS TOTALES -->
            <td class="md:p-4 align-middle text-left md:text-center mb-3 md:mb-0 border-b md:border-none pb-2 md:pb-0">
                <div class="flex items-center md:flex-col gap-2 md:gap-0">
                    <span class="text-xl font-black text-slate-800 leading-none">${g.ventas}</span>
                    <span class="text-[8px] font-black text-gray-400 uppercase">Ventas Totales</span>
                </div>
            </td>

            <!-- ACCIONES (AQUÍ SE APLICÓ LA CORRECCIÓN) -->
            <td class="md:p-4 align-middle md:text-right">
                <div class="flex justify-start md:justify-end items-center gap-3">
                    <button onclick="sendCredentialsWA('${g.id}')" class="flex items-center gap-1 bg-amber-100 text-amber-600 px-3 py-2 rounded-xl font-black uppercase text-[9px] md:bg-transparent md:p-2 md:rounded-full md:text-amber-500 hover:bg-amber-50 transition-all border border-amber-200 md:border-transparent">
                        <span class="material-symbols-outlined text-lg">key</span>
                        <span class="md:hidden">Enviar Clave</span>
                    </button>

                    <button onclick="sendWelcomeBackMsg('${g.id}', '${safeName}', '${g.telefono}', '${safePass}')" class="flex items-center gap-1 bg-emerald-100 text-emerald-600 px-3 py-2 rounded-xl font-black uppercase text-[9px] md:bg-transparent md:p-2 md:rounded-full md:text-emerald-500 hover:bg-emerald-50 transition-all border border-emerald-200 md:border-transparent">
                        <span class="material-symbols-outlined text-lg">campaign</span>
                        <span class="md:hidden">Rescatar</span>
                    </button>

                    <button onclick="removeGestor('${g.id}', '${safeName}')" class="p-2 text-gray-300 hover:text-red-500 transition-all ml-auto md:ml-0">
                        <span class="material-symbols-outlined text-lg">block</span>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// =========================================================
// 3. ENVÍO DE MENSAJE Y MARCA DE TIEMPO
// =========================================================
async function sendWelcomeBackMsg(id, nombre, telefono, password) {
    let telLimpio = telefono.replace(/\D/g, '');
    if (telLimpio.length === 8) telLimpio = '53' + telLimpio;

    const baseUrl = window.location.origin + window.location.pathname;
    const longLink = `${baseUrl}?ref=${encodeURIComponent(nombre)}&contact=${telLimpio}`;

    let affiliateLink = longLink;
    try {
        if(typeof getOrGenerateShortLink === 'function') {
            affiliateLink = await getOrGenerateShortLink(nombre, longLink);
        }
    } catch(e) { console.log("Usando link largo por defecto"); }

    await supabaseClient
        .from('gestores')
        .update({ fecha_rescate: new Date().toISOString() })
        .eq('id', id);

    const mensaje = `¡Hola *${nombre}*! 👋 Te escribo del equipo de *ParaTuHogar*.

Vimos que tienes tu cuenta de gestor activa, pero hace un tiempito no nos visitas. Queríamos recordarte que estamos aquí para apoyarte. Si tienes alguna duda sobre cómo vender, cómo hacer los pedidos o sobre los equipos, *¡pregúntanos sin pena ninguna!* Estamos para ayudarte a hacer dinero. 🤝

📌 *TUS DATOS DE ACCESO:*
👤 *Usuario:* ${nombre}
🔑 *Contraseña:* ${password || 'La que elegiste al registrarte'}
🌐 *Entra a la tienda aquí:* ${baseUrl}

Tenemos muchísimos equipos nuevos en almacén a muy buenos precios. Además, recuerda que en tu Panel tienes el *Configurador de Precios*: ahí puedes subirle el precio a los equipos y toda esa diferencia es *ganancia extra 100% para ti*. 💸

🚀 *TU ENLACE DE AFILIADO MÁGICO:*
🔗 ${affiliateLink}

Compártelo en tus grupos y estados. Si alguien entra a ese link y compra (incluso si compra días después), el sistema lo detecta y *la comisión te la pagamos a ti automáticamente* sin que tengas que hacer nada.

¡Anímate a probarlo hoy! Quedo al pendiente por si necesitas ayuda. 😉`;

    alert(`✅ Recordatorio preparado para ${nombre}.\n\nEste mensaje es solo un recordatorio comercial; las cuentas no se dan de baja automáticamente por falta de ventas.`);

    // --- LÓGICA INTELIGENTE PARA ABRIR WHATSAPP DIRECTO ---
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
    window.location.href = `whatsapp://send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`;
} else {
    window.open(`https://web.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`, '_blank');
}

    loadPendingGestores();
}

function sendCredentialsWA(agentId) {
    // 1. Buscar al gestor en la lista global que ya tenemos cargada
    const gestor = globalAgentsList.find(g => g.id === agentId);

    if (!gestor) {
        alert("❌ No se encontró la información del gestor.");
        return;
    }

    // 2. Limpiar el teléfono para WhatsApp
    let telLimpio = gestor.telefono.replace(/\D/g, '');
    if (telLimpio.length === 8) telLimpio = '53' + telLimpio;

    // 3. Preparar el mensaje con sus datos reales
    const mensaje = `Hola *${gestor.nombre}* 👋, aquí tienes tus datos de acceso para la tienda ParaTuHogar:

👤 *Usuario:* ${gestor.nombre}
🔑 *Contraseña:* ${gestor.password}

🌐 *Entra aquí:* https://paratuhogar.org

_Recuerda guardar estos datos en un lugar seguro para que no se te olviden._ 😉`;

    // 4. Abrir WhatsApp (Detectando si es móvil o PC)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const urlBase = isMobile ? "whatsapp://send" : "https://web.whatsapp.com/send";

    window.open(`${urlBase}?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`, '_blank');
}

async function generarComprobanteB2B(datosPedido, accion) {
    if (window.PTHAssets && !await window.PTHAssets.ensure('pdf')) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Generar código
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const numOferta = `#REF-${randomCode}`;

    // Paleta de Colores (Estilo Imagen 2)
    const cBlack = [17, 17, 17];
    const cGold = [184, 142, 84]; // Color bronce/dorado
    const cGray = [100, 116, 139];
    const cLightBox = [245, 245, 245];

    // --- PÁGINA 1: LA PRE-OFERTA ---

    // Título Principal
    doc.setTextColor(...cBlack);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("OFERTA MAYORISTA", 15, 22);

    // Cuadrito Dorado al lado del título
    let textWidth = doc.getTextWidth("OFERTA MAYORISTA");
    doc.setFillColor(...cGold);
    doc.rect(15 + textWidth + 4, 14, 6, 8, 'F');

    // Subtítulo
    doc.setTextColor(...cGray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Distribución B2B", 15, 29);

    // Obtener Gestor Dinámicamente
    const session = JSON.parse(localStorage.getItem('pth_session'));
    const referrer = JSON.parse(localStorage.getItem('pth_referrer_smart'));
    let agentName = "EQUIPO DE VENTAS";
    if (session && session.name) agentName = session.name;
    else if (referrer && referrer.nombre) agentName = referrer.nombre;

    doc.setTextColor(...cGold);
    doc.setFont("helvetica", "bold");
    doc.text(`ATENDIDO POR: ${agentName.toUpperCase()}`, 15, 38);

    // Recuadro superior derecho (ORDEN DE DESPACHO)
    doc.setFillColor(...cGold);
    doc.rect(125, 12, 70, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text("ORDEN DE DESPACHO", 160, 19, { align: "center" });

    // Dirección Almacén
    doc.setTextColor(...cBlack);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Almacén Inbond: Reparto Eléctrico\nLa Habana, Cuba", 195, 28, { align: "right" });

    // Línea Divisoria
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(15, 45, 195, 45);

    // DATOS DEL CLIENTE (Izquierda)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DATOS PARA RESERVA / DESPACHO:", 15, 55);

    doc.setFont("helvetica", "normal");
    doc.text(`CLIENTE: ${datosPedido.cliente.toUpperCase()}`, 15, 62);
    doc.text(`ID REGISTRO: ${datosPedido.ci || '---'}`, 15, 68);
    // AQUÍ SALE EL TELÉFONO FINALMENTE
    doc.text(`CONTACTO: ${datosPedido.telefono || '---'}`, 15, 74);

    // CAJA GRIS DE REFERENCIA (Derecha)
    doc.setFillColor(...cLightBox);
    doc.rect(125, 50, 70, 26, 'F');
    doc.setFontSize(11);
    doc.text("Nº Referencia:", 130, 59);
    doc.text("Fecha Emisión:", 130, 69);

    doc.setFont("helvetica", "bold");
    doc.text(numOferta, 190, 59, { align: "right" });
    const fechaActual = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(fechaActual, 190, 69, { align: "right" });

    // TABLA DE PRODUCTOS
    const filasTabla = datosPedido.items.map(i => [
        i.nombre,
        i.qty.toString(),
        `$ ${i.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        `$ ${(i.price * i.qty).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    ]);

    doc.autoTable({
        startY: 85,
        head: [['DESCRIPCIÓN', 'CANTIDAD', 'PRECIO UNIT.', 'TOTAL']],
        body: filasTabla,
        theme: 'plain',
        headStyles: { fillColor: cBlack, textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { textColor: cBlack, fontSize: 10 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center', cellWidth: 25 },
            2: { halign: 'left', cellWidth: 35 },
            3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' } // Total alineado a la derecha
        },
        willDrawCell: function(data) {
            // Dibuja una línea fina gris debajo de cada fila del cuerpo
            if (data.section === 'body') {
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.1);
                doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            }
        }
    });

    // TOTAL FINAL
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("TOTAL A PAGAR (USD):", 150, finalY, { align: "right" });
    doc.setFontSize(14);
    doc.text(`$ ${datosPedido.totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 195, finalY, { align: "right" });

    // --- PÁGINA 2: ANEXO LEGAL (ARREGLADO POR PÁRRAFOS) ---
    doc.addPage();
    doc.setTextColor(...cBlack);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ANEXO LEGAL: CONDICIONES DE IMPORTACIÓN ACEPTADAS", 15, 20);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 25, 195, 25);

    // Texto legal procesado párrafo por párrafo para evitar los huecos extraños
    const parrafosLegal = [
        `Por medio del presente documento generado de forma electrónica, el ciudadano(a) ${datosPedido.cliente.toUpperCase()}, en representación de la entidad adquirente (Licencia: MIPYME / TCP), certifica haber LEÍDO y ACEPTADO íntegramente los siguientes términos operativos para la adquisición de la mercancía descrita en la Página 1:`,
        `1. NATURALEZA DE LA OPERACIÓN: El cliente comprende que esta operación constituye un proceso de Importación y Nacionalización de mercancías ubicadas en Almacén Inbond (Reparto Eléctrico, La Habana) bajo el régimen y custodia de la Aduana General de la República.`,
        `2. IDENTIDAD JURÍDICA: El Contrato Comercial se establece obligatoriamente a nombre de su licencia de TCP o MIPYME a través de una Importadora Estatal (frecuentemente CUBAELECTRONICA). Si es cliente nuevo, deberá cumplir con el proceso de acreditación.`,
        `3. CONDICIÓN DE ENTREGA: Modalidad DAP (Delivered At Place). La mercancía se entrega exclusivamente en el Almacén Inbond mencionado.`,
        `4. FORMAS DE PAGO: El cliente comprende que la vía preferente es la transferencia bancaria internacional. Sin embargo, se acepta la liquidación en efectivo físico (USD/EUR) de todos los productos en plaza descritos en la factura. El pago en efectivo se realiza en nuestras oficinas a nuestra Asistente Ejecutiva.`,
        `5. PROCEDIMIENTO ADUANAL Y ACOMPAÑAMIENTO: Tras emitirse la Factura Comercial (evidencia de pago), el Ejecutivo Comercial gestiona personalmente la Declaración de Mercancía (DM) y el permiso de extracción de almacén. Este proceso toma habitualmente entre 1 y 2 días hábiles (24h a 48h). Una vez listo, se avisa al cliente para la extracción.`,
        `6. ARANCELES DE LEY: El cliente asume los aranceles aduanales y operativos aplicados por la Importadora estatal, reconociendo que responden a normativas oficiales del MINCEX y no son impuestos arbitrarios ni sobrecargos ocultos.`,
        `CERTIFICACIÓN DIGITAL: La generación y descarga de esta Pre-Oferta equivale a la aceptación de las condiciones preliminares descritas, dando el consentimiento necesario para dar paso a la firma del Contrato Comercial oficial que rige la transacción.`
    ];

    let cursorY = 35;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    parrafosLegal.forEach(parrafo => {
        const lineasDelParrafo = doc.splitTextToSize(parrafo, 180);
        doc.text(lineasDelParrafo, 15, cursorY);
        cursorY += (lineasDelParrafo.length * 4.5) + 3;
    });

    // --- SALIDA DEL PDF ---
    const nombreArchivo = `OFERTA_${datosPedido.cliente.replace(/\s+/g, '_')}.pdf`;

    if (accion === 'compartir' && navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });
        try {
            await navigator.share({ files: [file], title: 'Oferta Comercial' });
        } catch (err) { doc.save(nombreArchivo); }
    } else {
        doc.save(nombreArchivo);
    }
}

// --- FILTRAR VISIBILIDAD DE REGISTRO PARA CLIENTES ---
    function aplicarFiltroRegistro() {
        const params = new URLSearchParams(window.location.search);
        const tieneGestor = params.has('gestor') || params.has('tel');
        const tieneInvitacion = params.has('invitado_por');

        const tabRegistro = document.getElementById('tab-register-btn');
        if (tabRegistro) {
            // Si entró por un link de venta normal de un gestor, OCULTAMOS el registro para evitar curiosos
            if (tieneGestor && !tieneInvitacion) {
                tabRegistro.classList.add('hidden');
                tabRegistro.style.display = 'none';
                console.log("🔒 Pestaña de Registro oculta: Navegando como cliente.");
            } else {
                // Si entra limpio (paratuhogar.org) o por link de subgestor -> visible
                tabRegistro.classList.remove('hidden');
                tabRegistro.style.display = 'block';
            }
        }
    }

    // Ejecutar inmediatamente al cargar
    window.addEventListener('load', aplicarFiltroRegistro);

// === CEREBRO DE ENRUTAMIENTO WHATSAPP (GESTOR VS TIENDA) ===

// 1. Obtiene el teléfono del gestor amarrado o cae de respaldo al dueño de la tienda
async function getDestinoWhatsAppGestor() {
    try {
        // Intentar recuperar el referido guardado en la memoria del navegador
        const stored = localStorage.getItem('pth_referrer_smart') || localStorage.getItem('pth_referrer');
        if (stored) {
            const data = JSON.parse(stored);
            if (data && data.telefono) {
                let tel = data.telefono.replace(/\D/g, '');
                if (tel.length === 8) tel = "53" + tel;
                if (tel.length > 7) return tel;
            }
        }
    } catch (e) {
        console.error("Error leyendo gestor guardado:", e);
    }

    // Si es un cliente orgánico (sin enlace), el WhatsApp va a la tienda central
    return "5356071095";
}

// 2. Procesa el formulario de consulta rápida enviando los datos al WhatsApp del gestor correcto
async function procesarSolicitudFormulario(event) {
    event.preventDefault();

    const nombre = document.getElementById('sol-nombre').value.trim();
    const telCliente = document.getElementById('sol-tel').value.trim();
    const equipo = document.getElementById('sol-equipo').value.trim();

    const targetPhone = await getDestinoWhatsAppGestor();

    const mensaje = `👋 Hola, mi nombre es *${nombre}* (${telCliente}).\n\nEstoy viendo la tienda online y quiero consultar la disponibilidad de: *${equipo}*.`;

    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(mensaje)}`, '_blank');
}

// 3. Abre WhatsApp con el gestor correcto para los botones del banner y testimonios
async function contactarGestorAtribuido(mensajeOpcional) {
    const targetPhone = await getDestinoWhatsAppGestor();
    const txt = mensajeOpcional || "Hola, estoy navegando en la tienda online y me gustaría asesoría para comprar un equipo.";

    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(txt)}`, '_blank');
}
