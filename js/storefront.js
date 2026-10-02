// Resource URLs carry their versions; opening the store never reloads the page.
    // === 2. CÓDIGO DE LIMPIEZA DE EMERGENCIA ===
    (function() {
        const urlParams = new URLSearchParams(window.location.search);
        // Si la URL tiene ?limpiar=true, borramos todo
        if (urlParams.get('limpiar') === 'true') {
            localStorage.removeItem('pth_referrer');
            localStorage.removeItem('pth_referrer_smart');
            localStorage.removeItem('pth_session');
            alert("✅ MEMORIA RESETEADA: Se ha borrado el rastro anterior.");
            // Recargar la página limpia
            window.location.href = window.location.origin + window.location.pathname;
        }
    })();

        // === CÓDIGO DE LIMPIEZA DE EMERGENCIA ===
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    // Si la URL tiene ?limpiar=true, borramos todo
    if (urlParams.get('limpiar') === 'true') {
        localStorage.removeItem('pth_referrer');
        localStorage.removeItem('pth_referrer_smart');
        localStorage.removeItem('pth_session');
        alert("✅ MEMORIA RESETEADA: Se ha borrado el rastro del gestor anterior (Frank). Ahora la web está limpia.");
        // Recargar la página limpia
        window.location.href = window.location.origin + window.location.pathname;
    }
})();
// =========================================


    // 1. CONFIGURACIÓN SUPABASE
    // Cambiamos el nombre de la constante a 'supabaseClient' para evitar errores
    const SUPABASE_URL = 'https://ljqwaovevfatkiigirhf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt'; // Asegúrate que esta sea la 'anon key'
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Alertas del Radar para gestores conectados en cualquier sección de la tienda.
    supabaseClient
        .channel('global-blacklist-alerts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blacklist' }, payload => {
            let activeSession = null;
            try {
                activeSession = JSON.parse(localStorage.getItem('pth_session') || 'null');
            } catch (error) {
                console.warn('No se pudo leer la sesión para la alerta del Radar.', error);
            }
            if (!activeSession) return;

            const reportedBy = payload.new?.reportado_por || 'Otro gestor';
            if (reportedBy === activeSession.name) return;

            const phoneDigits = String(payload.new?.telefono || '').replace(/\D/g, '');
            const phoneLabel = phoneDigits.length === 8 ? `+53 ${phoneDigits}` : `+${phoneDigits}`;
            const alertBox = document.createElement('div');
            alertBox.setAttribute('role', 'alert');
            alertBox.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-[1000] rounded-2xl border border-red-400 bg-red-950 px-5 py-4 text-white shadow-2xl';

            const title = document.createElement('p');
            title.className = 'font-black uppercase tracking-wide text-sm';
            title.textContent = '🚨 Nuevo número problemático';
            const detail = document.createElement('p');
            detail.className = 'mt-1 text-xs font-bold text-red-100';
            detail.textContent = `${reportedBy} reportó ${phoneLabel}. Ya quedó bloqueado para comprar.`;
            alertBox.append(title, detail);
            document.body.appendChild(alertBox);
            setTimeout(() => alertBox.remove(), 9000);
        })
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR') console.warn('Las alertas del Radar en tiempo real no están disponibles.');
        });

async function checkShortLinks() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('s');

    if (slug) {
        // 1. BANDERA DE SEGURIDAD: Avisamos al navegador que estamos saltando
        sessionStorage.setItem('pth_redirecting', 'true');

        const { data, error } = await supabaseClient
            .from('short_links')
            .select('*')
            .eq('slug', slug)
            .single();

        if (data && !error) {
            let telOriginal = "";
            try {
                const urlObj = new URL(data.original_url);
                telOriginal = urlObj.searchParams.get('contact') || urlObj.searchParams.get('tel') || "";
            } catch(e) {}

            if (!telOriginal) {
                const { data: gestorDB } = await supabaseClient
                    .from('gestores')
                    .select('telefono')
                    .eq('nombre', data.gestor)
                    .single();
                if (gestorDB) telOriginal = gestorDB.telefono;
            }

            const referrerData = {
                nombre: data.gestor,
                telefono: telOriginal,
                timestamp: new Date().getTime(),
                expiresAt: new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
            };

            localStorage.setItem('pth_referrer_smart', JSON.stringify(referrerData));
            localStorage.setItem('pth_referrer', JSON.stringify(referrerData));

            // Redirigir
            window.location.href = data.original_url;

            // Detener ejecución para que no se registre nada en esta página intermedia
            return true;
        }
    } else {
        // Si NO hay slug, significa que ya aterrizamos. Quitamos la bandera.
        // Pero lo hacemos con un pequeño delay para que el trackSpy no se dispare antes de tiempo
        setTimeout(() => {
            sessionStorage.removeItem('pth_redirecting');
        }, 2000);
    }
}

// The startup handler resolves short links once before attribution/catalogue.


    const MASTER_KEY = "HOGAR2025";
    const ADMIN_SECRET_KEY = "ANGEL_ORO"; // <--- Esta línea corrige el ReferenceError

    const _0xaf21 = "NTIwMl9OSU1EQV9PUlA=";
    const getAccess = () => atob(_0xaf21).split('').reverse().join('');


    let productosRaw = [], catalogSourceProducts = [], cart = [], selectedProduct = null;
    let catalogLastSyncAt = null;
    let comparisonProductIds = [];
    let detailRelatedProducts = [];
    let cupRate = 450, showInCUP = false, activeCategory = 'TODOS';

    const lowConnectivityStorage = (() => { try { return localStorage; } catch (_) { return null; } })();
    const lowConnectivity = window.PTHLowConnectivity.create(lowConnectivityStorage);
    let newCartOwner = null;
    let newCartOwnerBound = false;
    let newCartRevision = null;
    let publicCatalogueRefresh = null;
    let volatileCheckoutIntent = null;
    let newCheckoutShippingOverride = null;
    let dataSavingEnabled = Boolean(lowConnectivity.saving(navigator.connection));
    window.PTHDataSaving = { enabled: () => dataSavingEnabled };

    function currentNewCartOwner() { return window.PTHSecureData.accountId() || null; }
    function bindNewCartAccount(event) {
        const owner = currentNewCartOwner();
        if (newCartOwnerBound && owner !== newCartOwner) {
            cart = [];
            newCartRevision = null;
            document.getElementById('cart-count').textContent = '0';
            // Logout removes the departing account's local draft. Other accounts
            // are never restored by name or copied into the visitor cart.
            if (!owner && event?.reason !== 'expired') lowConnectivity.clearDraft(newCartOwner);
            document.getElementById('cart-modal')?.classList.add('hidden');
            document.getElementById('checkout-form')?.reset();
        }
        newCartOwner = owner;
        newCartOwnerBound = true;
    }
    window.addEventListener('pth:session-changed', bindNewCartAccount);
    function persistNewCartDraft() {
        bindNewCartAccount();
        if (lowConnectivity.wasSent(newCartOwner,newCartRevision)) {
            cart = []; newCartRevision = null;
            document.getElementById('cart-count').textContent = '0';
        }
        const ok = lowConnectivity.saveDraft(newCartOwner, cart);
        newCartRevision = lowConnectivity.readDraft(newCartOwner)?.intentId || null;
        const note = document.getElementById('pth-cart-draft-note');
        if (note) note.textContent = ok
            ? 'El carrito guarda solo productos y cantidades en este dispositivo. No es un pedido enviado.'
            : 'No se pudo guardar el carrito en este dispositivo. Mantén esta pestaña abierta.';
    }
    function recoverNewCartDraft() {
        bindNewCartAccount();
        const draft = lowConnectivity.readDraft(newCartOwner);
        if (!draft || cart.length) return;
        newCartRevision = draft.intentId;
        const missing = draft.lines.filter(line => !productosRaw.some(p => p.id === line.id));
        if (missing.length) { alert('Algunos productos del borrador no aparecen en este catálogo. Actualiza el catálogo antes de recuperarlo.'); return; }
        cart = draft.lines.map(line => {
            const product = productosRaw.find(p => p.id === line.id);
            return { ...product, qty: line.qty, precio_venta: Number(product.precio), comision_actual: Number(product.comision || 0), comision_original_pool: Number(product.comision_original_pool || product.comision || 0), shipping_linea: 0 };
        });
        document.getElementById('cart-count').textContent = String(cart.reduce((sum,line) => sum + line.qty,0));
        renderLowConnectivityPanel(); toggleCartModal(true);
    }
    window.addEventListener('storage', event => {
        if (event.key?.startsWith('pth_new_cart_sent_v1:') && lowConnectivity.wasSent(newCartOwner,newCartRevision)) {
            cart = []; newCartRevision = null; document.getElementById('cart-count').textContent = '0';
            document.getElementById('cart-modal')?.classList.add('hidden');
            renderLowConnectivityPanel();
        }
    });
    function renderLowConnectivityPanel() {
        const grid = document.getElementById('productos-container');
        if (!grid) return;
        bindNewCartAccount();
        let panel = document.getElementById('pth-low-data-panel');
        if (!panel) { panel = document.createElement('aside'); panel.id = 'pth-low-data-panel'; panel.className = 'pth-low-data-panel'; grid.before(panel); }
        const focusId = panel.contains(document.activeElement) ? document.activeElement.id : '';
        panel.replaceChildren();
        const cards = document.createElement('div'); cards.className = 'pth-connectivity-cards';
        const savingCard = document.createElement('section'); savingCard.className = 'pth-connectivity-card';
        savingCard.setAttribute('aria-labelledby', 'pth-data-saving-heading');
        const heading = document.createElement('div'); heading.className = 'pth-connectivity-heading';
        const title = document.createElement('h3'); title.id = 'pth-data-saving-heading'; title.textContent = 'Ahorro de datos';
        const state = document.createElement('span'); state.className = 'pth-data-saving-state';
        state.dataset.enabled = String(dataSavingEnabled); state.setAttribute('role', 'status');
        state.textContent = dataSavingEnabled ? 'Activado' : 'Desactivado';
        heading.append(title, state);
        const explanation = document.createElement('p'); explanation.id = 'pth-data-saving-description';
        explanation.textContent = dataSavingEnabled
            ? 'Las fotos de los productos solo se cargan al tocarlas. Así consumes menos datos.'
            : 'Las fotos de los productos se cargan automáticamente al recorrer el catálogo.';
        const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'pth-data-saving-toggle';
        toggle.className = 'pth-connectivity-action pth-data-saving-action';
        toggle.setAttribute('aria-label', 'Ahorro de datos'); toggle.setAttribute('aria-pressed', String(dataSavingEnabled));
        toggle.setAttribute('aria-describedby', explanation.id);
        toggle.textContent = dataSavingEnabled ? 'Desactivar ahorro' : 'Activar ahorro';
        toggle.onclick = () => {
            dataSavingEnabled = !dataSavingEnabled; lowConnectivity.setSaving(dataSavingEnabled);
            renderLowConnectivityPanel(); renderProducts();
        };
        savingCard.append(heading, explanation, toggle);
        const savedCard = document.createElement('section'); savedCard.className = 'pth-connectivity-card';
        savedCard.setAttribute('aria-labelledby', 'pth-saved-catalog-heading');
        const savedTitle = document.createElement('h3'); savedTitle.id = 'pth-saved-catalog-heading'; savedTitle.textContent = 'Catálogo guardado';
        const copy = lowConnectivity.readPublic(), copyDate = document.createElement('p');
        copyDate.id = 'pth-saved-catalog-date'; copyDate.className = 'pth-saved-catalog-date';
        if (copy) {
            const date = document.createElement('time'); date.dateTime = new Date(copy.savedAt).toISOString();
            date.textContent = new Date(copy.savedAt).toLocaleString('es-CU', {timeZone:'America/Havana',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
            copyDate.append('Guardado: ', date);
            if (copy.stale) copyDate.append(' · Pendiente de actualizar');
        } else copyDate.textContent = 'Todavía no hay una copia guardada.';
        const copyHelp = document.createElement('p'); copyHelp.id = 'pth-saved-catalog-description';
        copyHelp.textContent = copy
            ? 'Consulta la copia pública de este dispositivo sin conexión.'
            : 'Ábrelo con conexión y pulsa “Actualizar copia pública” para guardarla.';
        const link = document.createElement('a'); link.id = 'pth-saved-catalog-link'; link.className = 'pth-connectivity-action pth-saved-catalog-action';
        link.href = '/offline-catalog.html'; link.textContent = 'Abrir catálogo guardado';
        link.setAttribute('aria-describedby', copyHelp.id + ' ' + copyDate.id + ' pth-saved-catalog-warning');
        const warning = document.createElement('p'); warning.id = 'pth-saved-catalog-warning'; warning.className = 'pth-saved-catalog-warning';
        warning.textContent = 'Los precios y la disponibilidad pueden cambiar. Confírmalos con conexión antes de hacer el pedido.';
        savedCard.append(savedTitle, copyHelp, link, copyDate, warning);
        cards.append(savingCard, savedCard);
        // Keep existing manual receipt/cart actions separate from the copy's date.
        const status = document.createElement('p'); status.setAttribute('role', 'status'); status.className = 'pth-connectivity-status';
        panel.append(cards, status);
        const expiredOwner = window.PTHSecureData.expiredCheckoutOwner?.();
        if (expiredOwner && !currentNewCartOwner()) {
            let pending; try { pending = JSON.parse(checkoutStorage?.getItem('pth_checkout_submission_token:' + expiredOwner + ':outcome') || 'null'); } catch (_) {}
            if (pending?.attempt) {
                const check = document.createElement('button'); check.type = 'button'; check.textContent = 'Comprobar mi envío pendiente';
                check.onclick = async () => { check.disabled = true; try {
                    const result = await window.PTHSecureData.checkout({operation:'receipt',attempt:pending.attempt});
                    if (result.error) status.textContent = getCheckoutFailureMessage(result.error);
                    else status.textContent = result.data.complete ? 'Envío confirmado: ' + result.data.confirmed.map(row=>row.reference).join(', ') : 'Todavía no se confirmó todo el envío. Vuelve a entrar en tu cuenta antes de reintentar.';
                } catch (_) { status.textContent = 'No se pudo comprobar el recibo. Reintenta cuando tengas conexión.'; } finally { check.disabled = false; } };
                panel.appendChild(check);
            }
        }
        if (!cart.length && lowConnectivity.readDraft(newCartOwner)) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Recuperar mi carrito'; button.onclick = recoverNewCartDraft; panel.appendChild(button);
        }
        if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
    }
    function cachePublicCatalogue(rows, anonymousSource, savedAt) {
        if (anonymousSource) { lowConnectivity.savePublic(rows, savedAt); renderLowConnectivityPanel(); return; }
        const existing = lowConnectivity.readPublic();
        if (existing && !existing.stale || publicCatalogueRefresh) return;
        publicCatalogueRefresh = window.PTHPublicCatalog.fetch().then(rows => {
            lowConnectivity.savePublic(rows); renderLowConnectivityPanel();
        }).catch(() => {}).finally(() => { publicCatalogueRefresh = null; });
    }



    const urlParams = new URLSearchParams(window.location.search);
    const gestorName = urlParams.get('ref') || urlParams.get('gestor');
    const gestorTel = urlParams.get('contact') || urlParams.get('tel');
    const isAdmin = urlParams.get('admin') === 'true';

    // ==========================================
    // SENSOR DE ORIGEN DE TRÁFICO (INDETECTABLE)
    // ==========================================
    (function detectarOrigenOrganico() {
        // Usamos sessionStorage para que se borre si cierran el navegador
        if (!sessionStorage.getItem('pth_origen_trafico')) {
            const ref = document.referrer.toLowerCase();
            let origen = 'directo'; // Por defecto asumimos que escribió la URL a mano

            if (ref.includes('facebook') || ref.includes('fb.') || ref.includes('instagram') || ref.includes('ig.')) {
                origen = 'social'; // Viene de redes sociales
            } else if (ref.includes('google') || ref.includes('bing') || ref.includes('yahoo')) {
                origen = 'buscador'; // Viene buscando en Google
            } else if (ref.includes('whatsapp') || ref.includes('wa.me') || ref.includes('android-app://com.whatsapp')) {
                origen = 'whatsapp'; // Viene de un chat de WhatsApp
            }

            sessionStorage.setItem('pth_origen_trafico', origen);
        }
    })();
    // ==========================================

    // --- LÓGICA DE INICIO Y RECUPERACIÓN DE SESIÓN ---
   window.addEventListener('DOMContentLoaded', async () => {

    // === INICIO LÓGICA SPLASH SCREEN ===
    // --- CAPTURAR INVITACIÓN DE SUBGESTOR ---
        const urlParamsInvite = new URLSearchParams(window.location.search);
        const invitadoPor = urlParamsInvite.get('invitado_por');
        if (invitadoPor && invitadoPor.trim() !== "") {
            localStorage.setItem('pth_invitado_por_id', invitadoPor);
            console.log("🔗 Registro de Subgestor iniciado. Invitado por Gestor ID:", invitadoPor);
        }
        if (urlParamsInvite.get('registro') === 'gestor') {
            const loginOverlay = document.getElementById('login-overlay');
            if (loginOverlay) loginOverlay.classList.remove('hidden');
            setTimeout(() => {
                if (typeof toggleLoginMode === 'function') toggleLoginMode('register');
            }, 80);
        }


    // ... aquí sigue tu código original (await checkShortLinks(); etc...)
    // 1. Procesar identificación (Link corto y Referral) primero
    if (await checkShortLinks()) return;
    await initSmartReferral();

    try { await window.PTHSecureData.restore(); }
    catch (error) {
        catalogLoadError = { error, reload: true };
        showCatalogLoadError(error, true);
        renderLowConnectivityPanel();
        return;
    }
    const savedSession = localStorage.getItem('pth_session');
    if (savedSession) {
        // Solo los usuarios internos necesitan gráficas, Excel, editor, ZIP y PDF.
        // La sesión puede continuar aunque una herramienta secundaria no cargue.
        const s = JSON.parse(savedSession);
        window.currentUserData = s.data || {};
        setupSession(s.name, s.isAdmin);
        loadInternalAssets();
    } else {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.classList.add('hidden');
        window.gestorName = null;
        window.isAdmin = false;
        window.currentUserData = null;
        loadProducts();
    }

    initAutoSaveSystem();
    bindNewCartAccount();
    initAgentFloatingButton();

    // --- SENSOR DE INICIO DE SESIÓN CON BLOQUEO DE DUPLICADOS ---
    // Si ya enviamos el rastro en esta pestaña, no lo repetimos
    if (!sessionStorage.getItem('pth_entry_logged')) {
        sessionStorage.setItem('pth_entry_logged', 'true');
        const scheduleTracking = () => trackSpy('INICIO_SESION', 'Cliente entró a la tienda');
        if ('requestIdleCallback' in window) requestIdleCallback(scheduleTracking, { timeout: 4000 });
        else setTimeout(scheduleTracking, 1200);
    }
});

    // --- SISTEMA DE ATRIBUCIÓN (ÚLTIMO CLIC GANA) ---
    let referrerData = null;

    function initReferralSystem() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlGestor = urlParams.get('ref') || urlParams.get('gestor');
        const urlTel = urlParams.get('contact') || urlParams.get('tel');

        // 1. SI HAY NUEVO ENLACE -> SOBRESCRIBIMOS (Last Click Wins)
        if (urlGestor) {
            referrerData = {
                nombre: urlGestor,
                telefono: urlTel || "",
                timestamp: new Date().getTime() // Guardamos cuándo ocurrió
            };
            // Guardamos en memoria persistente del navegador
            localStorage.setItem('pth_referrer', JSON.stringify(referrerData));
            console.log("Nuevo gestor atribuido:", urlGestor);
        }
        // 2. SI NO HAY ENLACE -> BUSCAMOS EN MEMORIA (Histórico)
        else {
            const stored = localStorage.getItem('pth_referrer');
            if (stored) {
                referrerData = JSON.parse(stored);
                console.log("Gestor recuperado de memoria:", referrerData.nombre);
            }
        }
    }
// Función para abrir la ventana de inicio de sesión manualmente
function openLoginModal() {
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) {
        loginOverlay.classList.remove('hidden');
        // Asegurarnos de que inicie en la pestaña de "Entrar" y no "Registrarme"
        if(typeof toggleLoginMode === 'function') toggleLoginMode('login');
    } else {
        console.error("Error: No se encontró el elemento login-overlay en el HTML");
    }
}


    // Ejecutar inmediatamente al cargar el script
    initReferralSystem();



    // Función para Clientes (Botón "Entrar como Cliente")
    function enterAsClient() {
    document.getElementById('login-overlay').classList.add('hidden');
    // Si no se habían cargado los productos, los cargamos
    if (productosRaw.length === 0) loadProducts();
}

    // --- 1. LÓGICA DE ACCESO (LOGIN/REGISTRO) ---

    function toggleLoginMode(mode) {
    // 1. Obtener todos los formularios
    const fLogin = document.getElementById('form-login');
    const fRegister = document.getElementById('form-register');
    const fRecover = document.getElementById('form-recover'); // Este es el nuevo

    // 2. Obtener los botones de las pestañas
    const btnTabLogin = document.getElementById('tab-login-btn');
    const btnTabRegister = document.getElementById('tab-register-btn');

    // 3. OCULTAR TODO POR DEFECTO (Reseteo)
    if(fLogin) fLogin.classList.add('hidden');
    if(fRegister) fRegister.classList.add('hidden');
    if(fRecover) fRecover.classList.add('hidden');

    // 4. RESETEAR ESTILOS DE PESTAÑAS (Ponerlas grises)
    // Usamos border-transparent para que no se vea la línea azul
    const estiloInactivo = "flex-1 pb-2 font-black text-xs uppercase text-gray-400 border-b-2 border-transparent";
    const estiloActivo = "flex-1 pb-2 font-black text-xs uppercase text-primary border-b-2 border-primary";

    if(btnTabLogin) btnTabLogin.className = estiloInactivo;
    if(btnTabRegister) btnTabRegister.className = estiloInactivo;

    // 5. LÓGICA DE ACTIVACIÓN
    if (mode === 'login') {
        if(fLogin) fLogin.classList.remove('hidden');
        if(btnTabLogin) btnTabLogin.className = estiloActivo;
    }
    else if (mode === 'register') {
        if(fRegister) fRegister.classList.remove('hidden');
        if(btnTabRegister) btnTabRegister.className = estiloActivo;
    }
    else if (mode === 'recover') {
        // AQUÍ ESTÁ EL ARREGLO: Mostramos el form de recuperar y dejamos las pestañas apagadas
        if(fRecover) {
            fRecover.classList.remove('hidden');
        } else {
            console.error("Error: No encuentro el div con id='form-recover' en el HTML");
            alert("Error del sistema: Falta el formulario de recuperación.");
        }
    }
}

async function processRecovery() {
    alert("Para proteger tu cuenta, contacta con tu gestor principal o un administrador para verificar y restablecer tu acceso.");
}

    // REGISTRO DE NUEVO GESTOR
    // ==============================================================
// REGISTRO AUTOMÁTICO, ONBOARDING Y AUTO-LOGIN VIP (FRICCIÓN CERO)
// ==============================================================
// ==============================================================
// REGISTRO SEGURO (FILTRO ANTI-CLIENTES CURIOSOS)
// ==============================================================
async function processRegister() {
    const btn = document.querySelector('#form-register button');
    const nombre = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const tel = document.getElementById('reg-tel').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();

    if(!nombre || !pass || !tel) return alert("Nombre, Teléfono y Contraseña son obligatorios.");

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "PROCESANDO REGISTRO...";

    try {
        // 1. VERIFICAR SI YA EXISTE EL TELÉFONO
        const { data: existe } = await supabaseClient.from('gestores').select('id, estado').eq('telefono', tel).maybeSingle();
        if (existe) {
            alert("⚠️ Este número ya está registrado. Ve a la pestaña de ENTRAR.");
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        // Determinar si viene invitado por un Gestor Principal
        const parentId = localStorage.getItem('pth_invitado_por_id') || null;

        // 2. INSERTAR EN LA BASE DE DATOS (MÉTODO PENDIENTE SUBGESTOR)
        const { error } = await supabaseClient
            .from('gestores')
            .insert([{
                nombre: nombre,
                email: email,
                telefono: tel,
                password: pass,
                estado: parentId ? 'pendiente_subgestor' : 'pendiente', // Los subgestores esperan al padre; los directos esperan al admin
                parent_id: parentId
            }]);

        if (error) throw error;

        // 3. MOSTRAR PANTALLA DE SOLICITUD ENVIADA SI ES SUBGESTOR
        if (parentId) {
            const formContainer = document.getElementById('form-register');
            if (formContainer) {
                formContainer.innerHTML = `
                    <div class="space-y-4 text-center py-4 animate-pop-in">
                        <div class="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 border border-amber-200">
                            <span class="material-symbols-outlined text-3xl animate-pulse">hourglass_empty</span>
                        </div>
                        <h3 class="text-lg font-black text-slate-800 dark:text-white uppercase leading-tight">¡Solicitud Enviada!</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Tu registro como subgestor ha sido enviado con éxito.</p>
                        <p class="text-[11px] text-slate-600 dark:text-gray-400 font-medium leading-relaxed">Tu Gestor Principal revisará tu solicitud y se pondrá en contacto contigo a través de WhatsApp para explicarte la metodología y activarte la cuenta.</p>

                        <button onclick="location.reload()" class="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black uppercase text-xs">
                            Volver a la Tienda
                        </button>
                    </div>
                `;
            }
        } else {
            alert(`✅ Solicitud enviada correctamente, ${nombre.split(' ')[0]}.\n\nTu perfil ha sido enviado a revisión. El administrador central de la tienda te activará la cuenta en las próximas 24 horas.`);
            toggleLoginMode('login');
        }

    } catch (e) {
        alert("Error al registrar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}



    // INICIO DE SESIÓN


    // Función auxiliar para guardar en el navegador
    function saveSessionToMemory(name, isAdmin, data) {
        const session = {
            name: name,
            isAdmin: isAdmin,
            data: data
        };
        localStorage.setItem('pth_session', JSON.stringify(session));
        window.PTHAnalytics?.excludeInternal();
    }

    function closeLogin() { document.getElementById('login-overlay').classList.add('hidden'); }
    function enterAsClient() { closeLogin(); loadProducts(); }

    async function setupSession(name, adminMode) {
    const setupVersion = window.PTHWorkView.beginSetup();
    let welcomeNotice = Promise.resolve();
    adminMode = window.PTHWorkView.isAdminView(window.currentUserData);
    let requestedAdminTab = null;
    try { requestedAdminTab = await window.PTHPushLinks?.resolve(); } catch (_) { /* Login/service errors keep the existing verified view. */ }
    if (requestedAdminTab) adminMode = true;
    window.gestorName = name;
    window.isAdmin = adminMode;
    if (!adminMode && typeof stopTrafficDashboard === 'function') stopTrafficDashboard();
    // Remove the previous view before rendering the new one. The role/token stay intact.
    document.getElementById('sec-admin-master')?.classList.toggle('hidden', !adminMode);
    document.getElementById('sec-dashboard')?.classList.add('hidden');
    document.getElementById('gestor-command-center')?.classList.toggle('hidden', adminMode);
    window.PTHWorkView.syncButtons(window.currentUserData, adminMode);

    // Forzar limpieza del buscador para eliminar el autocompletado del navegador
    const searchBar = document.getElementById('search-bar');
    if (searchBar) searchBar.value = '';

    const label = document.getElementById('gestor-label');
    if(label) label.innerText = adminMode ? `ADMINISTRADOR` : `AGENTE: ${name.toUpperCase()}`;

    const adminNav = document.getElementById('admin-nav');
    if(adminNav) adminNav.classList.remove('hidden');

    if (adminMode) {
        // MODO ADMINISTRADOR (Logística)
        document.getElementById('sec-admin-master').classList.remove('hidden');
        document.getElementById('sec-catalogo').style.display = 'none';
        if(adminNav) adminNav.classList.add('hidden');
        loadAdminData();
        if (requestedAdminTab) changeAdminTab(requestedAdminTab);
        else if (!document.getElementById('cnt-trafico')?.classList.contains('hidden') && typeof initTrafficDashboard === 'function') initTrafficDashboard();
    } else {
        // MODO GESTOR o SUBGESTOR (Ventas)
        const commandCenter = document.getElementById('gestor-command-center');
        if (commandCenter) commandCenter.classList.remove('hidden');

        const publicFilters = document.getElementById('public-filters-bar');
        if (publicFilters) publicFilters.classList.add('hidden');
        document.querySelectorAll('.client-only-section').forEach(section => section.classList.add('hidden'));

        if (typeof applyLockedFeatures === "function") applyLockedFeatures();
        if (typeof renderFlashButton === "function") renderFlashButton();
        if (typeof checkGamificationStatus === "function") {
            checkGamificationStatus();
            welcomeNotice = showAgentWelcomeModal(name);
        }

        // --- VERIFICACIÓN DE SUBGESTOR EN TIEMPO REAL (EL FIX) ---
        try {
            let hierarchyQuery = supabaseClient
                .from('gestores')
                .select('id, parent_id');
            hierarchyQuery = window.currentUserData?.id ? hierarchyQuery.eq('id', window.currentUserData.id) : hierarchyQuery.eq('nombre', name);
            const { data: dbGestor } = await hierarchyQuery.single();

            if (!window.PTHWorkView.isCurrentSetup(setupVersion)) return;
            if (dbGestor) {
                window.currentUserData = window.currentUserData || {};
                window.currentUserData.id = dbGestor.id;
                window.currentUserData.parent_id = dbGestor.parent_id;

                if (dbGestor.parent_id) {
                    // Es subgestor -> Descargar datos de contacto de su Gestor Principal
                    const { data: parentData } = await supabaseClient
                        .from('gestores')
                        .select('nombre, telefono')
                        .eq('id', dbGestor.parent_id)
                        .maybeSingle();

                    if (!window.PTHWorkView.isCurrentSetup(setupVersion)) return;
                    if (parentData) {
                        window.currentUserData.parent_nombre = parentData.nombre;
                        window.currentUserData.parent_telefono = parentData.telefono;
                    }
                }
            }
        } catch (err) {
            console.error("Error sincronizando rol de subgestor:", err);
        }
        if (!window.PTHWorkView.isCurrentSetup(setupVersion)) return;

        // --- ENMASCARAR BOTÓN RED DE SUBGESTORES AL SUBGESTOR ---
        const isSubgestor = window.currentUserData && window.currentUserData.parent_id;
        const btnSub = document.getElementById('btn-open-subgestores');
        const btnPrices = document.getElementById('btn-dash-precios');
        const btnAutoAssign = document.getElementById('btn-auto-assign-subcommissions');
        if (btnPrices) {
            btnPrices.textContent = isSubgestor ? '🏷️ Precios asignados' : '🏷️ Mis Precios (Config)';
        }
        if (btnAutoAssign) {
            btnAutoAssign.classList.toggle('hidden', Boolean(isSubgestor));
        }
        if (btnSub) {
            if (isSubgestor) {
                btnSub.classList.add('hidden');
                btnSub.style.display = 'none';
                console.log("🔒 Botón 'Red de Subgestores' ocultado para el subgestor:", name);
            } else {
                btnSub.classList.remove('hidden');
                btnSub.style.display = 'inline-flex';
            }
        }
        // Cargar la información una sola vez, ya con el rol correcto resuelto.
        // El gestor entra directamente a su centro de trabajo.
        await Promise.all([
            loadProducts(),
            loadProDashboard(name)
        ]);
        if (!window.PTHWorkView.isCurrentSetup(setupVersion)) return;
        loadMyPayoutRequests();
        if(typeof loadAnalyticsPro === "function") loadAnalyticsPro(name);
        showSection(window.PTHWorkView.canSwitch(window.currentUserData) ? 'catalogo' : 'dashboard');
        Promise.resolve(welcomeNotice).then(() => {
            if (window.PTHWorkView.isCurrentSetup(setupVersion)) void window.PTHFeedbackAnnouncement?.show();
        }).catch(() => {});
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.classList.remove('hidden');
        btnLogout.style.display = 'inline-flex';
    }

    // CRM loads when checkout opens.

    const waBtn = document.getElementById('floating-agent-contact');
    if (waBtn) waBtn.classList.add('hidden');

    // ============================================================
    // 🛡️ LÓGICA DE BOTÓN MAESTRO (FINANCIERO) (RESTAURADA)
    // ============================================================
    const userData = window.currentUserData || {};
    const VAULT_ADMIN_IDS = new Set([
        'a5cd1515-47dc-4379-a392-cb09459b3686', // Jomil
        '19db1f25-8615-418c-b092-1548e8f92abd'  // Beatriz Barrero
    ]);
    const esSuperAdmin = userData.rol === 'superadmin'
        || name === 'Administrador'
        || name === 'Marcel Montano'
        || (userData.rol === 'admin' && VAULT_ADMIN_IDS.has(String(userData.id || '')));

    if (esSuperAdmin) {
        // Localizamos el contenedor de los botones del header al lado del botón de salida
        const headerContainer = btnLogout ? btnLogout.parentElement : document.querySelector('header div.flex.items-center');

        if (headerContainer && !document.getElementById('btn-master-vault')) {
            const btnMaster = document.createElement('button');
            btnMaster.id = 'btn-master-vault';
            btnMaster.innerHTML = `<span class="material-symbols-outlined text-amber-900 font-bold">shield</span>`;

            // Estilos: Dorado, con sombra, pulso suave para destacar
            btnMaster.className = "flex items-center justify-center rounded-lg h-10 w-10 bg-amber-400 hover:bg-amber-300 text-amber-900 transition-all shadow-lg shadow-amber-500/50 border-2 border-amber-200 animate-pulse ml-2";
            btnMaster.title = "ACCESO A BÓVEDA FINANCIERA";
            btnMaster.onclick = () => window.location.href = 'master.html';

            headerContainer.insertBefore(btnMaster, btnLogout);
        }
    }

    // Herramientas experimentales: acceso exclusivo del propietario/programador.
    ['btn-radar-secret', 'btn-war-room'].forEach(id => document.getElementById(id)?.remove());
    if (name === "Marcel Montano") {
        const headerActions = document.querySelector('header .flex.items-center.gap-2.md\\:gap-4');

        if (headerActions && !document.getElementById('btn-radar-secret')) {
            const btnRadar = document.createElement('button');
            btnRadar.id = 'btn-radar-secret';
            btnRadar.title = "SISTEMA RADAR";
            btnRadar.onclick = () => window.location.href = 'marcel-radar.html';
            btnRadar.className = "flex items-center justify-center rounded-lg h-10 w-10 bg-purple-600/20 text-purple-400 border border-purple-500/40 hover:bg-purple-600 hover:text-white transition-all animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]";
            btnRadar.innerHTML = '<span class="material-symbols-outlined">radar</span>';
            headerActions.prepend(btnRadar);
        }

        if (headerActions && !document.getElementById('btn-war-room')) {
            const btnWar = document.createElement('button');
            btnWar.id = 'btn-war-room';
            btnWar.onclick = () => window.open('shadow-marketer.html', '_blank');
            btnWar.className = "flex items-center justify-center rounded-lg h-10 w-10 bg-purple-600 text-white hover:bg-purple-500 transition-all shadow-[0_0_15px_rgba(147,51,234,0.6)] animate-pulse border border-purple-400 ml-2";
            btnWar.innerHTML = '<span class="material-symbols-outlined">smart_toy</span>';
            btnWar.title = "SALA DE GUERRA AI";
            headerActions.prepend(btnWar);
        }
    }

    setTimeout(() => {
        if (!adminMode && window.PTHWorkView.isCurrentSetup(setupVersion)) {
            showRadarIntro();
        }
    }, 2000);
}


    // --- 2. LÓGICA DASHBOARD PRO (Ranking + Enlaces) ---

    // Variable global para guardar los pedidos del gestor y poder filtrar
let myOrdersData = [];

async function loadProDashboard(nombreGestor) {
    // --- DETECTAR ROL EN TIEMPO REAL ---
    const esSubgestor = window.currentUserData && window.currentUserData.parent_id;

    let misVentas = [];

    if (esSubgestor) {
        // 1. Obtener pedidos aprobados (de la tabla 'pedidos')
        const { data: aprobados, error: errAprobados } = await supabaseClient
            .from('pedidos')
            .select('*')
            .eq('subgestor_nombre', nombreGestor)
            .order('fecha', { ascending: false });

        // 2. Obtener pedidos pendientes de aprobación (de 'pedidos_subgestores')
        const { data: pendientes, error: errPendientes } = await supabaseClient
            .from('pedidos_subgestores')
            .select('*')
            .eq('subgestor_nombre', nombreGestor)
            .order('created_at', { ascending: false });

        // Adaptar campos de aprobados y pendientes para unificar la visualización
        const listaAprobados = (aprobados || []).map(p => ({
            ...p,
            comision_total: p.comision_subgestor, // Mapeamos su comisión real
            pago_gestor: p.pago_subgestor // Mapeamos el estado de su pago
        }));

        const listaPendientes = (pendientes || []).map(p => ({
            ...p,
            fecha: p.created_at,
            estado: 'Pendiente',
            comision_total: p.comision_subgestor,
            pago_gestor: 'Pendiente',
            origen: 'Manual (Panel)'
        }));

        // Combinar ambas listas para su historial unificado
        misVentas = [...listaPendientes, ...listaAprobados];
    } else {
        // Comportamiento original para Gestores Principales
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select('*')
            .eq('gestor', nombreGestor)
            .order('fecha', { ascending: false });

        if(error) { console.error(error); return; }
        misVentas = data || [];
    }

    myOrdersData = misVentas;

    // 2. Cálculos Financieros
    const misEntregados = misVentas.filter(p => p.estado === 'Entregado');
    const misPendientes = misVentas.filter(p => p.estado !== 'Entregado' && p.estado !== 'Cancelado');

    const porCobrar = misEntregados
        .filter(p => p.pago_gestor === 'Pendiente' || !p.pago_gestor)
        .reduce((acc, curr) => acc + getOrderCommission(curr), 0);

    const cobrado = misEntregados
        .filter(p => p.pago_gestor === 'Pagado')
        .reduce((acc, curr) => acc + getOrderCommission(curr), 0);

    // Actualizar HTML Financiero
    if(document.getElementById('dash-money-pending')) document.getElementById('dash-money-pending').innerText = `$${porCobrar.toFixed(2)}`;
    if(document.getElementById('dash-money-paid')) document.getElementById('dash-money-paid').innerText = `$${cobrado.toFixed(2)}`;
    if(document.getElementById('dash-ok')) document.getElementById('dash-ok').innerText = misEntregados.length;
    if(document.getElementById('dash-pending')) document.getElementById('dash-pending').innerText = misPendientes.length;

    renderGestorHome({
        ventas: misVentas,
        entregados: misEntregados,
        pendientes: misPendientes,
        porCobrar,
        cobrado
    });
    await loadGestorWarrantyCases();

    // 3. RENDERIZAR TABLA DE MIS PEDIDOS
    renderMyOrdersList(misVentas);

    // 4. GRÁFICA DE FUENTES
    renderSourceChart(misVentas);

    // 5. ENLACES (Link corto)
    await injectLinksSection(nombreGestor);

    // 6. RENDERIZAR RANKING (Se eliminó 'created_at' para evitar el error de consulta)
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);

    const { data: allPedidos, error: errAll } = await supabaseClient
        .from('pedidos')
        .select('gestor, comision_total, producto, fecha, estado')
        .eq('estado', 'Entregado')
        .gte('fecha', hace30dias.toISOString());

    const rankingPedidos = allPedidos || [];
    renderLockedRanking(rankingPedidos, nombreGestor);
}

// Función auxiliar para el Ranking (para mantener el código limpio)
// --- FUNCIÓN ACTUALIZADA CON LAS 4 IDEAS ---
// Función auxiliar para tiempo relativo (Ej: "Hace 5m")
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Hace un momento";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return "Ayer";
}

// Función principal de Ranking PRO
// Función principal de Ranking PRO (TEXTOS GRANDES Y LEGIBLES)
// 1. FUNCIÓN AUXILIAR PARA EL TIEMPO (Pégala fuera de renderRankingAnonimo, al final de tu script)
function timeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Hace un momento";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return "Ayer";
}

// 2. FUNCIÓN PRINCIPAL CORREGIDA
// --- FUNCIÓN PRINCIPAL DE RANKING (SYSTEM STYLE) ---
// --- FUNCIÓN PRINCIPAL DE RANKING (SYSTEM STYLE - HIGH CONTRAST) ---
// --- RENDERIZADOR DEL RANKING (ESPAÑOL Y ADICTIVO) ---
// --- RENDERIZADOR DEL RANKING (FULL SYSTEM: TICKER + PODIO + BARRA + LISTA) ---
// --- RENDERIZADOR DEL RANKING (MODO VENTAS + MISTERIO) ---
async function renderRankingAnonimo(allPedidos, nombreGestor) {
    const container = document.getElementById('ranking-list');
    if (!container) return;

    const rankingMap = {};
    const salesFeed = [];

    // === EL FIX: VENTANA DE 30 DÍAS (TEMPORADA ACTUAL) ===
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);

    allPedidos.forEach(p => {
        const fechaPedido = new Date(p.fecha || p.created_at);

        // SOLO SE CUENTAN VENTAS ENTREGADAS DE LOS ÚLTIMOS 30 DÍAS
        if (p.estado === 'Entregado' && p.gestor !== 'Venta Directa' && fechaPedido >= hace30dias) {
            const monto = Number(p.comision_total) || 0;

            if (!rankingMap[p.gestor]) {
                rankingMap[p.gestor] = { money: 0, sales: 0 };
            }

            rankingMap[p.gestor].money += monto;
            rankingMap[p.gestor].sales += 1;

            salesFeed.push(p);
        }
    });

    salesFeed.sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));

    const rankingArray = Object.entries(rankingMap)
        .map(([name, data]) => ({ name, total: data.money, count: data.sales }))
        .sort((a, b) => b.total - a.total);

    const myRankIndex = rankingArray.findIndex(r => r.name === nombreGestor);
    const myData = rankingArray[myRankIndex] || { total: 0, count: 0 };
    const topData = rankingArray[0] || { total: 1, count: 1 };
    const maxScore = topData.total || 1;
    const gestoresActivos = rankingArray.length;

    let html = '';

    const lastSale = salesFeed[0];
    let tickerContent = `SISTEMA: Escaneando transacciones...`;

    if (lastSale) {
        const tiempo = timeAgo(lastSale.created_at || lastSale.fecha);
        tickerContent = `
            <span class="text-emerald-400 font-bold">📢 [NUEVO]</span>
            <span class="text-white font-black">${lastSale.gestor.substring(0,10).toUpperCase()}</span>
            VENDIÓ: <span class="text-cyan-300 font-bold">${lastSale.producto.substring(0,30)}...</span>
            <span class="text-slate-500 text-[10px] ml-2 font-mono">(${tiempo})</span>
        `;
    }



    html += `<div class="flex flex-col md:flex-row items-end justify-center gap-6 mb-10 px-2 relative z-10 font-system">`;
    const [p1, p2, p3] = [rankingArray[0], rankingArray[1], rankingArray[2]];

    if (p2) html += renderSystemCard(p2, 2, nombreGestor, maxScore);
    if (p1) html += renderSystemCard(p1, 1, nombreGestor, maxScore);
    if (p3) html += renderSystemCard(p3, 3, nombreGestor, maxScore);
    html += `</div>`;

    if (myRankIndex > 0 && myData.count > 0) {
        const percentage = Math.min(100, (myData.count / topData.count) * 100);
        const ventasRestantes = topData.count - myData.count;

        let fraseMotivacional = "";
        if(ventasRestantes <= 2) fraseMotivacional = "¡ESTÁS A PUNTO DE SUPERARLO!";
        else fraseMotivacional = `Elimina ${ventasRestantes} objetivos más para igualar al Monarca.`;

        html += `
        <div class="mb-12 relative group font-system mx-2">
            <div class="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

            <div class="relative bg-[#020617] border border-slate-700 p-6 rounded-lg shadow-2xl">
                <div class="flex justify-between items-end mb-3">
                    <div>
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">COMPARACIÓN DE PODER (VENTAS)</p>
                        <h4 class="text-xl font-black text-white uppercase italic tracking-wide">
                            DISTANCIA AL <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">MONARCA</span>
                        </h4>
                    </div>
                    <span class="text-4xl font-black text-white font-mono">${percentage.toFixed(0)}%</span>
                </div>

                <div class="h-5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div class="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 relative transition-all duration-1000 shadow-[0_0_20px_rgba(139,92,246,0.6)]" style="width: ${percentage}%">
                        <div class="absolute right-0 top-0 h-full w-1 bg-white/80 shadow-[0_0_10px_white]"></div>
                    </div>
                </div>

                <div class="mt-4 flex justify-between items-center">
                    <div class="flex flex-col">
                        <span class="text-[9px] font-bold text-slate-500 uppercase">TU NIVEL ACTUAL</span>
                        <span class="text-white font-mono font-bold text-lg">${myData.count} <span class="text-xs text-slate-500">VENTAS</span></span>
                    </div>
                    <p class="text-purple-400 text-xs font-bold italic animate-pulse text-center hidden md:block">"${fraseMotivacional}"</p>
                    <div class="flex flex-col items-end">
                        <span class="text-[9px] font-bold text-slate-500 uppercase">PODER DEL TOP 1</span>
                        <span class="text-purple-400 font-mono font-black text-lg tracking-widest">${topData.count} <span class="text-xs text-slate-600">VENTAS</span></span>
                    </div>
                </div>
                <p class="text-purple-400 text-xs font-bold italic mt-3 text-center md:hidden">"${fraseMotivacional}"</p>
            </div>
        </div>`;
    }

    html += `<div class="bg-[#0f172a] rounded-xl border border-slate-700 overflow-hidden shadow-2xl font-system">
                <div class="bg-[#020617] p-4 border-b border-slate-700 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-slate-400">toc</span>
                        <h4 class="text-sm font-black text-slate-300 uppercase tracking-[0.2em]">Clasificación Global</h4>
                    </div>
                    <span class="text-[9px] font-bold text-emerald-500 uppercase border border-emerald-900 bg-emerald-900/20 px-2 py-1 rounded">TEMPORADA 30 DÍAS</span>
                </div>
                <div class="divide-y divide-slate-800">`;

    if (rankingArray.length === 0) {
        html += `<div class="p-6 text-center text-slate-500 font-bold uppercase text-xs">Aún no hay ventas en los últimos 30 días. ¡Sé el primero!</div>`;
    }

    rankingArray.forEach((user, index) => {
        const rank = index + 1;
        if (rank > 3) {
            const isMe = user.name === nombreGestor;
            const displayMoney = isMe ? `$${user.total.toFixed(0)}` : '???';
            const displayName = isMe ? `${user.name.toUpperCase()}` : user.name.substring(0, 3).toUpperCase() + '***';

            const bgClass = isMe ? "bg-cyan-950/40" : "bg-[#0f172a] hover:bg-[#1e293b]";
            const textClass = isMe ? "text-cyan-300 text-shadow-glow" : "text-slate-300";
            const borderClass = isMe ? "border-l-4 border-cyan-400" : "border-l-4 border-transparent";

            html += `
            <div class="flex items-center justify-between p-4 ${bgClass} ${borderClass} transition-colors group">
                <div class="flex items-center gap-6">
                    <span class="text-lg font-mono font-bold text-slate-600 w-8 group-hover:text-slate-400 transition-colors">#${rank < 10 ? '0'+rank : rank}</span>
                    <div class="flex flex-col">
                        <span class="text-sm md:text-base font-black ${textClass} tracking-wide uppercase">
                            ${displayName}
                            ${isMe ? '<span class="ml-2 text-[9px] bg-cyan-600 text-white px-1.5 py-0.5 rounded align-middle tracking-widest">YOU</span>' : ''}
                        </span>
                        <span class="text-[9px] text-slate-500 font-bold uppercase mt-0.5">${user.count} VENTAS</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="hidden md:block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">Ganancia Acumulada</span>
                    <span class="text-sm md:text-base font-mono font-black text-amber-500 bg-black/30 px-2 py-1 rounded border border-white/5">
                        ${displayMoney}
                    </span>
                </div>
            </div>`;
        }
    });
    html += `</div></div>`;

    container.innerHTML = html;
}

// --- TARJETA DE RANGO (VISUALMENTE ADICTIVA) ---
function renderSystemCard(user, rank, meName, maxScore) {
    const isMe = user.name === meName;
    const nameDisplay = isMe ? 'TÚ' : user.name.split(' ')[0].toUpperCase();
    const moneyDisplay = isMe ? `$${user.total.toFixed(0)}` : 'BLOQUEADO';

    // Porcentaje para la barra de poder
    const powerPercent = (user.total / maxScore) * 100;

    let c = {};
    if (rank === 1) {
        c = {
            wrapper: "order-1 md:order-2 w-full md:w-1/3 z-20 scale-110 border-purple-500/50 bg-[#0a0a0a]",
            rankText: "1", rankColor: "text-purple-500",
            title: "MONARCA (TOP 1)", titleBg: "bg-purple-900/50 text-purple-200 border-purple-500",
            barColor: "bg-purple-600",
            glow: "shadow-[0_0_40px_rgba(168,85,247,0.2)]"
        };
    } else {
        c = {
            wrapper: "order-2 md:order-1 w-full md:w-1/4 z-10 opacity-90 hover:opacity-100 border-cyan-500/30 bg-[#020617]",
            rankText: rank, rankColor: "text-cyan-500",
            title: rank === 2 ? "NIVEL NACIONAL" : "CAZADOR ÉLITE",
            titleBg: "bg-cyan-900/30 text-cyan-200 border-cyan-500/50",
            barColor: "bg-cyan-600",
            glow: "shadow-[0_0_20px_rgba(34,211,238,0.1)]"
        };
    }

    return `
    <div class="relative border-2 rounded-lg overflow-hidden transition-all duration-500 group ${c.wrapper} ${c.glow}">

        <!-- Header Rango -->
        <div class="p-6 text-center border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
            <p class="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-2">POSICIÓN</p>
            <h1 class="text-7xl font-black ${c.rankColor} leading-none mb-4 drop-shadow-lg">${c.rankText}</h1>
            <span class="px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${c.titleBg}">
                ${c.title}
            </span>
        </div>

        <!-- Stats Cuerpo -->
        <div class="p-6 space-y-4">

            <div class="flex justify-between items-end border-b border-slate-800 pb-2">
                <span class="text-[10px] font-bold text-slate-500 uppercase">AGENTE</span>
                <span class="text-lg font-black text-white uppercase tracking-wide truncate max-w-[120px] text-right">${nameDisplay}</span>
            </div>

            <!-- Barra de Poder (Reemplaza HP/MP) -->
            <div>
                <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1">
                    <span>Dominio del Mercado</span>
                    <span>${powerPercent.toFixed(0)}%</span>
                </div>
                <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full ${c.barColor} transition-all duration-1000 shadow-[0_0_10px_currentColor]" style="width: ${powerPercent}%"></div>
                </div>
            </div>

            <!-- Recompensa -->
            <div class="pt-2 mt-2">
                <p class="text-[10px] font-bold text-slate-500 uppercase text-center mb-1">GANANCIA ACUMULADA</p>
                <div class="text-center">
                    <span class="text-2xl font-mono font-black text-white bg-white/5 px-4 py-2 rounded border border-white/10 block">
                        ${moneyDisplay}
                    </span>
                </div>
            </div>

        </div>

        <!-- Efecto Borde Brillante al pasar el mouse -->
        <div class="absolute inset-0 border-2 border-white/0 group-hover:border-white/20 transition-all rounded-lg pointer-events-none"></div>
    </div>`;
}

// --- FUNCIÓN UTILITARIA DE TIEMPO ---
function timeAgo(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000); // Diferencia en segundos

    // Lógica de tiempo relativo
    if (seconds < 60) return "Hace un momento";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;

    const days = Math.floor(hours / 24);
    if (days === 1) return "Ayer";
    if (days < 7) return `Hace ${days} días`;

    // Si es muy antiguo, mostramos la fecha
    return date.toLocaleDateString();
}

// Renderizador del Podio High-End
// Renderizador del Podio "Pricing Style"
function renderHighEndPodium(user, rank, meName) {
    const isMe = user.name === meName;
    const nameDisplay = isMe ? 'TÚ' : user.name.split(' ')[0].substring(0, 8).toUpperCase();
    const moneyDisplay = isMe ? `$${user.total.toFixed(0)}` : '???';

    const config = {
        1: {
            grad: 'grad-rank-1',
            icon: 'military_tech',
            title: 'LÍDER',
            height: 'h-64 md:h-96', // Menos altura en móvil
            scale: 'scale-105 z-20',
            barColor: 'bg-[#2d2d2d]',
            msg: 'DOMINANDO'
        },
        2: {
            grad: 'grad-rank-2',
            icon: 'lightbulb',
            title: 'RETADOR',
            height: 'h-56 md:h-80',
            scale: 'scale-100 z-10',
            barColor: 'bg-[#333333]',
            msg: 'MUY CERCA'
        },
        3: {
            grad: 'grad-rank-3',
            icon: 'favorite',
            title: 'ÉLITE',
            height: 'h-56 md:h-80',
            scale: 'scale-100 z-10',
            barColor: 'bg-[#333333]',
            msg: 'EN EL TOP'
        }
    };

    const c = config[rank];
    const borderMe = isMe ? 'border-2 md:border-4 border-blue-500 transform translate-y-[-5px]' : '';

    // ETIQUETA CORREGIDA: Texto en una línea y más pequeña
    const topTag = rank === 1
        ? `<div class="absolute -top-6 left-0 right-0 bg-[#2d2d2d] text-white text-center py-1 text-[8px] md:text-xs font-bold uppercase tracking-widest rounded-t-lg shadow-lg whitespace-nowrap z-30">
             👑 LÍDER ACTUAL
             <div class="triangle-down"></div>
           </div>`
        : '';

    return `
    <div class="relative flex flex-col ${c.height} flex-1 min-w-[90px] max-w-[180px] pricing-shadow rounded-lg transition-all duration-300 ${c.scale} ${borderMe} bg-white">

        ${topTag}

        <!-- 1. CABECERA -->
        <div class="flex-1 ${c.grad} flex flex-col items-center justify-center p-1 text-white rounded-t-lg relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-full bg-white/10" style="clip-path: polygon(0 0, 100% 0, 100% 20%, 0 80%);"></div>

            <span class="material-symbols-outlined text-4xl md:text-7xl mb-1 drop-shadow-md">${c.icon}</span>
            <h3 class="text-sm md:text-2xl font-black uppercase tracking-tighter leading-none text-center drop-shadow-sm">
                ${c.title}
            </h3>
        </div>

        <!-- 2. BARRA PRECIO -->
        <div class="${c.barColor} py-2 md:py-4 text-center relative z-10">
            <p class="text-xl md:text-4xl font-black text-white tracking-tight leading-none">
                ${moneyDisplay}
            </p>
            <p class="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Ventas</p>
        </div>

        <!-- 3. CUERPO -->
        <div class="bg-white flex flex-col items-center justify-center py-2 md:py-4 rounded-b-lg gap-1 md:gap-2">

            <p class="text-sm md:text-xl font-black text-slate-800 uppercase text-center w-full px-1 leading-tight truncate">
                ${nameDisplay}
            </p>

            <div class="space-y-0.5 md:space-y-1 w-full px-1 opacity-70 flex flex-col items-center">
                <div class="flex items-center gap-1 justify-center">
                    <span class="material-symbols-outlined text-green-500 text-[10px] md:text-sm font-bold">check</span>
                    <span class="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Activo Hoy</span>
                </div>
                <div class="flex items-center gap-1 justify-center">
                    <span class="material-symbols-outlined text-green-500 text-[10px] md:text-sm font-bold">check</span>
                    <span class="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">${c.msg}</span>
                </div>
            </div>

            <!-- Botón falso -->
            <div class="mt-1 md:mt-2 w-4/5 h-6 md:h-8 ${c.grad} rounded flex items-center justify-center opacity-80 shadow-sm">
                 <span class="text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest">#${rank} Ranking</span>
            </div>
        </div>
    </div>`;
}

// Función auxiliar para renderizar el Podio
function renderPodiumItem(user, rank, meName) {
    const isMe = user.name === meName;
    const nameDisplay = isMe ? 'TÚ' : user.name.substring(0, 3);
    const moneyDisplay = isMe ? `$${user.total.toFixed(0)}` : '🏆'; // Ocultamos dinero ajeno

    // Colores y Alturas
    const styles = {
        1: { class: 'rank-1 order-2 w-1/3 z-20', color: 'bg-yellow-400', icon: '🥇' },
        2: { class: 'rank-2 order-1 w-1/4 z-10 opacity-90', color: 'bg-gray-400', icon: '🥈' },
        3: { class: 'rank-3 order-3 w-1/4 z-10 opacity-90', color: 'bg-orange-400', icon: '🥉' }
    };

    const s = styles[rank];
    const borderClass = isMe ? 'ring-2 ring-blue-500 ring-offset-2' : '';

    return `
    <div class="podium-card ${s.class} ${borderClass}">
        <div class="absolute -top-6 flex flex-col items-center">
            <div class="avatar-circle ${s.color}">${nameDisplay.substring(0,1)}</div>
            <span class="text-lg drop-shadow-md">${s.icon}</span>
        </div>

        <div class="text-center mt-auto pb-2">
            <p class="text-[10px] font-black uppercase text-gray-600 mb-1">${nameDisplay}</p>
            <p class="text-xs font-black text-[#1a4789] bg-white/50 px-2 rounded-full backdrop-blur-sm">
                ${moneyDisplay}
            </p>
        </div>
    </div>`;
}

// Inicializar el Ticker (opcional si quieres que rote automáticamente cada X tiempo sin recargar)
// Nota: La animación CSS ya hace el trabajo visual.

// --- NUEVA FUNCIÓN: RENDERIZAR LISTA DE MIS PEDIDOS ---
// --- FUNCIÓN ACTUALIZADA: RENDERIZAR LISTA DE MIS PEDIDOS CON WHATSAPP ---
let currentMyOrdersFilter = 'TODOS';



// Variable global para almacenar tus pedidos (asegúrate que esta variable exista al inicio del script)
// let myOrdersData = []; <--- Ya debería estar declarada arriba en tu código

// 1. FUNCIÓN DE CAMBIO DE FILTRO (Corregida)
function setMyOrdersFilter(status, btn) {
    currentMyOrdersFilter = status;

    // Actualizar UI de botones (Tabs)
    document.querySelectorAll('#my-orders-tabs button').forEach(b => {
        b.classList.remove('active', 'bg-[#1a4789]', 'text-white', 'shadow-md');
        b.classList.add('bg-gray-100', 'text-gray-500');
    });

    // Activar botón actual
    btn.classList.remove('bg-gray-100', 'text-gray-500');
    btn.classList.add('active', 'bg-[#1a4789]', 'text-white', 'shadow-md');

    // Re-renderizar usando la variable global 'myOrdersData'
    renderMyOrdersList(myOrdersData);
}

// 2. FUNCIÓN DE RENDERIZADO (CORREGIDA Y GARANTIZADA)
function renderMyOrdersList(lista) {
    const container = document.getElementById('list-mis-pedidos');

    if (!container) return;
    if (!lista) lista = [];

    // LÓGICA DE FILTRADO (INTACTA)
    const filteredByStatus = currentMyOrdersFilter === 'TODOS'
        ? lista
        : lista.filter(p => p.estado === currentMyOrdersFilter);

    // 1. CALCULAR CUÁNTOS VIENEN POR ENLACE (INTACTO)
    const countLinks = filteredByStatus.filter(p => p.origen === 'Enlace Compartido').length;

    // Estado Vacío (INTACTO)
    if (filteredByStatus.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center flex flex-col items-center opacity-50">
                <span class="material-symbols-outlined text-4xl text-gray-300 mb-2">inbox</span>
                <p class="text-sm font-bold text-gray-400">No hay pedidos en esta sección.</p>
            </div>`;
        return;
    }

    // 2. CREAR EL AVISO PULSÁTIL (INTACTO)
    let headerHTML = '';
    if (countLinks > 0) {
        headerHTML = `
        <div class="mb-4 bg-red-50 text-white p-2 rounded-xl flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-red-500/30">
            <span class="material-symbols-outlined text-lg">link</span>
            <span class="text-xs font-black uppercase tracking-widest">¡ATENCIÓN! ${countLinks} PEDIDOS POR ENLACE</span>
        </div>`;
    }

    // 3. RENDERIZADO DE TARJETAS
    const cardsHTML = filteredByStatus.map(p => {
        // A. Estilos visuales (INTACTO)
        const esPorEnlace = p.origen === 'Enlace Compartido';
        const cardStyle = esPorEnlace
            ? 'bg-red-50 border border-red-200 shadow-sm'
            : 'bg-white border border-gray-200 shadow-sm';

        // B. Estilos de Estado (INTACTO)
        let estadoStyle = 'bg-gray-100 text-gray-600';
        if(p.estado === 'Pendiente') estadoStyle = 'bg-amber-50 text-amber-600 border border-amber-100';
        if(p.estado === 'Asignado Mensajero') estadoStyle = 'bg-blue-50 text-blue-600 border border-blue-100';
        if(p.estado === 'Entregado') estadoStyle = 'bg-emerald-50 text-emerald-600 border border-emerald-100';

        // C. Datos básicos (INTACTO)
        const fechaDoc = new Date(p.fecha).toLocaleDateString();
        const primerNombre = p.cliente.split(' ')[0];
        const msjWA = `Hola ${primerNombre}, le escribo de paratuhogar por su pedido...`;
        const urlWA = `https://wa.me/${p.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(msjWA)}`;

        // D. BADGE DE ORIGEN (INTACTO)
        let sourceBadge = '';
        if (esPorEnlace) {
            sourceBadge = `<span class="flex items-center gap-1 text-[9px] font-black uppercase text-red-600 bg-white px-1.5 py-0.5 rounded border border-red-200 ml-2 shadow-sm" title="Venta Automática"><span class="material-symbols-outlined text-[10px]">link</span> Enlace</span>`;
        } else if (p.origen === 'Manual (Panel)') {
            sourceBadge = `<span class="flex items-center gap-1 text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 ml-2" title="Venta Manual"><span class="material-symbols-outlined text-[10px]">edit_note</span> Manual</span>`;
        } else {
            sourceBadge = `<span class="flex items-center gap-1 text-[9px] font-black uppercase text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 ml-2"><span class="material-symbols-outlined text-[10px]">language</span> Web</span>`;
        }

        // --- E. BOTONES DE GESTIÓN (EDITAR / ELIMINAR) ---
        // <--- CAMBIO AQUÍ: Definimos actionBtns en lugar de deleteBtn
        let actionBtns = '';
        if (p.estado === 'Pendiente') {
            actionBtns = `
            <!-- Botón Editar (Lápiz Azul) -->
            <button onclick="openGestorEdit('${p.id}')" title="Corregir Datos"
                class="h-7 w-7 bg-indigo-50 text-indigo-500 border border-indigo-100 rounded-full flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors ml-1">
                <span class="material-symbols-outlined text-sm">edit</span>
            </button>

            <!-- Botón Eliminar (Basura Roja) -->
            <button onclick="deleteMyOrder('${p.id}')" title="Eliminar Pedido"
                class="h-7 w-7 bg-white text-gray-400 border border-gray-200 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors ml-1">
                <span class="material-symbols-outlined text-sm">delete</span>
            </button>`;
        }

        // --- F. BOTÓN REENVÍO AL SISTEMA (INTACTO) ---
        const btnReenviar = `
            <button onclick="reenviarPedidoAdmin('${p.id}')" title="Reenviar Pedido al Almacén"
                class="h-7 w-7 bg-teal-500 text-white rounded-full flex items-center justify-center hover:bg-teal-600 transition-colors shadow-sm ml-1 border border-teal-600">
                <span class="material-symbols-outlined text-sm">send</span>
            </button>
        `;

        return `
        <div class="p-3 rounded-xl mb-3 relative transition-all hover:shadow-md group ${cardStyle}">

            <!-- CABECERA -->
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center">
                    <span class="text-[10px] font-bold text-gray-400">${fechaDoc}</span>
                    ${sourceBadge}
                </div>

                <!-- BOTONES DE ACCIÓN -->
                <div class="flex items-center gap-1">

                    <!-- 1. Botón Cliente (Verde) - INTACTO -->
                    <a href="${urlWA}" target="_blank" title="Chat con Cliente"
                       class="h-7 w-7 bg-[#25D366] text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm">
                        <i class="fab fa-whatsapp text-sm"></i>
                    </a>

                    <!-- 2. Botón Reenvío (Turquesa) - INTACTO -->
                    ${btnReenviar}

                    <!-- 3. Botones PDF (Rojo/Azul) - INTACTOS -->
                    <button onclick="prepararPDFDesdeHistorial('${p.id}', 'descargar')" title="PDF"
                        class="h-7 w-7 bg-red-50 text-red-500 border border-red-100 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-sm">download</span>
                    </button>

                    <button onclick="prepararPDFDesdeHistorial('${p.id}', 'compartir')" title="Compartir"
                        class="h-7 w-7 bg-blue-50 text-blue-500 border border-blue-100 rounded-full flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-sm">share</span>
                    </button>

                    ${p.estado === 'Entregado' ? `
                    <button onclick="openWarrantyCaseModal('${p.id}')" title="Reportar garantía"
                        class="h-7 w-7 bg-orange-50 text-orange-600 border border-orange-100 rounded-full flex items-center justify-center hover:bg-orange-500 hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-sm">health_and_safety</span>
                    </button>` : ''}

                    <!-- 4. BOTONES NUEVOS -->
                    ${actionBtns}  <!-- CAMBIO AQUÍ: Usamos actionBtns en vez de deleteBtn -->
                </div>
            </div>

            <!-- CUERPO COMPACTO Y ESTADO DE PAGO -->
            <div class="flex justify-between items-end gap-2">
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-black text-slate-700 uppercase truncate leading-tight mb-0.5" title="${p.cliente}">${p.cliente}</h4>
                    <p class="text-[10px] text-gray-400 truncate mb-2">${p.producto}</p>

                    <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${estadoStyle}">
                        ${p.estado}
                    </span>
                </div>

                <!-- PRECIO Y ETIQUETA -->
                <div class="text-right flex-shrink-0 flex flex-col items-end justify-end">
                    <p class="text-[10px] font-bold text-slate-400 mb-0.5">$${Number(p.total || 0).toFixed(0)}</p>
                    <p class="text-sm font-black text-emerald-600 whitespace-nowrap">+$${Number(p.comision_total).toFixed(2)}</p>

                    <!-- LÓGICA DE ETIQUETA DE PAGO (SOLO SI ESTÁ ENTREGADO) -->
                    ${p.estado === 'Entregado' ?
                        (p.pago_gestor === 'Pagado'
                            ? `<p class="text-[8px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded mt-1 text-right uppercase inline-flex items-center gap-1 justify-end w-full border border-emerald-200"><span class="material-symbols-outlined text-[10px]">check_circle</span> Pagado</p>`
                            : `<p class="text-[8px] font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded mt-1 text-right uppercase inline-flex items-center gap-1 justify-end w-full border border-orange-200"><span class="material-symbols-outlined text-[10px]">hourglass_empty</span> Por Cobrar</p>`
                        )
                    : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    // Insertar HEADER + TARJETAS
    container.innerHTML = headerHTML + cardsHTML;
}

    async function injectLinksSection(nombre) {
    // 1. Eliminar si ya existe para evitar duplicados
    if(document.getElementById('sec-links-gestor')) document.getElementById('sec-links-gestor').remove();

    const userData = window.currentUserData || {};
    const baseUrl = window.location.origin + window.location.pathname;

    // --- BYPASS MODO DIOS (Marcel siempre Nivel 5) ---
    let sales = 0;
    if (nombre === "Marcel Montano" || nombre === "Diana") {
    sales = 800;
} else {
        // CORRECCIÓN: Contar TODAS las ventas entregadas sin límite de 30 días
        // Esto asegura que el botón VIP lea el historial correcto (Ej: las 8 ventas de Elías)
        const { count } = await supabaseClient
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .eq('gestor', nombre)
            .eq('estado', 'Entregado');
        sales = count || 0;
    }

    window.gestorSalesCount = sales;
    const lvlData = getLevelData(sales);

    // Si es 365 días o más, mostramos "1 AÑO" para que se vea más poderoso
    let diasDuracion = lvlData.duration / 24;
    if (diasDuracion >= 365) diasDuracion = "1 AÑO";

    const myLongLink = `${baseUrl}?ref=${encodeURIComponent(nombre)}&contact=${userData.telefono || ''}`;
    const linkParaMostrar = await getOrGenerateShortLink(nombre, myLongLink);

    // CAMBIO VISUAL: Quitamos mt-6 (margen arriba) y pusimos mb-8 (margen abajo)
    const html = `
    <div id="sec-links-gestor" class="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 shadow-sm mb-8 relative overflow-hidden">

        <!-- Decoración Sutil de Fondo -->
        <div class="absolute -right-4 -top-4 opacity-5 pointer-events-none">
            <span class="material-symbols-outlined text-[100px] text-primary">link</span>
        </div>

        <div class="relative z-10">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-black uppercase text-primary italic">🔗 Mi Enlace Inteligente</h3>
                <span class="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                    ⚡ LINK PRO ACTIVO
                </span>
            </div>
            <p class="text-xs text-gray-400 mb-4">
                Este enlace dura <span class="font-black text-primary">${diasDuracion} días</span> en el navegador del cliente.
            </p>

            <div class="flex gap-2 mb-4">
                <input type="text" id="my-link-input" value="${linkParaMostrar}" readonly class="w-full bg-gray-50 dark:bg-gray-900 text-xs p-3 rounded-xl border-gray-200 font-bold text-gray-500 shadow-inner focus:ring-0">
                <button onclick="copy('my-link-input')" class="bg-primary hover:bg-[#2c6fb5] text-white px-6 rounded-xl font-black text-xs uppercase shadow-md transition-colors active:scale-95">Copiar</button>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <button onclick="window.open('https://wa.me/?text=${encodeURIComponent('Catálogo: ' + linkParaMostrar)}')" class="py-3 bg-[#25D366] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] transition-transform">
                    <i class="fab fa-whatsapp text-lg"></i> Enviar por WhatsApp
                </button>
                <button onclick="window.open('https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(linkParaMostrar)}')" class="py-3 bg-[#1877F2] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:scale-[1.02] transition-transform">
                    <i class="fab fa-facebook text-lg"></i> Compartir Facebook
                </button>
            </div>
        </div>
    </div>`;

    // ============================================================
    // CAMBIO MAESTRO: INSERCIÓN AL PRINCIPIO DEL DASHBOARD
    // ============================================================
    // Buscamos el contenedor principal de la vista de resumen
    const dashboardTop = document.getElementById('sub-dash-resumen');

    if(dashboardTop) {
        // 'afterbegin' lo inserta como el PRIMER hijo de ese div
        dashboardTop.insertAdjacentHTML('afterbegin', html);
    } else {
        // Fallback de seguridad
        const fallbackDiv = document.getElementById('sec-dashboard');
        if(fallbackDiv) fallbackDiv.insertAdjacentHTML('afterbegin', html);
    }
}



    // 2. CARGA DE PRODUCTOS
function prepareClientExperience() {
    // En una sesión interna estas secciones se ocultan; esta organización es
    // exclusivamente para quien visita la tienda como cliente.
    if (localStorage.getItem('pth_session')) return;
    const catalog = document.getElementById('sec-catalogo');
    const hero = catalog?.querySelector('.client-only-section');
    const trust = catalog?.querySelector('.client-trust-section');
    const productGrid = document.getElementById('productos-container');
    if (!catalog || !hero || !productGrid) return;

    // Promesa de confianza breve y luego productos: la intención de compra
    // aparece antes que testimonios, formularios y explicaciones extensas.
    if (trust) hero.insertAdjacentElement('afterend', trust);

    const finalCta = catalog.querySelector('.client-final-cta');
    catalog.querySelectorAll('.client-secondary-section:not(.client-final-cta)').forEach(section => {
        productGrid.insertAdjacentElement('afterend', section);
    });
    if (finalCta) catalog.appendChild(finalCta);
}

document.addEventListener('DOMContentLoaded', prepareClientExperience);
// Respaldo para navegadores móviles que restauran la página desde caché y
// pueden haber completado DOMContentLoaded antes de ejecutar este bloque.
window.addEventListener('load', prepareClientExperience);

    // 2. CARGA DE PRODUCTOS Y CATEGORÍAS AUTOMÁTICAS
// --- FUNCIÓN MAESTRA DE CARGA Y FUSIÓN DE PRECIOS ---
// =====================================================
// CARGA DE PRODUCTOS CON CACHE BUSTING INTELIGENTE
// =====================================================
// =====================================================
// CARGA DE PRODUCTOS CON CACHE BUSTING INTELIGENTE (CORREGIDO)
// =====================================================
let productsLoadInProgress = false;
let catalogLoadError = null;

function showCatalogLoadError(error, reload = false) {
    const container = document.getElementById('productos-container');
    if (!container) return;
    container.innerHTML = `<div class="col-span-full py-10 text-center" role="alert">
        <p class="font-bold text-gray-700">No se pudo actualizar el catálogo</p>
        <p data-catalog-error-message class="text-gray-500 mt-2"></p>
        <button type="button" data-catalog-retry class="mt-4 px-4 py-2 bg-primary text-white rounded-xl">Reintentar catálogo</button>
    </div>`;
    // Server messages are text, never executable HTML.
    container.querySelector('[data-catalog-error-message]').textContent = error?.message || 'Comprueba tu conexión y vuelve a intentar.';
    const invalidSession = error?.code === 'SESSION_INVALID' || error?.status === 401;
    const button = container.querySelector('[data-catalog-retry]');
    if (invalidSession) button.textContent = 'Volver a entrar';
    button.addEventListener('click', () => invalidSession ? openLoginModal() : reload ? window.location.reload() : loadProducts());
    renderLowConnectivityPanel();
    const categories = document.getElementById('category-list');
    if (categories) categories.textContent = 'Catálogo pendiente de actualizar';
}

const salesHierarchyCache = new Map();

async function resolveSalesHierarchy(agentName, catalogOnly = false) {
    const cleanName = String(agentName || '').trim();
    if (!cleanName || cleanName === 'Venta Directa') return null;
    const self = window.currentUserData;
    const ownId = window.PTHSecureData.token() && self?.nombre === cleanName ? self.id : null;
    const scopeKey = `${window.PTHSecureData.cacheSuffix()}:${ownId || cleanName}:${catalogOnly}`;
    if (salesHierarchyCache.has(scopeKey)) return salesHierarchyCache.get(scopeKey);

    let query = supabaseClient
        .from('gestores')
        .select('id, nombre, telefono, estado, parent_id');
    query = ownId ? query.eq('id', ownId).maybeSingle() : query.eq('nombre', cleanName);
    if (!ownId && !catalogOnly) query = query.maybeSingle();
    const { data, error } = await query;

    if (error) {
        if (!catalogOnly && !ownId && error.code === 'PGRST116') {
            throw Object.assign(new Error('El enlace de atención necesita revisión.'), { code: 'SELLER_IDENTITY_AMBIGUOUS' });
        }
        throw Object.assign(new Error(error.message), error);
    }
    // Public catalogue links name the pricing owner. Repeated names may share
    // that owner, but never choose one account when their hierarchies disagree.
    const matches = Array.isArray(data) ? data : data ? [data] : [];
    if (matches.length > 1 && new Set(matches.map(row => row.parent_id || null)).size > 1) {
        throw new Error('Este enlace necesita revisión: hay cuentas con el mismo nombre y diferentes equipos.');
    }
    const agent = matches.length > 1 ? { nombre: cleanName, parent_id: matches[0].parent_id } : matches[0];
    if (!agent) {
        if (!catalogOnly) throw Object.assign(new Error('No encontramos la cuenta de atención de este enlace.'), { code: 'SELLER_NOT_FOUND' });
        return null;
    }

    let parent = null;
    if (agent.parent_id) {
        const { data: parentData, error: parentError } = await supabaseClient
            .from('gestores')
            .select('id, nombre, telefono, estado, parent_id')
            .eq('id', agent.parent_id)
            .maybeSingle();
        if (parentError) throw Object.assign(new Error(parentError.message), parentError);
        if (!parentData) {
            throw new Error(`El subgestor ${agent.nombre} no tiene un gestor principal válido.`);
        }
        parent = parentData;
    }

    const hierarchy = {
        agent,
        parent,
        isSubgestor: Boolean(parent),
        pricingOwnerName: parent?.nombre || agent.nombre
    };
    salesHierarchyCache.set(scopeKey, hierarchy);
    return hierarchy;
}

// Description hydration has no persistent cache and never replaces commercial fields.
let descriptionCatalogGeneration = 0;
let descriptionLoader;
function ensureProductDescriptions(products) {
    if (!descriptionLoader) descriptionLoader = window.PTHProductDescriptions.create({
        getScope: () => `${window.PTHSecureData.token() || 'public'}:${descriptionCatalogGeneration}`,
        fetchRows: async ids => {
            const { data, error } = await supabaseClient.from('productos').select('id, descripcion').in('id', ids);
            if (error) throw error;
            return data || [];
        }
    });
    return descriptionLoader.hydrate(products);
}
function loadDetailDescription(product) {
    const container = document.getElementById('detail-desc');
    if (Object.prototype.hasOwnProperty.call(product, 'descripcion')) return renderDetailDescription(product.descripcion);
    container.textContent = 'Cargando descripción…';
    ensureProductDescriptions([product]).then(() => {
        if (selectedProduct === product) renderDetailDescription(product.descripcion);
    }).catch(() => {
        if (selectedProduct !== product) return;
        container.textContent = 'No se pudo cargar la descripción. ';
        const retry = document.createElement('button');
        retry.type = 'button'; retry.className = 'min-h-11 px-3 font-bold text-primary underline';
        retry.textContent = 'Reintentar'; retry.onclick = () => loadDetailDescription(product);
        container.appendChild(retry);
    });
}

async function loadProducts() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('s');
    let urlGestor = urlParams.get('ref') || urlParams.get('gestor');
    const sessionGestor = window.gestorName;

    // --- RECUPERAR GESTOR DESDE MEMORIA (SANEADO) ---
    let memoriaGestor = null;
    // Evita que varios eventos de inicio reconstruyan el catálogo al mismo tiempo.
    if (productsLoadInProgress) return;
    productsLoadInProgress = true;
    descriptionCatalogGeneration++;

    try {
        catalogLoadError = null;

        try {
            const stored = JSON.parse(localStorage.getItem('pth_referrer_smart'));
            if (stored && stored.nombre) {
                memoriaGestor = stored.nombre;
            }
        } catch(e) {}

        // Declarar activeGestor con prioridad de sesión, URL o memoria
        const activeGestor = sessionGestor || urlGestor || memoriaGestor;
        const [salesHierarchy, { data: ctrlData }] = await Promise.all([
            resolveSalesHierarchy(activeGestor, true),
            supabaseClient.from('control_sistema').select('valor').eq('clave', 'ultimo_cambio_productos').maybeSingle()
        ]);
        window.activeSalesHierarchy = salesHierarchy;

        // Saneamiento de variables y redirección (Se mantiene intacto)
        if (slug) {
            const { data } = await supabaseClient.from('short_links').select('original_url, gestor').eq('slug', slug).single();
            if (data) {
                registrarRastroIP(data.gestor);
                window.location.href = data.original_url;
                return;
            }
        }

        if (urlGestor) {
            registrarRastroIP(urlGestor);
        } else {
            registrarRastroIP("Directo");
        }

        // =========================================================
        // VERIFICACIÓN RÁPIDA DE VERSIÓN DE INVENTARIO
        // =========================================================
        let productos = [];
        await window.PTHSecureData.restore();
        const catalogueScope = window.PTHSecureData.cacheSuffix();
        const catalogueRequestToken = window.PTHSecureData.token();
        const anonymousCatalogueSource = catalogueScope === ':public' && !catalogueRequestToken;
        const cacheKey = 'pth_catalogo_cache' + window.PTHSecureData.cacheSuffix();
        const cacheTimeKey = 'pth_catalogo_cache_time' + window.PTHSecureData.cacheSuffix();
        const cacheLocalKey = 'pth_ultimo_cambio_productos' + window.PTHSecureData.cacheSuffix();
        const catalogSchemaKey = 'pth_catalogo_schema_version';
        const catalogSchemaVersion = 'catalogue-gateway-compatible-v2';

        // Fuerza una sola actualización cuando la estructura del catálogo incorpora
        // campos nuevos, sin aumentar las consultas en las visitas posteriores.
        if (localStorage.getItem(catalogSchemaKey) !== catalogSchemaVersion) {
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimeKey);
            try { localStorage.setItem(catalogSchemaKey, catalogSchemaVersion); } catch (_) {}
        }

        let catalogoCacheado = localStorage.getItem(cacheKey);
        let cachedProducts;
        if (catalogoCacheado) {
            try {
                cachedProducts = JSON.parse(catalogoCacheado);
                if (!Array.isArray(cachedProducts) || !cachedProducts.length || cachedProducts.some(row => !row || typeof row !== 'object' || !row.id || !row.nombre)) throw Error('Invalid catalogue cache');
            } catch (_) {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimeKey);
                catalogoCacheado = null;
            }
        }
        const cacheTime = localStorage.getItem(cacheTimeKey);
        const ultimoCambioLocal = localStorage.getItem(cacheLocalKey);

        // 1. Consulta de control ultra ligera (descarga pocos bytes)
        const ultimoCambioNube = ctrlData ? ctrlData.valor : null;
        const CACHE_EXPIRATION_MS = 2 * 60 * 60 * 1000; // 2 horas de respaldo automático

        // Si la marca de tiempo de la base de datos es diferente a la local, se fuerza la descarga
        const hayNuevaVersion = ultimoCambioNube && (ultimoCambioNube !== ultimoCambioLocal);
        const cacheAge = Date.now() - Number(cacheTime);
        const cacheExpirada = !cacheTime || !Number.isFinite(cacheAge) || cacheAge < 0 || cacheAge > CACHE_EXPIRATION_MS;

        // Personalized prices and assigned shares can change independently of inventory.
        const necesitaDescargar = Boolean(window.currentUserData?.parent_id) || !catalogoCacheado || hayNuevaVersion || cacheExpirada;

        if (!necesitaDescargar) {
            productos = cachedProducts;
            console.log("📦 Catálogo cargado desde Caché Local (Versión al día)");
        } else {
            // Descargar catálogo completo de Supabase sólo si es estrictamente necesario
            const { data, error } = await supabaseClient
                .from('productos')
                // Gateway v7 accepts ASCII identifiers only. Keep its supported
                // wildcard so tamaño_envio and all required fields remain present.
                // Server projectRow still removes fields unauthorized for this actor.
                .select('*')
                .order('nombre', { ascending: true })
                .forSession(catalogueRequestToken);

            if (error) throw error;
            if (!Array.isArray(data)) throw new Error('El servidor no devolvió un catálogo válido. Reintenta la carga.');
            productos = data;

            // Guardar en caché y actualizar marcas de tiempo
            // Cache is optional. A full device must not hide a valid catalogue.
            try {
                localStorage.setItem(cacheKey, JSON.stringify(productos));
                localStorage.setItem(cacheTimeKey, Date.now().toString());
                if (ultimoCambioNube) localStorage.setItem(cacheLocalKey, ultimoCambioNube);
            } catch (_) {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimeKey);
            }
            console.log("☁️ Catálogo actualizado desde Supabase (Nueva versión detectada)");
        }

        if (catalogueRequestToken !== window.PTHSecureData.token() || catalogueScope !== window.PTHSecureData.cacheSuffix()) {
            throw Object.assign(new Error('La sesión cambió mientras cargaba el catálogo. Vuelve a entrar.'),{code:'SESSION_CHANGED'});
        }
        // La copia oficial nunca recibe precios o comisiones personalizados.
        // Es la referencia de disponibilidad, frescura e historial comercial.
        catalogSourceProducts = productos.map(product => ({ ...product }));
        productosRaw = productos.map(product => ({ ...product }));
        catalogLastSyncAt = ultimoCambioNube || (cacheTime ? new Date(Number(cacheTime)).toISOString() : new Date().toISOString());
        // =========================================================

        // Fusionar precios personalizados de gestores (Se mantiene intacto)
        if (activeGestor) {
            const esSubgestor = Boolean(salesHierarchy?.isSubgestor);
            const gestorConsultar = salesHierarchy?.pricingOwnerName || activeGestor;

            const { data: preciosCustom, error: preciosError } = await supabaseClient
                .from('precios_personalizados')
                .select('producto_id, nuevo_precio, comision_subgestor, visible_subgestor')
                .eq('gestor', gestorConsultar);

            if (preciosError) throw preciosError;

            if (preciosCustom && preciosCustom.length > 0) {
                productosRaw = productosRaw.filter(p => {
                    const custom = preciosCustom.find(c => c.producto_id === p.id);
                    if (esSubgestor && custom && custom.visible_subgestor === false) {
                        return false;
                    }
                    return true;
                });

                productosRaw.forEach(p => {
            p.comision_original_base = parseFloat(p.comision) || 0; // Guardamos comisión original base de la DB
            const custom = preciosCustom.find(c => c.producto_id === p.id);
            if (custom) {
                const precioBase = parseFloat(p.precio);
                const precioNuevo = parseFloat(custom.nuevo_precio);

                if (p.precio_flexible === 'SI') {
                    if (precioNuevo >= precioBase) p.precio = precioNuevo;
                }

                if (esSubgestor) {
                    // Calculamos la comisión total real del producto para el gestor principal (base + sobreprecio)
                    const extraParent = (p.precio_flexible === 'SI' && precioNuevo >= precioBase) ? (precioNuevo - precioBase) : 0;
                    p.comision_original_pool = p.comision_original_base + extraParent;

                    p.comision = (parseFloat(custom.comision_subgestor) || 0).toFixed(2);
                } else {
                    if (p.precio_flexible === 'SI' && precioNuevo >= precioBase) {
                       const extra = precioNuevo - precioBase;
                       p.comision = (parseFloat(p.comision) + extra).toFixed(2);
                    }
                    p.comision_original_pool = parseFloat(p.comision);
                }
                p.is_custom = true;
            } else {
                p.comision_original_pool = p.comision_original_base;
                if (esSubgestor) {
                    p.comision = "0.00";
                }
            }
        });
            } else if (esSubgestor) {
                productosRaw.forEach(p => { p.comision = "0.00"; });
            }
        }

        // Restaurar el contexto de un mensaje compartido antes de dibujar.
        const sharedCategory = urlParams.get('catalog_category');
        const sharedQuery = urlParams.get('catalog_q');
        if (sharedCategory) activeCategory = sharedCategory.toUpperCase();
        const sharedSearchInput = document.getElementById('search-bar');
        if (sharedSearchInput && sharedQuery) sharedSearchInput.value = sharedQuery;

        renderCategories();
        renderProducts();
        updateGestorSalesPulse();
        renderLowConnectivityPanel();
        // Internal data is never the source of the new public offline copy.
        // Public cache refresh is shared and uses an explicitly anonymous read.
        cachePublicCatalogue(productos, anonymousCatalogueSource, necesitaDescargar ? Date.now() : Number(cacheTime));

        if (sessionGestor) {
            renderGestorPricing();
        }

        const searchParam = urlParams.get('search');
        if (searchParam) {
            const existe = productosRaw.find(p => p.nombre === searchParam);
            if (isProductCurrentlyAvailable(existe)) {
                setTimeout(() => { openDetail(searchParam); }, 500);
            } else if (existe) {
                setTimeout(() => showUnavailableSharedOffer(existe), 350);
            }
        }

    } catch (e) {
        console.error("Error cargando catálogo:", e);
        catalogLoadError = { error: e, reload: false };
        showCatalogLoadError(e);
    } finally {
        productsLoadInProgress = false;
    }
}

// --- FUNCIONES DE APOYO PARA EL RASTREO IP ---

// --- PEGAR ESTO EN index.html (Reemplaza la función antigua) ---

async function registrarRastroIP(nombreGestor) {
    if (!nombreGestor) return;

    // == EXCLUSIÓN DE GESTORES Y ADMINS ==
    if (localStorage.getItem('pth_session')) {
        console.log("ℹ️ Sesión activa detectada. No se registra tráfico interno.");
        return;
    }

    let ip = "";
    let pais = "Desconocido";

    try {
        // INTENTO MEJORADO: Usar ipwho.is (Gratis, sin API Key, devuelve País)
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                ip = data.ip;
                pais = data.country || "Desconocido"; // Capturamos el país real
            } else {
                // Fallback a ipify si falla
                const res2 = await fetch('https://api.ipify.org?format=json');
                const data2 = await res2.json();
                ip = data2.ip;
            }
        }
    } catch (e) {
        console.error("Error obteniendo IP:", e);
        return;
    }

    try {
        // 1. Huella Digital
        const fingerprint = navigator.userAgent + "|" + screen.width;
        // 2. Cooldown (30 min)
        const margenTiempo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        // 3. Verificar duplicado
        const { data: existente } = await supabaseClient
            .from('link_analytics')
            .select('id')
            .eq('agent_name', nombreGestor)
            .eq('ip_address', ip)
            .gte('timestamp', margenTiempo)
            .limit(1);

        // 4. Guardar si es nuevo
        if (!existente || existente.length === 0) {
            const ua = navigator.userAgent;
            const tipoDispositivo = /Mobi|Android/i.test(ua) ? 'Móvil' : 'Escritorio';
            const sistemaOperativo = ua.includes("Win") ? "Windows" : ua.includes("Mac") ? "MacOS" : "Móvil";

            await supabaseClient.from('link_analytics').insert([{
                agent_name: nombreGestor,
                ip_address: ip,
                pais: pais, // <--- AHORA SÍ SE GUARDARÁ EL PAÍS REAL
                device_type: tipoDispositivo,
                os: sistemaOperativo,
                browser: fingerprint,
                timestamp: new Date().toISOString()
            }]);
            console.log(`📍 Rastro registrado: ${ip} (${pais})`);
        }
    } catch (e) {
        console.error("Error guardando rastro:", e);
    }
}

async function buscarDuenoPorIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const { ip } = await res.json();

        // Buscamos el último rastro dejado por esta IP en las últimas 48 horas
        const hace48Horas = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const { data } = await supabaseClient
            .from('link_analytics')
            .select('agent_name')
            .eq('ip_address', ip)
            .gte('timestamp', hace48Horas)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

        return data ? data.agent_name : null;
    } catch (e) { return null; }
}

function prepararPDFDesdeHistorial(pedidoId, accion) {
    // Si estamos en el panel admin, usamos pedidosRawAdmin. Si estamos en gestor, usamos myOrdersData
    const p = (typeof pedidosRawAdmin !== 'undefined' ? pedidosRawAdmin.find(item => item.id === pedidoId) : null) ||
              (typeof myOrdersData !== 'undefined' ? myOrdersData.find(item => item.id === pedidoId) : null);

    if (!p) return alert("Error: No se encontró el registro del pedido.");

    const totalVentaRegistrado = Number(p.total);
    const mensajeria = Number(p.costo_mensajeria || 0);
    const totalEquiposEnPedido = totalVentaRegistrado - mensajeria;

    const partes = p.producto.split(' + ');
    const itemsProcesados = [];
    let esPedidoB2B = false; // Bandera para saber qué PDF generar

    partes.forEach(parte => {
        let qty = 1;
        const qtyMatch = parte.match(/^(\d+)x/);
        if (qtyMatch) qty = parseInt(qtyMatch[1]);

        let nombreLimpio = parte.replace(/^\d+x\s+/, '').split('[')[0].trim();

        const productoEnCatalogo = productosRaw.find(prod => prod.nombre === nombreLimpio);
        let precioUnitario = 0;

        if (productoEnCatalogo) {
            precioUnitario = Number(productoEnCatalogo.precio);
            // Comprobar si pertenece a categoría B2B
            const cat = (productoEnCatalogo.categoria || "").toUpperCase();
            if (cat.includes('MAYORISTA') || cat.includes('B2B') || cat.includes('MIPYME')) {
                esPedidoB2B = true;
            }
        } else {
            const totalUnidades = partes.reduce((acc, cur) => {
                const m = cur.match(/^(\d+)x/);
                return acc + (m ? parseInt(m[1]) : 1);
            }, 0);
            precioUnitario = totalEquiposEnPedido / totalUnidades;

            // Fallback: Si el producto fue borrado, buscamos por el nombre
            if(nombreLimpio.toUpperCase().includes('LOTE') || nombreLimpio.toUpperCase().includes('MAYORISTA')) {
                esPedidoB2B = true;
            }
        }

        itemsProcesados.push({
            nombre: nombreLimpio,
            qty: qty,
            price: precioUnitario,
            total: precioUnitario * qty
        });
    });

    const datosParaPDF = {
        cliente: p.cliente,
        ci: p.ci || "---",
        telefono: p.telefono,
        direccion: p.direccion,
        totalUSD: totalVentaRegistrado,
        mensajeria: mensajeria,
        items: itemsProcesados
    };

    // === ELEGIR EL GENERADOR CORRECTO ===
    if (esPedidoB2B) {
        generarComprobanteB2B(datosParaPDF, accion);
    } else {
        generarComprobanteVenta(datosParaPDF, accion);
    }
}

    // Variable global para guardar las categorías de la tienda
let categoriasPúblicas = [];

// REEMPLAZAR LA ACTUAL renderCategories() POR ESTA:
async function renderCategories() {
    // 1. Cargamos el orden oficial del Jefe desde la Base de Datos
    let categoriasOficiales = [];
    try {
        const { data } = await supabaseClient
            .from('categorias')
            .select('nombre')
            .order('orden', { ascending: true });
        if (data) {
            categoriasOficiales = data.map(c => c.nombre.toUpperCase().trim());
        }
    } catch(e) { console.error("Error cargando categorías oficiales"); }

    // 2. Extraemos TODAS las categorías que tienen tus productos actualmente (Modo rescate)
    const categoriasEnProductos = [...new Set(productosRaw.map(p => p.categoria ? p.categoria.toUpperCase().trim() : 'VARIOS'))];

    // 3. FUSIONAMOS: Ponemos primero las del Jefe (en su orden), y al final las "Huerfanas" (si hay alguna)
    const categoriasFinales = [...categoriasOficiales];
    categoriasEnProductos.forEach(cat => {
        if (!categoriasFinales.includes(cat)) {
            categoriasFinales.push(cat); // Si hay una nueva, se añade al final automáticamente
        }
    });

    // 4. Dibujamos el menú
    const allCats = ['TODOS', ...categoriasFinales];
    const container = document.getElementById('category-list');
    if (!container) return;

    container.innerHTML = allCats.map(cat => {
        const isActive = activeCategory === cat;

        // --- 🚀 LA MAGIA AQUÍ: Detectar si es la categoría Mayorista ---
        const esMayorista = cat.toUpperCase().includes('MAYORISTA') || cat.toUpperCase().includes('B2B') || cat.toUpperCase().includes('MIPYME');

        if (esMayorista) {
            // DISEÑO VIP EXCLUSIVO PARA MAYORISTA
            const bgClass = isActive
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.6)]' // Activo: Dorado brillante
                : 'bg-slate-900 text-amber-400 border border-amber-500 shadow-md hover:bg-slate-800'; // Inactivo: Negro elegante con borde dorado

            const iconColor = isActive ? 'text-slate-900' : 'text-amber-400';

            return `
            <div class="py-2 px-1 flex items-center"> <!-- Contenedor para alinear con el resto -->
                <button onclick="filterByCategory('${cat}')" class="relative group flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs md:text-sm transition-all transform hover:scale-105 active:scale-95 ${bgClass}">
                    <span class="material-symbols-outlined ${iconColor} text-lg">local_shipping</span>
                    ${cat}
                    <!-- Etiqueta flotante HOT que rebota -->
                    <span class="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black animate-bounce shadow-lg border border-white">B2B</span>
                </button>
            </div>`;
        }

        // --- DISEÑO NORMAL PARA LAS DEMÁS CATEGORÍAS ---
        const styleClass = isActive
            ? "category-tab active py-4 text-sm font-black border-b-4 border-primary text-primary transition-all px-2"
            : "category-tab py-4 text-sm font-bold text-gray-400 hover:text-primary transition-all px-2 border-b-4 border-transparent hover:border-gray-200";

        return `<button onclick="filterByCategory('${cat}')" class="${styleClass}">${cat}</button>`;
    }).join('');
}

let gestorCatalogView = 'grid';
let gestorCatalogFilter = 'disponibles';

function isGestorCatalogMode() {
    return Boolean(localStorage.getItem('pth_session')) && Boolean(window.gestorName);
}

function isRecentCatalogProduct(product) {
    const created = new Date(product.created_at || product.fecha || 0).getTime();
    return created > 0 && (Date.now() - created) <= 7 * 24 * 60 * 60 * 1000;
}

function matchesGestorCatalogFilter(product) {
    if (!isProductCurrentlyAvailable(product)) return false;
    if (!isGestorCatalogMode() || gestorCatalogFilter === 'todos') return true;
    if (gestorCatalogFilter === 'nuevos') return isRecentCatalogProduct(product);
    if (gestorCatalogFilter === 'comision') return Number(product.comision || 0) > 10;
    return true;
}

function getFilteredCatalogProducts() {
    const query = (document.getElementById('search-bar')?.value || '').trim().toLowerCase();
    const filterHighComm = Boolean(document.getElementById('filter-high-comm')?.checked);
    return productosRaw.filter(product => {
        const name = String(product.nombre || '').toLowerCase();
        const category = String(product.categoria || '');
        const matchSearch = !query || name.includes(query) || category.toLowerCase().includes(query);
        const matchCategory = activeCategory === 'TODOS' || category.toUpperCase().includes(activeCategory);
        const matchCommission = !filterHighComm || Number(product.comision || 0) > 10;
        return matchSearch && matchCategory && matchCommission && matchesGestorCatalogFilter(product);
    });
}

function renderGestorCatalogSummary(visibleCount) {
    if (!isGestorCatalogMode()) return;
    const available = productosRaw.filter(isProductCurrentlyAvailable);
    const values = {
        'gestor-catalog-available': available.length,
        'gestor-catalog-new': available.filter(isRecentCatalogProduct).length,
        'gestor-catalog-high-commission': available.filter(product => Number(product.comision || 0) > 10).length
    };
    Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    const result = document.getElementById('gestor-catalog-result-label');
    if (result) result.textContent = `${visibleCount} ${visibleCount === 1 ? 'producto visible' : 'productos visibles'} · ${activeCategory === 'TODOS' ? 'Todas las categorías' : activeCategory}`;

    document.querySelectorAll('[data-gestor-catalog-filter]').forEach(button => {
        const active = button.dataset.gestorCatalogFilter === gestorCatalogFilter;
        button.classList.toggle('ring-2', active);
        button.classList.toggle('ring-[#1a4789]', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function setGestorCatalogFilter(filter) {
    gestorCatalogFilter = ['todos', 'disponibles', 'nuevos', 'comision'].includes(filter)
        ? filter
        : 'disponibles';
    applySort();
}

function showAllAvailableCatalogProducts() {
    const search = document.getElementById('search-bar');
    const commission = document.getElementById('filter-high-comm');
    if (search) search.value = '';
    if (commission) commission.checked = false;
    gestorCatalogFilter = 'disponibles';
    filterByCategory('TODOS');
}

function setGestorCatalogView(view) {
    gestorCatalogView = view === 'list' ? 'list' : 'grid';
    const gridButton = document.getElementById('gestor-view-grid');
    const listButton = document.getElementById('gestor-view-list');
    [gridButton, listButton].forEach(button => button?.classList.remove('bg-white', 'text-[#1a4789]', 'shadow-sm'));
    const activeButton = gestorCatalogView === 'grid' ? gridButton : listButton;
    activeButton?.classList.add('bg-white', 'text-[#1a4789]', 'shadow-sm');
    applySort();
}

function getCatalogProductBadges(product) {
    const badges = [];
    if (!isProductCurrentlyAvailable(product)) badges.push('<span class="rounded-full bg-rose-50 px-2 py-1 text-[8px] font-black uppercase text-rose-700">Agotado</span>');
    else badges.push('<span class="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase text-emerald-700">Disponible</span>');
    if (isRecentCatalogProduct(product)) badges.push('<span class="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase text-blue-700">Nuevo</span>');
    if (product.precio_flexible === 'SI') badges.push('<span class="rounded-full bg-violet-50 px-2 py-1 text-[8px] font-black uppercase text-violet-700">Precio flexible</span>');
    return badges.join('');
}

function getPublicProductPrice(product) {
    const usd = Number(product?.precio) || 0;
    if (!showInCUP) return `$${usd} USD`;
    const cup = calculateProductCUP(usd, null, product?.cup_extra);
    return cup
        ? `CUP ${cup.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `$${usd} USD`;
}

function createStableProductSlug(productOrName) {
    const product = typeof productOrName === 'object' && productOrName !== null ? productOrName : null;
    const storedSlug = String(product?.slug || '').trim();
    if (storedSlug) {
        return storedSlug
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    const name = String(product?.nombre || productOrName || 'producto');
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90) || 'producto';
}

function getPermanentProductUrl(productOrName, absolute = false) {
    const slug = createStableProductSlug(productOrName);
    const path = `/producto/${encodeURIComponent(slug)}/`;
    return absolute ? `${window.location.origin}${path}` : path;
}

function makeOpaqueAttributedFallback(longLink) {
    try {
        const url = new URL(longLink, window.location.origin);
        const ref = url.searchParams.get('ref');
        const contact = url.searchParams.get('contact');
        if (!ref) return longLink;
        const payload = JSON.stringify({ n: ref, t: contact || '' });
        const token = btoa(unescape(encodeURIComponent(payload)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
        url.search = '';
        url.searchParams.set('r', token);
        return url.toString();
    } catch (error) {
        return longLink;
    }
}

function openProductCard(event, productName) {
    if (event) event.preventDefault();
    openDetail(productName);
}

let detailGalleryImages = [];
let detailGalleryIndex = 0;

function selectDetailImage(index) {
    if (!detailGalleryImages.length) return;
    detailGalleryIndex = Math.max(0, Math.min(index, detailGalleryImages.length - 1));
    const image = document.getElementById('detail-main-img');
    const counter = document.getElementById('detail-image-counter');
    if (image) image.src = detailGalleryImages[detailGalleryIndex];
    document.getElementById('detail-load-photo')?.remove();
    if (counter) counter.textContent = `${detailGalleryIndex + 1} / ${detailGalleryImages.length}`;
    document.querySelectorAll('[data-detail-thumbnail]').forEach((thumb, thumbIndex) => {
        thumb.classList.toggle('border-[#1a4789]', thumbIndex === detailGalleryIndex);
        thumb.classList.toggle('ring-2', thumbIndex === detailGalleryIndex);
        thumb.classList.toggle('ring-blue-100', thumbIndex === detailGalleryIndex);
        thumb.classList.toggle('border-slate-200', thumbIndex !== detailGalleryIndex);
    });
}

function openDetailImagePreview() {
    if (!detailGalleryImages.length) return;
    let preview = document.getElementById('detail-image-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'detail-image-preview';
        preview.className = 'fixed inset-0 z-[180] hidden items-center justify-center bg-slate-950/95 p-4';
        preview.innerHTML = `
            <button type="button" onclick="closeDetailImagePreview()" class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Cerrar imagen ampliada">
                <span class="material-symbols-outlined">close</span>
            </button>
            <img id="detail-image-preview-img" class="max-h-[88vh] max-w-full object-contain" alt="Vista ampliada del producto">`;
        preview.addEventListener('click', event => {
            if (event.target === preview) closeDetailImagePreview();
        });
        document.body.appendChild(preview);
    }
    document.getElementById('detail-image-preview-img').src = detailGalleryImages[detailGalleryIndex];
    preview.classList.remove('hidden');
    preview.classList.add('flex');
}

function closeDetailImagePreview() {
    const preview = document.getElementById('detail-image-preview');
    if (!preview) return;
    preview.classList.add('hidden');
    preview.classList.remove('flex');
}

function escapeDetailText(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

function renderDetailDescription(description) {
    const container = document.getElementById('detail-desc');
    if (!container) return;
    const raw = String(description || '').trim();
    if (!raw) {
        container.innerHTML = '<p class="rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">Consulta con tu asesor para conocer todas las especificaciones de este equipo.</p>';
        return;
    }
    if (/<[a-z][\s\S]*>/i.test(raw)) {
        container.innerHTML = raw;
        return;
    }

    const lines = raw.split(/\n+|[•·]\s*/).map(line => line.trim()).filter(Boolean);
    if (lines.length <= 1) {
        container.innerHTML = `<p>${escapeDetailText(raw)}</p>`;
        return;
    }
    container.innerHTML = `<ul class="grid gap-2">${lines.map(line => `
        <li class="flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <span class="material-symbols-outlined mt-0.5 text-sm text-blue-600">check_circle</span>
            <span class="min-w-0">${escapeDetailText(line)}</span>
        </li>`).join('')}</ul>`;
}

function normalizeTechnicalSheetUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let parsed;
    try { parsed = new URL(raw); } catch (error) { return ''; }
    if (parsed.protocol !== 'https:') return '';

    if (parsed.hostname === 'github.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const blobIndex = parts.indexOf('blob');
        if (blobIndex === 2 && parts.length > 4) {
            parsed = new URL(`https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts[3]}/${parts.slice(4).join('/')}`);
        }
    }
    if (!parsed.pathname.toLowerCase().endsWith('.pdf')) return '';
    return parsed.href;
}

function renderDetailTechnicalSheet(product) {
    const section = document.getElementById('detail-technical-sheet');
    const actions = document.getElementById('detail-technical-sheet-actions');
    const name = document.getElementById('detail-technical-sheet-name');
    const meta = document.getElementById('detail-technical-sheet-meta');
    if (!section || !actions || !name || !meta) return;

    const pdfUrl = normalizeTechnicalSheetUrl(product?.ficha_pdf);
    if (!pdfUrl) {
        section.classList.add('hidden');
        actions.innerHTML = '';
        return;
    }

    const internal = Boolean(localStorage.getItem('pth_session'));
    name.textContent = product.ficha_pdf_nombre || 'Ficha técnica';
    meta.textContent = `Documento PDF · ${product.ficha_pdf_idioma || 'ES'}`;
    const encodedUrl = encodeURIComponent(pdfUrl).replace(/'/g, '%27');
    const encodedProduct = encodeURIComponent(product.nombre || 'Producto').replace(/'/g, '%27');
    actions.innerHTML = internal ? `
        <button type="button" onclick="openTechnicalSheet('${encodedUrl}')" class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1a4789] text-[10px] font-black uppercase text-white shadow-sm">
            <span class="material-symbols-outlined text-lg">visibility</span> Ver ficha técnica
        </button>
        <div class="mt-2 grid grid-cols-3 gap-2">
            <button type="button" onclick="copyTechnicalSheetLink('${encodedUrl}', this)" class="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[9px] font-black text-slate-600">
                <span class="material-symbols-outlined text-base">link</span> Copiar
            </button>
            <button type="button" onclick="shareTechnicalSheetWhatsApp('${encodedUrl}', '${encodedProduct}')" class="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-[#25D366] text-[9px] font-black text-white">
                <i class="fab fa-whatsapp"></i> WhatsApp
            </button>
            <button type="button" onclick="downloadTechnicalSheet('${encodedUrl}', '${encodedProduct}', this)" class="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50 text-[9px] font-black text-blue-700">
                <span class="material-symbols-outlined text-base">download</span> Descargar
            </button>
        </div>` : `
        <button type="button" onclick="openTechnicalSheet('${encodedUrl}')" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a4789] text-xs font-black text-white shadow-md">
            <span class="material-symbols-outlined">description</span> Consultar ficha técnica
            <span class="material-symbols-outlined text-base">open_in_new</span>
        </button>`;
    section.classList.remove('hidden');
}

function openTechnicalSheet(encodedUrl) {
    const url = normalizeTechnicalSheetUrl(decodeURIComponent(encodedUrl || ''));
    if (!url) return alert('La ficha técnica no tiene un enlace válido.');
    window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyTechnicalSheetLink(encodedUrl, button) {
    const url = normalizeTechnicalSheetUrl(decodeURIComponent(encodedUrl || ''));
    if (!url) return alert('La ficha técnica no tiene un enlace válido.');
    let shareUrl = url;
    try {
        const manager = window.gestorName || 'ParaTuHogar';
        shareUrl = await getOrGenerateShortLink(manager, url);
        await navigator.clipboard.writeText(shareUrl);
        const original = button?.innerHTML;
        if (button) button.innerHTML = '<span class="material-symbols-outlined text-base">check</span> Copiado';
        setTimeout(() => { if (button && original) button.innerHTML = original; }, 1600);
    } catch (error) {
        window.prompt('Copia el enlace de la ficha técnica:', shareUrl);
    }
}

async function shareTechnicalSheetWhatsApp(encodedUrl, encodedProduct) {
    const url = normalizeTechnicalSheetUrl(decodeURIComponent(encodedUrl || ''));
    const productName = decodeURIComponent(encodedProduct || 'Producto');
    if (!url) return alert('La ficha técnica no tiene un enlace válido.');
    const shareWindow = window.open('about:blank', '_blank');
    const manager = window.gestorName || 'ParaTuHogar';
    const shortUrl = await getOrGenerateShortLink(manager, url);
    const message = `Te comparto la ficha técnica de *${productName}*:\n${shortUrl}\n\nSi tienes alguna duda, puedo ayudarte a revisar sus características.`;
    const destination = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (shareWindow) shareWindow.location.replace(destination);
    else window.location.href = destination;
}

async function downloadTechnicalSheet(encodedUrl, encodedProduct, button) {
    const url = normalizeTechnicalSheetUrl(decodeURIComponent(encodedUrl || ''));
    const productName = decodeURIComponent(encodedProduct || 'ficha-tecnica');
    if (!url) return alert('La ficha técnica no tiene un enlace válido.');
    const original = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="material-symbols-outlined animate-spin text-base">progress_activity</span>';
    }
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo descargar el PDF');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `${productName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ficha-tecnica'}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
        window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
}

function testTechnicalSheetAdmin() {
    const input = document.getElementById('p-ficha-pdf');
    const normalized = normalizeTechnicalSheetUrl(input?.value);
    if (!input?.value.trim()) return alert('Primero pega el enlace público del PDF.');
    if (!normalized) return alert('El enlace debe comenzar con https:// y terminar en .pdf.');
    input.value = normalized;
    window.open(normalized, '_blank', 'noopener,noreferrer');
}

function renderDetailRelatedProducts(product) {
    const section = document.getElementById('detail-related-section');
    const container = document.getElementById('detail-related-products');
    if (!section || !container || !product) return;

    const normalizeCategory = value => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/gi, ' ')
        .trim()
        .toUpperCase();
    const category = normalizeCategory(product.categoria);
    const currentPrice = Number(product.precio) || 0;
    const available = productosRaw.filter(item =>
        isProductCurrentlyAvailable(item) && item.nombre !== product.nombre);
    const sameCategory = available.filter(item => {
        const itemCategory = normalizeCategory(item.categoria);
        return itemCategory === category
            || (category.length > 3 && itemCategory.includes(category))
            || (itemCategory.length > 3 && category.includes(itemCategory));
    });
    const pool = sameCategory.length >= 3 ? sameCategory : [
        ...sameCategory,
        ...available.filter(item => !sameCategory.includes(item))
    ];
    const alternatives = pool
        .sort((a, b) => Math.abs((Number(a.precio) || 0) - currentPrice)
            - Math.abs((Number(b.precio) || 0) - currentPrice))
        .slice(0, 3);

    if (!alternatives.length) {
        container.innerHTML = '';
        section.classList.add('hidden');
        return;
    }

    container.innerHTML = alternatives.map(item => {
        const safeName = String(item.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
            <button onclick="openDetail('${safeName}')" class="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-md">
                <div class="aspect-square overflow-hidden bg-slate-50 p-2">
                    ${window.PTHProductImages.render(fixDriveUrl(item.thumbnail), item.nombre, 'h-full w-full object-contain transition duration-300 group-hover:scale-105')}
                </div>
                <div class="p-2">
                    <p class="line-clamp-2 min-h-[2rem] text-[10px] font-black leading-tight text-slate-700">${item.nombre}</p>
                    <p class="mt-1 truncate text-xs font-black text-[#1a4789]">${getPublicProductPrice(item)}</p>
                </div>
            </button>`;
    }).join('');
    section.classList.remove('hidden');
}

function applyDetailAudienceMode(product) {
    const internal = Boolean(localStorage.getItem('pth_session'));
    [
        'detail-client-availability',
        'detail-client-benefits',
        'detail-client-consult'
    ].forEach(id => document.getElementById(id)?.classList.toggle('hidden', internal));

    const actions = document.getElementById('detail-primary-actions');
    if (actions) {
        actions.classList.toggle('grid-cols-[0.8fr_1.2fr]', !internal);
        actions.classList.toggle('grid-cols-1', internal);
    }
    const relatedEyebrow = document.getElementById('detail-related-eyebrow');
    const relatedTitle = document.getElementById('detail-related-title');
    if (relatedEyebrow) relatedEyebrow.textContent = internal ? 'Opciones para cerrar la venta' : 'Recomendados para ti';
    if (relatedTitle) relatedTitle.textContent = internal ? 'Alternativas para ofrecer' : 'También podría interesarte';

    const updated = document.getElementById('detail-manager-updated');
    const updatedText = document.getElementById('detail-manager-updated-text');
    updated?.classList.toggle('hidden', !internal);
    updated?.classList.toggle('flex', internal);
    if (internal && updatedText) {
        const dateValue = product?.inventario_actualizado_en || product?.updated_at || product?.created_at;
        updatedText.textContent = dateValue
            ? `Producto actualizado el ${new Date(dateValue).toLocaleDateString('es-CU', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'Este producto no tiene fecha de actualización registrada';
    }
}

function renderCatalogProducts(list) {
    if (catalogLoadError) {
        showCatalogLoadError(catalogLoadError.error, catalogLoadError.reload);
        return;
    }
    const container = document.getElementById('productos-container');
    if (!container) return;
    const seller = isGestorCatalogMode();
    const isList = seller && gestorCatalogView === 'list';
    container.className = isList
        ? 'px-4 md:px-6 py-6 grid grid-cols-1 gap-3'
        : 'px-4 md:px-6 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6';

    renderGestorCatalogSummary(list.length);
    const publicResult = document.getElementById('public-catalog-result-label');
    if (publicResult && !seller) {
        const categoryLabel = activeCategory === 'TODOS' ? 'todas las categorías' : activeCategory.toLowerCase();
        publicResult.textContent = `${list.length} ${list.length === 1 ? 'equipo disponible' : 'equipos disponibles'} · ${categoryLabel}`;
    }
    if (!list.length) {
        const term = (document.getElementById('search-bar')?.value || '').trim();
        if (term.length > 3) trackSpy('BUSQUEDA_VACIA', term);
        container.innerHTML = `
            <div class="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
                <span class="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                <p class="mt-3 text-sm font-black text-slate-700">No encontramos productos con estos filtros</p>
                <button onclick="showAllAvailableCatalogProducts()" class="mt-3 text-xs font-black text-[#1a4789] hover:underline">Ver todos los disponibles</button>
            </div>`;
        return;
    }

    const visibleList = list.slice(0, catalogVisibleCount);
    const hasMoreProducts = visibleList.length < list.length;

    const productCardsHtml = visibleList.map(product => {
        const price = Number(product.precio) || 0;
        const commission = Number(product.comision) || 0;
        const safeName = String(product.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        let priceDisplay = getPublicProductPrice(product);

        if (!seller) {
            return `
                <article class="group flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-xl">
                    <a href="${getPermanentProductUrl(product)}" onclick="openProductCard(event, '${safeName}')" class="aspect-square w-full overflow-hidden bg-slate-50 p-4">
                    ${window.PTHProductImages.render(fixDriveUrl(product.thumbnail), product.nombre, 'h-full w-full object-contain transition duration-500 group-hover:scale-110')}
                    </a>
                    <div class="flex flex-1 flex-col gap-2 p-4 md:p-5">
                        <div class="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-700">
                            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Disponible
                        </div>
                        <h3 class="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-slate-800">${product.nombre}</h3>
                        <p class="text-xl font-black text-primary md:text-2xl">${priceDisplay}</p>
                        <div class="space-y-1 border-t border-slate-100 pt-2 text-[9px] font-bold text-slate-500">
                            <p class="flex items-center gap-1"><span class="material-symbols-outlined text-xs text-blue-600">verified_user</span><span class="truncate">${product.garantia || 'Garantía disponible'}</span></p>
                            <p class="flex items-center gap-1"><span class="material-symbols-outlined text-xs text-blue-600">local_shipping</span><span class="truncate">${product.mensajeria || 'Entrega coordinada'}</span></p>
                        </div>
                        <div class="mt-auto grid grid-cols-[1fr_44px] gap-2 pt-1">
                            <a href="${getPermanentProductUrl(product)}" onclick="openProductCard(event, '${safeName}')" class="flex min-h-11 items-center justify-center rounded-xl bg-primary px-2 text-xs font-extrabold text-white shadow-md transition hover:bg-[#12396f]">Ver detalles</a>
                            <button onclick="addProductFromCard('${safeName}')" class="flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-primary transition hover:bg-blue-100" title="Añadir ${safeName} al pedido" aria-label="Añadir ${safeName} al pedido">
                                <span class="material-symbols-outlined text-xl">add_shopping_cart</span>
                            </button>
                        </div>
                    </div>
                </article>`;
        }

        const unavailable = !isProductCurrentlyAvailable(product);
        const updatedAt = product.inventario_actualizado_en || product.updated_at || product.created_at;
        const updatedLabel = updatedAt ? formatRelativeCatalogTime(updatedAt) : 'Revisión pendiente';
        const cardLayout = isList ? 'md:grid md:grid-cols-[150px_1fr_250px] md:items-stretch' : 'flex flex-col';
        const imageLayout = isList ? 'aspect-[4/3] md:aspect-auto md:min-h-[180px]' : 'aspect-square';
        return `
            <article class="group overflow-hidden rounded-2xl border ${unavailable ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'} shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${cardLayout}">
                <a href="${getPermanentProductUrl(product)}" onclick="openProductCard(event, '${safeName}')" class="${imageLayout} relative w-full overflow-hidden bg-slate-50 p-4">
                    ${window.PTHProductImages.render(fixDriveUrl(product.thumbnail), product.nombre, `h-full w-full object-contain transition duration-500 group-hover:scale-105 ${unavailable ? 'grayscale opacity-60' : ''}`, isList ? 'list' : 'grid')}
                </a>
                <div class="flex min-w-0 flex-1 flex-col p-4">
                    <div class="mb-3 flex flex-wrap gap-1.5">${getCatalogProductBadges(product)}</div>
                    <h3 class="line-clamp-2 text-sm font-black leading-snug text-slate-900">${product.nombre}</h3>
                    <p class="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">${product.categoria || 'Sin categoría'}</p>
                    <div class="mt-4 grid grid-cols-2 gap-2">
                        <div class="rounded-xl bg-slate-50 p-3">
                            <span class="block text-[8px] font-black uppercase text-slate-400">Cliente paga</span>
                            <strong class="mt-1 block text-lg font-black text-[#1a4789]">${priceDisplay}</strong>
                        </div>
                        <div class="rounded-xl bg-emerald-50 p-3">
                            <span class="block text-[8px] font-black uppercase text-emerald-600">Tu ganancia</span>
                            <strong class="mt-1 block text-lg font-black text-emerald-700">$${commission}</strong>
                        </div>
                    </div>
                    <div class="mt-3 space-y-1.5 text-[10px] font-bold text-slate-500">
                        <p class="flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">verified</span><span class="truncate">${product.garantia || 'Garantía por confirmar'}</span></p>
                        <p class="flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">local_shipping</span><span class="truncate">${product.mensajeria || 'Mensajería por confirmar'}</span></p>
                        <p class="flex items-center gap-1.5 text-slate-400"><span class="material-symbols-outlined text-sm">update</span><span>${updatedLabel}</span></p>
                    </div>
                </div>
                <div class="border-t border-slate-100 bg-slate-50/80 p-3 ${isList ? 'md:flex md:flex-col md:justify-center md:border-l md:border-t-0' : ''}">
                    <div class="grid grid-cols-4 gap-1">
                        <button onclick="copyProductOffer('${safeName}', this)" class="flex min-h-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600" title="Copiar oferta"><span class="material-symbols-outlined text-xl">content_copy</span></button>
                        <button onclick="shareProductWhatsApp('${safeName}')" class="flex min-h-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-emerald-600" title="Compartir por WhatsApp"><i class="fab fa-whatsapp text-xl"></i></button>
                        <button onclick="downloadProductCardImage('${safeName}', this)" class="flex min-h-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-blue-600" title="Descargar imagen"><span class="material-symbols-outlined text-xl">download</span></button>
                        <button onclick="generateStoryForProduct('${safeName}', this)" class="flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white shadow-sm" title="Crear Story"><span class="material-symbols-outlined text-xl">auto_awesome</span></button>
                    </div>
                    <button onclick="addProductFromCard('${safeName}')" ${unavailable ? 'disabled' : ''} class="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black ${unavailable ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-[#1a4789] text-white shadow-md hover:bg-[#12396f]'}">
                        <span class="material-symbols-outlined text-lg">${unavailable ? 'block' : 'add_shopping_cart'}</span>${unavailable ? 'No disponible' : 'Añadir al pedido'}
                    </button>
                    <a href="${getPermanentProductUrl(product)}" onclick="openProductCard(event, '${safeName}')" class="mt-2 block w-full py-2 text-center text-[10px] font-black uppercase text-slate-500 hover:text-[#1a4789]">Ver información completa</a>
                </div>
            </article>`;
    }).join('');

    const loadMoreHtml = hasMoreProducts ? `
        <div class="col-span-full flex justify-center py-5">
            <button type="button" onclick="loadMoreCatalogProducts()" class="min-h-12 rounded-2xl bg-[#1a4789] px-8 text-sm font-black text-white shadow-md hover:bg-[#12396f]">
                Cargar más productos (${visibleList.length} de ${list.length})
            </button>
        </div>` : '';

    container.innerHTML = productCardsHtml + loadMoreHtml;
}

const CATALOG_PAGE_SIZE = 24;
let catalogVisibleCount = CATALOG_PAGE_SIZE;

function renderProducts() {
    if (catalogLoadError) {
        showCatalogLoadError(catalogLoadError.error, catalogLoadError.reload);
        return;
    }
    catalogVisibleCount = CATALOG_PAGE_SIZE;
    applySort();
}

function loadMoreCatalogProducts() {
    catalogVisibleCount += CATALOG_PAGE_SIZE;
    applySort();
}

    // 3. DETALLE DE PRODUCTO
    // 3. DETALLE DE PRODUCTO
 // 3. DETALLE DE PRODUCTO (CON INTERCEPTOR DE PANELES SOLARES)
// 3. DETALLE DE PRODUCTO (CON INTERCEPTORES DE B2B Y PANELES)
// 3. DETALLE DE PRODUCTO (CON INTERCEPTORES DE B2B Y PANELES + HERRAMIENTAS RESTAURADAS)
function openDetail(name, skipSolarCheck = false) {
    // === SEO DINÁMICO ===
    const nombreReal = name.replace(/&quot;/g, '"');
    selectedProduct = productosRaw.find(p => p.nombre === nombreReal);

    if(!selectedProduct) return;

    // Las rutas limpias solo pueden escribirse cuando la página se sirve por
    // HTTP(S). Chrome bloquea pushState hacia /producto/... al abrir el HTML
    // directamente mediante file:// durante las pruebas locales.
    if (window.location.protocol !== 'file:') {
        history.pushState({producto: name}, '', getPermanentProductUrl(selectedProduct));
    }
    document.title = `${nombreReal} | Comprar en Cuba - ParaTuHogar`;

    // === EJECUCIÓN NORMAL (BLOQUEOS ELIMINADOS) ===
    tiempoInicioLectura = Date.now();
    productoActualLectura = name;
    trackSpy('VIO_DETALLE', name);
    window.PTHAnalytics?.event('view_item');

    if (typeof registrarVistaAnalitica === "function") {
        registrarVistaAnalitica(selectedProduct);
    }

    const p = selectedProduct;
    const detailModal = document.getElementById('detail-modal');

    document.getElementById('detail-name').innerText = p.nombre;
    loadDetailDescription(p);

    // Badge de Ganancia
    const oldBadge = document.getElementById('admin-comm-badge');
    if(oldBadge) oldBadge.remove();

    if(typeof isAdmin !== 'undefined' && isAdmin || window.gestorName) {
        const badge = `<div id="admin-comm-badge" class="bg-emerald-500 text-white px-3 py-2 rounded-xl font-black text-[11px] mb-4 flex justify-between items-center shadow-lg shadow-emerald-500/20 uppercase italic">
            <span>Ganancia de Agente:</span>
            <span>$${p.comision || 0}.00</span>
        </div>`;
        document.getElementById('detail-name').insertAdjacentHTML('beforebegin', badge);
    }

    // PRECIOS Y DETALLES
    const detailPriceDisplay = getPublicProductPrice(p);
    document.getElementById('detail-price').innerText = detailPriceDisplay;
    const mobilePrice = document.getElementById('detail-mobile-price');
    if (mobilePrice) mobilePrice.innerText = detailPriceDisplay;
    document.getElementById('detail-cat').innerText = p.categoria || '';
    document.getElementById('detail-warranty').innerText = p.garantia || '1 Mes';
    document.getElementById('detail-shipping').innerText = p.mensajeria || 'Consultar';

    // IMÁGENES
    const thumbs = [p.thumbnail, p.image1, p.image2, p.image3].filter(url => url && url.length > 5);
    detailGalleryImages = [...new Set((thumbs.length ? thumbs : ['']).map(fixDriveUrl))];
    document.getElementById('detail-main-img').alt = p.nombre;
    document.getElementById('detail-thumbnails').innerHTML = detailGalleryImages.map((url, index) => `
        <button type="button" data-detail-thumbnail onclick="selectDetailImage(${index})" class="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 transition" aria-label="Ver imagen ${index + 1} de ${detailGalleryImages.length}">
            ${dataSavingEnabled ? `<span class="text-xs font-bold text-primary">Foto ${index + 1}</span>` : `<img src="${url}" class="h-full w-full object-contain" alt="">`}
        </button>
    `).join('');
    document.getElementById('detail-load-photo')?.remove();
    if (dataSavingEnabled) {
        const image = document.getElementById('detail-main-img'); image.removeAttribute('src');
        const button = document.createElement('button'); button.id = 'detail-load-photo'; button.type = 'button'; button.className = 'pth-photo-button'; button.textContent = 'Ver foto del producto'; button.onclick = () => selectDetailImage(0); image.after(button);
    } else selectDetailImage(0);
    renderDetailRelatedProducts(p);
    applyDetailAudienceMode(p);
    renderDetailTechnicalSheet(p);

    // --- CARGAR OPINIONES AL ABRIR EL MODAL ---
    loadProductReviews(p.id, p.nombre, p.categoria);

    // Herramientas de marketing
    const toolsContainer = document.getElementById('marketing-tools-container');
    if (toolsContainer) {
        const session = localStorage.getItem('pth_session');
        if (session) toolsContainer.classList.remove('hidden');
        else toolsContainer.classList.add('hidden');
    }

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function consultSelectedProduct() {
    if (!selectedProduct) return;
    const message = `Hola, estoy viendo *${selectedProduct.nombre}* en ParaTuHogar y quisiera confirmar disponibilidad, entrega y garantía.`;
    contactarGestorAtribuido(message);
}

    // 4. CARRITO Y PAGOS
   function addItemToCart() {
    // === NUEVO: LÓGICA DE BLOQUEO B2B ===
    const catActual = (selectedProduct.categoria || "").toUpperCase();
    const esB2B = catActual.includes('MAYORISTA') || catActual.includes('B2B') || catActual.includes('MIPYME');

    if (cart.length > 0) {
        const cartTieneB2B = cart.some(item => (item.categoria || "").toUpperCase().includes('MAYORISTA') || (item.categoria || "").toUpperCase().includes('B2B') || (item.categoria || "").toUpperCase().includes('MIPYME'));

        if (esB2B && !cartTieneB2B) {
            return alert("⛔ No puedes agregar un Lote Mayorista si ya tienes productos normales en el carrito. Vacía el carrito primero.");
        }
        if (!esB2B && cartTieneB2B) {
            return alert("⛔ No puedes agregar productos normales a un pedido Mayorista. Vacía el carrito primero.");
        }
    }
    // ====================================

    const existing = cart.find(item => item.nombre === selectedProduct.nombre);

    let defaultShipping = 0;
    if(selectedProduct.mensajeria && !isNaN(parseFloat(selectedProduct.mensajeria))) {
        defaultShipping = parseFloat(selectedProduct.mensajeria);
    }

    if(existing) {
        existing.qty++;
        existing.shipping_linea += defaultShipping;
    } else {
        cart.push({
            ...selectedProduct,
            qty: 1,
            precio_venta: Number(selectedProduct.precio),
            comision_actual: Number(selectedProduct.comision || 0),
            comision_original_pool: Number(selectedProduct.comision_original_pool || selectedProduct.comision || 0),
            comision_original_pool_base: Number(selectedProduct.comision_original_pool || selectedProduct.comision || 0),
            shipping_linea: defaultShipping,
            cup_extra: selectedProduct.cup_extra || 0
        });
        if (typeof captureGhostLead === "function") {
            captureGhostLead();
        }
    }

    document.getElementById('cart-count').innerText = cart.reduce((acc, item) => acc + item.qty, 0);
    window.PTHAnalytics?.event('add_to_cart');
    closeDetail();
    toggleCartModal(true);

    setTimeout(() => {
        const crmSearch = document.getElementById('crm-search');
        if(crmSearch) crmSearch.focus();
    }, 100);
}

// --- AÑADE ESTA FUNCIÓN NUEVA DEBAJO DE addItemToCart ---
function updateLineShipping(index, value) {
    const val = parseFloat(value);
    if(isNaN(val) || val < 0) return;
    cart[index].shipping_linea = val;
    recalcularTotalFinal(); // Actualiza los totales visuales
}

function renderCart() {
    persistNewCartDraft();
    const container = document.getElementById('cart-items');
    const isGestor = window.gestorName ? true : false;

    // 1. Renderizar Productos
    let htmlItems = cart.map((item, index) => {
        // El checkout respeta siempre el precio publicado/configurado. Los
        // cambios se realizan en “Mis precios”, nunca pedido por pedido.
        const precioInput = `<p class="text-primary font-black text-sm mb-1">$${item.precio_venta}</p>`;

        // --- NUEVO: Lógica del botón de consulta (Solo para clientes) ---
        let botonConsultar = '';


        // Input de Mensajería (Tu lógica original + El botón nuevo debajo)
        // Input de Mensajería eliminado de cada línea porque ahora es Global
        const shippingInput = botonConsultar ? `<div class="mt-2">${botonConsultar}</div>` : '';

        // Tu lógica de colores de ganancia intacta
        let colorGanancia = "text-emerald-500";
        if(item.comision_actual < item.comision) colorGanancia = "text-orange-500";
        if(item.comision_actual > item.comision) colorGanancia = "text-blue-600";

        const gananciaDisplay = isGestor ?
            `<p class="text-[9px] font-bold ${colorGanancia} text-right">
                Gan: $${(item.comision_actual * item.qty).toFixed(0)}
             </p>` : '';

        // Estructura HTML (Idéntica a la tuya)
        return `
        <div class="flex gap-2 bg-white dark:bg-gray-800 p-3 rounded-xl relative border border-gray-100 dark:border-gray-700 mb-3 shadow-sm">
            <div class="w-16 h-16 shrink-0">${window.PTHProductImages.render(fixDriveUrl(item.thumbnail), item.nombre, 'w-16 h-16 object-contain bg-gray-50 rounded border border-gray-200', 'list')}</div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <h4 class="text-xs font-bold leading-tight pr-6 mb-1 truncate w-full" title="${item.nombre}">${item.nombre}</h4>
                    <button onclick="removeFromCart(${index})" class="text-gray-300 hover:text-red-500 p-0.5 absolute top-2 right-2"><span class="material-symbols-outlined text-sm">close</span></button>
                </div>

                <div class="flex justify-between items-end mt-1">
                    <!-- Control Cantidad -->
                    <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 px-1 h-6">
                        <button onclick="changeQty(${index}, -1)" class="w-5 flex items-center justify-center text-gray-500 font-bold text-xs">-</button>
                        <span class="text-xs font-black min-w-[15px] text-center">${item.qty}</span>
                        <button onclick="changeQty(${index}, 1)" class="w-5 flex items-center justify-center text-gray-500 font-bold text-xs">+</button>
                    </div>

                    <!-- Columna Precios -->
                    <div class="flex flex-col items-end">
                        <div class="flex flex-col items-end">
                           ${isGestor ? `<label class="text-[8px] text-gray-400 font-bold uppercase">Precio Unit.</label>` : ''}
                           ${precioInput}
                        </div>
                        ${shippingInput}
                        ${gananciaDisplay}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = htmlItems;
    recalcularTotalFinal();
    // === NUEVO: OCULTAR MENSAJERÍA SI ES B2B ===
    const isB2BOrder = cart.some(item => (item.categoria || "").toUpperCase().includes('MAYORISTA') || (item.categoria || "").toUpperCase().includes('B2B') || (item.categoria || "").toUpperCase().includes('MIPYME'));

    const checkRecogida = document.getElementById('check-recogida');
    const containerRecogida = checkRecogida ? checkRecogida.parentElement : null;
    const containerDireccion = document.getElementById('check-dir') ? document.getElementById('check-dir').parentElement : null;

    if(isB2BOrder && checkRecogida) {
        // Forzar recogida en almacén y ocultar opciones
        checkRecogida.checked = true;
        toggleRecogidaEnAlmacen();
        if(containerRecogida) containerRecogida.style.display = 'none';
        if(containerDireccion) containerDireccion.style.display = 'none';
        document.getElementById('check-dir').value = "Almacén Inbond (Mayorista B2B)";
    } else if (checkRecogida) {
        // Restaurar si es cliente normal
        if(containerRecogida) containerRecogida.style.display = 'flex';
        if(containerDireccion) containerDireccion.style.display = 'block';
    }
    // ============================================
}

// Función para sumar o restar cantidad
function changeQty(index, delta) {
    const item = cart[index];
    item.qty += delta;

    // Si baja de 1, preguntar si eliminar
    if (item.qty < 1) {
        if(confirm("¿Eliminar este producto?")) {
            cart.splice(index, 1);
        } else {
            item.qty = 1; // Restaurar a 1 si dice que no
        }
    }

    // Actualizar contador rojo
    document.getElementById('cart-count').innerText = cart.reduce((acc, item) => acc + item.qty, 0);

    // Volver a dibujar el carrito
    renderCart();
    // NUEVO: Cada vez que añada algo, actualizamos el Radar si ya puso su teléfono
    if (typeof captureGhostLead === "function") {
        captureGhostLead();
    }

}

    function recalcularTotalFinal() {
    const totalEquipos = cart.reduce((acc, item) => acc + (item.precio_venta * item.qty), 0);
    const costoEnvio = obtenerCostoMensajeriaGlobal();
    const totalUSD = totalEquipos + costoEnvio;

    // Actualizar cajas nuevas
    if(document.getElementById('resumen-equipos')) document.getElementById('resumen-equipos').innerText = `$${totalEquipos.toLocaleString()}`;
    if(document.getElementById('resumen-envio')) document.getElementById('resumen-envio').innerText = costoEnvio === 0 ? "GRATIS" : `$${costoEnvio.toLocaleString()}`;

    const elTotal = document.getElementById('total-convertido');
    if(elTotal) elTotal.innerText = `$${totalUSD.toLocaleString()}`;
}




function buildSubgestorWhatsappSummary(orderSubgestor, assignedCommission) {
    const parentName = String(orderSubgestor?.parent?.nombre || 'No asignado').trim();
    const subgestorName = String(orderSubgestor?.agent?.nombre || 'No asignado').trim();
    const commission = Number(assignedCommission) || 0;

    return `\n------------------------------------\n👮‍♂️ *DATOS INTERNOS*\nComercial: ${parentName}\nSubgestor: ${subgestorName}\nComisión asignada al subgestor: $${commission}\n`;
}

function getCheckoutFailureMessage(error) {
    switch (error?.code) {
        case 'SELLER_IDENTITY_AMBIGUOUS':
            return 'El enlace de atención necesita revisión. Pide al contacto que te lo envió que lo revise antes de confirmar. Tus datos siguen en esta pantalla.';
        case 'SELLER_NOT_FOUND':
            return 'No encontramos la cuenta de atención de este enlace. Pide al contacto que te lo envió un enlace actualizado. Tus datos siguen en esta pantalla.';
        case 'SESSION_INVALID':
        case 'SESSION_CHANGED':
            return 'Tu sesión venció o cambió. Vuelve a iniciar sesión antes de confirmar el pedido. Tus datos siguen en esta pantalla.';
        case 'ORDER_OUTCOME_UNKNOWN':
            return 'Se perdió la confirmación del servidor. Todavía no sabemos si el pedido llegó. No cierres esta pestaña: cuando tengas conexión, pulsa Confirmar Pedido para comprobar el recibo antes de reintentar.';
        case 'ATTEMPT_EXPIRED':
            return 'Este intento venció. Revisa si el pedido llegó antes de iniciar otro; no se reenviará automáticamente.';
        case 'PAYLOAD_CHANGED':
            return 'Cambiaste datos de un intento pendiente. Conserva los datos originales y comprueba su recibo antes de iniciar otro pedido.';
        case 'CONDITIONS_CHANGED':
            return 'Cambió el precio o la entrega. Comprueba el carrito y confirma nuevamente; todavía no se confirmó este envío.';
        case 'DELIVERY_UNAVAILABLE':
            return 'No se pudo verificar una tarifa de entrega para esta localidad. Revisa la localidad y vuelve a comprobar.';
        case 'PRODUCT_UNAVAILABLE':
            return 'Un producto cambió o dejó de estar disponible. Actualiza el catálogo y revisa el carrito.';
        default:
            return '❌ No pudimos completar el pedido. No cierres esta pantalla y vuelve a intentarlo. Si el problema continúa, informa al administrador.';
    }
}

    // 5. ENVÍO DE PEDIDO (FORMATO EXACTO FOTO CON BRAZOS 💪)
// 5. ENVÍO DE PEDIDO (Lógica de visibilidad Gestor vs Cliente)
// 5. ENVÍO DE PEDIDO (ACTUALIZADO CON CAMPO NOTAS)
    // 5. ENVÍO DE PEDIDO (CON CANDADO DE SEGURIDAD PARA ENVÍO $0)
    const checkoutStorage = (() => {
        try { return window.sessionStorage; } catch (_) { return null; }
    })();
    const checkoutScope = () => window.PTHSecureData.accountId?.() || 'visitor';
    const checkoutTokenKey = () => 'pth_checkout_submission_token' + (checkoutScope() === 'visitor' ? '' : ':' + checkoutScope());
    const checkoutSubmitGuard = window.PTHCheckoutSubmitGuard.createCheckoutSubmitGuard(checkoutStorage, checkoutTokenKey);
    const checkoutOutcomes = new Map();
    function readNewCheckoutOutcome() {
        const key = checkoutTokenKey() + ':outcome';
        try { return JSON.parse(checkoutStorage?.getItem(key) || 'null') || checkoutOutcomes.get(key) || null; }
        catch (_) { return checkoutOutcomes.get(key) || null; }
    }
    function markNewCheckoutOutcome(value) {
        const key = checkoutTokenKey() + ':outcome'; checkoutOutcomes.set(key,value);
        try { checkoutStorage?.setItem(key,JSON.stringify(value)); } catch (_) {}
    }
    function clearNewCheckoutOutcome() {
        const key = checkoutTokenKey() + ':outcome'; checkoutOutcomes.delete(key);
        try { checkoutStorage?.removeItem(key); } catch (_) {}
    }
    async function checkNewCheckoutOutcome(outcome) {
        if (outcome.attempt) {
            const result = await window.PTHSecureData.checkout({operation:'receipt',attempt:outcome.attempt});
            if (result.error) throw result.error;
            return {kind:result.data.complete?'confirmed':result.data.confirmed.length?'partial':'absent',receipts:result.data.confirmed.map(row=>({orden_dia:row.reference,proveedor:row.proveedor}))};
        }
        return window.PTHCheckoutRecovery.check({
            authenticated: checkoutScope() !== 'visitor', table: outcome.table, token: outcome.token, providers: outcome.providers, codes: outcome.codes,
            // Gateway forbids filtering token columns. Exact new references use
            // existing scope; compare the attempt key locally, never widen it.
            query: (table,token,codes) => supabaseClient.from(table).select('id,proveedor,submission_token,orden_dia').in('orden_dia',codes)
        });
    }

document.getElementById('checkout-form').onsubmit = async function(e) {
    e.preventDefault();
    window.PTHAnalytics?.event('begin_checkout');

    // Debe ejecutarse antes del primer await. Así un doble clic o un reintento
    // mientras carga la red no inicia dos flujos de inserción simultáneos.
    const submissionAttempt = checkoutSubmitGuard.acquire();
    if (!submissionAttempt.accepted) {
        alert('⏳ Este pedido ya se está procesando. Espera la confirmación.');
        return;
    }
    const submissionToken = submissionAttempt.token;
    const submissionOwner = checkoutScope();
    const submissionSession = window.PTHSecureData.token();
    let checkoutFinished = false;
    let btn = null;

    try {
    if (typeof lowConnectivity !== 'undefined' && lowConnectivity.wasSent(newCartOwner,newCartRevision)) {
        alert('Este carrito ya fue confirmado en otra pestaña. Revisa tus pedidos antes de iniciar otra venta.'); return;
    }
    if (!cart.length) { alert('Añade productos al carrito antes de confirmar.'); return; }
    if (window.navigator?.onLine === false) {
        alert('No hay conexión. El carrito sigue en este dispositivo; el pedido todavía no se ha enviado. Vuelve cuando tengas datos y pulsa Confirmar Pedido.');
        return;
    }
    const previousOutcome = readNewCheckoutOutcome();
    if (previousOutcome) {
        const outcome = await checkNewCheckoutOutcome(previousOutcome);
        if (outcome.kind === 'confirmed') {
            alert('El servidor confirmó este envío: ' + outcome.receipts.map(row => row.orden_dia || row.id).join(', ') + '. No se creó otro pedido.');
            clearNewCheckoutOutcome(); checkoutSubmitGuard.succeed(); checkoutFinished = true;
            lowConnectivity.markSent(newCartOwner,newCartRevision);
            cart = []; lowConnectivity.clearDraft(newCartOwner); newCartRevision = null; document.getElementById('cart-count').textContent = '0'; toggleCartModal(false); return;
        }
        if (!['absent','partial'].includes(outcome.kind)) throw Object.assign(new Error('Unconfirmed outcome'),{code:'ORDER_OUTCOME_UNKNOWN'});
        if (previousOutcome.products !== window.PTHLowConnectivity.fingerprint(cart)) {
            alert('El carrito cambió durante el envío. Primero revisa el intento anterior antes de confirmar otro carrito.'); return;
        }
    }

    // === NUEVO: SABER SI ES RECOGIDA EN ALMACÉN ===
    const isRecogida = document.getElementById('check-recogida') ? document.getElementById('check-recogida').checked : false;

    // === VERIFICACIÓN DE DISPONIBILIDAD EN TIEMPO REAL (ESCUDO ANTI-CACHÉ) ===
    let verifiedCheckoutProducts;
    try {
        const idsEnCarrito = cart.map(item => item.id);
        const { data: dbProducts, error: dbError } = await supabaseClient
            .from('productos')
            .select('id,nombre,disponible,precio,comision,precio_flexible,proveedor,garantia,mensajeria')
            .in('id', idsEnCarrito);

        if (dbError || !Array.isArray(dbProducts)) throw Object.assign(new Error('Inventory unavailable'),{code:'NETWORK_ERROR'});
        verifiedCheckoutProducts = dbProducts;
        if (dbProducts) {
            const noDisponibles = [];
            cart.forEach(cartItem => {
                const dbProd = dbProducts.find(p => p.id === cartItem.id);
                // Si el producto no existe en la DB o su estado disponible no es "SI"
                if (!dbProd || !isProductCurrentlyAvailable(dbProd)) {
                    noDisponibles.push(cartItem.nombre);
                }
            });

            if (noDisponibles.length > 0) {
                alert(`⚠️ PEDIDO DETENIDO POR INVENTARIO:\n\nLos siguientes productos ya no se encuentran disponibles:\n\n• ${noDisponibles.join('\n• ')}\n\nPor favor, actualice la página para refrescar el catálogo.`);

                const btnF = document.getElementById('final-submit-btn');
                if (btnF) {
                    btnF.disabled = false;
                    btnF.innerText = "Confirmar Pedido";
                }
                return; // Detiene la ejecución e impide que se guarde el pedido o se envíe el WhatsApp
            }
        }
    } catch (errCheck) {
        throw errCheck;
    }
    // =======================================================================

    // === 1. NUEVO: VALIDAR LOCALIDAD ===
    const selectLocalidad = document.getElementById('check-localidad');
    // Si es recogida, forzamos texto. Si no, tomamos el del select
    const localidadC = isRecogida ? "Centro de Entrega" : (selectLocalidad ? selectLocalidad.value : "");

    // Solo validamos que no esté vacío si NO es recogida
    if (!isRecogida && (!localidadC || localidadC === "")) {
        alert("⚠️ Por favor, selecciona una Localidad/Reparto antes de confirmar el pedido.");
        return;
    }

    // === 2. NUEVO: CÁLCULO GLOBAL DE ENVÍO ===
    const envioTotalGlobal = typeof obtenerCostoMensajeriaGlobal === 'function' ? obtenerCostoMensajeriaGlobal() : 0;

    // Solo alertamos de envío $0 si NO es recogida en almacén
    if (!isRecogida && envioTotalGlobal === 0) {
        const confirmarGratis = confirm("⚠️ ¡ATENCIÓN: ENVÍO $0! ⚠️\n\nEl costo de mensajería para esta zona está en $0.\n\n¿Estás seguro de procesar el pedido sin cobrar envío?\n\n[Aceptar] = Sí, es correcto. Enviar.\n[Cancelar] = ¡Me olvidé! Volver para corregir.");
        if (!confirmarGratis) return;
    }

    // Un producto sin garantía no puede llegar a la inserción del pedido. La base
    // de datos necesita una duración válida para conservar la cobertura vendida.
    const productosSinGarantia = cart.filter(item => !String(item.garantia || '').trim());
    if (productosSinGarantia.length > 0) {
        alert(`⚠️ PEDIDO DETENIDO POR DATOS INCOMPLETOS:\n\nFalta configurar la garantía de:\n\n• ${productosSinGarantia.map(item => item.nombre).join('\n• ')}\n\nUn administrador debe completar la garantía del producto antes de venderlo.`);
        return;
    }

    btn = document.getElementById('final-submit-btn');
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";

    const session = localStorage.getItem('pth_session');
    const isLogged = !!session;


    // === CAPTURA DE DATOS DEL FORMULARIO ===
    const nombreC = document.getElementById('check-nombre').value;
    const ciC = document.getElementById('check-ci').value || "No especificado";
    const telC = document.getElementById('check-tel').value;

    // 👇 INICIO DEL ESCUDO PROTECTOR (LISTA NEGRA) 👇
    const telLimpioCheck = telC.replace(/\D/g, '');
    const blacklistCandidates = new Set([telLimpioCheck]);

    // Compatibilidad con registros cubanos antiguos (8 dígitos) y nuevos (+53).
    if (telLimpioCheck.startsWith('53') && telLimpioCheck.length === 10) {
        blacklistCandidates.add(telLimpioCheck.substring(2));
    } else if (telLimpioCheck.length === 8) {
        blacklistCandidates.add('53' + telLimpioCheck);
    }

    const { data: blockedMatches, error: blacklistError } = await supabaseClient
        .from('blacklist')
        .select('tipo, motivo, telefono')
        .in('telefono', [...blacklistCandidates])
        .limit(1);

    if (blacklistError) {
        alert('⚠️ No pudimos verificar el teléfono en el Radar de Riesgos. Por seguridad, intenta confirmar el pedido nuevamente.');
        btn.disabled = false;
        btn.innerText = 'Confirmar Pedido';
        return;
    }

    const isBlocked = blockedMatches?.[0];

    if (isBlocked) {
        alert(`🚨 ALERTA DE SEGURIDAD 🚨\n\nEste número de teléfono está registrado en nuestra base de datos como Cliente ${isBlocked.tipo.toUpperCase()}.\n\nMotivo del reporte: ${isBlocked.motivo}\n\nPor seguridad del equipo, este pedido no puede ser procesado.`);

        const btnF = document.getElementById('final-submit-btn');
        btnF.disabled = false;
        btnF.innerText = "Confirmar Pedido";
        return; // 🛑 ESTO DETIENE LA COMPRA TOTALMENTE
    }
    // 👆 FIN DEL ESCUDO PROTECTOR 👆

    // Si marcó recogida, sobrescribimos Municipio y Dirección automáticamente
    const municipioC = isRecogida ? "Almacén" : document.getElementById('check-municipio').value;
    const dirC = isRecogida ? "Recogida presencial en almacén" : document.getElementById('check-dir').value;

    const notasInput = document.getElementById('check-notas');
    const notasC = notasInput ? notasInput.value.trim() : "";

    const valVuelto = document.getElementById('check-vuelto').value;
    const metodoPagoSeleccionado = document.getElementById('check-moneda-pago').value;
    const vueltoC = (valVuelto && valVuelto > 0) ? `${valVuelto}` : "no";

    // EL CEREBRO: DETECTAR QUIÉN SE LLEVA LA COMISIÓN
    let activeGestor = await obtenerDuenoReal(telC);
    const checkoutHierarchy = await resolveSalesHierarchy(activeGestor);
    const orderSubgestor = checkoutHierarchy?.isSubgestor ? checkoutHierarchy : null;

    // Revalidar precios contra Supabase antes de guardar. Esto bloquea carritos
    // antiguos, cachés desactualizadas o cualquier edición manual del HTML.
    const cartProductIds = [...new Set(cart.map(item => item.id).filter(Boolean))];
    const checkoutBaseProducts = verifiedCheckoutProducts;
    if (!checkoutBaseProducts) {
        throw new Error('No se pudieron validar los precios vigentes del pedido.');
    }

    let checkoutCustomPrices = [];
    const pricingOwner = checkoutHierarchy?.pricingOwnerName;
    if (pricingOwner) {
        const { data: customRows, error: customRowsError } = await supabaseClient
            .from('precios_personalizados')
            .select('producto_id, nuevo_precio, comision_subgestor')
            .eq('gestor', pricingOwner)
            .in('producto_id', cartProductIds);
        if (customRowsError) throw customRowsError;
        checkoutCustomPrices = customRows || [];
    }

    const priceMismatches = [];
    cart.forEach(item => {
        const base = checkoutBaseProducts.find(product => product.id === item.id);
        if (!base) {
            priceMismatches.push(item.nombre);
            return;
        }
        for (const field of ['proveedor','garantia','mensajeria']) {
            if (base[field] !== undefined && String(item[field] || '') !== String(base[field] || '')) {
                priceMismatches.push(`${item.nombre}: cambió ${field === 'proveedor' ? 'la entrega' : field === 'garantia' ? 'la garantía' : 'el envío'}`);
                item[field] = base[field];
            }
        }
        const custom = checkoutCustomPrices.find(row => row.producto_id === item.id);
        const basePrice = Number(base.precio) || 0;
        const customPrice = Number(custom?.nuevo_precio);
        const expectedPrice = base.precio_flexible === 'SI' && Number.isFinite(customPrice) && customPrice >= basePrice
            ? customPrice
            : basePrice;
        const expectedPoolCommission = (Number(base.comision) || 0) + (expectedPrice - basePrice);
        const expectedSellerCommission = orderSubgestor
            ? (Number(custom?.comision_subgestor) || 0)
            : expectedPoolCommission;

        if (Math.abs(Number(item.precio_venta) - expectedPrice) > 0.001) {
            priceMismatches.push(`${item.nombre}: $${item.precio_venta} → $${expectedPrice}`);
            item.precio = expectedPrice;
            item.precio_venta = expectedPrice;
        }
        item.comision = expectedSellerCommission;
        item.comision_actual = expectedSellerCommission;
        item.comision_original_pool = expectedPoolCommission;
        item.comision_original_pool_base = expectedPoolCommission;
    });

    if (priceMismatches.length > 0) {
        renderCart();
        alert(`⚠️ CAMBIARON LAS CONDICIONES DEL CARRITO:\n\n• ${priceMismatches.join('\n• ')}\n\nEl carrito fue actualizado. Revisa el total, la entrega y la garantía; confirma nuevamente.`);
        return;
    }

    // --- CORRECCIÓN ENRUTAMIENTO DE WHATSAPP ---
    const PHONE_DUENO_TIENDA = "5356071095";
    let whatsappDestino = PHONE_DUENO_TIENDA;

    if (orderSubgestor?.parent?.telefono) {
        // Tanto el pedido manual como el realizado desde el enlace de un
        // subgestor se comunican exclusivamente con su gestor principal.
        let parentTel = orderSubgestor.parent.telefono.replace(/\D/g, '');
        if (parentTel.length === 8) parentTel = "53" + parentTel;
        whatsappDestino = parentTel;
        console.log("➡️ Pedido de subgestor enrutado a su Gestor Principal:", parentTel);
    } else if (isLogged) {
        // 2. Si es un Gestor Principal logueado, va al dueño de la tienda
        whatsappDestino = PHONE_DUENO_TIENDA;
    } else {
        // 3. Si es un cliente final comprando por el link de la tienda
        if (activeGestor !== "Venta Directa") {
            if (checkoutHierarchy?.agent?.telefono) {
                    let w = checkoutHierarchy.agent.telefono.replace(/\D/g, '');
                    if (w.length === 8) w = "53" + w;
                    whatsappDestino = w;
            }
        }
    }

    // ... (El resto de tu código de la línea: // LÓGICA DE BINDEO (MODO DIOS) hacia abajo se queda exactamente igual)

    // La protección se actualiza únicamente después de guardar el pedido.
    // Así, quien realiza el cierre completo recibe la comisión y la nueva ventana.

    let origenPedido = "Directo/Web";
    if (isLogged) {
        origenPedido = "Manual (Panel)";
    } else if (activeGestor !== "Venta Directa") {
        origenPedido = "Enlace Compartido";
    }

    // AGRUPAR CARRITO
    const gruposPorProveedor = cart.reduce((acc, item) => {
        const prov = item.proveedor || 'General';
        if (!acc[prov]) acc[prov] = [];
        acc[prov].push(item);
        return acc;
    }, {});

    let mensajeRaw = "";
    const promesas = [];
    const protectionOrderIds = [];
    const agentPhone = getAgentPhone();

    // Bandera para asignar el envío global SOLO a un vale (por si hay múltiples proveedores)
    let envioYaCobrado = false;

    if (checkoutScope() !== submissionOwner) throw Object.assign(new Error('Session changed'),{code:'SESSION_CHANGED'});

    // GENERAR VALES Y MENSAJE
    for (const [prov, productos] of Object.entries(gruposPorProveedor)) {

        let codPedido = "";
        try {
            // El consecutivo se reserva en Supabase con bloqueo transaccional.
            // Así nunca depende de una lectura parcial del navegador ni de los últimos 20 pedidos.
            const { data: consecutivo, error: errConsecutivo } = await supabaseClient
                .rpc('reservar_consecutivo_pedido', { p_proveedor: prov });

            if (errConsecutivo || !consecutivo) {
                throw errConsecutivo || new Error('Supabase no devolvió un consecutivo');
            }

            codPedido = String(consecutivo).trim();
        } catch (e) {
            console.error('No se pudo reservar el consecutivo del pedido:', e);
            alert('❌ No se pudo reservar el consecutivo del pedido. No se envió a WhatsApp ni se guardó un código temporal. Vuelve a intentarlo.');
            throw e;
        }
        protectionOrderIds.push(codPedido);

        let detalleCuerpo = "";
        let subtotalProductos = 0;
        let comisionTotalVale = 0; // Guardará la comisión configurada para el subgestor ($3)
        let comisionOriginalPoolVale = 0; // Guardará la comisión total del producto en la tienda ($5)

        // Asignación inteligente del costo de envío
        let envioTotalVale = 0;
        if (!envioYaCobrado) {
            envioTotalVale = envioTotalGlobal;
            envioYaCobrado = true;
        }

        productos.forEach(item => {
            const costoEquipo = Number(item.precio_venta) * Number(item.qty);
            subtotalProductos += costoEquipo;

            if (activeGestor !== "Venta Directa") {
                comisionTotalVale += (item.comision_actual * item.qty);
                comisionOriginalPoolVale += ((item.comision_original_pool || item.comision_actual) * item.qty);
            }

            // Ya no mostramos el envío individual aquí, solo el equipo
            detalleCuerpo += `📦 ${item.qty}x ${item.nombre}\n💵 Equipo: $${item.precio_venta}\n`;
        });

        let totalUSDVale = subtotalProductos + envioTotalVale;

        // CONSTRUCCIÓN DEL MENSAJE DE WHATSAPP (Añadido Reparto)
        mensajeRaw += `🧾 *NUEVO PEDIDO #${codPedido}*\n📅 Fecha: ${new Date().toLocaleDateString()}\n\n`;
        mensajeRaw += `👤 *CLIENTE*\nNombre: ${nombreC}\nTel: ${telC}\nDirección: ${dirC}\n📍 Zona: ${localidadC}, ${municipioC}\n${ciC !== "No especificado" ? "CI: "+ciC : ""}\n\n`;

        if (notasC) {
            mensajeRaw += `📝 *NOTAS / OBSERVACIONES:*\n${notasC}\n\n`;
        }

        mensajeRaw += `🛒 *DETALLE*\n${detalleCuerpo}\n`;
        mensajeRaw += `💰 *TOTAL A PAGAR: $${totalUSDVale} USD*\n(Equipos: $${subtotalProductos} + Envío: $${envioTotalVale})\n`;
        mensajeRaw += `💳 *MÉTODO PAGO:* ${metodoPagoSeleccionado}\n`;

        if(vueltoC !== "no") mensajeRaw += `⚠️ *OJO VUELTO:* Necesita vuelto de $${vueltoC}\n`;

        if (orderSubgestor && isLogged) {
            mensajeRaw += buildSubgestorWhatsappSummary(orderSubgestor, comisionTotalVale);
        } else if (isLogged) {
            mensajeRaw += `\n------------------------------------\n👮‍♂️ *DATOS INTERNOS*\nComercial: ${activeGestor}\nComisión: $${comisionTotalVale}\nTel Comercial: ${agentPhone}\n`;
        }

        mensajeRaw += `\n------------------------------------\n\n`;

        // GUARDAR EN BASE DE DATOS (Incluyendo Localidad)

        // ANIDAMOS EL MÉTODO DE PAGO Y VUELTO EN LAS NOTAS PARA PODER EXTRAERLO DESPUÉS EN EL REENVÍO
        let notasExtended = notasC;
        if (metodoPagoSeleccionado) notasExtended += (notasExtended ? ` ` : ``) + `[PAGO: ${metodoPagoSeleccionado}]`;
        if (vueltoC !== "no") notasExtended += (notasExtended ? ` ` : ``) + `[VUELTO: ${vueltoC}]`;

        const direccionFinalDB = notasExtended ? `${dirC} (${localidadC}) [NOTA: ${notasExtended}]` : `${dirC} (${localidadC})`;
        const garantiasDelVale = productos.map(item => ({
            nombre: item.nombre,
            garantia: String(item.garantia || 'Por confirmar').trim()
        }));
        const garantiaVentaVale = garantiasDelVale
            .map(item => `${item.nombre}: ${item.garantia}`)
            .join(' | ');
        const garantiasUnicas = [...new Set(garantiasDelVale.map(item => item.garantia))];
        const garantiaDiasVale = garantiasUnicas.length === 1 ? parseWarrantyDays(garantiasUnicas[0]) : null;

        // --- INTERCEPTOR DE ÓRDENES DE SUBGESTORES ---
        let insertPromise;

        if (orderSubgestor) {
            // El pedido va a la cola de aprobación del Gestor Principal
            insertPromise = {
                _lineas: productos.map(p => ({ producto_id: p.id, cantidad: p.qty })),
                subgestor_id: orderSubgestor.agent.id,
                subgestor_nombre: orderSubgestor.agent.nombre,
                parent_gestor_id: orderSubgestor.parent.id,
                parent_gestor_nombre: orderSubgestor.parent.nombre,
                cliente: nombreC,
                telefono: telC,
                ci: ciC,
                direccion: direccionFinalDB,
                municipio: municipioC,
                producto: productos.map(p => `${p.qty}x ${p.nombre} [USD]`).join(' + '),
                total: totalUSDVale,
                costo_mensajeria: envioTotalVale,
                comision_total: comisionOriginalPoolVale, // <-- Guardamos la comisión completa original de la tienda ($5)
                comision_subgestor: comisionTotalVale,   // <-- Guardamos la comisión del subgestor por separado ($3)
                orden_dia: codPedido,                     // <-- Guardamos el consecutivo generado para que no se pierda
                proveedor: prov,
                garantia_venta: garantiaVentaVale,
                garantia_dias: garantiaDiasVale,
                submission_token: submissionToken
            };
        } else {
            // Pedido normal (va directo al Almacén Central)
            insertPromise = {
                _lineas: productos.map(p => ({ producto_id: p.id, cantidad: p.qty })),
                gestor: activeGestor,
                cliente: nombreC,
                ci: ciC,
                telefono: telC,
                direccion: direccionFinalDB,
                municipio: municipioC,
                producto: productos.map(p => `${p.qty}x ${p.nombre} [USD]`).join(' + '),
                total: totalUSDVale,
                costo_mensajeria: envioTotalVale,
                comision_total: comisionTotalVale,
                estado: 'Pendiente',
                pago_gestor: 'Pendiente',
                proveedor: prov,
                orden_dia: codPedido,
                origen: origenPedido,
                garantia_venta: garantiaVentaVale,
                garantia_dias: garantiaDiasVale,
                submission_token: submissionToken
            };
        }
        if (checkoutScope() !== submissionOwner) throw Object.assign(new Error('Session changed'),{code:'SESSION_CHANGED'});
        promesas.push(insertPromise);
    }

    const draft = lowConnectivity.readDraft(newCartOwner);
    if (!volatileCheckoutIntent || volatileCheckoutIntent.owner !== submissionOwner || volatileCheckoutIntent.products !== window.PTHLowConnectivity.fingerprint(cart)) {
        volatileCheckoutIntent = { owner: submissionOwner, products: window.PTHLowConnectivity.fingerprint(cart), intentId: Array.from(crypto.getRandomValues(new Uint8Array(32)),v => v.toString(16).padStart(2,'0')).join(''), savedAt: Date.now() };
    }
    const intent = draft || volatileCheckoutIntent;
    const request = { table: orderSubgestor ? 'pedidos_subgestores' : 'pedidos', inputs: promesas, delivery: { pickup: isRecogida, municipio: municipioC, localidad: localidadC }, intentId: intent.intentId, intentCreatedAt: intent.savedAt, attempt: previousOutcome?.attempt };
    const quote = await window.PTHSecureData.checkout({ ...request, operation: 'quote' });
    if (quote.error) throw quote.error;
    if (checkoutScope() !== submissionOwner) throw Object.assign(new Error('Session changed'),{code:'SESSION_CHANGED'});
    if (quote.data.complete) {
        alert('El servidor ya confirmó este envío: ' + quote.data.confirmed.map(row => row.reference).join(', ') + '. No se creó otro pedido.');
        clearNewCheckoutOutcome(); checkoutSubmitGuard.succeed(); checkoutFinished = true; lowConnectivity.markSent(newCartOwner,newCartRevision); lowConnectivity.clearDraft(newCartOwner); cart = []; newCartRevision = null; document.getElementById('cart-count').textContent = '0'; toggleCartModal(false); return;
    }
    markNewCheckoutOutcome({ token: submissionToken, attempt: quote.data.attempt, table: request.table, providers: Object.keys(gruposPorProveedor), codes: protectionOrderIds, products: window.PTHLowConnectivity.fingerprint(cart) });
    const changedTerms = quote.data.terms.some(term => {
        const expected = promesas.find(input => input.proveedor === term.proveedor);
        return !expected || Math.abs(Number(expected.total)-Number(term.total)) > 0.001 || Math.abs(Number(expected.costo_mensajeria)-Number(term.costo_mensajeria)) > 0.001 || expected.garantia_venta !== term.garantia_venta;
    });
    if (changedTerms) {
        for (const term of quote.data.terms) for (const price of term.prices || []) {
            const item = cart.find(row => row.id === price.id); if (item) { item.precio = price.price; item.precio_venta = price.price; if (price.garantia) item.garantia = price.garantia; }
        }
        newCheckoutShippingOverride = { fingerprint: window.PTHLowConnectivity.fingerprint(cart), municipio: municipioC, localidad: localidadC, pickup: isRecogida, cost: quote.data.terms.reduce((sum,term) => sum + Number(term.costo_mensajeria),0) };
        renderCart(); alert('El servidor comprobó nuevas condiciones de precio, garantía o entrega. Revisa el total actualizado y pulsa Confirmar Pedido nuevamente.'); return;
    }
    const result = await window.PTHSecureData.checkout({ ...request, operation: 'submit', attempt: quote.data.attempt, quote: quote.data.quote });
    if (result.error) throw result.error;
    if (checkoutScope() !== submissionOwner) throw Object.assign(new Error('Session changed'),{code:'SESSION_CHANGED'});
    if (!result.data?.complete) throw Object.assign(new Error('Unconfirmed write'),{code:'ORDER_OUTCOME_UNKNOWN'});
    if (previousOutcome || result.data.confirmed.some(row => !protectionOrderIds.includes(row.reference))) {
        alert('El servidor confirmó este envío: ' + result.data.confirmed.map(row => row.reference).join(', ') + '. No necesitas enviarlo otra vez.');
        clearNewCheckoutOutcome(); checkoutSubmitGuard.succeed(); checkoutFinished = true; lowConnectivity.markSent(newCartOwner,newCartRevision); lowConnectivity.clearDraft(newCartOwner); cart = []; newCartRevision = null; document.getElementById('cart-count').textContent = '0'; toggleCartModal(false); return;
    }

    clearNewCheckoutOutcome();
    // Only an acknowledged server result reaches this success path.
    lowConnectivity.markSent(newCartOwner,newCartRevision);
    lowConnectivity.clearDraft(newCartOwner);
    checkoutSubmitGuard.succeed();
    checkoutFinished = true;

    if (activeGestor !== 'Venta Directa') {
        const protection = await recordCustomerClosure(telC, activeGestor, protectionOrderIds.join(','));
        if (protection.transferred) {
            console.log(`🔄 Cliente transferido por cierre completo: ${protection.previousOwner} → ${activeGestor}`);
        }
        if (activeGestor === window.gestorName) {
            protectedCustomerCountOwner = null;
            protectedCustomerCountValue = null;
            window.PTHFollowups?.scheduleProtectedCustomer?.({
                cliente: nombreC,
                telefono: telC,
                producto: cart.map(item => item.nombre).join(', '),
                pedido_id: protectionOrderIds.join(',')
            });
        }
    }

    const mensajeCodificado = encodeURIComponent(mensajeRaw.trim());

    if (!isLogged) {
        trackSpy('COMPRA_CONFIRMADA', nombreC);
    window.PTHAnalytics?.event('generate_lead');
    }

    window.open(`https://api.whatsapp.com/send?phone=${whatsappDestino}&text=${mensajeCodificado}`, '_blank');

    // Generar PDF para el cliente
    const totalGlobalProductos = cart.reduce((acc, i) => acc + (i.precio_venta * i.qty), 0);
    const dirPDF = notasC ? `${dirC} (${localidadC}, ${municipioC}) - NOTA: ${notasC}` : `${dirC} (${localidadC}, ${municipioC})`;

    const datosParaPDF = {
        cliente: nombreC,
        ci: ciC,
        telefono: telC,
        direccion: dirPDF,
        totalUSD: totalGlobalProductos + envioTotalGlobal,
        mensajeria: envioTotalGlobal,
        items: cart.map(item => ({ nombre: item.nombre, qty: item.qty, price: item.precio_venta }))
    };

    // === NUEVO: VERIFICAR SI DEBE GENERAR PDF MAYORISTA ===
    const isB2BOrder = cart.some(item => (item.categoria || "").toUpperCase().includes('MAYORISTA') || (item.categoria || "").toUpperCase().includes('B2B') || (item.categoria || "").toUpperCase().includes('MIPYME'));

    setTimeout(() => {
        if(isB2BOrder) {
            generarComprobanteB2B(datosParaPDF, 'descargar');
        } else {
            generarComprobanteVenta(datosParaPDF, 'descargar');
        }

        setTimeout(() => {
            cart = [];
            clearAutoSave();
            toggleCartModal(false);
            location.reload();
        }, 2000);
    }, 1500);
    checkoutSubmitGuard.succeed();
    checkoutFinished = true;
    } catch (checkoutError) {
        console.error("Error inesperado al procesar el pedido:", checkoutError);
        if (checkoutFinished) {
            alert('El servidor confirmó el pedido. No necesitas enviarlo otra vez. No se pudo completar el comprobante o la comunicación; revisa el pedido en tu panel.');
            cart = []; document.getElementById('cart-count').textContent = '0'; toggleCartModal(false);
        } else alert(getCheckoutFailureMessage(checkoutError));
    } finally {
        if (!checkoutFinished) checkoutSubmitGuard.fail();
        // Ante cualquier validación, error de red o excepción, el cliente puede
        // volver a intentarlo en lugar de quedar atrapado en “PROCESANDO…”.
        if (!checkoutFinished && btn) {
            btn.disabled = false;
            btn.innerText = "Confirmar Pedido";
        }
    }
};

// Web Locks coordinate same-account submissions across tabs where supported.
// The existing server uniqueness constraint remains the final duplicate guard.
const submitNewCheckout = document.getElementById('checkout-form').onsubmit;
document.getElementById('checkout-form').onsubmit = function(event) {
    event.preventDefault();
    const locks = window.navigator?.locks;
    if (!locks) return submitNewCheckout.call(this,event);
    return locks.request('pth-new-checkout:' + checkoutScope(), { ifAvailable: true }, lock => {
        if (!lock) { alert('Hay un envío en otra pestaña. Espera su confirmación antes de enviar desde aquí.'); return; }
        return submitNewCheckout.call(this,event);
    });
};

    // 6. FUNCIONES AUXILIARES
    function parseMensajeria(texto) {
        if (!texto) return 0;
        let t = texto.toString().toLowerCase();
        if (t.includes('gratis') && !t.includes('periferia')) return 0;
        let match = t.match(/\d+/);
        return match ? parseFloat(match[0]) : 0;
    }

    // --- FUNCIÓN CORREGIDA: CARGA IMÁGENES DESDE GITHUB (CARPETA LOCAL) ---
// --- FUNCIÓN CORREGIDA: CARGA IMÁGENES DESDE GITHUB (FIX URL ENCODING) ---
// --- FUNCIÓN BLINDADA: CARGA FOTOS DESDE GITHUB Y CORRIGE NOMBRES ---
// --- FUNCIÓN CORREGIDA: CARGA IMÁGENES DESDE GITHUB (CARPETA LOCAL) ---
// --- FUNCIÓN DE ALTA PRECISIÓN PARA CARGAR FOTOS ---
function fixDriveUrl(url) {
    // 1. Si no hay dato, devolver imagen por defecto
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
        return 'https://placehold.co/400x400/1a4789/ffffff?text=Sin+Foto';
    }

    // 2. Limpieza básica: Obtener solo el nombre del archivo
    let nombreArchivo = url;

    // Si viene una URL completa antigua, nos quedamos con el final
    if (url.includes('/')) {
        nombreArchivo = url.split('/').pop();
    }

    // Quitar parámetros extra (?token=...)
    nombreArchivo = nombreArchivo.split('?')[0];

    // Decodificar caracteres raros (%20 -> espacio)
    try {
        nombreArchivo = decodeURIComponent(nombreArchivo);
    } catch(e) {}

    // Quitar comillas si las hubiera
    nombreArchivo = nombreArchivo.trim().replace(/['"]/g, '');

    // === REGLA DE ORO ===
    // Eliminamos espacios para estandarizar
    nombreArchivo = nombreArchivo.replace(/\s+/g, '');

    // === AQUÍ ESTÁ EL CAMBIO ===
    const GITHUB_USER = 'paratuhogar';
    const REPO = 'paratuhogar-fotos'; // <--- CAMBIAMOS AL NUEVO REPOSITORIO
    const BRANCH = 'main';

    // Construimos la URL apuntando al repositorio de fotos
    return `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/${BRANCH}/img_productos/${nombreArchivo}`;
}

    // 1. Lógica para decidir si mostrar el botón del Gestor (Nivel 2+)
async function initAgentFloatingButton() {
    // 1. Si hay sesión activa (Gestor/Admin), OCULTAR y salir.
    const session = localStorage.getItem('pth_session');
    if (session) {
        const container = document.getElementById('floating-agent-contact');
        if (container) container.classList.add('hidden');

        return;
    }

    // 2. Si NO hay sesión (Cliente), MOSTRAR SIEMPRE.
    // Intentamos recuperar el gestor de la URL o Memoria
    let referrer = await getActiveReferrer();

    // Si no hay referrer (cliente orgánico), asignamos al "Dueño" por defecto para no perder la venta
    if (!referrer) {
        referrer = { nombre: "Atención al Cliente", telefono: "5356071095" }; // TU NÚMERO AQUÍ
    }

    // Renderizar Botón Flotante
    if (referrer.telefono) {
        renderFloatingWA(referrer.nombre, referrer.telefono);
    }


}

// 2. Función para pintar el botón con el teléfono del gestor
// 2. Función para pintar el botón con el teléfono del gestor
function renderFloatingWA(nombre, telefono) {
    const container = document.getElementById('floating-agent-contact');
    if (!container || !telefono) return;

    // 1. Limpiar caracteres raros (quitar espacios, +, paréntesis)
    let telLimpio = telefono.replace(/\D/g, '');

    // === CORRECCIÓN ANTI-ERROR DE PAÍS ===
    // Si el número tiene exactamente 8 dígitos (ej: 52087899),
    // asumimos que es de Cuba y le pegamos el 53 delante.
    if (telLimpio.length === 8) {
        telLimpio = '53' + telLimpio;
    }
    // ======================================

    const primerNombre = nombre.split(' ')[0];
    const advisorName = document.getElementById('client-assigned-advisor-name');
    const advisorStatus = document.getElementById('client-assigned-advisor-status');
    if (advisorName) {
        advisorName.textContent = nombre === 'Atención al Cliente'
            ? 'Atención personalizada'
            : `Te atiende ${primerNombre}`;
    }
    if (advisorStatus) advisorStatus.textContent = 'Disponible para ayudarte por WhatsApp';

    container.innerHTML = `
        <a href="https://wa.me/${telLimpio}?text=${encodeURIComponent('Hola ' + primerNombre + ', estoy viendo el catálogo y me interesa un equipo.')}"
           target="_blank"
           class="fixed bottom-6 left-6 z-[60] flex items-center gap-3 bg-[#25D366] text-white p-2 pr-5 rounded-full shadow-2xl hover:scale-105 transition-all active:scale-95 group pulse-wa">

            <div class="relative">
                <div class="h-12 w-12 bg-white rounded-full flex items-center justify-center text-[#25D366] border-2 border-white">
                    <span class="material-symbols-outlined text-3xl">person</span>
                </div>
                <div class="absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-400 border-2 border-white rounded-full"></div>
            </div>

            <div class="flex flex-col">
                <span class="text-[9px] font-black uppercase opacity-80 tracking-tighter leading-none mb-1">Comercial en línea</span>
                <span class="text-sm font-black leading-none">${nombre.toUpperCase()}</span>
            </div>

            <div class="absolute -top-12 left-0 bg-gray-900 text-white text-[10px] py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                ¿Tienes dudas? Chatea conmigo 👋
                <div class="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>
        </a>
    `;
    container.classList.remove('hidden');
}

function toggleCartModal(show) {
    const cartModal = document.getElementById('cart-modal');
    if (!cartModal) return;

    // 1. Abre o cierra el modal
    cartModal.classList.toggle('hidden', !show);

    if(show) {
        if (!document.getElementById('pth-cart-draft-note')) {
            const note = document.createElement('p'); note.id = 'pth-cart-draft-note'; note.className = 'pth-cart-draft-note';
            document.getElementById('cart-items')?.before(note);
        }
        void loadClientCRM();
        // 2. Dibuja los productos del carrito
        renderCart();

        // 3. LÓGICA DE VISIBILIDAD DE HERRAMIENTAS GESTOR (Pegar y CRM)
        const session = localStorage.getItem('pth_session');
        const gestorTools = document.getElementById('gestor-checkout-tools');

        if (gestorTools) {
            if (session) {
                // Si Marcel está logueado, le mostramos el botón verde de "Pegar" y el buscador CRM
                gestorTools.classList.remove('hidden');
            } else {
                // Si es un cliente, le escondemos esas herramientas profesionales
                gestorTools.classList.add('hidden');
            }
        }
    }
}
    function closeDetail() {
    // === NUEVO: RESTAURAR SEO DINÁMICO ===
    if (window.location.protocol !== 'file:') {
        history.pushState(null, '', '/');
    }
    document.title = "ParaTuHogar | Electrodomésticos para Cuba";
    closeDetailImagePreview();
    // ==========================================

    // 1. SENSOR: Calcular tiempo de lectura antes de cerrar
    if (tiempoInicioLectura > 0) {
        const segundos = Math.floor((Date.now() - tiempoInicioLectura) / 1000);

        if (segundos > 2) {
            trackSpy('LECTURA_PROFUNDA', productoActualLectura, segundos);
        }

        tiempoInicioLectura = 0;
        productoActualLectura = "";
    }

    // 2. LÓGICA ORIGINAL: Cerrar el modal
    document.getElementById('detail-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

    function filterByCategory(cat) {
    // Eliminamos el bloqueo de los 5 pasos
    activeCategory = cat;
    trackSpy('VIO_CATEGORIA', cat);
    renderCategories();
    renderProducts();

    const label = document.getElementById('marketing-cat-label');
    if(label) label.innerText = cat;
}


    function removeFromCart(i) { cart.splice(i, 1); document.getElementById('cart-count').innerText = cart.reduce((acc, item) => acc + item.qty, 0); renderCart(); // NUEVO: Cada vez que añada algo, actualizamos el Radar si ya puso su teléfono
    if (typeof captureGhostLead === "function") {
        captureGhostLead();
    }
}



function copyOffer() {
        const text = `🔥 *OFERTA DISPONIBLE*\n📦 ${selectedProduct.nombre}\n💰 Precio: $${selectedProduct.precio} USD\n🛡️ Garantía: ${selectedProduct.garantia}\n🚛 Envío: ${selectedProduct.mensajeria}`;
        navigator.clipboard.writeText(text).then(() => alert("¡Copiado!"));
    }

    // DASHBOARD DE GESTOR (Simplificado para Supabase)
    // --- FUNCIÓN DASHBOARD BLINDADA ---
async function loadFullDashboard() {
    const currentGestor = window.gestorName || gestorName;
    if (!currentGestor) return;

    // Consultamos pedidos
    const { data, error } = await supabaseClient
        .from('pedidos')
        .select('*')
        .eq('gestor', currentGestor);

    if (error) {
        console.error("Error cargando dashboard:", error);
        return;
    }

    const entregados = data.filter(p => p.estado === 'Entregado');
    const pendientes = data.filter(p => p.estado === 'Pendiente' || p.estado === 'Asignado Mensajero' || p.estado === 'Recogida Almacén');

    // Calculamos comisiones
    const ganancia = entregados.reduce((acc, curr) => acc + getOrderCommission(curr), 0);

    // --- AQUÍ ESTABA EL ERROR: VALIDAMOS QUE EXISTAN LOS ELEMENTOS ANTES DE ESCRIBIR ---

    const elMoney = document.getElementById('dash-money');
    if (elMoney) elMoney.innerText = `$${ganancia.toFixed(2)}`;

    const elOk = document.getElementById('dash-ok');
    if (elOk) elOk.innerText = entregados.length;

    const elPending = document.getElementById('dash-pending');
    if (elPending) elPending.innerText = pendientes.length;

    // Actualizamos también los contadores de la nueva sección "Mis Pedidos Financieros" si existen
    const elMoneyPending = document.getElementById('dash-money-pending');
    const elMoneyPaid = document.getElementById('dash-money-paid');

    if (elMoneyPending || elMoneyPaid) {
        const porCobrar = entregados
            .filter(p => p.pago_gestor === 'Pendiente' || !p.pago_gestor)
            .reduce((acc, curr) => acc + getOrderCommission(curr), 0);

        const cobrado = entregados
            .filter(p => p.pago_gestor === 'Pagado')
            .reduce((acc, curr) => acc + getOrderCommission(curr), 0);

        if(elMoneyPending) elMoneyPending.innerText = `$${porCobrar.toFixed(2)}`;
        if(elMoneyPaid) elMoneyPaid.innerText = `$${cobrado.toFixed(2)}`;
    }

    // Ranking
    if (typeof renderRankingGestor === "function") {
        renderRankingGestor(data);
    }
}

    function renderRankingGestor(misVentas) {
        // Esta función lista las últimas ventas del propio gestor en la lista de abajo
        const list = document.getElementById('ranking-list');
        list.innerHTML = misVentas.slice(0, 5).map(v => `
            <div class="p-4 flex justify-between items-center">
                <div>
                    <p class="text-[10px] font-bold text-gray-400">${new Date(v.created_at || new Date()).toLocaleDateString()}</p>
                    <p class="text-xs font-black uppercase text-gray-700">${v.producto.substring(0, 20)}...</p>
                </div>
                <span class="text-emerald-500 font-black text-xs">+$${v.comision_total}</span>
            </div>
        `).join('');
    }

function prepareGestorDashboardLayout() {
    const dashboard = document.getElementById('sec-dashboard');
    if (!dashboard || dashboard.dataset.layoutReady === 'true') return;

    const home = document.getElementById('gestor-home');
    const dashboardNav = document.getElementById('btn-dash-resumen')?.parentElement;
    if (home && dashboardNav) dashboard.insertBefore(dashboardNav, home);

    const prices = document.getElementById('sub-dash-precios');
    const commissions = document.getElementById('sub-dash-comisiones');
    const performance = document.getElementById('sub-dash-rendimiento');
    let legacyStarted = false;
    Array.from(dashboard.children).forEach(child => {
        if (child === prices) {
            legacyStarted = true;
            return;
        }
        if (child === commissions || child === performance) return;
        if (legacyStarted) {
            child.classList.add('gestor-legacy-block', 'hidden');
        }
    });
    dashboard.dataset.layoutReady = 'true';
}

function gestorSafeText(value) {
    const node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
}

let gestorRecommendedProductName = '';

function renderGestorDailyOpportunity() {
    const container = document.getElementById('gestor-daily-opportunity');
    if (!container || !Array.isArray(productosRaw)) return;
    const candidates = productosRaw
        .filter(isProductCurrentlyAvailable)
        .sort((a, b) => {
            const recentDifference = Number(isRecentCatalogProduct(b)) - Number(isRecentCatalogProduct(a));
            if (recentDifference) return recentDifference;
            return (Number(b.comision) || 0) - (Number(a.comision) || 0);
        });
    const product = candidates[0];
    if (!product) {
        container.classList.add('hidden');
        return;
    }

    gestorRecommendedProductName = product.nombre;
    document.getElementById('gestor-opportunity-name').textContent = product.nombre;
    document.getElementById('gestor-opportunity-reason').textContent =
        `${isRecentCatalogProduct(product) ? 'Producto nuevo' : 'Producto disponible'} · ganas $${Number(product.comision) || 0}`;
    container.classList.remove('hidden');
}

function shareGestorOpportunity(action, button) {
    if (!gestorRecommendedProductName) return;
    if (action === 'whatsapp') {
        shareProductWhatsApp(gestorRecommendedProductName);
    } else {
        copyProductOffer(gestorRecommendedProductName, button);
    }
}

function getGestorStoreLink() {
    const generatedLink = document.getElementById('my-link-input')?.value;
    if (generatedLink) return generatedLink;
    const data = window.currentUserData || {};
    const base = window.location.origin + window.location.pathname;
    return `${base}?ref=${encodeURIComponent(window.gestorName || '')}&contact=${encodeURIComponent(data.telefono || '')}`;
}

async function copyGestorStoreLink() {
    const originalLink = getGestorStoreLink();
    const manager = window.gestorName || window.currentUserData?.nombre || 'ParaTuHogar';
    const link = await getOrGenerateShortLink(manager, originalLink);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(() => alert('✅ Enlace de tu tienda copiado.'));
    } else {
        const temp = document.createElement('textarea');
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
        alert('✅ Enlace de tu tienda copiado.');
    }
}

function openGestorClientView() {
    window.open(getGestorStoreLink(), '_blank', 'noopener');
}

function getGestorFollowupStats() {
    return window.PTHFollowups?.getStats?.() || { overdue: 0, today: 0, interested: 0 };
}

function renderGestorToday(orders = myOrdersData, followupStats = getGestorFollowupStats()) {
    const activeOrders = (Array.isArray(orders) ? orders : [])
        .filter(order => order.estado !== 'Entregado' && order.estado !== 'Cancelado')
        .sort((a, b) => new Date(b.fecha || b.created_at || 0) - new Date(a.fecha || a.created_at || 0));
    const todayFollowups = Number(followupStats.today) || 0;
    const overdueFollowups = Number(followupStats.overdue) || 0;
    const total = activeOrders.length + todayFollowups + overdueFollowups;

    const values = {
        'gestor-today-orders': activeOrders.length,
        'gestor-today-followups': todayFollowups,
        'gestor-today-overdue': overdueFollowups,
        'gestor-today-total': total
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const summary = document.getElementById('gestor-today-summary');
    if (summary) {
        summary.textContent = total
            ? `${total} ${total === 1 ? 'acción prioritaria' : 'acciones prioritarias'} para mantener tus ventas en movimiento.`
            : 'Todo está al día. Puedes concentrarte en generar nuevas conversaciones.';
    }

    const list = document.getElementById('gestor-today-orders-list');
    if (!list) return;
    const priorityOrders = activeOrders.slice(0, 3);
    if (!priorityOrders.length) {
        list.innerHTML = `
            <div class="flex items-center gap-3 p-4 text-xs font-bold text-slate-500 md:px-6">
                <span class="material-symbols-outlined text-emerald-500">check_circle</span>
                No tienes pedidos activos pendientes.
            </div>`;
        return;
    }

    list.innerHTML = priorityOrders.map(order => {
        const phone = String(order.telefono || '').replace(/\D/g, '');
        return `
            <div class="grid grid-cols-[36px_minmax(0,1fr)_40px] items-center gap-3 p-4 md:px-6">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <span class="material-symbols-outlined text-lg">pending_actions</span>
                </div>
                <div class="min-w-0">
                    <p class="truncate text-xs font-black text-slate-800">${gestorSafeText(order.cliente || 'Cliente')}</p>
                    <p class="mt-1 truncate text-[10px] font-bold text-slate-400">${gestorSafeText(order.producto || 'Pedido')} · ${gestorSafeText(order.estado || 'Pendiente')}</p>
                </div>
                ${phone ? `
                    <button onclick="contactGestorOrder('${phone}')" class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600" title="Escribir por WhatsApp">
                        <i class="fab fa-whatsapp text-lg"></i>
                    </button>` : '<span></span>'}
            </div>`;
    }).join('');
}

function openGestorFollowups(filter = 'hoy') {
    if (window.PTHFollowups?.open) {
        window.PTHFollowups.open(filter);
        return;
    }
    document.getElementById('btn-client-followup')?.click();
}

let commissionCenterFilter = 'pending';
let commissionPayoutRequests = [];
let commissionSelectedOrderIds = new Set();
let commissionReservedOrderIds = new Set();
let commissionPayoutDetailsLoaded = false;

function isBeatrizPayoutAdmin() {
    return String(window.currentUserData?.nombre || window.gestorName || '').trim().toLowerCase() === 'beatriz barrero'
        && !window.currentUserData?.parent_id;
}

function getHavanaWeekday() {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Havana', weekday: 'short' }).format(new Date());
    return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday] || 0;
}

function isPayoutRequestWindowOpen() {
    // Ventana semanal: miércoles 00:00 a lunes 23:59, hora de La Habana.
    // El martes se reserva para procesar los pagos.
    return getHavanaWeekday() !== 2;
}

async function loadMyPayoutRequests() {
    const user = window.currentUserData || {};
    if (!user.id || !user.password) return;
    commissionPayoutDetailsLoaded = false;
    const [requestsResult, detailsResult] = await Promise.all([
        supabaseClient.rpc('mis_solicitudes_cobro', { p_gestor_id: user.id, p_password: user.password }),
        supabaseClient.rpc('mis_pedidos_solicitudes_cobro', { p_gestor_id: user.id, p_password: user.password })
    ]);
    if (requestsResult.error || detailsResult.error) {
        const error = requestsResult.error || detailsResult.error;
        if (!/function|schema cache|does not exist/i.test(error.message || '')) console.error('No se pudieron cargar solicitudes:', error);
        commissionPayoutRequests = [];
        commissionReservedOrderIds = new Set();
        closeCommissionRequestModal();
        renderCommissionCenter();
        return;
    }
    commissionPayoutRequests = requestsResult.data || [];
    commissionReservedOrderIds = new Set((detailsResult.data || []).map(detail => String(detail.pedido_id)));
    commissionPayoutDetailsLoaded = true;
    closeCommissionRequestModal();
    renderCommissionCenter();
}

function isCommissionPaid(order) {
    return String(order?.pago_gestor || '').trim().toLowerCase() === 'pagado';
}

function getOrderCommission(order) {
    const total = Math.max(0, Number(order?.comision_total) || 0);
    // En la sesión de un subgestor, loadProDashboard ya transforma
    // comision_total en su comisión individual.
    if (window.currentUserData?.parent_id) return total;

    // La Bóveda paga la comisión completa al gestor principal; este liquida
    // por separado la parte de su subgestor desde la red privada.
    return total;
}

function getActiveCommissionReservationTotal(requests) {
    return (Array.isArray(requests) ? requests : [])
        .filter(request => ['pendiente', 'procesando'].includes(String(request?.estado || '').toLowerCase()))
        .reduce((total, request) => total + (Number(request?.importe_usd) || 0), 0);
}

function getCommissionCenterData() {
    const orders = Array.isArray(myOrdersData) ? myOrdersData : [];
    const delivered = orders.filter(order => order.estado === 'Entregado' && getOrderCommission(order) > 0);
    const pending = delivered.filter(order =>
        !isCommissionPaid(order) && !commissionReservedOrderIds.has(String(order.id)));
    const paid = delivered.filter(isCommissionPaid);
    const pipeline = orders.filter(order =>
        order.estado !== 'Entregado'
        && order.estado !== 'Cancelado'
        && getOrderCommission(order) > 0);
    const sum = list => list.reduce((total, order) => total + getOrderCommission(order), 0);
    const requestedPaidTotal = commissionPayoutRequests
        .filter(request => ['pagado', 'archivado'].includes(String(request.estado || '').toLowerCase()))
        .reduce((total, request) => total + (Number(request.importe_usd) || 0), 0);
    return {
        delivered,
        pending,
        paid,
        pipeline,
        pendingTotal: commissionPayoutDetailsLoaded ? sum(pending) : 0,
        paidTotal: sum(paid) + requestedPaidTotal,
        pipelineTotal: sum(pipeline)
    };
}

function getCommissionSettlementContact() {
    const isSubmanager = Boolean(window.currentUserData?.parent_id);
    if (isSubmanager) {
        let phone = String(window.currentUserData?.parent_telefono || '').replace(/\D/g, '');
        if (phone.length === 8) phone = `53${phone}`;
        return {
            name: window.currentUserData?.parent_nombre || 'tu gestor principal',
            phone: phone || '5355386602',
            isSubmanager: true
        };
    }
    return { name: 'Ángel', phone: '5355386602', isSubmanager: false };
}

function getCommissionOrderDate(order) {
    const raw = order?.fecha || order?.created_at;
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('es-CU', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Sin fecha';
}

function getCommissionOrderReference(order) {
    const id = String(order?.id || '');
    return id ? `#${id.slice(-7).toUpperCase()}` : 'Sin referencia';
}

function renderCommissionCenter() {
    const list = document.getElementById('commission-center-list');
    if (!list) return;
    const data = getCommissionCenterData();
    const contact = getCommissionSettlementContact();
    const requestWindowOpen = isPayoutRequestWindowOpen();
    const amountValues = {
        'commission-center-pending': `$${data.pendingTotal.toFixed(2)}`,
        'commission-center-paid': `$${data.paidTotal.toFixed(2)}`,
        'commission-center-pipeline': `$${data.pipelineTotal.toFixed(2)}`,
        'commission-center-count': String(data.delivered.length)
    };
    Object.entries(amountValues).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const note = document.getElementById('commission-center-role-note');
    const step = document.getElementById('commission-center-step-two');
    const requestButton = document.getElementById('commission-request-button');
    if (note) {
        note.textContent = contact.isSubmanager
            ? `Tus comisiones están respaldadas por ventas entregadas. Puedes solicitarlas de miércoles a lunes; el pago se procesa el martes.`
            : 'Cada importe está respaldado por una venta entregada. Solicita el cobro de miércoles a lunes; el pago se realiza el martes.';
    }
    if (step) {
        step.textContent = 'Elige cuánto cobrar y si lo recibirás en efectivo USD o por transferencia en CUP.';
    }
    if (requestButton) {
        requestButton.disabled = data.pendingTotal <= 0 || !requestWindowOpen || !commissionPayoutDetailsLoaded;
        requestButton.innerHTML = !requestWindowOpen
            ? '<span class="material-symbols-outlined text-lg">event_busy</span> Disponible el miércoles'
            : !commissionPayoutDetailsLoaded
                ? '<span class="material-symbols-outlined text-lg">sync</span> Actualizando saldo'
            : data.pendingTotal > 0
                ? '<span class="material-symbols-outlined text-lg">payments</span> Solicitar cobro'
                : '<span class="material-symbols-outlined text-lg">check_circle</span> Sin saldo disponible';
    }

    document.querySelectorAll('.commission-filter').forEach(button => {
        const active = button.dataset.commissionFilter === commissionCenterFilter;
        button.classList.toggle('bg-emerald-600', active);
        button.classList.toggle('text-white', active);
        button.classList.toggle('border-emerald-600', active);
        button.classList.toggle('bg-white', !active);
        button.classList.toggle('text-slate-500', !active);
        button.classList.toggle('border-slate-200', !active);
    });

    let displayed = [];
    if (commissionCenterFilter === 'pending') displayed = data.pending;
    else if (commissionCenterFilter === 'paid') displayed = data.paid;
    else if (commissionCenterFilter === 'pipeline') displayed = data.pipeline;
    else displayed = [...data.delivered, ...data.pipeline];
    displayed = [...displayed].sort((a, b) =>
        new Date(b.fecha || b.created_at || 0) - new Date(a.fecha || a.created_at || 0));

    const summary = document.getElementById('commission-center-summary');
    if (summary) {
        summary.textContent = `${displayed.length} ${displayed.length === 1 ? 'movimiento visible' : 'movimientos visibles'} · los importes se calculan desde tus pedidos`;
    }

    if (!displayed.length) {
        const emptyMessages = {
            pending: ['Todo está liquidado', 'No tienes comisiones entregadas pendientes de pago.'],
            paid: ['Aún no hay liquidaciones', 'Cuando la bóveda marque un pago, aparecerá aquí.'],
            pipeline: ['No hay comisión en proceso', 'Tus próximos pedidos activos aparecerán en esta sección.'],
            all: ['Aún no hay movimientos', 'Tus comisiones aparecerán cuando registres pedidos.']
        };
        const [title, description] = emptyMessages[commissionCenterFilter] || emptyMessages.all;
        list.innerHTML = `
            <div class="p-10 text-center">
                <span class="material-symbols-outlined text-4xl text-slate-300">account_balance_wallet</span>
                <p class="mt-2 text-xs font-black text-slate-700">${title}</p>
                <p class="mt-1 text-[10px] font-bold text-slate-400">${description}</p>
            </div>`;
        return;
    }

    list.innerHTML = displayed.map(order => {
        const paid = order.estado === 'Entregado' && isCommissionPaid(order);
        const available = order.estado === 'Entregado' && !paid;
        const status = paid
            ? { label: 'Liquidada', icon: 'check_circle', className: 'bg-emerald-50 text-emerald-700' }
            : available
                ? { label: 'Por cobrar', icon: 'payments', className: 'bg-amber-50 text-amber-700' }
                : { label: 'En proceso', icon: 'hourglass_top', className: 'bg-blue-50 text-blue-700' };
        return `
            <article class="grid grid-cols-[44px_minmax(0,1fr)] gap-3 p-4 md:grid-cols-[46px_minmax(0,1fr)_auto] md:items-center md:px-6">
                <div class="flex h-11 w-11 items-center justify-center rounded-2xl ${status.className}">
                    <span class="material-symbols-outlined">${status.icon}</span>
                </div>
                <div class="min-w-0">
                    <p class="truncate text-xs font-black text-slate-800">${gestorSafeText(order.producto || 'Pedido')}</p>
                    <p class="mt-1 text-[9px] font-bold text-slate-400">${getCommissionOrderReference(order)} · ${getCommissionOrderDate(order)}</p>
                </div>
                <div class="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:block md:text-right">
                    <span class="inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase ${status.className}">${status.label}</span>
                    <p class="text-base font-black text-emerald-700 md:mt-1">+$${getOrderCommission(order).toFixed(2)}</p>
                </div>
            </article>`;
    }).join('');
}

function setCommissionCenterFilter(filter) {
    commissionCenterFilter = ['pending', 'paid', 'pipeline', 'all'].includes(filter) ? filter : 'pending';
    renderCommissionCenter();
}

function requestCommissionSettlement() {
    const data = getCommissionCenterData();
    if (window.currentUserData?.parent_id) {
        const contact = getCommissionSettlementContact();
        const phone = String(contact.phone || '').replace(/\D/g, '');
        if (!phone) return alert('No está registrado el teléfono de tu gestor principal. Contacta con él directamente.');
        const message = `Hola ${contact.name}, deseo solicitar el cobro de mis comisiones disponibles por $${data.pendingTotal.toFixed(2)} USD. Por favor, revisa mi nómina de subgestor.`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        return;
    }
    if (!isPayoutRequestWindowOpen()) return alert('Las solicitudes se reciben de miércoles a lunes. El martes el sistema procesa los pagos y no acepta solicitudes.');
    if (!commissionPayoutDetailsLoaded) return alert('Estamos actualizando tus pedidos; inténtalo nuevamente en unos segundos.');
    if (data.pendingTotal <= 0) {
        closeCommissionRequestModal();
        return alert('No tienes saldo disponible para solicitar.');
    }
    resetCommissionRequestForm();
    const ordersContainer = document.getElementById('commission-request-orders');
    ordersContainer.innerHTML = data.pending.map(order => `
        <label class="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
            <input type="checkbox" class="commission-order-check rounded border-slate-300 text-emerald-600" value="${gestorSafeText(order.id)}" onchange="toggleCommissionOrder('${gestorSafeText(order.id)}',this.checked)">
            <span class="min-w-0 flex-1"><strong class="block truncate text-[10px] text-slate-800">${gestorSafeText(order.producto || 'Pedido')}</strong><small class="text-[9px] font-bold text-slate-400">${getCommissionOrderReference(order)}</small></span>
            <strong class="text-sm text-emerald-700">$${getOrderCommission(order).toFixed(2)}</strong>
        </label>`).join('');
    const modal = document.getElementById('commission-request-modal');
    document.getElementById('commission-modal-available').textContent = `$${data.pendingTotal.toFixed(2)}`;
    const amount = document.getElementById('commission-request-amount');
    amount.value = '0.00';
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeCommissionRequestModal() {
    resetCommissionRequestForm(true);
}

function resetCommissionRequestForm(closeModal = false) {
    commissionSelectedOrderIds = new Set();
    const ordersContainer = document.getElementById('commission-request-orders');
    if (ordersContainer) ordersContainer.innerHTML = '';
    const available = document.getElementById('commission-modal-available');
    if (available) available.textContent = '$0.00';
    const amount = document.getElementById('commission-request-amount');
    if (amount) amount.value = '0.00';
    if (!closeModal) return;
    const modal = document.getElementById('commission-request-modal');
    modal?.classList.add('hidden'); modal?.classList.remove('flex');
}

window.addEventListener('pageshow', () => resetCommissionRequestForm(true));

function fillFullCommissionAmount() {
    const data = getCommissionCenterData();
    commissionSelectedOrderIds = new Set(data.pending.map(order => String(order.id)));
    document.querySelectorAll('.commission-order-check').forEach(check => { check.checked = true; });
    updateSelectedCommissionTotal();
}

function toggleCommissionOrder(orderId, checked) {
    if (checked) commissionSelectedOrderIds.add(String(orderId));
    else commissionSelectedOrderIds.delete(String(orderId));
    updateSelectedCommissionTotal();
}

function updateSelectedCommissionTotal() {
    const orders = getCommissionCenterData().pending;
    const total = orders.filter(order => commissionSelectedOrderIds.has(String(order.id)))
        .reduce((sum, order) => sum + getOrderCommission(order), 0);
    document.getElementById('commission-request-amount').value = total.toFixed(2);
}

function isInvalidGestorSessionError(error) {
    return /sesi[oó]n de gestor no v[aá]lida|cuenta inactiva|cuenta dada de baja/i.test(String(error?.message || error || ''));
}

function isTransientPayoutNetworkError(error) {
    return /failed to fetch|networkerror|network request failed|load failed/i.test(String(error?.message || error || ''));
}

function recoverInvalidGestorSession() {
    window.PTHSecureData.clearSession();
    localStorage.removeItem('pth_session');
    window.currentUserData = null;
    window.gestorName = null;
    window.isAdmin = false;
    closeCommissionRequestModal();
    document.getElementById('login-overlay')?.classList.remove('hidden');
    if (typeof toggleLoginMode === 'function') toggleLoginMode('login');
}

async function requestCommissionPayoutWithRetry(payload) {
    let intentosRestantes = 1;
    while (true) {
        try {
            const result = await supabaseClient.rpc('solicitar_cobro_comision_pedidos', payload);
            if (!result.error || !isTransientPayoutNetworkError(result.error) || intentosRestantes <= 0) return result;
        } catch (error) {
            if (!isTransientPayoutNetworkError(error) || intentosRestantes <= 0) throw error;
        }
        intentosRestantes -= 1;
        await new Promise(resolve => setTimeout(resolve, 900));
    }
}

async function submitCommissionPayoutRequest() {
    const user = window.currentUserData || {};
    const amount = Math.round((Number(document.getElementById('commission-request-amount')?.value) || 0) * 100) / 100;
    const method = document.getElementById('commission-request-method')?.value;
    const available = getCommissionCenterData().pendingTotal;
    if (!user.id || !user.password) return alert('Tu sesión no contiene los datos necesarios. Cierra sesión y vuelve a entrar.');
    const selectedIds = [...commissionSelectedOrderIds];
    if (!selectedIds.length || amount <= 0 || amount > available + 0.001) return alert('Selecciona al menos un pedido completo para solicitar su comisión.');
    const button = document.getElementById('commission-submit-request');
    const original = button.innerHTML; button.disabled = true; button.innerHTML = 'Enviando…';
    try {
        let { data, error } = await requestCommissionPayoutWithRetry({ p_gestor_id: user.id, p_password: user.password, p_pedidos_ids: selectedIds, p_metodo_pago: method });
        if (error && /ya est[aá] incluido en otra solicitud/i.test(error.message || '')) {
            await loadMyPayoutRequests();
            const solicitudConfirmada = selectedIds.every(id => commissionReservedOrderIds.has(String(id)));
            if (solicitudConfirmada) {
                data = { fecha_pago_prevista: '' };
                error = null;
            }
        }
        if (error) throw error;
        closeCommissionRequestModal();
        await loadMyPayoutRequests();
        alert(`✅ Solicitud registrada por $${amount.toFixed(2)} USD. Pago previsto para el martes ${data?.fecha_pago_prevista || ''}.`);
    } catch (error) {
        if (isInvalidGestorSessionError(error)) {
            recoverInvalidGestorSession();
            alert('Tu sesión anterior ya no es válida. Inicia sesión nuevamente con tu contraseña actual para solicitar el cobro.');
            return;
        }
        alert(`No se pudo registrar la solicitud: ${error.message || error}`);
    } finally { button.disabled = false; button.innerHTML = original; }
}

async function loadBeatrizPayoutRequests() {
    if (!isBeatrizPayoutAdmin()) return;
    const user = window.currentUserData || {};
    const list = document.getElementById('payout-admin-list');
    if (list) list.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-slate-400">Actualizando…</td></tr>';
    const { data, error } = await supabaseClient.rpc('listar_solicitudes_cobro_beatriz', { p_admin_id: user.id, p_password: user.password, p_incluir_archivadas: false });
    if (error) {
        if (list) list.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">${gestorSafeText(error.message)}</td></tr>`;
        return;
    }
    const rows = data || [];
    const totals = rows.reduce((acc, item) => { const state=String(item.estado); acc.total += Number(item.importe_usd)||0; acc[state]=(acc[state]||0)+1; return acc; }, { total:0 });
    const summary = document.getElementById('payout-admin-summary');
    if (summary) summary.innerHTML = [
        ['Pendientes', totals.pendiente || 0, 'amber'], ['Procesando', totals.procesando || 0, 'blue'],
        ['Pagadas', totals.pagado || 0, 'emerald'], ['Total visible', `$${totals.total.toFixed(2)}`, 'violet']
    ].map(([label,value,color]) => `<article class="rounded-2xl border border-${color}-100 bg-${color}-50 p-4"><span class="text-[9px] font-black uppercase text-${color}-700">${label}</span><strong class="mt-2 block text-2xl font-black text-${color}-950">${value}</strong></article>`).join('');
    if (!list) return;
    if (!rows.length) { list.innerHTML='<tr><td colspan="7" class="p-10 text-center font-bold text-slate-400">No hay solicitudes activas.</td></tr>'; return; }
    list.innerHTML = rows.map(item => {
        const method = item.metodo_pago === 'transferencia_cup' ? 'Transferencia CUP' : 'Efectivo USD';
        const requested = new Date(item.creado_en).toLocaleString('es-CU', { timeZone:'America/Havana', dateStyle:'short', timeStyle:'short' });
        const role = item.tipo_solicitante === 'subgestor' ? `<span class="block text-[8px] font-black uppercase text-violet-600">Subgestor de ${gestorSafeText(item.parent_nombre || 'gestor')}</span>` : '<span class="block text-[8px] font-black uppercase text-slate-400">Gestor principal</span>';
        const actions = item.estado === 'pendiente'
            ? `<button onclick="managePayoutRequest('${item.id}','procesando')" class="rounded-lg bg-blue-50 px-2 py-2 text-[8px] font-black uppercase text-blue-700">Procesar</button> <button onclick="managePayoutRequest('${item.id}','pagado')" class="rounded-lg bg-emerald-600 px-2 py-2 text-[8px] font-black uppercase text-white">Pagado</button>`
            : item.estado === 'procesando' ? `<button onclick="managePayoutRequest('${item.id}','pagado')" class="rounded-lg bg-emerald-600 px-2 py-2 text-[8px] font-black uppercase text-white">Marcar pagado</button>` : '—';
        return `<tr class="border-t border-slate-100"><td class="p-4 font-black text-slate-800">${gestorSafeText(item.gestor_nombre)}${role}</td><td class="p-4">${gestorSafeText(item.gestor_telefono || '—')}</td><td class="p-4 text-base font-black text-emerald-700">$${Number(item.importe_usd).toFixed(2)}</td><td class="p-4 font-bold">${method}</td><td class="p-4 text-[10px]">${requested}<span class="block font-black text-violet-700">Martes ${gestorSafeText(item.fecha_pago_prevista)}</span></td><td class="p-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase">${gestorSafeText(item.estado)}</span></td><td class="p-4 text-right">${actions}</td></tr>`;
    }).join('');
}

async function managePayoutRequest(id, action) {
    const reference = action === 'pagado' ? (prompt('Referencia o nota del pago (opcional):') || '') : '';
    const user = window.currentUserData || {};
    const { error } = await supabaseClient.rpc('gestionar_solicitud_cobro_beatriz', { p_admin_id:user.id, p_password:user.password, p_solicitud_id:id, p_accion:action, p_referencia:reference });
    if (error) return alert(error.message);
    await loadBeatrizPayoutRequests();
}

async function archivePaidPayoutRequests() {
    if (!confirm('Se archivarán las solicitudes pagadas/rechazadas. El historial se conservará. ¿Continuar?')) return;
    const user = window.currentUserData || {};
    const { data, error } = await supabaseClient.rpc('archivar_solicitudes_pagadas_beatriz', { p_admin_id:user.id, p_password:user.password });
    if (error) return alert(error.message);
    alert(`✅ ${data || 0} solicitudes archivadas.`); await loadBeatrizPayoutRequests();
}

function downloadCommissionStatement() {
    const data = getCommissionCenterData();
    const movementRows = [...data.delivered, ...data.pipeline]
        .sort((a, b) => new Date(b.fecha || b.created_at || 0) - new Date(a.fecha || a.created_at || 0))
        .map(order => {
            const state = order.estado === 'Entregado'
                ? (isCommissionPaid(order) ? 'Liquidada' : 'Por cobrar')
                : 'En proceso';
            return [
                getCommissionOrderReference(order),
                getCommissionOrderDate(order),
                order.producto || 'Pedido',
                getOrderCommission(order).toFixed(2),
                state
            ];
        });
    const paymentRows = [...commissionPayoutRequests]
        .sort((a,b) => new Date(b.creado_en || 0)-new Date(a.creado_en || 0))
        .map(request => [
            request.id || '',
            request.creado_en ? new Date(request.creado_en).toLocaleString('es-CU',{timeZone:'America/Havana'}) : '',
            Number(request.importe_usd || 0).toFixed(2),
            request.metodo_pago === 'transferencia_cup' ? 'Transferencia CUP' : 'Efectivo USD',
            request.estado || '',
            request.fecha_pago_prevista || '',
            request.pagado_en ? new Date(request.pagado_en).toLocaleString('es-CU',{timeZone:'America/Havana'}) : '',
            request.referencia_pago || ''
        ]);
    if (!movementRows.length && !paymentRows.length) return alert('Todavía no tienes movimientos de comisión para descargar.');
    const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const summary = [
        ['RESUMEN DE COMISIONES'],
        ['Gestor', window.gestorName || ''],
        ['Generado', new Date().toLocaleString('es-CU',{timeZone:'America/Havana'})],
        ['Saldo disponible USD', data.pendingTotal.toFixed(2)],
        ['Liquidado USD', data.paidTotal.toFixed(2)],
        ['Comisión potencial USD', data.pipelineTotal.toFixed(2)],
        [],
        ['SOLICITUDES Y PAGOS'],
        ['ID solicitud','Fecha solicitud','Importe base USD','Forma de pago','Estado','Pago previsto','Fecha pagada','Referencia'],
        ...paymentRows,
        [],
        ['MOVIMIENTOS POR PEDIDO'],
        ['Referencia', 'Fecha del pedido', 'Producto', 'Comisión USD', 'Estado'],
        ...movementRows
    ];
    const csv = summary.map(row => row.map(csvEscape).join(',')).join('\n');
    const blobUrl = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Resumen_pagos_comisiones_${String(window.gestorName || 'gestor').replace(/[^a-z0-9]+/gi, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function getGestorPulseStorageKey() {
    const identity = String(window.gestorName || window.currentUserData?.nombre || 'gestor')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñ]+/g, '-');
    // v4 descarta pendientes guardados por la versión que comparaba
    // precio y comisión como texto.
    return `pth_sales_pulse_v4_${identity || 'gestor'}`;
}

function isProductCurrentlyAvailable(product) {
    return String(product?.disponible || '').trim().toUpperCase() === 'SI';
}

function parseCommercialNumber(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function sameCommercialNumber(left, right) {
    const a = parseCommercialNumber(left);
    const b = parseCommercialNumber(right);
    return a !== null && b !== null && Math.abs(a - b) < 0.01;
}

function buildGestorCatalogSnapshot() {
    return (Array.isArray(catalogSourceProducts) ? catalogSourceProducts : []).reduce((snapshot, product) => {
        const id = String(product.id ?? product.nombre ?? '').trim();
        if (!id) return snapshot;
        snapshot[id] = {
            id,
            nombre: String(product.nombre || 'Producto'),
            disponible: isProductCurrentlyAvailable(product),
            precio: Number(product.precio) || 0,
            comision: Number(product.comision) || 0,
            categoria: String(product.categoria || 'OTROS'),
            thumbnail: String(product.thumbnail || ''),
            updatedAt: String(product.inventario_actualizado_en || product.updated_at || product.fecha_actualizacion || '')
        };
        return snapshot;
    }, {});
}

function getGestorPulseChangeKey(change) {
    return String(change.eventId || [
        change.type,
        change.product?.id,
        change.occurredAt,
        change.previousValue,
        change.newValue
    ].join(':'));
}

function getGestorPulseOpportunities(limit = 3) {
    return (Array.isArray(productosRaw) ? productosRaw : [])
        .filter(isProductCurrentlyAvailable)
        .map(product => ({
            ...product,
            precio: Number(product.precio) || 0,
            comision: Number(product.comision) || 0,
            disponible: true
        }))
        .sort((a, b) => (b.comision - a.comision) || (b.precio - a.precio))
        .slice(0, limit)
        .map(product => ({
            type: 'opportunity',
            product,
            label: 'Disponible para vender',
            detail: product.comision > 0 ? `Puedes ganar $${product.comision.toFixed(0)}` : `Precio $${product.precio.toFixed(0)}`
        }));
}

function formatInventoryEvent(event) {
    const official = catalogSourceProducts.find(product =>
        String(product.id) === String(event.producto_id)
        || product.nombre === event.producto_nombre
    );
    const commercial = productosRaw.find(product =>
        String(product.id) === String(event.producto_id)
        || product.nombre === event.producto_nombre
    );
    const raw = commercial || official || event.datos_producto || {};
    const product = {
        ...raw,
        id: String(event.producto_id || raw.id || event.producto_nombre),
        nombre: event.producto_nombre || raw.nombre || 'Producto',
        precio: Number(raw.precio ?? event.datos_producto?.precio) || 0,
        comision: Number(raw.comision ?? event.datos_producto?.comision) || 0,
        disponible: isProductCurrentlyAvailable(official || raw)
    };
    const previous = parseCommercialNumber(event.valor_anterior);
    const current = parseCommercialNumber(event.valor_nuevo);
    const map = {
        nuevo: { type: 'new', label: 'Nuevo en catálogo', detail: 'Disponible para vender' },
        reposicion: { type: 'restock', label: 'Disponible nuevamente', detail: 'Inventario repuesto' },
        agotado: { type: 'soldout', label: 'Producto agotado', detail: 'Deja de compartir esta oferta' },
        precio: {
            type: 'price',
            label: current < previous ? 'Precio reducido' : 'Precio cambió',
            detail: previous !== null && current !== null
                ? `$${previous.toFixed(2).replace(/\.00$/, '')} → $${current.toFixed(2).replace(/\.00$/, '')}`
                : ''
        },
        comision: {
            type: 'commission',
            label: current > previous ? 'Comisión aumentó' : 'Comisión cambió',
            detail: previous !== null && current !== null
                ? `$${previous.toFixed(2).replace(/\.00$/, '')} → $${current.toFixed(2).replace(/\.00$/, '')}`
                : ''
        }
    };
    const wasShared = getSharedProductIds().has(String(product.id))
        || getSharedProductIds().has(product.nombre);
    if (event.tipo === 'agotado' && wasShared) {
        map.agotado.label = 'Oferta que compartiste agotada';
        map.agotado.detail = 'El enlace ya no permite pedir este producto';
    }
    return {
        ...(map[event.tipo] || { type: event.tipo, label: 'Cambio de inventario', detail: '' }),
        eventId: event.id,
        occurredAt: event.ocurrido_en,
        previousValue: event.valor_anterior,
        newValue: event.valor_nuevo,
        product
    };
}

async function fetchRealInventoryEvents(afterDate) {
    const query = supabaseClient
        .from('inventario_eventos')
        .select('id, producto_id, producto_nombre, tipo, valor_anterior, valor_nuevo, datos_producto, ocurrido_en, confiable')
        .eq('confiable', true)
        .order('ocurrido_en', { ascending: false })
        .limit(60);
    if (afterDate) query.gt('ocurrido_en', afterDate);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(formatInventoryEvent);
}

function getGestorPulseVisual(type) {
    const visuals = {
        new: { icon: 'new_releases', color: 'text-blue-600', bg: 'bg-blue-50' },
        restock: { icon: 'inventory', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        soldout: { icon: 'remove_shopping_cart', color: 'text-rose-600', bg: 'bg-rose-50' },
        price: { icon: 'sell', color: 'text-amber-600', bg: 'bg-amber-50' },
        commission: { icon: 'payments', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        opportunity: { icon: 'trending_up', color: 'text-violet-600', bg: 'bg-violet-50' }
    };
    return visuals[type] || visuals.opportunity;
}

function reconcileGestorPulseItems(items = []) {
    const currentById = new Map(
        Object.values(buildGestorCatalogSnapshot()).map(product => [String(product.id), product])
    );
    const currentByName = new Map(
        Object.values(buildGestorCatalogSnapshot()).map(product => [product.nombre, product])
    );

    return items.reduce((validItems, change) => {
        const currentProduct = currentById.get(String(change?.product?.id || ''))
            || currentByName.get(String(change?.product?.nombre || ''));
        if (change?.type === 'soldout') {
            if (currentProduct?.disponible) return validItems;
            validItems.push(change);
            return validItems;
        }
        if (!currentProduct?.disponible) return validItems;
        if (change?.type === 'price' || change?.type === 'commission') {
            const previous = parseCommercialNumber(change.previousValue);
            const next = parseCommercialNumber(change.newValue);
            if (previous === null || next === null || sameCommercialNumber(previous, next)) return validItems;
            const officialValue = change.type === 'price' ? currentProduct.precio : currentProduct.comision;
            // Un aviso comercial pendiente solo es válido si el valor registrado
            // sigue siendo exactamente el valor oficial vigente.
            if (!sameCommercialNumber(next, officialValue)) return validItems;
        }
        const commercial = productosRaw.find(product =>
            String(product.id) === String(currentProduct.id) || product.nombre === currentProduct.nombre
        );
        validItems.push({
            ...change,
            product: {
                ...(commercial || currentProduct),
                precio: Number(commercial?.precio ?? currentProduct.precio) || 0,
                comision: Number(commercial?.comision ?? currentProduct.comision) || 0,
                disponible: true
            }
        });
        return validItems;
    }, []);
}

function formatRelativeCatalogTime(value) {
    const timestamp = new Date(value || 0).getTime();
    if (!timestamp) return 'Hora de actualización no disponible';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return 'Actualizado hace menos de 1 minuto';
    if (minutes < 60) return `Actualizado hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Actualizado hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Última revisión hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

function renderCatalogFreshness() {
    const freshness = document.getElementById('gestor-pulse-freshness');
    if (!freshness) return;
    const datedProducts = catalogSourceProducts
        .map(product => new Date(product.inventario_actualizado_en || product.updated_at || product.fecha_actualizacion || 0).getTime())
        .filter(Boolean);
    const newestProductUpdate = datedProducts.length ? Math.max(...datedProducts) : 0;
    const reference = catalogLastSyncAt || newestProductUpdate;
    const staleLimit = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const staleCount = catalogSourceProducts.filter(product => {
        const changed = new Date(product.inventario_actualizado_en || product.updated_at || product.fecha_actualizacion || 0).getTime();
        return isProductCurrentlyAvailable(product) && (!changed || changed < staleLimit);
    }).length;
    freshness.innerHTML = `<span class="material-symbols-outlined text-sm">${staleCount ? 'warning' : 'verified'}</span>
        ${gestorSafeText(formatRelativeCatalogTime(reference))}${staleCount ? ` · ${staleCount} productos requieren revisión interna` : ' · Inventario verificado'}`;
    freshness.className = `mt-1 flex items-center gap-1 text-[9px] font-bold ${staleCount ? 'text-amber-600' : 'text-emerald-600'}`;
}

function renderGestorSalesPulse(items = [], hasPendingChanges = false, firstRun = false, preserveHistory = false) {
    const list = document.getElementById('gestor-pulse-list');
    const summary = document.getElementById('gestor-pulse-summary');
    const count = document.getElementById('gestor-pulse-count');
    const footer = document.getElementById('gestor-pulse-footer');
    const markRead = document.getElementById('gestor-pulse-mark-read');
    if (!list || !summary || !count || !footer) return;

    const relevantItems = preserveHistory ? items : reconcileGestorPulseItems(items);
    const displayItems = relevantItems.length ? relevantItems.slice(0, 8) : getGestorPulseOpportunities(3);
    const pendingCount = hasPendingChanges ? relevantItems.length : 0;
    count.textContent = String(pendingCount);
    count.classList.toggle('hidden', !pendingCount);
    markRead?.classList.toggle('hidden', !pendingCount);
    markRead?.classList.toggle('flex', Boolean(pendingCount));
    summary.textContent = pendingCount
        ? `${pendingCount} ${pendingCount === 1 ? 'cambio importante pendiente' : 'cambios importantes pendientes'} de revisar.`
        : firstRun
            ? 'Catálogo sincronizado. Desde tu próxima visita te mostraremos aquí cada cambio.'
            : 'No hay cambios pendientes. Estas son buenas opciones para compartir hoy.';

    if (!displayItems.length) {
        list.innerHTML = `<div class="p-8 text-center">
            <span class="material-symbols-outlined text-3xl text-slate-300">inventory_2</span>
            <p class="mt-2 text-xs font-black text-slate-600">No hay productos disponibles</p>
        </div>`;
        return;
    }

    list.innerHTML = displayItems.map(change => {
        const product = change.product;
        const visual = getGestorPulseVisual(change.type);
        const encodedName = encodeURIComponent(product.nombre);
        const canPromote = change.type !== 'soldout' && product.disponible;
        const fallbackDetail = `$${product.precio.toFixed(0)} USD${product.comision > 0 ? ` · ganas $${product.comision.toFixed(0)}` : ''}`;
        return `
            <article class="grid grid-cols-[44px_minmax(0,1fr)] gap-3 p-4 md:grid-cols-[48px_minmax(0,1fr)_auto] md:items-center md:px-6">
                <div class="flex h-11 w-11 items-center justify-center rounded-2xl ${visual.bg} ${visual.color}">
                    <span class="material-symbols-outlined">${visual.icon}</span>
                </div>
                <div class="min-w-0">
                    <p class="text-[9px] font-black uppercase tracking-wider ${visual.color}">${gestorSafeText(change.label)}</p>
                    <p class="mt-1 truncate text-xs font-black text-slate-800">${gestorSafeText(product.nombre)}</p>
                    <p class="mt-1 text-[10px] font-bold text-slate-500">${gestorSafeText(change.detail || fallbackDetail)}</p>
                </div>
                ${canPromote ? `
                <div class="col-start-2 flex gap-2 md:col-start-auto">
                    <button onclick="openGestorPulseProduct('${encodedName}')" class="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black text-slate-600 md:flex-none">
                        <span class="material-symbols-outlined text-base">visibility</span> Ver
                    </button>
                    <button onclick="shareGestorPulseProduct('${encodedName}')" class="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-[#25D366] px-3 text-[9px] font-black text-white md:flex-none">
                        <i class="fab fa-whatsapp"></i> Compartir
                    </button>
                </div>` : ''}
            </article>`;
    }).join('');
}

async function updateGestorSalesPulse() {
    if (!document.getElementById('gestor-sales-pulse') || !localStorage.getItem('pth_session') || !productosRaw.length) return;
    renderCatalogFreshness();
    const key = getGestorPulseStorageKey();
    let state = null;
    try { state = JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) {}

    if (!state?.lastSeenAt) {
        localStorage.setItem(key, JSON.stringify({ lastSeenAt: new Date().toISOString(), pending: [] }));
        renderGestorSalesPulse([], false, true);
        return;
    }

    try {
        const detected = await fetchRealInventoryEvents(state.lastSeenAt);
        const merged = [...(Array.isArray(state.pending) ? state.pending : []), ...detected];
        const pending = reconcileGestorPulseItems(
            Array.from(new Map(merged.map(change => [getGestorPulseChangeKey(change), change])).values())
        ).sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));
        localStorage.setItem(key, JSON.stringify({ lastSeenAt: state.lastSeenAt, pending }));
        renderGestorSalesPulse(pending, pending.length > 0);
    } catch (error) {
        console.info('Historial de inventario pendiente de activar:', error.message);
        renderGestorSalesPulse([], false);
        const summary = document.getElementById('gestor-pulse-summary');
        if (summary) summary.textContent = 'Inventario disponible verificado. El historial real se activará al ejecutar el nuevo SQL.';
    }
}

function markGestorPulseRead() {
    const key = getGestorPulseStorageKey();
    localStorage.setItem(key, JSON.stringify({
        lastSeenAt: new Date().toISOString(),
        pending: [],
    }));
    renderGestorSalesPulse([], false);
}

async function showInventoryHistory() {
    const summary = document.getElementById('gestor-pulse-summary');
    if (summary) summary.textContent = 'Consultando cambios confirmados directamente por Supabase…';
    try {
        const history = await fetchRealInventoryEvents();
        renderGestorSalesPulse(history.slice(0, 30), false, false, true);
        if (summary) {
            summary.textContent = history.length
                ? `Últimos ${Math.min(history.length, 30)} movimientos reales del inventario.`
                : 'Todavía no hay movimientos registrados desde que se activó el historial.';
        }
    } catch (error) {
        if (summary) summary.textContent = 'Ejecuta el archivo SQL del inventario para activar el historial confiable.';
    }
}

function openGestorPulseProduct(encodedName) {
    const name = decodeURIComponent(encodedName || '');
    const product = productosRaw.find(item => item.nombre === name);
    showSection('catalogo');
    setTimeout(() => {
        if (isProductCurrentlyAvailable(product)) {
            openDetail(name);
            return;
        }
        const search = document.getElementById('search-bar');
        if (search) search.value = product?.categoria || '';
        activeCategory = product?.categoria?.toUpperCase() || 'TODOS';
        gestorCatalogFilter = 'disponibles';
        renderCategories();
        renderProducts();
        document.getElementById('productos-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function shareGestorPulseProduct(encodedName) {
    const name = decodeURIComponent(encodedName || '');
    const product = productosRaw.find(item => item.nombre === name);
    if (!isProductCurrentlyAvailable(product)) {
        updateGestorSalesPulse();
        alert('Este producto acaba de agotarse y ya fue retirado de tus recomendaciones.');
        return;
    }
    shareProductWhatsApp(name);
}

let protectedCustomerCountOwner = null;
let protectedCustomerCountValue = null;

async function loadProtectedCustomerCount() {
    const gestor = String(window.gestorName || '').trim();
    const output = document.getElementById('gestor-protected-customer-count');
    if (!gestor || !output) return;

    if (protectedCustomerCountOwner === gestor && protectedCustomerCountValue !== null) {
        output.textContent = protectedCustomerCountValue;
        return;
    }

    output.textContent = '…';
    let { data, error } = await supabaseClient
        .from('customer_bindings')
        .select('phone, protected_until, last_activity_at, last_purchase_at, updated_at')
        .eq('agent_name', gestor);

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const legacy = await supabaseClient.from('customer_bindings').select('phone').eq('agent_name', gestor);
        data = legacy.data;
        error = legacy.error;
    }

    if (error) {
        console.error('No se pudo cargar el total de clientes protegidos:', error);
        output.textContent = 'Activo';
        output.classList.remove('text-3xl');
        output.classList.add('text-lg');
        return;
    }

    const activeRows = data || [];
    protectedCustomerCountOwner = gestor;
    protectedCustomerCountValue = activeRows.length;
    output.classList.remove('text-lg');
    output.classList.add('text-3xl');
    output.textContent = protectedCustomerCountValue;

    const protectedCustomers = activeRows.map(row => {
        const matchingOrders = (Array.isArray(myOrdersData) ? myOrdersData : [])
            .filter(item => customerPhoneCandidates(item.telefono).some(value => customerPhoneCandidates(row.phone).includes(value)))
            .sort((a, b) => new Date(b.fecha || b.created_at || 0) - new Date(a.fecha || a.created_at || 0));
        const latest = matchingOrders[0];
        return {
            telefono: row.phone,
            cliente: latest?.cliente || row.phone,
            producto: latest?.producto || 'Compra anterior',
            pedido_id: latest?.id || null
        };
    });
    if (window.PTHFollowups?.importProtectedCustomers) {
        window.PTHFollowups.importProtectedCustomers(protectedCustomers).catch(error => console.warn('No se pudo preparar toda la cartera para seguimiento.', error));
    }

    const needsAttention = activeRows
        .map(row => ({ ...row, lastTouch: new Date(row.last_activity_at || row.last_purchase_at || row.updated_at || 0).getTime() }))
        .filter(row => !row.lastTouch || Date.now() - row.lastTouch >= 45 * 86400000)
        .sort((a, b) => a.lastTouch - b.lastTouch);
    const attentionCount = document.getElementById('gestor-protection-attention-count');
    const attentionList = document.getElementById('gestor-protection-attention-list');
    if (attentionCount) attentionCount.textContent = needsAttention.length;
    if (attentionList) {
        attentionList.replaceChildren();
        if (!needsAttention.length) {
            const empty = document.createElement('p');
            empty.className = 'text-[10px] font-bold text-emerald-600';
            empty.textContent = 'Tus clientes tienen seguimiento reciente.';
            attentionList.appendChild(empty);
        } else {
            needsAttention.slice(0, 6).forEach(row => {
                const order = (Array.isArray(myOrdersData) ? myOrdersData : []).find(item => customerPhoneCandidates(item.telefono).some(value => customerPhoneCandidates(row.phone).includes(value)));
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'rounded-xl border border-amber-100 bg-amber-50 p-3 text-left transition hover:border-amber-300';
                card.addEventListener('click', () => {
                    if (window.PTHFollowups?.openCustomer) window.PTHFollowups.openCustomer(row.phone);
                    else openProtectionFollowups();
                });
                const name = document.createElement('strong');
                name.className = 'block truncate text-[11px] text-slate-800';
                name.textContent = order?.cliente || row.phone;
                const meta = document.createElement('span');
                meta.className = 'mt-1 block text-[9px] font-bold text-amber-700';
                const days = row.lastTouch ? Math.floor((Date.now() - row.lastTouch) / 86400000) : null;
                meta.textContent = `${days === null ? 'Sin seguimiento registrado en esta herramienta' : `${days} días sin contacto`} · Atender ahora`;
                card.append(name, meta);
                attentionList.appendChild(card);
            });
        }
    }
}

function openProtectionFollowups() {
    if (window.PTHFollowups?.open) {
        window.PTHFollowups.open('hoy');
        return;
    }
    showDashSection('rendimiento');
}

function renderGestorHome({ ventas = [], entregados = [], pendientes = [], porCobrar = 0 }) {
    prepareGestorDashboardLayout();

    const firstName = (window.gestorName || 'gestor').trim().split(/\s+/)[0];
    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-CU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
    const deliveredTotal = entregados.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const averageTicket = entregados.length ? deliveredTotal / entregados.length : 0;

    const title = document.getElementById('gestor-home-title');
    const date = document.getElementById('gestor-home-date');
    const summary = document.getElementById('gestor-home-summary');
    if (title) title.textContent = `Hola, ${firstName}`;
    if (date) date.textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    if (summary) {
        summary.textContent = pendientes.length
            ? `Tienes ${pendientes.length} ${pendientes.length === 1 ? 'pedido activo que requiere' : 'pedidos activos que requieren'} seguimiento.`
            : 'Todo está al día. Es un buen momento para compartir ofertas y generar nuevas ventas.';
    }

    const values = {
        'gestor-kpi-active': pendientes.length,
        'gestor-kpi-receivable': `$${porCobrar.toFixed(2)}`,
        'gestor-kpi-delivered': entregados.length,
        'gestor-kpi-ticket': `$${averageTicket.toFixed(0)}`
    };
    Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    renderGestorDailyOpportunity();
    renderGestorToday(ventas);
    updateGestorSalesPulse();
    renderCommissionCenter();
    renderGestorPerformance(ventas);
    loadProtectedCustomerCount();

    const list = document.getElementById('gestor-home-orders');
    if (!list) return;
    const recent = [...ventas]
        .sort((a, b) => new Date(b.fecha || b.created_at || 0) - new Date(a.fecha || a.created_at || 0))
        .slice(0, 4);

    if (!recent.length) {
        list.innerHTML = `
            <div class="p-8 text-center">
                <span class="material-symbols-outlined text-3xl text-slate-300">inbox</span>
                <p class="mt-2 text-xs font-black text-slate-600">Todavía no hay pedidos</p>
                <p class="mt-1 text-[11px] text-slate-400">Comparte tu enlace para comenzar a vender.</p>
            </div>`;
        return;
    }

    list.innerHTML = recent.map(order => {
        const status = order.estado || 'Pendiente';
        const isDelivered = status === 'Entregado';
        const isCancelled = status === 'Cancelado';
        const statusClass = isDelivered
            ? 'bg-emerald-50 text-emerald-700'
            : isCancelled ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
        const orderDate = order.fecha || order.created_at;
        const dateText = orderDate
            ? new Date(orderDate).toLocaleDateString('es-CU', { day: '2-digit', month: 'short' })
            : 'Sin fecha';
        return `
            <div class="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-4 md:flex md:px-6">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <span class="material-symbols-outlined text-xl">shopping_bag</span>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-black text-slate-800">${gestorSafeText(order.producto || 'Pedido')}</p>
                    <p class="mt-1 truncate text-[10px] font-bold text-slate-400">${gestorSafeText(order.cliente || 'Cliente')} · ${dateText}</p>
                </div>
                <div class="col-start-2 flex min-w-0 items-center justify-between gap-2 md:block md:shrink-0 md:text-right">
                    <p class="text-xs font-black text-slate-800">$${(Number(order.total) || 0).toFixed(0)}</p>
                    <div class="flex min-w-0 items-center justify-end gap-1.5">
                        <span class="inline-flex max-w-[130px] truncate rounded-full px-2 py-1 text-[8px] font-black uppercase ${statusClass}">${gestorSafeText(status)}</span>
                        ${order.telefono ? `
                        <button onclick="contactGestorOrder('${String(order.telefono).replace(/\D/g, '')}')" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" title="Contactar por WhatsApp">
                            <i class="fab fa-whatsapp text-sm"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');
}

window.addEventListener('pth:followups-updated', event => {
    renderGestorToday(myOrdersData, event.detail?.stats || getGestorFollowupStats());
});

function contactGestorOrder(phone) {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) return;
    const normalizedPhone = cleanPhone.startsWith('53') ? cleanPhone : `53${cleanPhone}`;
    const message = 'Hola, te escribo de ParaTuHogar para dar seguimiento a tu pedido.';
    window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function requestVerifiedReview(orderId) {
    const order = (Array.isArray(myOrdersData) ? myOrdersData : []).find(item => String(item.id) === String(orderId));
    if (!order || order.estado !== 'Entregado') return alert('La opinión solo puede solicitarse para una compra entregada.');
    const cleanPhone = String(order.telefono || '').replace(/\D/g, '');
    if (!cleanPhone) return alert('Este pedido no tiene un teléfono válido.');
    const normalizedPhone = cleanPhone.startsWith('53') ? cleanPhone : `53${cleanPhone}`;
    const firstName = String(order.cliente || 'cliente').trim().split(/\s+/)[0];
    const product = String(order.producto || 'tu compra').replace(/\s*\[.*?\]\s*/g, '').trim();
    const message = `Hola ${firstName}. Esperamos que estés disfrutando tu compra de *${product}* en ParaTuHogar.\n\nQueremos conocer tu experiencia:\n\n1️⃣ ¿Cómo valoras nuestra atención del 1 al 5?\n2️⃣ ¿Cómo valoras la mensajería del 1 al 5?\n3️⃣ ¿Qué comentario deseas compartir?\n\nSi estás de acuerdo con que publiquemos tu opinión de forma anónima, responde también: *AUTORIZO SU PUBLICACIÓN*.\n\nSolo mostraremos el producto y la fecha aproximada. El municipio y cualquier foto se publicarán únicamente si los autorizas por separado. Nunca publicaremos tu nombre, teléfono ni esta conversación.`;
    window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

const WARRANTY_ANGEL_PHONE = '5355386602';
const WARRANTY_CASE_STATES = [
    'Pendiente de enviar a Ángel',
    'Enviado a Ángel',
    'Esperando respuesta',
    'Esperando información del cliente',
    'Coordinando con proveedor',
    'Revisión técnica',
    'Reparación',
    'Cambio autorizado',
    'Resuelto',
    'Fuera de garantía',
    'Cerrado'
];
let gestorWarrantyCases = [];

function parseWarrantyDays(warrantyText) {
    const value = String(warrantyText || '').trim().toLowerCase();
    const number = Number((value.match(/\d+(?:[.,]\d+)?/) || [0])[0].replace(',', '.')) || 0;
    if (!number) return null;
    if (value.includes('año')) return Math.round(number * 365);
    if (value.includes('mes')) return Math.round(number * 30);
    if (value.includes('semana')) return Math.round(number * 7);
    if (value.includes('día') || value.includes('dia')) return Math.round(number);
    return null;
}

function normalizeWarrantyProductName(value) {
    return String(value || '')
        .replace(/\[[^\]]*]/g, '')
        .replace(/^\s*\d+\s*x\s*/i, '')
        .trim()
        .toLowerCase();
}

function getWarrantyProductForOrder(order) {
    const orderText = normalizeWarrantyProductName(order?.producto);
    if (!orderText) return null;
    return (Array.isArray(productosRaw) ? productosRaw : []).find(product => {
        const name = normalizeWarrantyProductName(product.nombre);
        return name && (orderText.includes(name) || name.includes(orderText));
    }) || null;
}

function getOrderWarrantySnapshot(order) {
    const product = getWarrantyProductForOrder(order);
    const warrantyText = String(order?.garantia_venta || product?.garantia || 'Garantía por confirmar con Ángel').trim();
    const warrantyDays = Number(order?.garantia_dias)
        || (warrantyText.includes('|') ? null : parseWarrantyDays(warrantyText));
    const startSource = order?.fecha_entrega || order?.fecha;
    const start = startSource ? new Date(startSource) : null;
    const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
    const end = validStart && warrantyDays ? new Date(validStart.getTime() + warrantyDays * 86400000) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = end ? end >= today : null;
    return {
        product,
        text: warrantyText,
        days: warrantyDays || null,
        start: validStart,
        end,
        active,
        provider: order?.proveedor || product?.proveedor || 'Por confirmar'
    };
}

function formatWarrantyDate(date) {
    if (!date || Number.isNaN(date.getTime())) return 'Por confirmar';
    return date.toLocaleDateString('es-CU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function openWarrantyCaseModal(orderId) {
    const order = (Array.isArray(myOrdersData) ? myOrdersData : []).find(item => String(item.id) === String(orderId));
    if (!order || order.estado !== 'Entregado') {
        return alert('Solo se puede reportar una garantía desde un pedido entregado.');
    }
    const snapshot = getOrderWarrantySnapshot(order);
    document.getElementById('warranty-order-id').value = String(order.id);
    document.getElementById('warranty-modal-order').textContent = `${order.orden_dia || 'Pedido'} · ${order.cliente || 'Cliente'}`;
    document.getElementById('warranty-summary').innerHTML = `
        <div class="flex items-start gap-3">
            <span class="material-symbols-outlined rounded-xl bg-white p-2 text-amber-600">verified_user</span>
            <div class="min-w-0">
                <p class="text-xs font-black text-slate-800">${gestorSafeText(order.producto || 'Producto')}</p>
                <p class="mt-1 text-[10px] font-bold text-slate-600">Garantía registrada: ${gestorSafeText(snapshot.text)}</p>
                <p class="mt-1 text-[9px] font-bold text-slate-500">Inicio usado: ${formatWarrantyDate(snapshot.start)} · Vencimiento estimado: ${formatWarrantyDate(snapshot.end)}</p>
                <p class="mt-2 text-[9px] font-black uppercase ${snapshot.active === false ? 'text-rose-600' : snapshot.active === true ? 'text-emerald-600' : 'text-amber-700'}">
                    ${snapshot.active === false ? 'Período estimado vencido: requiere revisión' : snapshot.active === true ? 'Dentro del período estimado' : 'Vigencia por confirmar con Ángel'}
                </p>
            </div>
        </div>`;
    document.getElementById('warranty-case-form').reset();
    document.getElementById('warranty-order-id').value = String(order.id);
    const modal = document.getElementById('modal-caso-garantia');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeWarrantyCaseModal() {
    document.getElementById('modal-caso-garantia')?.classList.add('hidden');
    document.body.style.overflow = '';
}

function buildWarrantyWhatsAppMessage(order, warranty, formData, caseId) {
    const status = warranty.active === false
        ? 'Período estimado vencido — requiere revisión'
        : warranty.active === true ? 'Dentro del período estimado' : 'Vigencia por confirmar';
    return `🛠️ *SOLICITUD DE GARANTÍA*

*Caso:* ${caseId ? String(caseId).slice(0, 8).toUpperCase() : 'Recién creado'}
*Pedido:* ${order.orden_dia || order.id}
*Gestor:* ${window.gestorName || order.gestor || 'Gestor'}
*Cliente:* ${order.cliente || 'No informado'}
*Teléfono:* ${order.telefono || 'No informado'}
*Producto:* ${order.producto || 'No informado'}
*Proveedor:* ${warranty.provider}
*Garantía registrada:* ${warranty.text}
*Inicio usado:* ${formatWarrantyDate(warranty.start)}
*Vencimiento estimado:* ${formatWarrantyDate(warranty.end)}
*Estado estimado:* ${status}

*Problema informado:*
${formData.problema}

*Comenzó:* ${formData.fecha_inicio_problema || 'No informado'}
*El equipo enciende:* ${formData.enciende}
*Daño visible:* ${formData.dano_visible}
*Probado al recibir:* ${formData.probado_al_recibir}
*Instalación:* ${formData.instalacion_tecnica}
*Factura/certificado:* ${formData.tiene_factura}
*Solución esperada:* ${formData.solucion_esperada || 'No informada'}
*Notas del gestor:* ${formData.notas_gestor || 'Sin notas'}

Solicito indicaciones para coordinar el caso con el proveedor.

📎 Las fotos, videos, audios o documentos se enviarán directamente en esta conversación de WhatsApp.`;
}

async function submitWarrantyCase(event) {
    event.preventDefault();
    const orderId = document.getElementById('warranty-order-id').value;
    const order = (Array.isArray(myOrdersData) ? myOrdersData : []).find(item => String(item.id) === String(orderId));
    if (!order) return alert('No se encontró el pedido.');
    const warranty = getOrderWarrantySnapshot(order);
    const formData = {
        problema: document.getElementById('warranty-problem').value.trim(),
        fecha_inicio_problema: document.getElementById('warranty-problem-date').value || null,
        enciende: document.getElementById('warranty-powers-on').value,
        dano_visible: document.getElementById('warranty-visible-damage').value,
        probado_al_recibir: document.getElementById('warranty-tested-delivery').value,
        instalacion_tecnica: document.getElementById('warranty-installation').value,
        tiene_factura: document.getElementById('warranty-has-document').value,
        solucion_esperada: document.getElementById('warranty-expected-solution').value.trim(),
        notas_gestor: document.getElementById('warranty-manager-notes').value.trim()
    };
    if (!formData.problema) return alert('Describe el problema informado por el cliente.');

    const button = document.getElementById('warranty-submit-button');
    button.disabled = true;
    button.innerHTML = '<span class="loader"></span> Guardando caso…';
    try {
        const payload = {
            pedido_id: String(order.id),
            gestor: window.gestorName || order.gestor || 'Gestor',
            producto: order.producto || 'Producto',
            proveedor: warranty.provider,
            garantia_texto: warranty.text,
            garantia_dias: warranty.days,
            garantia_inicio: warranty.start ? warranty.start.toISOString().slice(0, 10) : null,
            garantia_fin: warranty.end ? warranty.end.toISOString().slice(0, 10) : null,
            ...formData,
            estado: 'Enviado a Ángel'
        };
        const { data, error } = await supabaseClient
            .from('casos_garantia')
            .insert(payload)
            .select('id')
            .single();
        if (error) throw error;
        const message = buildWarrantyWhatsAppMessage(order, warranty, formData, data?.id);
        closeWarrantyCaseModal();
        await loadGestorWarrantyCases();
        window.open(`https://wa.me/${WARRANTY_ANGEL_PHONE}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    } catch (error) {
        console.error('No se pudo crear el caso de garantía:', error);
        alert(`No se pudo guardar el caso. Verifica que ejecutaste centro-posventa-garantias.sql.\n\n${error.message || ''}`);
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fab fa-whatsapp text-base"></i> Guardar y enviar a Ángel';
    }
}

function getWarrantyCaseStatusClass(status) {
    if (['Resuelto', 'Cerrado'].includes(status)) return 'bg-emerald-50 text-emerald-700';
    if (status === 'Fuera de garantía') return 'bg-rose-50 text-rose-700';
    if (['Revisión técnica', 'Reparación', 'Cambio autorizado'].includes(status)) return 'bg-blue-50 text-blue-700';
    return 'bg-amber-50 text-amber-700';
}

async function updateWarrantyCaseStatus(caseId, status) {
    if (!WARRANTY_CASE_STATES.includes(status)) return;
    const { error } = await supabaseClient
        .from('casos_garantia')
        .update({ estado: status })
        .eq('id', caseId)
        .eq('gestor', window.gestorName);
    if (error) {
        console.error(error);
        return alert('No se pudo actualizar el estado del caso.');
    }
    await loadGestorWarrantyCases();
}

function contactWarrantyCustomer(orderId) {
    const order = (Array.isArray(myOrdersData) ? myOrdersData : []).find(item => String(item.id) === String(orderId));
    const phone = String(order?.telefono || '').replace(/\D/g, '');
    if (!phone) return alert('Este pedido no tiene un teléfono válido.');
    const normalized = phone.startsWith('53') ? phone : `53${phone}`;
    const firstName = String(order.cliente || 'cliente').trim().split(/\s+/)[0];
    const message = `Hola ${firstName}, te escribo de ParaTuHogar para actualizarte sobre el caso de garantía de tu equipo.`;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function resendWarrantyCaseToAngel(caseId) {
    const warrantyCase = gestorWarrantyCases.find(item => String(item.id) === String(caseId));
    const order = (Array.isArray(myOrdersData) ? myOrdersData : []).find(item => String(item.id) === String(warrantyCase?.pedido_id));
    if (!warrantyCase || !order) return alert('No se encontraron los datos completos del caso.');
    const warranty = {
        text: warrantyCase.garantia_texto,
        days: warrantyCase.garantia_dias,
        start: warrantyCase.garantia_inicio ? new Date(`${warrantyCase.garantia_inicio}T00:00:00`) : null,
        end: warrantyCase.garantia_fin ? new Date(`${warrantyCase.garantia_fin}T00:00:00`) : null,
        active: warrantyCase.garantia_fin ? new Date(`${warrantyCase.garantia_fin}T23:59:59`) >= new Date() : null,
        provider: warrantyCase.proveedor || 'Por confirmar'
    };
    const message = buildWarrantyWhatsAppMessage(order, warranty, warrantyCase, warrantyCase.id);
    window.open(`https://wa.me/${WARRANTY_ANGEL_PHONE}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function renderGestorWarrantyCases() {
    const container = document.getElementById('gestor-warranty-list');
    const count = document.getElementById('gestor-warranty-count');
    if (!container || !count) return;
    const activeCases = gestorWarrantyCases.filter(item => !['Resuelto', 'Cerrado'].includes(item.estado));
    count.textContent = `${activeCases.length} ${activeCases.length === 1 ? 'caso activo' : 'casos activos'}`;
    if (!gestorWarrantyCases.length) {
        container.innerHTML = `
            <div class="p-8 text-center">
                <span class="material-symbols-outlined text-3xl text-slate-300">health_and_safety</span>
                <p class="mt-2 text-xs font-black text-slate-700">No tienes casos de garantía</p>
                <p class="mt-1 text-[10px] font-bold text-slate-400">Cuando un cliente reporte un problema, abre el caso desde su pedido entregado.</p>
            </div>`;
        return;
    }
    container.innerHTML = gestorWarrantyCases.slice(0, 8).map(item => {
        const updated = item.ultima_actualizacion
            ? new Date(item.ultima_actualizacion).toLocaleDateString('es-CU', { day: '2-digit', month: 'short' })
            : 'Sin fecha';
        const options = WARRANTY_CASE_STATES.map(status =>
            `<option value="${gestorSafeText(status)}" ${status === item.estado ? 'selected' : ''}>${gestorSafeText(status)}</option>`
        ).join('');
        return `
            <article class="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="rounded-full px-2 py-1 text-[8px] font-black uppercase ${getWarrantyCaseStatusClass(item.estado)}">${gestorSafeText(item.estado)}</span>
                        <span class="text-[9px] font-bold text-slate-400">Actualizado ${updated}</span>
                    </div>
                    <p class="mt-2 truncate text-xs font-black text-slate-800">${gestorSafeText(item.producto)}</p>
                    <p class="mt-1 line-clamp-2 text-[10px] font-bold text-slate-500">${gestorSafeText(item.problema)}</p>
                    <p class="mt-1 text-[9px] font-bold text-slate-400">${gestorSafeText(item.garantia_texto)} · ${gestorSafeText(item.proveedor || 'Proveedor por confirmar')}</p>
                </div>
                <div class="flex items-center gap-2 overflow-x-auto">
                    <select onchange="updateWarrantyCaseStatus('${item.id}', this.value)" class="h-10 min-w-[170px] rounded-xl border-slate-200 bg-white text-[9px] font-black text-slate-600">${options}</select>
                    <button onclick="contactWarrantyCustomer('${gestorSafeText(item.pedido_id)}')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600" title="Actualizar al cliente"><i class="fab fa-whatsapp"></i></button>
                    <button onclick="resendWarrantyCaseToAngel('${item.id}')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600" title="Reenviar a Ángel"><span class="material-symbols-outlined text-lg">forward_to_inbox</span></button>
                </div>
            </article>`;
    }).join('');
}

async function loadGestorWarrantyCases() {
    const container = document.getElementById('gestor-warranty-list');
    if (!container || !window.gestorName) return;
    const { data, error } = await supabaseClient
        .from('casos_garantia')
        .select('*')
        .eq('gestor', window.gestorName)
        .order('ultima_actualizacion', { ascending: false })
        .limit(20);
    if (error) {
        console.error('Centro de garantía no disponible:', error);
        container.innerHTML = '<div class="p-6 text-center text-[10px] font-bold text-slate-400">Ejecuta el archivo SQL del centro de posventa para activar esta sección.</div>';
        return;
    }
    gestorWarrantyCases = data || [];
    renderGestorWarrantyCases();
}

function getGestorOrderSource(order) {
    const source = String(order?.origen || '').trim().toLowerCase();
    if (source.includes('enlace')) return 'link';
    return 'manual';
}

function getGestorCustomerKey(order) {
    const phone = String(order?.telefono || '').replace(/\D/g, '');
    if (phone) return `tel:${phone.slice(-8)}`;
    return `name:${String(order?.cliente || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

const gestorPerformanceCharts = {};

function replaceGestorPerformanceChart(key, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    if (gestorPerformanceCharts[key]) gestorPerformanceCharts[key].destroy();
    gestorPerformanceCharts[key] = new Chart(canvas.getContext('2d'), config);
}

function getPerformanceChartDefaults() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#fff',
                bodyColor: '#e2e8f0',
                padding: 12,
                cornerRadius: 12,
                displayColors: true
            }
        }
    };
}

function renderGestorPerformanceCharts(all, delivered) {
    const chartSection = document.getElementById('sub-dash-rendimiento');
    if (chartSection?.classList.contains('hidden')) return;
    if (typeof Chart === 'undefined' && window.PTHAssets) {
        window.PTHAssets.load('charts').then(() => {
            if (!chartSection?.classList.contains('hidden')) renderGestorPerformance();
        }).catch(error => console.warn(error.message));
        return;
    }
    const baseOptions = getPerformanceChartDefaults();
    const monthFormatter = new Intl.DateTimeFormat('es-CU', { month: 'short' });
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        return {
            key: `${date.getFullYear()}-${date.getMonth()}`,
            label: monthFormatter.format(date).replace('.', '').replace(/^\w/, letter => letter.toUpperCase())
        };
    });
    const deliveredByMonth = Object.fromEntries(months.map(month => [month.key, { sales: 0, commission: 0, count: 0 }]));
    delivered.forEach(order => {
        const date = new Date(order.fecha || order.created_at || 0);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!deliveredByMonth[key]) return;
        deliveredByMonth[key].sales += Number(order.total) || 0;
        deliveredByMonth[key].commission += getOrderCommission(order);
        deliveredByMonth[key].count += 1;
    });
    replaceGestorPerformanceChart('sales', 'performance-sales-chart', {
        type: 'bar',
        data: {
            labels: months.map(month => month.label),
            datasets: [
                {
                    type: 'bar',
                    label: 'Ventas entregadas',
                    data: months.map(month => deliveredByMonth[month.key].sales),
                    backgroundColor: '#2563eb',
                    hoverBackgroundColor: '#1d4ed8',
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 44
                },
                {
                    type: 'line',
                    label: 'Comisiones',
                    data: months.map(month => deliveredByMonth[month.key].commission),
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 3,
                    tension: 0.35,
                    yAxisID: 'commission'
                }
            ]
        },
        options: {
            ...baseOptions,
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: '#64748b', font: { size: 11, weight: 'bold' } }
                },
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: '#eef2f7' },
                    ticks: {
                        color: '#64748b',
                        callback: value => `$${Number(value).toLocaleString('es-CU')}`
                    }
                },
                commission: {
                    beginAtZero: true,
                    position: 'right',
                    border: { display: false },
                    grid: { display: false },
                    ticks: { color: '#059669', callback: value => `$${value}` }
                }
            },
            plugins: {
                ...baseOptions.plugins,
                tooltip: {
                    ...baseOptions.plugins.tooltip,
                    callbacks: {
                        label: context => `${context.dataset.label}: $${Number(context.raw || 0).toFixed(2)}`
                    }
                }
            }
        }
    });

    const statusGroups = [
        { label: 'Pendientes', test: state => state.includes('pendiente'), color: '#f59e0b' },
        { label: 'En preparación', test: state => state.includes('prepar') || state.includes('confirm'), color: '#8b5cf6' },
        { label: 'Con mensajero', test: state => state.includes('mensaj') || state.includes('asignado'), color: '#0ea5e9' },
        { label: 'Recogida', test: state => state.includes('recog'), color: '#14b8a6' },
        { label: 'Entregados', test: state => state.includes('entregado'), color: '#10b981' }
    ];
    const funnelValues = statusGroups.map(group => all.filter(order =>
        group.test(String(order.estado || 'Pendiente').toLowerCase())).length);
    replaceGestorPerformanceChart('funnel', 'performance-funnel-chart', {
        type: 'bar',
        data: {
            labels: statusGroups.map(group => group.label),
            datasets: [{
                data: funnelValues,
                backgroundColor: statusGroups.map(group => group.color),
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 24
            }]
        },
        options: {
            ...baseOptions,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    grace: '10%',
                    border: { display: false },
                    grid: { color: '#eef2f7' },
                    ticks: { precision: 0, color: '#64748b' }
                },
                y: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: '#334155', font: { size: 11, weight: 'bold' } }
                }
            },
            plugins: {
                ...baseOptions.plugins,
                tooltip: {
                    ...baseOptions.plugins.tooltip,
                    callbacks: { label: context => `${context.raw} pedidos` }
                }
            }
        }
    });

    const commissionData = getCommissionCenterData();
    const commissionValues = [
        commissionData.paidTotal,
        commissionData.pendingTotal,
        commissionData.pipelineTotal
    ];
    replaceGestorPerformanceChart('commission', 'performance-commission-chart', {
        type: 'doughnut',
        data: {
            labels: ['Liquidado', 'Por cobrar', 'En proceso'],
            datasets: [{
                data: commissionValues,
                backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'],
                hoverOffset: 7,
                borderColor: '#ffffff',
                borderWidth: 5
            }]
        },
        options: {
            ...baseOptions,
            cutout: '72%',
            plugins: {
                ...baseOptions.plugins,
                tooltip: {
                    ...baseOptions.plugins.tooltip,
                    callbacks: { label: context => `${context.label}: $${Number(context.raw || 0).toFixed(2)}` }
                }
            }
        }
    });
    const commissionLegend = document.getElementById('performance-commission-legend');
    if (commissionLegend) {
        const total = commissionValues.reduce((sum, value) => sum + value, 0);
        const rows = [
            ['Liquidado', commissionValues[0], 'bg-emerald-500'],
            ['Por cobrar', commissionValues[1], 'bg-amber-500'],
            ['En proceso', commissionValues[2], 'bg-blue-500']
        ];
        commissionLegend.innerHTML = rows.map(([label, value, color]) => `
            <div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span class="flex items-center gap-2 text-[10px] font-black text-slate-600"><i class="h-2.5 w-2.5 rounded-full ${color}"></i>${label}</span>
                <span class="text-xs font-black text-slate-900">$${Number(value).toFixed(2)} <small class="text-[8px] text-slate-400">${total ? Math.round((value / total) * 100) : 0}%</small></span>
            </div>`).join('');
    }

    const sourceLabels = ['Por mi enlace', 'Registrado por mí'];
    const sourceValues = ['link', 'manual'].map(source =>
        all.filter(order => getGestorOrderSource(order) === source).length);
    replaceGestorPerformanceChart('sources', 'performance-source-chart', {
        type: 'doughnut',
        data: {
            labels: sourceLabels,
            datasets: [{
                data: sourceValues,
                backgroundColor: ['#2563eb', '#f97316'],
                borderColor: '#ffffff',
                borderWidth: 5,
                hoverOffset: 6
            }]
        },
        options: {
            ...baseOptions,
            cutout: '68%',
            plugins: {
                ...baseOptions.plugins,
                tooltip: {
                    ...baseOptions.plugins.tooltip,
                    callbacks: { label: context => `${context.label}: ${context.raw} pedidos` }
                }
            }
        }
    });
}

function renderGestorPerformance(orders = myOrdersData) {
    const section = document.getElementById('sub-dash-rendimiento');
    if (!section) return;
    const all = (Array.isArray(orders) ? orders : []).filter(order => order.estado !== 'Cancelado');
    const delivered = all.filter(order => order.estado === 'Entregado');
    const deliveredValue = delivered.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const closeRate = all.length ? Math.round((delivered.length / all.length) * 100) : 0;
    const deliveredCommission = delivered.reduce((sum, order) => sum + getOrderCommission(order), 0);
    const activeOrders = all.filter(order => order.estado !== 'Entregado');

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    const orderDate = order => new Date(order.fecha || order.created_at || 0);
    const currentDelivered = delivered.filter(order => orderDate(order) >= thirtyDaysAgo).length;
    const previousDelivered = delivered.filter(order => {
        const date = orderDate(order);
        return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length;
    const trend = currentDelivered - previousDelivered;

    const customerMap = new Map();
    all.forEach(order => {
        const key = getGestorCustomerKey(order);
        if (key === 'name:') return;
        if (!customerMap.has(key)) {
            customerMap.set(key, {
                name: order.cliente || 'Cliente',
                phone: String(order.telefono || '').replace(/\D/g, ''),
                orders: []
            });
        }
        customerMap.get(key).orders.push(order);
    });
    const repeatCustomers = [...customerMap.values()]
        .filter(customer => customer.orders.length >= 2)
        .sort((a, b) => {
            if (b.orders.length !== a.orders.length) return b.orders.length - a.orders.length;
            return Math.max(...b.orders.map(order => orderDate(order).getTime())) -
                Math.max(...a.orders.map(order => orderDate(order).getTime()));
        });
    const uniqueCustomers = customerMap.size;
    const repeatRate = uniqueCustomers ? Math.round((repeatCustomers.length / uniqueCustomers) * 100) : 0;

    const values = {
        'performance-delivered': String(delivered.length),
        'performance-close-rate': `${closeRate}%`,
        'performance-repeat-count': String(repeatCustomers.length),
        'performance-sales-total': `$${deliveredValue.toFixed(0)}`,
        'performance-average-ticket': `$${(delivered.length ? deliveredValue / delivered.length : 0).toFixed(0)}`,
        'performance-average-commission': `$${(delivered.length ? deliveredCommission / delivered.length : 0).toFixed(2)}`,
        'performance-active-orders': String(activeOrders.length),
        'performance-repeat-rate': `${repeatRate}%`
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    const trendElement = document.getElementById('performance-delivered-trend');
    if (trendElement) {
        trendElement.textContent = trend === 0
            ? `${currentDelivered} en los últimos 30 días · sin cambio`
            : `${currentDelivered} en 30 días · ${trend > 0 ? '+' : ''}${trend} vs. periodo anterior`;
    }
    const insight = document.getElementById('performance-main-insight');
    if (insight) {
        if (!all.length) {
            insight.textContent = 'Cuando registres tus primeros pedidos, aquí verás avances, recurrencia y canales que convierten.';
        } else if (repeatCustomers.length) {
            insight.textContent = `Tienes ${repeatCustomers.length} ${repeatCustomers.length === 1 ? 'cliente que ya volvió' : 'clientes que ya volvieron'}. Recontactarlos puede ser tu camino más corto hacia la próxima venta.`;
        } else if (closeRate >= 60) {
            insight.textContent = `Tu tasa de cierre es ${closeRate}%. Mantén el seguimiento y empieza a cultivar la recompra de tus clientes entregados.`;
        } else {
            insight.textContent = `Has cerrado ${closeRate}% de tus pedidos válidos. Prioriza los pedidos activos y los seguimientos vencidos para elevar ese resultado.`;
        }
    }

    const sourceDefinitions = [
        { key: 'link', label: 'Por mi enlace', color: 'bg-blue-600', text: 'text-blue-700' },
        { key: 'manual', label: 'Registrado por mí', color: 'bg-orange-500', text: 'text-orange-700' }
    ];
    const knownSourceTotal = all.length;
    const sourcesContainer = document.getElementById('performance-sources');
    if (sourcesContainer) {
        sourcesContainer.innerHTML = sourceDefinitions.map(source => {
            const count = all.filter(order => getGestorOrderSource(order) === source.key).length;
            const percentage = knownSourceTotal ? Math.round((count / knownSourceTotal) * 100) : 0;
            return `
                <div>
                    <div class="mb-2 flex items-center justify-between gap-3 text-[10px] font-black">
                        <span class="${source.text}">${source.label}</span>
                        <span class="text-slate-700">${count} · ${percentage}%</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div class="h-full rounded-full ${source.color}" style="width:${percentage}%"></div>
                    </div>
                </div>`;
        }).join('');
    }
    const sourceNote = document.getElementById('performance-source-note');
    if (sourceNote) {
        sourceNote.textContent = '“Por mi enlace” identifica pedidos atribuidos a tu enlace personal. Los demás corresponden a órdenes registradas directamente por ti.';
    }
    renderGestorPerformanceCharts(all, delivered);

    const repeatContainer = document.getElementById('performance-repeat-customers');
    if (repeatContainer) {
        if (!repeatCustomers.length) {
            repeatContainer.innerHTML = `
                <div class="p-8 text-center">
                    <span class="material-symbols-outlined text-3xl text-slate-300">group</span>
                    <p class="mt-2 text-xs font-black text-slate-700">Aún no hay compradores recurrentes</p>
                    <p class="mt-1 text-[10px] font-bold text-slate-400">Se destacarán automáticamente al completar su segundo pedido.</p>
                </div>`;
        } else {
            repeatContainer.innerHTML = repeatCustomers.slice(0, 6).map(customer => {
                const deliveredCount = customer.orders.filter(order => order.estado === 'Entregado').length;
                const total = customer.orders
                    .filter(order => order.estado === 'Entregado')
                    .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
                const phone = customer.phone;
                return `
                    <article class="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 p-4 md:px-6">
                        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                            <span class="material-symbols-outlined">workspace_premium</span>
                        </div>
                        <div class="min-w-0">
                            <p class="truncate text-xs font-black text-slate-800">${gestorSafeText(customer.name)}</p>
                            <p class="mt-1 text-[9px] font-bold text-slate-400">${customer.orders.length} pedidos · ${deliveredCount} entregados · $${total.toFixed(0)}</p>
                        </div>
                        ${phone ? `<button onclick="contactGestorOrder('${phone}')" class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600" title="Recontactar por WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ''}
                    </article>`;
            }).join('');
        }
    }

    const ordersContainer = document.getElementById('performance-orders');
    if (!ordersContainer) return;
    const recent = [...all].sort((a, b) => orderDate(b) - orderDate(a)).slice(0, 12);
    if (!recent.length) {
        ordersContainer.innerHTML = '<div class="p-8 text-center text-xs font-bold text-slate-400">Todavía no hay pedidos para gestionar.</div>';
        return;
    }
    ordersContainer.innerHTML = recent.map(order => {
        const id = String(order.id || '').replace(/'/g, '');
        const phone = String(order.telefono || '').replace(/\D/g, '');
        const source = getGestorOrderSource(order);
        const sourceLabels = { link: 'Mi enlace', manual: 'Registrado por mí' };
        return `
            <article class="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="truncate text-xs font-black text-slate-800">${gestorSafeText(order.cliente || 'Cliente')}</p>
                        <span class="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-500">${sourceLabels[source]}</span>
                        <span class="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase text-blue-700">${gestorSafeText(order.estado || 'Pendiente')}</span>
                    </div>
                    <p class="mt-1 truncate text-[10px] font-bold text-slate-500">${gestorSafeText(order.producto || 'Pedido')}</p>
                    <p class="mt-1 text-[9px] font-bold text-slate-400">${getCommissionOrderDate(order)} · $${(Number(order.total) || 0).toFixed(0)}</p>
                </div>
                <div class="flex gap-2 overflow-x-auto">
                    ${phone ? `<button onclick="contactGestorOrder('${phone}')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ''}
                    ${order.estado === 'Entregado' && phone ? `<button onclick="requestVerifiedReview('${id}')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600" title="Solicitar opinión verificada"><span class="material-symbols-outlined text-lg">reviews</span></button>` : ''}
                    ${order.estado === 'Entregado' ? `<button onclick="openWarrantyCaseModal('${id}')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600" title="Reportar garantía"><span class="material-symbols-outlined text-lg">health_and_safety</span></button>` : ''}
                    <button onclick="reenviarPedidoAdmin('${id}')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600" title="Reenviar pedido"><span class="material-symbols-outlined text-lg">send</span></button>
                    <button onclick="prepararPDFDesdeHistorial('${id}','descargar')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600" title="Descargar factura"><span class="material-symbols-outlined text-lg">download</span></button>
                    <button onclick="prepararPDFDesdeHistorial('${id}','compartir')" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600" title="Compartir factura"><span class="material-symbols-outlined text-lg">share</span></button>
                </div>
            </article>`;
    }).join('');
}

function renderGestorHomeFromCache() {
    const ventas = Array.isArray(myOrdersData) ? myOrdersData : [];
    const entregados = ventas.filter(order => order.estado === 'Entregado');
    const pendientes = ventas.filter(order => order.estado !== 'Entregado' && order.estado !== 'Cancelado');
    const porCobrar = entregados
        .filter(order => order.pago_gestor === 'Pendiente' || !order.pago_gestor)
        .reduce((sum, order) => sum + (Number(order.comision_total) || 0), 0);
    renderGestorHome({ ventas, entregados, pendientes, porCobrar });
}

function openGestorTool(tool) {
    showSection('catalogo');
    setTimeout(() => {
        if (tool === 'catalogo') {
            const search = document.getElementById('search-bar');
            search?.focus();
            document.getElementById('category-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (tool === 'mensaje') {
            document.getElementById('btn-copy-bulk')?.click();
            return;
        }
        if (tool === 'pdf') {
            document.getElementById('btn-pdf-bulk')?.click();
            return;
        }
        if (tool === 'story') {
            openStoryComposer();
        }
    }, 120);
}

function openGestorOrders() {
    toggleGestorAdvanced(true);
    setTimeout(() => document.getElementById('list-mis-pedidos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function toggleGestorAdvanced(forceOpen) {
    prepareGestorDashboardLayout();
    const blocks = document.querySelectorAll('#sec-dashboard > .gestor-legacy-block');
    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : Array.from(blocks).some(block => block.classList.contains('hidden'));
    blocks.forEach(block => block.classList.toggle('hidden', !shouldOpen));
    document.getElementById('gestor-advanced-icon')?.classList.toggle('rotate-180', shouldOpen);
    const label = document.querySelector('#gestor-advanced-toggle > span:first-child');
    if (label) {
        label.innerHTML = `<span class="material-symbols-outlined text-lg">monitoring</span> ${shouldOpen ? 'Ocultar análisis avanzado' : 'Ver análisis, ranking e historial completo'}`;
    }
}

    // Busca esta función y reemplázala completamente
function showSection(section) {
    const isCat = section === 'catalogo';

    // Recuperar siempre el desplazamiento de la página al volver desde
    // cualquier modal o herramienta interna, especialmente en Android.
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y';

    // 1. Mostrar/Ocultar contenedores
    document.getElementById('sec-catalogo').style.display = isCat ? 'block' : 'none';
    document.getElementById('sec-dashboard').classList.toggle('hidden', isCat);

    // 2. Actualizar estilos de los botones del menú superior
    document.getElementById('tab-cat').setAttribute('aria-pressed', String(isCat));
    document.getElementById('tab-dash').setAttribute('aria-pressed', String(!isCat));

    // 3. CORRECCIÓN PRINCIPAL: Cargar el Dashboard PRO si entramos a la sección dashboard
    if (!isCat) {
        // Obtenemos el nombre del gestor de la variable global
        const currentGestor = window.gestorName;
        if (currentGestor && !myOrdersData.length) {
            loadProDashboard(currentGestor); // <--- ESTO CARGA EL RANKING Y PODIO
        } else if (currentGestor) {
            renderGestorHomeFromCache();
        }
    }

    window.scrollTo(0,0);
}

    // GESTORES
    function openGestorGen() { document.getElementById('gestor-modal').classList.remove('hidden'); }
    function closeGestorGen() { document.getElementById('gestor-modal').classList.add('hidden'); }
    async function processGestor() {
        const pass = document.getElementById('master-pass').value;
        if(pass !== MASTER_KEY) return alert("Código Maestro Incorrecto");
        const name = document.getElementById('gen-name').value.trim();
        const tel = document.getElementById('gen-tel').value.trim();
        if(!name || !tel) return alert("Faltan datos");
        const base = window.location.origin + window.location.pathname;
        const adminLongLink = `${base}?ref=${encodeURIComponent(name)}&contact=${tel}&admin=true`;
        const clientLongLink = `${base}?ref=${encodeURIComponent(name)}&contact=${tel}`;
        const [adminLink, clientLink] = await Promise.all([
            getOrGenerateShortLink(name, adminLongLink),
            getOrGenerateShortLink(name, clientLongLink)
        ]);
        document.getElementById('link-admin').value = adminLink;
        document.getElementById('link-client').value = clientLink;
        document.getElementById('links-result').classList.remove('hidden');
    }
    function copy(id) { const e = document.getElementById(id); e.select(); document.execCommand('copy'); alert("Copiado"); }

    // --- LÓGICA DEL PANEL MAESTRO ---

// CORRECCIÓN: Función para entrar al Panel Maestro (Dueño)
async function openAdminMaster() {
    const pass = prompt("Acceso Administrativo. Introduce la Clave de Dueño:");

    // Cambiamos MASTER_KEY por ADMIN_SECRET_KEY para que use la clave de administrador
    if (pass === ADMIN_SECRET_KEY) {
        document.getElementById('sec-catalogo').style.display = 'none';
        document.getElementById('sec-dashboard').classList.add('hidden');
        document.getElementById('admin-nav').classList.add('hidden');
        document.getElementById('sec-admin-master').classList.remove('hidden');
        loadAdminData();
    } else if (pass !== null) {
        alert("Clave de Administrador incorrecta.");
    }
}

let pedidosRawAdmin = []; // Añade esta línea antes de la función


let inventoryRawAdmin = []; // Variable global vital para el inventario

async function loadAdminData() {
    // 1. CARGA PRIORITARIA: MENSAJEROS (Se cargan primero para tenerlos listos antes de dibujar la logística)
    await loadMensajerosEnAdmin();

    // 2. Cargamos los datos masivos de pedidos, productos y visitas
    const { data: pedidos } = await supabaseClient.from('pedidos').select('*').order('fecha', {ascending: false});
    const { data: productos } = await supabaseClient.from('productos').select('*').order('nombre', {ascending: true});
    const { data: vistas } = await supabaseClient.from('metricas_vistas').select('*');

    // 3. Procesar Pedidos
    if (pedidos) {
        pedidosRawAdmin = pedidos;
        populateLogisticaFilters();
        renderAdminLogistica(); // <--- Ahora sí, listadoMensajerosAdmin ya tendrá los datos de MARCELITO y otros listos
        renderAdminCortes();
        updateAdminStats(pedidos);
        calculateProductSales();

        // Intentamos cargar analíticas (en try-catch para que si fallan no rompan nada más)
        try {
            renderAnaliticaGestores(pedidos);
            renderAnaliticaProveedores(pedidos);
            renderAnaliticaCancelacion(pedidos);
        } catch(e) { console.log("Analítica parcial pendiente de datos"); }
    }

    // 4. Procesar Inventario
    if (productos) {
        inventoryRawAdmin = productos; // Guardamos en global
        populateInventarioProveedorFilter();
        renderAdminInventario(productos); // Pasamos los datos
    }

    // 5. Procesar Cruce de datos
    if (pedidos && productos) {
        try {
            renderAnaliticaZombies(pedidos, productos);
            renderAnaliticaConversion(pedidos, vistas || []);
        } catch(e) { console.log("Cruce de datos pendiente"); }
    }
    loadPendingGestores();
    loadAdminReports();
    loadAdminCategorias();
}

// =================================================================
// 🚴 LÓGICA DE CONTROL Y ASIGNACIÓN DE MENSAJEROS (NUEVO)
// =================================================================
let listadoMensajerosAdmin = [];

// 1. Cargar mensajeros activos desde Supabase
async function loadMensajerosEnAdmin() {
    try {
        const { data, error } = await supabaseClient
            .from('mensajeros')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (!error && data) {
            listadoMensajerosAdmin = data;
            renderAdminMensajerosEquipo();
        }
    } catch (e) {
        console.error("Error al cargar mensajeros en el panel:", e);
    }
}

// 2. Dibujar la lista de mensajeros registrados en su pestaña
function renderAdminMensajerosEquipo() {
    const container = document.getElementById('list-admin-mensajeros-equipo');
    if (!container) return;

    if (listadoMensajerosAdmin.length === 0) {
        container.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-400 text-xs font-bold uppercase">No hay mensajeros registrados.</td></tr>`;
        return;
    }

    container.innerHTML = listadoMensajerosAdmin.map(m => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 font-black uppercase text-slate-800 text-xs">${m.nombre}</td>
            <td class="p-4 font-bold text-gray-500 text-xs">${m.telefono || '---'}</td>
            <td class="p-4 text-center font-mono font-black text-indigo-600 text-xs">${m.pin}</td>
            <td class="p-4 text-right">
                <button onclick="desactivarMensajero('${m.id}', '${m.nombre}')" class="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Dar de baja">
                    <span class="material-symbols-outlined text-sm">block</span>
                </button>
            </td>
        </tr>
    `).join('');
}

// 3. Registrar un nuevo mensajero en Supabase (Ely)
async function registrarNuevoMensajeroAdmin() {
    const nombre = document.getElementById('m-nom-nuevo').value.trim();
    const telefono = document.getElementById('m-tel-nuevo').value.trim();
    const pin = document.getElementById('m-pin-nuevo').value.trim();

    if (!nombre || !pin) {
        return alert("El Nombre y el PIN de acceso son campos obligatorios.");
    }

    try {
        const { error } = await supabaseClient
            .from('mensajeros')
            .insert([{ nombre, telefono, pin, activo: true }]);

        if (error) {
            if (error.message.includes('unique')) {
                alert("Ese PIN ya está asignado a otro mensajero. Por favor, introduce un PIN diferente.");
            } else {
                throw error;
            }
            return;
        }

        alert("Mensajero registrado con éxito en el sistema.");
        document.getElementById('m-nom-nuevo').value = "";
        document.getElementById('m-tel-nuevo').value = "";
        document.getElementById('m-pin-nuevo').value = "";

        await loadMensajerosEnAdmin();
        renderAdminLogistica(); // Refrescar logística para actualizar los dropdowns de asignación

    } catch (e) {
        alert("Error al registrar: " + e.message);
    }
}

// 4. Dar de baja a un mensajero (Ely)
async function desactivarMensajero(id, nombre) {
    if (!confirm(`¿Estás seguro de que quieres dar de baja a ${nombre}?\nYa no podrá acceder a la ruta utilizando su PIN.`)) return;

    try {
        const { error } = await supabaseClient
            .from('mensajeros')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;
        await loadMensajerosEnAdmin();
        renderAdminLogistica();

    } catch (e) {
        alert("Error al desactivar.");
    }
}

// 5. Asignar un pedido a un mensajero desde la tabla de logística
// --- CORREGIDO: ASIGNAR MENSAJERO ---
async function asignarMensajeroPedido(pedidoId, mensajeroId) {
    // CORRECCIÓN: Ahora evalúa correctamente 'mensajeroId' al final
    const mId = mensajeroId === "" ? null : mensajeroId;
    const updates = { mensajero_id: mId };

    // Si asignamos un mensajero, el pedido pasa automáticamente a estar "Con Mensajero"
    if (mId) {
        updates.estado = "Asignado Mensajero";
    }

    try {
        const { error } = await supabaseClient
            .from('pedidos')
            .update(updates)
            .eq('id', pedidoId);

        if (error) throw error;

        console.log("Asignación guardada con éxito en Supabase.");
        await loadAdminData(); // Refresca las tablas automáticamente

    } catch (e) {
        alert("Error al guardar la asignación: " + e.message);
    }
}

// --- NUEVA LÓGICA DE EDICIÓN TOTAL (ADMIN MASTER) ---

function openFinanceModal(id) {
    // 1. Buscar el pedido en la memoria (pedidosRawAdmin debe estar cargado)
    const p = pedidosRawAdmin.find(item => item.id === id);
    if(!p) return alert("Error: No se encuentra el pedido en memoria. Recarga la página.");

    // 2. Llenar TODOS los campos
    document.getElementById('edit-order-id').value = id;

    // Identificación
    document.getElementById('edit-orden-dia').value = p.orden_dia || '';
    document.getElementById('edit-estado').value = p.estado || 'Pendiente';
    document.getElementById('edit-proveedor').value = p.proveedor || '';

    // Cliente
    document.getElementById('edit-cliente').value = p.cliente || '';
    document.getElementById('edit-telefono').value = p.telefono || '';
    document.getElementById('edit-ci').value = p.ci || '';
    document.getElementById('edit-municipio').value = p.municipio || '';
    document.getElementById('edit-direccion').value = p.direccion || '';

    // Producto y Finanzas
    document.getElementById('edit-producto').value = p.producto || '';
    document.getElementById('edit-total').value = parseFloat(p.total) || 0;
    document.getElementById('edit-mensajeria').value = parseFloat(p.costo_mensajeria) || 0;
    document.getElementById('edit-comision').value = parseFloat(p.comision_total) || 0;

    // 3. Mostrar Modal
    document.getElementById('modal-edit-finance').classList.remove('hidden');
}

async function saveFinancialChanges() {
    const btn = document.getElementById('btn-save-finance');
    const originalText = btn.innerHTML;
    const id = document.getElementById('edit-order-id').value;

    btn.innerHTML = "GUARDANDO CAMBIOS...";
    btn.disabled = true;

    try {
        // 1. Recoger TODOS los datos del formulario
        const updates = {
            orden_dia: document.getElementById('edit-orden-dia').value, // El consecutivo
            estado: document.getElementById('edit-estado').value,
            proveedor: document.getElementById('edit-proveedor').value,

            cliente: document.getElementById('edit-cliente').value,
            telefono: document.getElementById('edit-telefono').value,
            ci: document.getElementById('edit-ci').value,
            municipio: document.getElementById('edit-municipio').value,
            direccion: document.getElementById('edit-direccion').value,

            producto: document.getElementById('edit-producto').value,
            total: parseFloat(document.getElementById('edit-total').value) || 0,
            costo_mensajeria: parseFloat(document.getElementById('edit-mensajeria').value) || 0,
            comision_total: parseFloat(document.getElementById('edit-comision').value) || 0
        };

        // 2. Enviar a Supabase
        const { error } = await supabaseClient
            .from('pedidos')
            .update(updates)
            .eq('id', id);

        if(error) throw error;

        // 3. Éxito
        alert("✅ Pedido actualizado correctamente.");
        document.getElementById('modal-edit-finance').classList.add('hidden');

        // Recargar la tabla maestra para ver los cambios
        loadAdminData();

    } catch(e) {
        console.error(e);
        alert("❌ Error al guardar: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


// --- FUNCIÓN PARA APROBAR O RECHAZAR GESTORES ---
async function approveGestor(id, nuevoEstado, nombre = "", telefono = "") {
    const confirmacion = confirm(`¿Estás seguro de que quieres cambiar el estado de ${nombre} a ${nuevoEstado}?`);
    if (!confirmacion) return;

    try {
        const { error } = await supabaseClient
            .from('gestores')
            .update({ estado: nuevoEstado })
            .eq('id', id);

        if (error) throw error;

        alert(`✅ Gestor ${nombre} ha sido marcado como ${nuevoEstado}.`);

        // Recargar las listas del panel de administración
        loadPendingGestores();
    } catch (e) {
        console.error("Error al actualizar gestor:", e);
        alert("Error al procesar la solicitud.");
    }
}
// Función para activar gestor SIN abrir WhatsApp
async function approveGestorOnly(id, nombre) {
    const confirmacion = confirm(`¿Estás seguro de que quieres activar oficialmente a ${nombre}?`);
    if (!confirmacion) return;

    try {
        // 1. Actualizar el estado en Supabase a 'activo'
        const { error } = await supabaseClient
            .from('gestores')
            .update({ estado: 'activo' })
            .eq('id', id);

        if (error) throw error;

        // 2. Avisar que se activó correctamente
        alert(`✅ El gestor ${nombre} ha sido activado. Ahora ya puede entrar con sus datos.`);

        // 3. Refrescar la lista de pendientes para que desaparezca de ahí
        loadPendingGestores();

    } catch (e) {
        console.error("Error al activar gestor:", e);
        alert("Ocurrió un error al intentar activar al gestor en la base de datos.");
    }
}
// --- NUEVA FUNCIÓN: APROBAR Y ENVIAR MENSAJE DE BIENVENIDA ---
async function approveAndWelcomeGestor(id, nombre, telefono, password) {
    const confirmacion = confirm(`¿Aprobar a ${nombre} y enviarle el mensaje de bienvenida por WhatsApp?`);
    if (!confirmacion) return;

    try {
        // 1. Aprobar en la base de datos
        const { error } = await supabaseClient
            .from('gestores')
            .update({ estado: 'activo' })
            .eq('id', id);

        if (error) throw error;

        // 2. Preparar el teléfono
        let telLimpio = telefono.replace(/\D/g, '');
        if (telLimpio.length === 8) telLimpio = '53' + telLimpio;

        // 3. Generar Link Corto
        const baseUrl = window.location.origin + window.location.pathname;
        const longLink = `${baseUrl}?ref=${encodeURIComponent(nombre)}&contact=${telLimpio}`;
        let affiliateLink = longLink;

        try {
            if(typeof getOrGenerateShortLink === 'function') {
                affiliateLink = await getOrGenerateShortLink(nombre, longLink);
            }
        } catch(e) { console.log("Usando link largo por defecto"); }

        // 4. Construir el mensaje exacto que pediste (Con Grupo de WA)
        const mensaje = `¡Hola *${nombre}*! 👋 Te escribo del equipo de *ParaTuHogar*.

Vimos que solicitaste unirte como gestor y tu cuenta ya está activa. Queríamos darte la bienvenida y recordarte que estamos aquí para apoyarte. Si tienes alguna duda sobre cómo vender, cómo hacer los pedidos o sobre los equipos, *¡pregúntanos sin pena ninguna!* Estamos para ayudarte a hacer dinero. 🤝

📌 *TUS DATOS DE ACCESO:*
👤 *Usuario:* ${nombre}
🔑 *Contraseña:* ${password}
🌐 *Entra a la tienda aquí:* https://paratuhogar.org

Tenemos muchísimos equipos nuevos en almacén a muy buenos precios. Además, recuerda que en tu Panel tienes el *Configurador de Precios*: ahí puedes subirle el precio a los equipos y toda esa diferencia es *ganancia extra 100% para ti*. 💸

🚀 *TU ENLACE DE AFILIADO MÁGICO:*
🔗 ${affiliateLink}

Compártelo en tus grupos y estados. Si alguien entra a ese link y compra (incluso si compra días después), el sistema lo detecta y *la comisión te la pagamos a ti automáticamente* sin que tengas que hacer nada.

📱 *ÚNETE A NUESTRO GRUPO DE WHATSAPP:*
Aquí enviamos información importante, nuevas ofertas y material de ventas:
👉 https://chat.whatsapp.com/GxIrA5GngPVKXQ7DBMDiOL

¡Anímate a probarlo hoy! Quedo al pendiente por si necesitas ayuda. 😉`;

        // 5. Refrescar la tabla y abrir WhatsApp
        alert(`✅ Gestor activado. Se abrirá WhatsApp para enviar el mensaje.`);
        loadPendingGestores(); // Recarga la lista para que desaparezca de "Pendientes"

        // --- LÓGICA INTELIGENTE PARA ABRIR WHATSAPP DIRECTO ---
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
    // Si está en celular o tablet, fuerza abrir la APP directamente (mantiene emojis intactos)
    window.location.href = `whatsapp://send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`;
} else {
    // Si está en PC, abre WhatsApp Web directamente
    window.open(`https://web.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`, '_blank');
}

    } catch (e) {
        console.error("Error al aprobar gestor:", e);
        alert("Ocurrió un error al intentar aprobar al gestor.");
    }
}

// --- FUNCIÓN PARA ELIMINAR GESTORES ---
async function removeGestor(id, nombre) {
    if (!confirm(`¿Vas a dar de baja a ${nombre}?\n\nSi el gestor tiene ventas, no se borrará para proteger los datos, pero pasará a estado BLOQUEADO y desaparecerá de esta lista.`)) return;

    try {
        // --- INTENTO 1: BORRADO FÍSICO ---
        // Agregamos .select() al final para verificar si realmente se borró algo
        const { data, error } = await supabaseClient
            .from('gestores')
            .delete()
            .eq('id', id)
            .select();

        // Verificamos si 'data' tiene contenido. Si data.length > 0, es que SÍ se borró.
        if (data && data.length > 0) {
            alert("✅ Gestor eliminado permanentemente (Cuenta limpia sin ventas).");
            loadPendingGestores(); // Recargamos la tabla
            return;
        }

        // Si llegamos aquí, es porque NO se borró (aunque no diera error),
        // probablemente porque tiene ventas asociadas (Foreign Key) o RLS.
        console.warn("El borrado físico falló (protección de datos). Aplicando bloqueo...");

        // --- INTENTO 2: BLOQUEO LÓGICO (PLAN B) ---
        const { error: updateError } = await supabaseClient
            .from('gestores')
            .update({ estado: 'bloqueado' }) // Lo marcamos como bloqueado
            .eq('id', id);

        if (updateError) throw updateError;

        alert(`⚠️ Este gestor tiene historial de ventas y no se puede borrar.\n✅ ACCIÓN ALTERNATIVA: Se ha cambiado su estado a 'BLOQUEADO' y ya no tendrá acceso ni aparecerá aquí.`);

        loadPendingGestores(); // Recargamos la tabla

    } catch (e) {
        console.error("Error al gestionar la baja:", e);
        alert("Ocurrió un error inesperado: " + e.message);
    }
}

function updateAdminStats(pedidos) {
    const entregados = pedidos.filter(p => p.estado === 'Entregado');
    const totalUSD = entregados.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente' || p.estado === 'En Camino').length;
    const deuda = pedidos.filter(p =>
        p.estado === 'Entregado' && String(p.pago_gestor || '').toLowerCase() !== 'pagado')
                         .reduce((acc, p) => acc + Number(p.comision_total || 0), 0);

    document.getElementById('m-stat-ventas').innerText = `$${totalUSD.toLocaleString()}`;
    document.getElementById('m-stat-pendientes').innerText = pendientes;
    document.getElementById('m-stat-deuda').innerText = `$${deuda.toLocaleString()}`;
    document.getElementById('m-stat-gestores').innerText = new Set(pedidos.map(p => p.gestor)).size;

    // --- NUEVO: CALCULAR POR MUNICIPIO ---
    const muniCounts = {};
    pedidos.forEach(p => {
        if(p.estado !== 'Cancelado' && p.municipio && p.municipio !== "Almacén") {
            muniCounts[p.municipio] = (muniCounts[p.municipio] || 0) + 1;
        }
    });

    const muniSorted = Object.entries(muniCounts).sort((a, b) => b[1] - a[1]); // Ordenar de mayor a menor

    const containerMuni = document.getElementById('m-stat-municipios');
    if (containerMuni) {
        if (muniSorted.length === 0) {
            containerMuni.innerHTML = "<p class='text-xs text-gray-400'>No hay datos de municipios aún.</p>";
        } else {
            containerMuni.innerHTML = muniSorted.map(([muni, count]) => `
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span class="text-[10px] font-bold text-gray-600 uppercase truncate pr-2" title="${muni}">${muni}</span>
                    <span class="text-xs font-black text-primary bg-blue-100 px-2 rounded-md">${count}</span>
                </div>
            `).join('');
        }
    }
}

// --- FUNCIÓN DE LOGÍSTICA MAESTRA CON FILTROS AVANZADOS ---
// --- FUNCIÓN DE LOGÍSTICA MAESTRA CORREGIDA ---
function renderAdminLogistica() {
    const container = document.getElementById('list-admin-pedidos');
    if (!container || !pedidosRawAdmin) return;

    // 1. Obtener valores de los filtros
    const query = document.getElementById('search-logistica').value.toLowerCase();
    const provFilter = document.getElementById('f-proveedor').value;
    const gestFilter = document.getElementById('f-gestor').value;
    const dateDesde = document.getElementById('f-desde').value;
    const dateHasta = document.getElementById('f-hasta').value;
    // Capturamos el municipio (con validación por si no existe el elemento)
    const muniFilter = document.getElementById('f-municipio') ? document.getElementById('f-municipio').value : 'TODOS';

    // 2. Aplicar Filtro Multi-Nivel (Un solo filtro para todo)
    const filtrados = pedidosRawAdmin.filter(p => {
        // A. Filtro por Pestaña (Status)
        let matchStatus = false;
        if (currentStatusFilter === 'TODOS') matchStatus = true;
        else if (currentStatusFilter === 'FINALIZADOS') matchStatus = (p.estado === 'Entregado' || p.estado === 'Cancelado');
        else matchStatus = (p.estado === currentStatusFilter);

        // B. Filtro por Texto (Buscador)
        const matchText = (p.cliente || "").toLowerCase().includes(query) ||
                          (p.producto || "").toLowerCase().includes(query);

        // C. Filtro por Proveedor
        const matchProv = provFilter === 'TODOS' || p.proveedor === provFilter;

        // D. Filtro por Gestor
        const matchGest = gestFilter === 'TODOS' || p.gestor === gestFilter;

        // E. Filtro por Municipio
        const matchMuni = muniFilter === 'TODOS' || p.municipio === muniFilter;

        // F. Filtro por Rango de Fecha
        let matchDate = true;
        if (p.fecha) {
            const pFecha = p.fecha.split('T')[0]; // Obtener YYYY-MM-DD
            if (dateDesde && pFecha < dateDesde) matchDate = false;
            if (dateHasta && pFecha > dateHasta) matchDate = false;
        }

        // Combinamos todas las condiciones
        return matchStatus && matchText && matchProv && matchGest && matchMuni && matchDate;
    });

    // 3. Actualizar Sumatorias
    const totalUSD = filtrados.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const totalComi = filtrados.reduce((acc, p) => acc + Number(p.comision_total || 0), 0);

    document.getElementById('sum-count').innerText = filtrados.length;
    document.getElementById('sum-usd').innerText = `$${totalUSD.toLocaleString()}`;
    document.getElementById('sum-comi').innerText = `$${totalComi.toLocaleString()}`;

    // 4. Renderizar Tabla
    if (filtrados.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-gray-400 font-bold uppercase text-xs">No hay pedidos que coincidan con estos filtros.</td></tr>`;
        return;
    }

    // --- DENTRO DE function renderAdminLogistica() ---

    container.innerHTML = filtrados.map(p => {
        let colorClass = "bg-gray-100 text-gray-600";
        if(p.estado === 'Pendiente') colorClass = "bg-yellow-100 text-yellow-700";
        if(p.estado === 'Recogida Almacén') colorClass = "bg-orange-100 text-orange-700";
        if(p.estado === 'Asignado Mensajero') colorClass = "bg-blue-100 text-blue-700";
        if(p.estado === 'Entregado') colorClass = "bg-emerald-100 text-emerald-700";
        if(p.estado === 'Cancelado') colorClass = "bg-red-100 text-red-700";

        const esFinal = (p.estado === 'Entregado' || p.estado === 'Cancelado');

        // Alerta de Tiempo
        const fechaPedido = new Date(p.fecha);
        const hoy = new Date();
        const horasPasadas = (hoy - fechaPedido) / (1000 * 60 * 60);
        let alertaTiempo = "";
        if (!esFinal && horasPasadas > 48) alertaTiempo = `<span class="bg-red-50 text-red-500 border border-red-100 px-1.5 rounded text-[9px] font-black">+48h</span>`;

        // Costo Mensajería
        const costoEnvio = parseFloat(p.costo_mensajeria) || 0;
        const envioDisplay = costoEnvio > 0
            ? `<span class="text-blue-600 font-black bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 ml-1">$${costoEnvio}</span>`
            : `<span class="text-gray-400 font-bold ml-1 text-[9px]">Gratis</span>`;

        // Link de Google Maps para la dirección
        const mapaUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion + ', ' + p.municipio + ', La Habana, Cuba')}`;

        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-all border-b dark:border-gray-700 bg-white dark:bg-gray-900">

            <!-- COL 1: CLIENTE + TELÉFONO -->
            <td class="p-4 align-top">
                <div class="flex items-center gap-2 mb-1">
                    <span class="bg-slate-800 text-white px-2 py-0.5 rounded text-[9px] font-black tracking-widest">#${p.orden_dia || '---'}</span>
                    <span class="text-[9px] text-gray-400 font-bold">${new Date(p.fecha).toLocaleDateString()}</span>
                    ${alertaTiempo}
                </div>

                <div class="mb-1">
                    <span class="text-primary text-xs font-black uppercase block leading-tight">${p.cliente}</span>
                    <!-- AQUI ESTÁ EL TELÉFONO DEL CLIENTE -->
                    <a href="tel:${p.telefono}" class="text-[10px] text-slate-500 font-bold hover:text-blue-600 flex items-center gap-1">
                        <span class="material-symbols-outlined text-[10px]">call</span> ${p.telefono}
                    </a>
                </div>

                <a href="https://wa.me/${p.telefono.replace(/\D/g,'')}" target="_blank" class="inline-flex items-center gap-1 text-[9px] bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded hover:bg-green-100 transition-colors font-bold">
                    <i class="fab fa-whatsapp"></i> Chat Cliente
                </a>
            </td>

            <!-- COL 2: DESTINO (MUNICIPIO Y DIRECCIÓN) -->
            <td class="p-4 align-top w-64">
                <div class="flex flex-col h-full justify-start">
                    <span class="text-xs font-black text-slate-700 dark:text-white uppercase mb-1 flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm text-red-400">location_on</span>
                        ${p.municipio || '---'}
                    </span>
                    <p class="text-[10px] text-gray-500 leading-snug break-words font-medium bg-gray-50 p-1.5 rounded border border-gray-100 mb-1">
                        ${p.direccion}
                    </p>
                    <a href="${mapaUrl}" target="_blank" class="text-[9px] text-blue-400 font-bold hover:underline flex items-center gap-1">
                        <span class="material-symbols-outlined text-[10px]">map</span> Ver en Mapa
                    </a>
                </div>
            </td>

            <!-- COL 3: ORIGEN (PROVEEDOR Y PRODUCTO) -->
            <td class="p-4 align-top w-56">
                <div class="flex items-center gap-1 mb-2">
                    <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-black text-[9px] uppercase border border-indigo-100 shadow-sm">
                        ${p.proveedor || 'General'}
                    </span>
                </div>
                <p class="text-[10px] text-slate-600 font-bold leading-tight" title="${p.producto}">
                    ${p.producto}
                </p>
            </td>

            <!-- COL 4: GESTOR Y HERRAMIENTAS -->
            <td class="p-4 align-top">
                <div class="flex flex-col gap-2">
                    <span class="bg-slate-100 px-2 py-1 rounded text-[9px] font-bold text-slate-600 w-fit">${p.gestor}</span>

                    <!-- Botón Contactar Gestor -->
                    <button onclick="alert('Gestor: ${p.gestor}')" class="text-[9px] text-gray-400 hover:text-green-500 flex items-center gap-1 font-bold transition-colors">
                        <i class="fab fa-whatsapp"></i> Contactar
                    </button>

                    <!-- Botón Reenviar Vale WhatsApp -->
                    <button onclick="reenviarValeAdmin('${p.id}')" class="flex items-center justify-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1.5 rounded-lg shadow-sm hover:bg-teal-100 transition-all active:scale-95 group" title="Generar Vale de Pedido en WhatsApp">
                        <span class="material-symbols-outlined text-[14px] group-hover:rotate-180 transition-transform duration-500">receipt_long</span>
                        <span class="text-[9px] font-black uppercase">Generar Vale</span>
                    </button>

                    <!-- === NUEVO BOTÓN: DESCARGAR PDF === -->
                    <button onclick="prepararPDFDesdeHistorial('${p.id}', 'descargar')" class="flex items-center justify-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-1.5 rounded-lg shadow-sm hover:bg-red-100 transition-all active:scale-95 group" title="Descargar Documento PDF">
                        <span class="material-symbols-outlined text-[14px] group-hover:scale-110 transition-transform">picture_as_pdf</span>
                        <span class="text-[9px] font-black uppercase">Descargar PDF</span>
                    </button>

                </div>
            </td>

            <!-- COL 5: ESTADO LOGÍSTICA (MODIFICADA) -->
            <td class="p-4 text-right align-top">
                <div class="flex flex-col items-end gap-2">
                    ${esFinal ?
                        `<span class="px-3 py-1.5 rounded-lg font-black text-[9px] uppercase ${colorClass} shadow-sm">${p.estado}</span>` :
                        `<select onchange="updatePedidoStatus('${p.id}', this.value)" class="text-[10px] font-black uppercase rounded-lg border-none ${colorClass} py-1.5 cursor-pointer focus:ring-0 text-center w-32 shadow-sm">
                            <option value="Pendiente" ${p.estado === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="Recogida Almacén" ${p.estado === 'Recogida Almacén' ? 'selected' : ''}>🏭 En Almacén</option>
                            <option value="Asignado Mensajero" ${p.estado === 'Asignado Mensajero' ? 'selected' : ''}>🏍️ Mensajero</option>
                            <option value="Entregado">✅ Entregado</option>
                            <option value="Cancelado">❌ Cancelado</option>
                        </select>`
                    }


                    <div class="mt-2 w-32">
                        <select onchange="asignarMensajeroPedido('${p.id}', this.value)" class="text-[9px] font-bold uppercase rounded-lg border border-gray-200 bg-white dark:bg-gray-800 text-gray-500 py-1 cursor-pointer focus:ring-0 w-full shadow-sm text-center">
                            <option value="">🚫 Sin Mensajero</option>
                            ${listadoMensajerosAdmin.map(m => `
                                <option value="${m.id}" ${p.mensajero_id === m.id ? 'selected' : ''}>🏍️ ${m.nombre.toUpperCase()}</option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- AQUI ESTÁ EL CAMBIO: Un div contenedor para alinear el precio y el botón -->
                    <div class="flex items-center justify-end gap-1">
                        <!-- Tu badge original de envío -->
                        <div class="flex items-center text-[9px] font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                            <span class="material-symbols-outlined text-[12px] mr-1 text-slate-400">two_wheeler</span>
                            Pago Envío: ${envioDisplay}
                        </div>

                        <!-- EL NUEVO BOTÓN DE LÁPIZ -->
                        <button onclick="openFinanceModal('${p.id}')" class="bg-amber-100 hover:bg-amber-200 text-amber-700 p-1 rounded border border-amber-300 transition-colors shadow-sm flex items-center justify-center" title="Corregir Comisión/Envío">
                            <span class="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                    </div>

                </div>
            </td>
        </tr>`;
    }).join('');
}

// FUNCION PARA LLENAR LOS SELECTS CON DATA REAL
// FUNCION PARA LLENAR LOS SELECTS CON DATA REAL (CORREGIDA PARA NO PERDER EL FILTRO)
function populateLogisticaFilters() {
    const selectProv = document.getElementById('f-proveedor');
    const selectGest = document.getElementById('f-gestor');

    // 1. MEMORIA: Guardar qué estaba seleccionado antes de recargar
    const provActual = selectProv ? selectProv.value : 'TODOS';
    const gestActual = selectGest ? selectGest.value : 'TODOS';

    // 2. Extraer listas únicas de la base de datos
    const proveedores = [...new Set(pedidosRawAdmin.map(p => p.proveedor || 'General'))].sort();
    const gestores = [...new Set(pedidosRawAdmin.map(p => p.gestor))].sort();

    // 3. Volver a dibujar las opciones
    selectProv.innerHTML = '<option value="TODOS">Todos los Proveedores</option>' +
                          proveedores.map(p => `<option value="${p}">${p}</option>`).join('');

    selectGest.innerHTML = '<option value="TODOS">Todos los Gestores</option>' +
                          gestores.map(g => `<option value="${g}">${g}</option>`).join('');

    // 4. RESTAURAR: Volver a seleccionar lo que el usuario tenía puesto
    // (Solo si ese proveedor sigue existiendo en la lista, por seguridad)
    if (provActual === 'TODOS' || proveedores.includes(provActual)) {
        selectProv.value = provActual;
    }

    if (gestActual === 'TODOS' || gestores.includes(gestActual)) {
        selectGest.value = gestActual;
    }
}

function resetLogisticaFilters() {
    document.getElementById('f-desde').value = "";
    document.getElementById('f-hasta').value = "";
    document.getElementById('f-proveedor').value = "TODOS";
    document.getElementById('f-gestor').value = "TODOS";
    document.getElementById('search-logistica').value = "";
    renderAdminLogistica();
}

function renderAdminCortes() {
    const container = document.getElementById('list-admin-cortes');
    if (!container || !pedidosRawAdmin) return;

    const searchTerm = (document.getElementById('search-gestor-pago')?.value || "").toLowerCase();

    // --- CORRECCIÓN AQUÍ ---
    // Antes buscaba 'input-tasa-cup', ahora busca 'daily-rate'
    const tasaInput = document.getElementById('daily-rate');
    const tasa = tasaInput ? parseFloat(tasaInput.value) : 450;
    // -----------------------

    // Filtramos solo los pedidos entregados que deben comisión
    const deuda = pedidosRawAdmin.filter(p =>
        p.estado === 'Entregado'
        && String(p.pago_gestor || '').toLowerCase() !== 'pagado'
        && p.gestor !== 'Venta Directa');

    // Agrupar por gestor
    const porGestor = deuda.reduce((acc, p) => {
        const gName = p.gestor || "Venta Directa";
        if (!acc[gName]) acc[gName] = { usd: 0, count: 0, ids: [] };
        acc[gName].usd += Number(p.comision_total || 0);
        acc[gName].count++;
        acc[gName].ids.push(p.id);
        return acc;
    }, {});

    // Filtramos para que NO aparezca "Venta Directa" y respetamos el buscador
    const entries = Object.entries(porGestor).filter(([name]) => {
        const noEsVentaDirecta = name !== "Venta Directa";
        const coincideBuscador = name.toLowerCase().includes(searchTerm);
        return noEsVentaDirecta && coincideBuscador;
    });

    if (entries.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-400 font-bold uppercase text-xs">Todo al día. No hay comisiones pendientes de pago.</td></tr>`;
        return;
    }

    container.innerHTML = entries.map(([name, data]) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-all border-b dark:border-gray-700 bg-white dark:bg-gray-900">
            <td class="p-4 font-black text-primary uppercase italic text-xs">${name}</td>
            <td class="p-4 font-bold text-gray-400 text-xs">${data.count} ventas</td>
            <td class="p-4 font-black text-sm">$${data.usd.toFixed(2)}</td>

            <!-- Aquí usamos la tasa corregida -->
            <td class="p-4 font-black text-emerald-500 text-sm italic">${(data.usd * tasa).toLocaleString()} CUP</td>

            <td class="p-4 text-right">
                <button onclick="liquidarComisiones('${data.ids.join(',')}')" class="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-colors shadow-lg shadow-gray-900/20">
                    Liquidar (Pagar)
                </button>
            </td>
        </tr>
    `).join('');
}

async function liquidarComisiones(idsStr) {
    if (!confirm("¿Ya pagaste estas comisiones?")) return;
    await supabaseClient.from('pedidos').update({ pago_gestor: 'Pagado' }).in('id', idsStr.split(','));
    loadAdminData();
}

async function updatePedidoStatus(id, nuevoEstado) {
    await supabaseClient.from('pedidos').update({ estado: nuevoEstado }).eq('id', id);
    loadAdminData();
}

// PEGA ESTA FUNCIÓN CORREGIDA
function renderAdminInventario(productosArg) {
    // 1. Lógica Híbrida: Usa el argumento si existe, sino usa la variable global, sino array vacío
    const listaProductos = productosArg || inventoryRawAdmin || [];

    const container = document.getElementById('list-admin-inventario');

    // Si no existe el buscador, asumimos vacío
    const searchInput = document.getElementById('search-inventario');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";

    // Capturar el valor seleccionado en el filtro de proveedor (id: filter-inventario-proveedor)
    const selectProv = document.getElementById('filter-inventario-proveedor');
    const selectedProv = selectProv ? selectProv.value : 'TODOS';

    if (!container) return;

    // 2. Filtrar por búsqueda y por proveedor seleccionado
    const filtered = listaProductos.filter(p => {
        // Generar SKU Virtual visual
        const skuVirtual = (p.categoria ? p.categoria.substring(0,3).toUpperCase() : "GEN") + "-" + p.id.substring(0,4).toUpperCase();

        // Coincidencia con la barra de búsqueda
        const matchSearch = p.nombre.toLowerCase().includes(searchVal) ||
                            (p.categoria || "").toLowerCase().includes(searchVal) ||
                            skuVirtual.toLowerCase().includes(searchVal);

        // Coincidencia con el proveedor (se asume 'General' si p.proveedor está vacío)
        const matchProv = selectedProv === 'TODOS' || (p.proveedor || 'General') === selectedProv;

        return matchSearch && matchProv;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-gray-400 font-bold uppercase text-xs italic">No hay productos cargados o no coinciden con la búsqueda.</div>`;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const skuDisplay = (p.categoria ? p.categoria.substring(0,3).toUpperCase() : "GEN") + "-" + p.id.substring(0,4).toUpperCase();

        return `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-3xl border shadow-sm flex flex-col justify-between h-full text-left group hover:border-primary/30 transition-all relative">
            <span class="absolute top-4 right-4 text-[9px] font-mono text-gray-300">#${skuDisplay}</span>
            <div>
                <img src="${fixDriveUrl(p.thumbnail)}" class="w-full h-32 object-contain mb-4 bg-gray-50 dark:bg-gray-900 rounded-2xl p-2">
                <h6 class="text-[10px] font-black leading-tight mb-1 uppercase text-gray-700 dark:text-gray-200 line-clamp-2 h-8">${p.nombre}</h6>
                <div class="flex justify-between items-end mb-4">
                    <p class="text-primary font-black text-sm">$${p.precio}</p>
                    <p class="text-[9px] text-gray-400 font-bold uppercase">${p.categoria || 'Varios'}</p>
                </div>
            </div>

            <div class="flex gap-2">
                <button onclick="toggleStockAdmin('${p.id}', '${p.disponible}')"
                    class="flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${p.disponible === 'SI' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                    ${p.disponible === 'SI' ? 'En Stock' : 'Agotado'}
                </button>
                <button onclick="editProduct('${p.id}')" class="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
            </div>
        </div>
    `; }).join('');
}

async function toggleStockAdmin(id, actual) {
    await supabaseClient.from('productos').update({ disponible: actual === 'SI' ? 'NO' : 'SI' }).eq('id', id);

    // Forzar actualización de versión para todos los gestores en la nube
    await supabaseClient
        .from('control_sistema')
        .upsert([{ clave: 'ultimo_cambio_productos', valor: new Date().toISOString() }]);

    window.PTHSecureData.clearCaches();
    localStorage.removeItem('pth_catalogo_cache_time');
    loadAdminData();
}

function renderAnaliticaVistas(vistas) {
    const counts = vistas.reduce((acc, v) => { acc[v.nombre_producto] = (acc[v.nombre_producto] || 0) + 1; return acc; }, {});
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('list-analitica-vistas').innerHTML = sorted.map(([name, count]) => `
        <div class="flex justify-between items-center text-[11px] font-bold uppercase italic text-gray-500">
            <p class="truncate pr-4">${name}</p>
            <p class="text-primary">${count} clics</p>
        </div>
    `).join('');
}

function renderAnaliticaGestores(pedidos) {
    const counts = pedidos.filter(p => p.estado === 'Entregado').reduce((acc, p) => { acc[p.gestor] = (acc[p.gestor] || 0) + 1; return acc; }, {});
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    document.getElementById('list-analitica-gestores').innerHTML = sorted.map(([name, count]) => `
        <div class="flex justify-between items-center text-[11px] font-bold uppercase italic text-gray-500">
            <p>${name}</p>
            <p class="text-primary">${count} ventas</p>
        </div>
    `).join('');
}

async function loadTrafficAnalytics() {
    // Definimos los últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    // 1. Buscamos TODOS los clics rompiendo el límite de 1000
    const { data: analytics, error } = await supabaseClient
        .from('link_analytics')
        .select('agent_name')
        .gte('timestamp', hace30Dias.toISOString())
        .limit(50000); // Límite masivo

    if (error || !analytics) {
        console.error("Error cargando el tráfico:", error);
        return;
    }

    const puntosGestor = {};

    // 2. Contamos uno por uno
    analytics.forEach(row => {
        const nombre = row.agent_name;
        // Ignoramos si está vacío o si es tráfico "Directo" (sin gestor)
        if (nombre && nombre !== 'Directo' && nombre !== 'Venta Directa') {
            puntosGestor[nombre] = (puntosGestor[nombre] || 0) + 1;
        }
    });

    // 3. Convertimos los datos en una lista y los ordenamos (El que tiene más clics va primero)
    const rankingOrdenado = Object.entries(puntosGestor).sort((a, b) => b[1] - a[1]);

    // 4. RENDERIZADO
    const contenedorHTML = document.getElementById('list-trafico-gestores');

    if (contenedorHTML) {
        contenedorHTML.innerHTML = rankingOrdenado.map(([nombre, clics], index) => {
            const nombreCorto = nombre.split(' ')[0].toUpperCase();
            const nombreCensurado = nombreCorto.substring(0, 5) + "***";

            return `
            <div class="flex justify-between items-center text-sm border-b border-gray-800 pb-4 pt-4">
                <div class="flex items-center gap-4">
                    <span class="text-gray-500 font-bold">#${index + 1}</span>
                    <span class="font-black text-white tracking-widest">${nombreCensurado}</span>
                </div>
                <div class="flex items-baseline gap-1">
                    <span class="text-xl font-black text-white">${clics}</span>
                    <span class="text-[10px] text-gray-500 font-bold">CLICS</span>
                </div>
            </div>`;
        }).join('');
    }
}

function changeAdminTab(tab) {
    if (tab !== 'trafico' && typeof stopTrafficDashboard === 'function') stopTrafficDashboard();
    // Load the existing private reviewer only on demand. Unmount on leaving so
    // hidden tabs never retain report text/screenshots or an active review form.
    const feedbackHost = document.getElementById('admin-feedback-content');
    if (feedbackHost && tab !== 'feedback') feedbackHost.replaceChildren();
    if (feedbackHost && tab === 'feedback' && !feedbackHost.firstChild) {
        const frame = document.createElement('iframe');
        frame.title = 'Revisión privada de problemas y mejoras';
        frame.src = 'feedback.html?view=review';
        frame.referrerPolicy = 'no-referrer';
        frame.style.cssText = 'display:block;width:100%;height:78vh;min-height:580px;border:0;border-radius:20px;background:#f4f7fb';
        feedbackHost.append(frame);
    }
    // 1. Ocultar todos los contenedores de pestañas admin
    document.querySelectorAll('.tab-cnt').forEach(cnt => {
        cnt.classList.add('hidden');
    });

    // 2. Mostrar el contenedor específico
    const target = document.getElementById('cnt-' + tab);
    if (target) {
        target.classList.remove('hidden');

        // --- NUEVO: Si entramos a tráfico, cargamos las gráficas ---
        // El 'typeof' evita errores si aún no has cargado el archivo admin-stats.js
        if (tab === 'trafico') {
            window.PTHAssets.load('traffic').then(() => {
                if (!target.classList.contains('hidden')) initTrafficDashboard();
            }).catch(() => { target.textContent = 'No se pudo cargar esta herramienta. Vuelve a abrir la pestaña para reintentar.'; });
        }
        // -----------------------------------------------------------
    } else {
        console.error("No se encontró el contenedor: cnt-" + tab);
    }

    // 3. Actualizar los estilos de los botones
    document.querySelectorAll('.btn-tab-admin').forEach(btn => {
        btn.classList.remove('active', 'bg-primary', 'text-white');
        btn.setAttribute('aria-pressed', 'false');
    });

    // 4. Resaltar el botón presionado
    const activeBtn = document.getElementById('tab-' + tab);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
    }
}

// Registro de estadísticas
async function registrarVistaAnalitica(p) {
    await supabaseClient.from('metricas_vistas').insert([{ producto_id: p.id, nombre_producto: p.nombre }]);
}
// Función para saltar del panel de gestores al panel de administración maestro
// CORRECCIÓN: Función para saltar desde el modal de gestores

function openAdminMasterFromGestor() {
    const passInput = document.getElementById('master-pass').value;

    // Verificamos si la clave escrita en el recuadro es la del dueño
    if (passInput === ADMIN_SECRET_KEY) {
        closeGestorGen(); // Cerramos el modal

        // Ejecutamos la apertura directamente sin volver a preguntar
        document.getElementById('sec-catalogo').style.display = 'none';
        document.getElementById('sec-dashboard').classList.add('hidden');
        document.getElementById('admin-nav').classList.add('hidden');
        document.getElementById('sec-admin-master').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Para acceder aquí, escribe la Clave de Dueño en el campo 'Código Maestro'.");
    }
}

// --- FUNCIONES PARA EL FORMULARIO DE PRODUCTOS ---
let productSaveInFlight = false;

function openModalProd() {
    window.pthPendingProductEdit = null;
    if (typeof prepareProductEditor === "function") void prepareProductEditor();
    if (productSaveInFlight) return alert("⏳ Espera a que termine el guardado del producto.");
        updateFormCategories(); // <--- AGREGAR ESTA LÍNEA AQUÍ
        updateFormProviders();

    // 1. Limpiar el ID de edición (para que sepa que es uno NUEVO)
    const idEdit = document.getElementById('p-id-edit');
    if(idEdit) idEdit.value = "";
    document.getElementById('p-disponible').value = "SI";
    const inactiveControl = document.getElementById('p-create-inactive-control');
    if (inactiveControl) inactiveControl.classList.remove('hidden');
    const inactiveCheckbox = document.getElementById('p-create-inactive');
    if (inactiveCheckbox) inactiveCheckbox.checked = false;

    // 2. Resetear todos los inputs del formulario (nombres, precios, etc)
    const form = document.getElementById('form-nuevo-prod');
    if(form) form.reset();

    // 3. Preparar el editor cada vez que se crea un producto. Si Quill no
    // está disponible, se activa el modo básico para que siga siendo escribible.
    quill = ProductDescriptionEditorApi.resetProductDescriptionEditor({
        QuillCtor: window.Quill,
        currentEditor: quill
    });

    // 4. Limpiar las 4 imágenes (Rutas, Previsualizaciones e Iconos)
    for (let i = 0; i < 4; i++) {
        const pathInput = document.getElementById(`img-path-${i}`);
        const previewImg = document.getElementById(`prev-${i}`);
        const iconSpan = document.getElementById(`icon-${i}`);

        if(pathInput) pathInput.value = "";
        if(previewImg) {
            previewImg.src = "";
            previewImg.classList.add('hidden');
        }
        if(iconSpan) {
            iconSpan.classList.remove('hidden');
            iconSpan.innerText = "add_a_photo";
        }
    }

    // LIMPIEZA EXPRESA DE MENSAJERÍA
    const inputMensajeria = document.getElementById('p-mensajeria');
    if (inputMensajeria) inputMensajeria.value = "";

    // 👇 AÑADIR ESTO:
    const inputTamano = document.getElementById('p-tamano-envio');
    if (inputTamano) inputTamano.value = "Pequeño";

    // 5. Asegurar que el botón diga "Guardar Cambios" y no "Actualizar"
    const btnSave = document.getElementById('btn-save-prod');
    if(btnSave) {
        btnSave.disabled = false;
        btnSave.innerText = "Guardar Cambios";
    }

    // 6. Mostrar el modal
    const modal = document.getElementById('modal-producto');
    if(modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModalProd(afterSave = false) {
    window.pthPendingProductEdit = null;
    if (productSaveInFlight && !afterSave) return alert("⏳ Espera a que termine el guardado del producto.");
    document.getElementById('modal-producto').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// --- FUNCIÓN PARA PROCESAR Y SUBIR IMAGEN ---
async function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const msg = document.getElementById('upload-msg');
    const btn = document.getElementById('btn-upload');

    msg.innerText = "⏳ Optimizando y subiendo imagen...";
    btn.disabled = true;

    try {
        // 1. Comprimir imagen para ahorrar datos en Cuba
        const compressedBlob = await compressImage(file, 800, 800);

        // 2. Crear un nombre limpio para Supabase
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${Date.now()}_${cleanName}`;

        // 3. Subir al Storage
        const { data, error } = await supabaseClient.storage
            .from('productos')
            .upload(fileName, compressedBlob);

        if (error) throw error;

        // 4. GUARDAR EL NOMBRE EN EL CAMPO OCULTO (Paso Vital)
        document.getElementById('p-img-name').value = fileName;

        msg.innerHTML = `✅ Foto lista para guardar`;
        btn.innerText = "Imagen Vinculada";
        btn.style.borderColor = "#33ccc4";

    } catch (e) {
        console.error(e);
        alert("Error al procesar la imagen: " + e.message);
        msg.innerText = "❌ Error en la subida";
        btn.disabled = false;
    }
}

function getAgentPhone() {
    let rawNum = "";

    // 1. Intentar sacar el teléfono de la sesión activa
    if (window.currentUserData && window.currentUserData.telefono) {
        rawNum = window.currentUserData.telefono;
    } else {
        // 2. Intentar sacar el teléfono de la URL si no hay sesión
        rawNum = new URLSearchParams(window.location.search).get('tel') || "";
    }

    // Si no hay número en ningún lado, devolver el del dueño
    if (!rawNum) return '5356071095';

    // LIMPIEZA Y FORMATO CUBA
    let limpio = rawNum.replace(/\D/g, ''); // Quita el + y espacios

    // Si el número tiene 8 dígitos (ej: 58183649), le ponemos el 53 delante
    if (limpio.length === 8) {
        limpio = '53' + limpio;
    }

    // Si el número tiene 10 dígitos y empieza con 53, está perfecto
    return limpio;
}

// --- GUARDAR EL PRODUCTO COMPLETO EN LA TABLA ---
// --- GUARDAR PRODUCTO CON VERIFICACIÓN INTELIGENTE (FUZZY MATCH) ---
document.getElementById('form-nuevo-prod').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-prod');
    if (productSaveInFlight || btn.disabled) return;
    productSaveInFlight = true;
    const form = document.getElementById('form-nuevo-prod');
    const previousInert = form.inert;
    form.inert = true;
    btn.disabled = true;
    btn.innerText = "GUARDANDO...";
    let editId = '';
    let guardado = false;

    try {
        const nombreInput = document.getElementById('p-nombre').value.trim();
        const categoriaInput = document.getElementById('p-categoria').value;
        editId = document.getElementById('p-id-edit').value;
        const fichaPdfInput = document.getElementById('p-ficha-pdf');
        const fichaPdfOriginal = fichaPdfInput?.value.trim() || '';
        const fichaPdfUrl = normalizeTechnicalSheetUrl(fichaPdfOriginal);

        if (fichaPdfOriginal && !fichaPdfUrl) {
            alert("❌ La ficha técnica debe tener un enlace HTTPS válido que termine en .pdf.");
            fichaPdfInput?.focus();
            return;
        }
        if (fichaPdfInput && fichaPdfUrl) fichaPdfInput.value = fichaPdfUrl;

        // Validar antes de consultar: no gastar una petición si falta la foto.
        const imgName = document.getElementById('p-img-name')?.value || '';
        const tieneFoto = [0, 1, 2, 3].some(i => document.getElementById(`img-path-${i}`).value);
        if (!editId && !tieneFoto && !imgName) {
            alert("❌ Error: Debes subir al menos una foto.");
            return;
        }

        // Capturar un solo borrador antes de la primera consulta asíncrona.
        const datos = {
            nombre: nombreInput,
            precio: parseFloat(document.getElementById('p-precio').value),
            comision: parseFloat(document.getElementById('p-comision').value) || 0,
            categoria: categoriaInput,
            descripcion: ProductDescriptionEditorApi.readProductDescription({ editor: quill }),

            thumbnail: document.getElementById('img-path-0').value || imgName,
            image1: document.getElementById('img-path-1').value,
            image2: document.getElementById('img-path-2').value,
            image3: document.getElementById('img-path-3').value,

            ficha_pdf: fichaPdfUrl || null,
            ficha_pdf_nombre: fichaPdfUrl
                ? (document.getElementById('p-ficha-pdf-nombre')?.value.trim() || 'Ficha técnica')
                : null,
            ficha_pdf_idioma: fichaPdfUrl
                ? (document.getElementById('p-ficha-pdf-idioma')?.value || 'ES')
                : null,

            mensajeria: document.getElementById('p-mensajeria') ? document.getElementById('p-mensajeria').value : "",
            tamaño_envio: document.getElementById('p-tamano-envio').value,
            disponible: ProductAvailabilityFormApi.getProductAvailability({
                isEditing: Boolean(editId),
                currentValue: document.getElementById('p-disponible').value,
                saveInactive: document.getElementById('p-create-inactive')?.checked
            }),
            proveedor: document.getElementById('p-proveedor').value || 'General',
            precio_flexible: document.getElementById('p-flexible').value || 'NO',
            garantia: document.getElementById('p-garantia').value,
            pagos: 'USD, CUP, Zelle'
        };

        // ============================================================
        // 1. DETECTOR DE DUPLICADOS INTELIGENTE (Solo si es NUEVO)
        // ============================================================
        if (!editId) {
            // A. Limpiamos el nombre para sacar palabras clave importantes
            // Quitamos palabras comunes que la IA pone siempre (Smart, TV, de, el, con...)
            const palabrasIgnoradas = ['de', 'el', 'la', 'con', 'para', 'en', 'y', 'un', 'una', 'smart', 'nuevo', 'oferta'];

            // Separamos el nombre en palabras, filtramos las cortas (<3 letras) y las ignoradas
            const palabrasClave = nombreInput.toLowerCase()
                .split(/[\s\-\/\(\)]+/) // Separar por espacios o guiones
                .filter(w => w.length > 2 && !palabrasIgnoradas.includes(w));

            const keywords = palabrasClave.slice(0, 3);

            if (keywords.length > 0) {
                // Filtros compatibles con el gateway seguro, en cualquier orden.
                // Limitar DESPUÉS de filtrar la categoría evita ocultar coincidencias.
                let consulta = supabaseClient
                    .from('productos')
                    .select('nombre, precio, categoria')
                    .eq('categoria', categoriaInput);
                for (const palabra of keywords) {
                    const literal = palabra.replace(/[\\%_]/g, '\\$&');
                    consulta = consulta.ilike('nombre', `%${literal}%`);
                }
                const { data: similares, error: errCheck } = await consulta.limit(3);
                if (errCheck) throw errCheck;

                // C. Si encuentra coincidencias, ALERTA al administrador
                if (similares && similares.length > 0) {
                    // Filtramos para asegurar que sean de la misma categoría (para evitar falsos positivos)
                    const duplicadoReal = similares.find(p => p.categoria === categoriaInput);

                    if (duplicadoReal) {
                        const confirmar = confirm(
                            `⛔ POSIBLE DUPLICADO DETECTADO\n\n` +
                            `Tú intentas subir: "${nombreInput}"\n\n` +
                            `Pero ya existe en base de datos:\n` +
                            `👉 "${duplicadoReal.nombre}" ($${duplicadoReal.precio})\n\n` +
                            `¿Es el mismo equipo que subió otro admin?\n` +
                            `[Aceptar] = Cancelar subida (No duplicar)\n` +
                            `[Cancelar] = Subir de todas formas (Es diferente)`
                        );

                        if (confirmar) {
                            return; // Detiene el proceso, no guarda nada.
                        }
                    }
                }
            }
        }
        // ============================================================

        const operacion = editId
            ? supabaseClient.from('productos').update(datos).eq('id', editId)
            : supabaseClient.from('productos').insert([datos]);
        const { error } = await operacion;
        if (error) throw error;

        guardado = true;
        // El guardado ya se confirmó. Cerrar evita reenviar si falla el refresco.
        closeModalProd(true);
        window.PTHSecureData.clearCaches();
        localStorage.removeItem('pth_catalogo_cache_time');
        const { error: errorVersion } = await supabaseClient
            .from('control_sistema')
            .upsert([{ clave: 'ultimo_cambio_productos', valor: new Date().toISOString() }]);
        if (errorVersion) throw errorVersion;
        if (typeof loadAdminData === 'function') await loadAdminData();
        alert("✅ ¡Guardado correctamente!");
    } catch (error) {
        console.error(guardado ? "Error actualizando catálogo:" : "Error guardando producto:", error);
        if (guardado) {
            alert("✅ El producto quedó guardado, pero no se pudo actualizar el catálogo. Actualiza la página; no vuelvas a crear el producto.");
        } else {
            alert(`❌ No se pudo ${editId ? 'actualizar' : 'guardar'} el producto.\n\n${error?.message || 'Error inesperado.'}\n\nSe conserva lo escrito en este formulario.`);
        }
    } finally {
        productSaveInFlight = false;
        form.inert = previousInert;
        btn.disabled = false;
        btn.innerText = editId ? "Actualizar Producto" : "Guardar Cambios";
    }
});


// Función mágica de compresión
function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a Blob (JPEG con calidad 0.7 es super ligero)
                canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.7);
            };
        };
    });
}

// --- FUNCIÓN UNIVERSAL PARA EXPORTAR A EXCEL ---
async function exportToExcel(tableId, fileName) {
    if (window.PTHAssets && !await window.PTHAssets.ensure('xlsx')) return;
    const table = document.getElementById(tableId);
    if (!table) return alert("No hay datos para exportar");

    // Creamos una hoja de trabajo a partir de la tabla HTML
    const wb = XLSX.utils.table_to_book(table, { sheet: "Reporte" });

    // Generamos el archivo y lo descargamos
    // Le añade la fecha de hoy al nombre para que no se confundan los archivos
    const fecha = new Date().toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `${fileName}_${fecha}.xlsx`);
}


// 2. Subida de imágenes mejorada (para los 4 espacios)
async function handlePowerUpload(input, index) {
    const file = input.files[0];
    if (!file) return;

    const icon = document.getElementById(`icon-${index}`);
    const prev = document.getElementById(`prev-${index}`);
    icon.innerText = "sync"; // Icono de cargando

    try {
        const compressedBlob = await compressImage(file, 800, 800);
        const fileName = `${Date.now()}_${index}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;

        const { error } = await supabaseClient.storage.from('productos').upload(fileName, compressedBlob);
        if (error) throw error;

        // Mostrar previsualización
        document.getElementById(`img-path-${index}`).value = fileName;
        prev.src = URL.createObjectURL(compressedBlob);
        prev.classList.remove('hidden');
        icon.classList.add('hidden');
    } catch (e) {
        alert("Error al subir foto " + (index + 1));
        icon.innerText = "add_a_photo";
    }
}

// Función para borrar una foto específica
function clearImageSlot(event, index) {
    // IMPORTANTE: Evita que el clic se propague al div padre (que abriría el selector de archivos)
    event.stopPropagation();

    if (confirm("¿Quieres quitar esta foto?")) {
        // 1. Limpiar el valor del input oculto (el que se guarda en la base de datos)
        document.getElementById(`img-path-${index}`).value = "";

        // 2. Ocultar la imagen de previsualización
        const prev = document.getElementById(`prev-${index}`);
        prev.src = "";
        prev.classList.add('hidden');

        // 3. Mostrar de nuevo el icono de "Añadir foto"
        const icon = document.getElementById(`icon-${index}`);
        icon.classList.remove('hidden');
        icon.innerText = "add_a_photo";

        // 4. Resetear el input file por si quieres subir la misma foto después
        document.getElementById(`file-${index}`).value = "";
    }
}

// 3. Función para EDITAR producto (Cargar datos en el modal)
// 3. Función para EDITAR producto (CORREGIDA)
    function editProduct(id) {
    if (typeof prepareProductEditor === "function") void prepareProductEditor();
        if (productSaveInFlight) return alert("⏳ Espera a que termine el guardado del producto.");
        // 1. Buscar el producto en la lista de Inventario (Admin) O en la de Catálogo
        // Esto asegura que funcione donde sea que estés
        const p = (typeof inventoryRawAdmin !== 'undefined' ? inventoryRawAdmin.find(prod => prod.id === id) : null)
                  || productosRaw.find(prod => prod.id === id);

        if (!p) return alert("Error: No se encuentra la información del producto.");
        if (!Object.prototype.hasOwnProperty.call(p, 'descripcion')) {
            const requestedId = id;
            window.pthPendingProductEdit = requestedId;
            return ensureProductDescriptions([p]).then(() => {
                if (window.pthPendingProductEdit === requestedId) editProduct(requestedId);
            }).catch(error => alert(error.message));
        }
        window.pthPendingProductEdit = null;
        updateFormProviders(); // <-- Poblamos el select antes de asignarle el valor

        // Llenamos los campos.
    // USAR || "" es vital para que si en la DB está vacío, el formulario se limpie
    const inputs = {
        'p-id-edit': p.id,
        'p-nombre': p.nombre,
        'p-precio': p.precio,
        'p-comision': p.comision,
        'p-categoria': p.categoria,
        'p-garantia': p.garantia,
        'p-proveedor': p.proveedor ? p.proveedor.trim() : 'General', // <-- Saneamos con .trim()
        'p-flexible': p.precio_flexible || 'NO',
        'p-mensajeria': p.mensajeria || "",
        'p-ficha-pdf': p.ficha_pdf || "",
        'p-ficha-pdf-nombre': p.ficha_pdf_nombre || "Ficha técnica",
        'p-ficha-pdf-idioma': p.ficha_pdf_idioma || "ES",
        'p-disponible': p.disponible || "SI",
        'p-tamano-envio': p.tamaño_envio || "Pequeño"
    };

    for (const [key, value] of Object.entries(inputs)) {
        const el = document.getElementById(key);
        if(el) el.value = value;
    }

    const inactiveControl = document.getElementById('p-create-inactive-control');
    if (inactiveControl) inactiveControl.classList.add('hidden');
    const inactiveCheckbox = document.getElementById('p-create-inactive');
    if (inactiveCheckbox) inactiveCheckbox.checked = false;

        // 3. Cambiar texto del botón
        const btnSave = document.getElementById('btn-save-prod');
        if(btnSave) {
            btnSave.disabled = false;
            btnSave.innerText = "Actualizar Producto";
        }

        // 4. Cargar Descripción en el Editor Quill
        quill = ProductDescriptionEditorApi.ensureProductDescriptionEditor({ QuillCtor: window.Quill, currentEditor: quill });
        ProductDescriptionEditorApi.writeProductDescription(p.descripcion || '', { editor: quill });

        // 5. Cargar Fotos (Modo GitHub Texto)
        const fotos = [p.thumbnail, p.image1, p.image2, p.image3];
        fotos.forEach((foto, i) => {
            const input = document.getElementById(`img-path-${i}`);

            // Limpiamos la URL completa para dejar solo el nombre del archivo
            // Esto es para que en el input se vea "lavadora.jpg" y no "https://raw..."
            let nombreArchivo = "";
            if (foto) {
                nombreArchivo = foto.split('/').pop(); // Toma lo último después del /
                nombreArchivo = nombreArchivo.split('?')[0]; // Quita tokens si los hay
            }

            if (input) {
                input.value = nombreArchivo;
                // Disparamos la previsualización manualmente
                previewGithubImage(i);
            }
        });

        // 6. Mostrar Modal
        document.getElementById('modal-producto').classList.remove('hidden');
        document.getElementById('modal-producto').scrollTop = 0;
        document.body.style.overflow = 'hidden';
    }



// --- 3. HERRAMIENTAS DE MARKETING (DESCARGAR Y COPIAR) ---

    // Función mejorada para forzar la descarga de la imagen
    async function downloadProductImage() {
        if(!selectedProduct) return;

        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="loader w-4 h-4 border-2 border-primary"></span>`; // Spinner pequeño

        try {
            const url = fixDriveUrl(selectedProduct.thumbnail);

            // 1. Obtenemos la imagen como un "blob" (archivo crudo)
            const response = await fetch(url);
            const blob = await response.blob();

            // 2. Creamos un enlace temporal en memoria
            const blobUrl = window.URL.createObjectURL(blob);

            // 3. Forzamos la descarga
            const link = document.createElement('a');
            link.href = blobUrl;
            // Limpiamos el nombre del archivo para que se guarde bonito
            const cleanName = selectedProduct.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `foto_${cleanName}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 4. Limpiamos memoria
            window.URL.revokeObjectURL(blobUrl);

            btn.innerHTML = originalText;
        } catch (error) {
            console.error(error);
            alert("No se pudo descargar la imagen directamente. Intenta mantener presionado sobre la foto.");
            btn.innerHTML = originalText;
        }
    }

// --- SERVICIO CENTRAL DE ENLACES CORTOS ---
// Reutiliza enlaces existentes, evita consultas repetidas con caché local y
// conserva siempre el enlace largo como respaldo si Supabase no responde.
const pendingShortLinkRequests = new Map();
const SHORT_LINK_CACHE_KEY = 'pth_short_links_cache_v2';
const SHORT_LINK_CACHE_LIMIT = 250;

function getShortLinkCache() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SHORT_LINK_CACHE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function findCachedShortLink(gestor, longLink) {
    return getShortLinkCache().find(entry =>
        entry.gestor === gestor && entry.original === longLink)?.short || '';
}

function cacheShortLink(gestor, longLink, shortLink) {
    if (!shortLink || shortLink === longLink) return;
    const withoutDuplicate = getShortLinkCache().filter(entry =>
        !(entry.gestor === gestor && entry.original === longLink));
    withoutDuplicate.unshift({
        gestor,
        original: longLink,
        short: shortLink,
        savedAt: Date.now()
    });
    try {
        localStorage.setItem(SHORT_LINK_CACHE_KEY, JSON.stringify(withoutDuplicate.slice(0, SHORT_LINK_CACHE_LIMIT)));
    } catch (error) {
        // La falta de espacio local nunca debe impedir que se comparta.
    }
}

function createShortSlug(length = 7) {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    if (window.crypto?.getRandomValues) {
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        return Array.from(values, value => alphabet[value % alphabet.length]).join('');
    }
    return Math.random().toString(36).slice(2, 2 + length);
}

async function requestShortLink(gestor, longLink) {
    const { data: existing, error: fetchError } = await supabaseClient
        .from('short_links')
        .select('slug')
        .eq('gestor', gestor)
        .eq('original_url', longLink)
        .limit(1)
        .maybeSingle();
    if (fetchError) throw fetchError;
    if (existing?.slug) {
        return `${window.location.origin}/?s=${existing.slug}`;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
        const slug = createShortSlug();
        const { error } = await supabaseClient.from('short_links').insert([{
            slug,
            original_url: longLink,
            gestor
        }]);
        if (!error) return `${window.location.origin}/?s=${slug}`;
        if (error.code !== '23505') throw error;
    }
    throw new Error('No fue posible generar un código corto único.');
}

async function getOrGenerateShortLink(gestor, longLink) {
    const cleanGestor = String(gestor || window.gestorName || 'ParaTuHogar').trim();
    const cleanLongLink = String(longLink || '').trim();
    if (!cleanLongLink) return '';
    if (/[?&]s=[a-z0-9]+(?:&|$)/i.test(cleanLongLink)) return cleanLongLink;

    const cached = findCachedShortLink(cleanGestor, cleanLongLink);
    if (cached) return cached;

    const requestKey = `${cleanGestor}\n${cleanLongLink}`;
    if (pendingShortLinkRequests.has(requestKey)) return pendingShortLinkRequests.get(requestKey);

    const request = requestShortLink(cleanGestor, cleanLongLink)
        .then(shortLink => {
            cacheShortLink(cleanGestor, cleanLongLink, shortLink);
            return shortLink;
        })
        .catch(error => {
            console.error('Error generando enlace corto:', error);
            // Respaldo opaco: conserva la atribución sin mostrar nombres de
            // parámetros, nombre del gestor ni teléfono en la dirección.
            return makeOpaqueAttributedFallback(cleanLongLink);
        })
        .finally(() => pendingShortLinkRequests.delete(requestKey));

    pendingShortLinkRequests.set(requestKey, request);
    return request;
}

    // Función para copiar texto de venta profesional con enlace de afiliado
 async function copySmartOffer(btnElement) {
    if(!selectedProduct) return;
    trackSpy('COPIO_OFERTA', selectedProduct.nombre);

    const gestor = window.gestorName || 'Ventas';
    const miTelefono = getAgentPhone(); // Usamos tu función inteligente

    // La atribución viaja dentro del destino almacenado, pero el cliente solo ve ?s=.
    const permanentUrl = new URL(getPermanentProductUrl(selectedProduct, true));
    permanentUrl.searchParams.set('ref', gestor);
    permanentUrl.searchParams.set('contact', String(miTelefono || '').replace(/\D/g, ''));
    const longLink = permanentUrl.toString();

    // El link corto ahora guardará la dirección COMPLETA con el teléfono
    const finalLink = await getOrGenerateShortLink(gestor, longLink);

    const textoVenta =
`🔥 *¡OFERTA ESPECIAL!* 🔥
📦 Modelo: *${selectedProduct.nombre}*

💰 Precio: *$${selectedProduct.precio} USD*
🚚 Mensajería: ${selectedProduct.mensajeria || 'A consultar'}
🛡️ Garantía: ${selectedProduct.garantia || 'Garantía Oficial'}

👇 *Ver fotos y detalles aquí:*
${finalLink}

✅ *Pedir ahora por WhatsApp:*
https://wa.me/${miTelefono}?text=${encodeURIComponent('Hola, me interesa el equipo: ' + selectedProduct.nombre)}`;

    navigator.clipboard.writeText(textoVenta).then(() => {
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = `<span class="material-symbols-outlined text-xl text-green-500">check</span>Copiado`;
        setTimeout(() => { btnElement.innerHTML = originalText; }, 2000);
    });
}

// ==========================================
// NUEVO: MÓDULO PRO PARA GESTORES 2.0
// ==========================================

// --- 1. LÓGICA DE FILTROS Y ORDENAMIENTO ---

// --- PEGAR ESTO EN index.html (Reemplaza la función applySort antigua) ---

function applySort() {
    // 1. Determinar quién está viendo y qué selector leer
    const isGestor = isGestorCatalogMode();
    let selector = isGestor ? document.getElementById('sort-selector') : document.getElementById('sort-selector-public');

    // Si por error no encuentra el selector, usamos 'nuevo' por defecto
    let criteria = selector ? selector.value : 'nuevo';

    // 2. Reutilizar los mismos filtros de búsqueda, categoría e inventario.
    let listaProcesada = getFilteredCatalogProducts();

    // 4. APLICAR EL ORDENAMIENTO (NÚCLEO DEL CAMBIO)
    listaProcesada.sort((a, b) => {
        // REGLA MAESTRA: B2B/Mayorista SIEMPRE al final (Si el cliente está viendo "TODOS")
        const catA = (a.categoria || "").toUpperCase();
        const catB = (b.categoria || "").toUpperCase();
        const isB2bA = catA.includes('MAYORISTA') || catA.includes('B2B') || catA.includes('MIPYME');
        const isB2bB = catB.includes('MAYORISTA') || catB.includes('B2B') || catB.includes('MIPYME');

        if (activeCategory === 'TODOS') {
            if (isB2bA && !isB2bB) return 1;   // Envía A al final
            if (!isB2bA && isB2bB) return -1;  // Envía B al final
        }

        // Si pasan la regla del mayorista, ordenamos según lo que eligió el usuario
        if (criteria === 'comision_desc') {
            return (parseFloat(b.comision) || 0) - (parseFloat(a.comision) || 0);
        } else if (criteria === 'precio_asc') {
            return (parseFloat(a.precio) || 0) - (parseFloat(b.precio) || 0);
        } else if (criteria === 'precio_desc') {
            return (parseFloat(b.precio) || 0) - (parseFloat(a.precio) || 0);
        } else if (criteria === 'demandados') {
            // Ordenar por vistas (De mayor a menor)
            return (parseFloat(b.vistas) || 0) - (parseFloat(a.vistas) || 0);
        } else {
            // 'nuevo' o defecto -> Más reciente primero (Fechas más nuevas)
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
        }
    });

    // 5. RENDERIZAR LA LISTA FINAL
    renderProductsCustom(listaProcesada);
}

function renderProductsCustom(lista) {
    renderCatalogProducts(lista);
}

function getProductForQuickAction(name) {
    const realName = String(name || '').replace(/&quot;/g, '"');
    return productosRaw.find(product => product.nombre === realName) || null;
}

const SHARED_PRODUCTS_STORAGE_KEY = 'pth_shared_products_v1';

function getSharedProductIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(SHARED_PRODUCTS_STORAGE_KEY) || '[]').map(String));
    } catch (error) {
        return new Set();
    }
}

function rememberSharedProduct(product) {
    const ids = getSharedProductIds();
    ids.add(String(product.id || product.nombre));
    ids.add(String(product.nombre));
    localStorage.setItem(SHARED_PRODUCTS_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-250)));
}

function getAvailableProductSubstitutes(product, limit = 3) {
    const price = Number(product?.precio) || 0;
    const category = String(product?.categoria || '').trim().toUpperCase();
    const available = productosRaw.filter(candidate =>
        isProductCurrentlyAvailable(candidate)
        && String(candidate.id) !== String(product?.id)
        && candidate.nombre !== product?.nombre
    );
    const sameCategory = available.filter(candidate =>
        String(candidate.categoria || '').trim().toUpperCase() === category
    );
    return (sameCategory.length ? sameCategory : available)
        .map(candidate => ({
            ...candidate,
            priceDistance: price ? Math.abs((Number(candidate.precio) || 0) - price) / price : 0
        }))
        .filter(candidate => !price || candidate.priceDistance <= 0.35)
        .sort((a, b) => a.priceDistance - b.priceDistance)
        .slice(0, limit);
}

function showUnavailableSharedOffer(product) {
    const alternatives = getAvailableProductSubstitutes(product);
    const container = document.getElementById('productos-container');
    if (!container) return;
    const cards = alternatives.length
        ? alternatives.map(item => {
            const safeName = String(item.nombre).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `<button onclick="openDetail('${safeName}')" class="flex min-w-0 items-center gap-3 rounded-2xl border border-amber-200 bg-white p-3 text-left shadow-sm">
                <img src="${fixDriveUrl(item.thumbnail)}" alt="" class="h-14 w-14 rounded-xl bg-slate-50 object-contain">
                <span class="min-w-0"><strong class="block truncate text-xs text-slate-900">${gestorSafeText(item.nombre)}</strong>
                <small class="mt-1 block font-black text-[#1a4789]">$${Number(item.precio).toFixed(0)} USD</small></span>
            </button>`;
        }).join('')
        : `<p class="rounded-xl bg-white p-3 text-xs font-bold text-slate-600">Por ahora no hay un sustituto equivalente confirmado.</p>`;
    container.insertAdjacentHTML('beforebegin', `
        <section id="unavailable-shared-offer" class="col-span-full mx-auto mb-5 w-full max-w-5xl rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div class="flex items-start gap-3">
                <span class="material-symbols-outlined rounded-2xl bg-amber-100 p-3 text-amber-700">inventory_2</span>
                <div>
                    <p class="text-[10px] font-black uppercase tracking-wider text-amber-700">Inventario actualizado</p>
                    <h2 class="mt-1 text-lg font-black text-slate-900">Esta oferta acaba de agotarse</h2>
                    <p class="mt-1 text-xs font-medium text-slate-600">${gestorSafeText(product.nombre)} ya no puede añadirse al pedido. Te mostramos opciones disponibles en un rango de precio similar.</p>
                </div>
            </div>
            <div class="mt-4 grid gap-2 md:grid-cols-3">${cards}</div>
        </section>`);
    document.getElementById('unavailable-shared-offer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function buildProductOfferText(product) {
    if (!isProductCurrentlyAvailable(product)) {
        throw new Error('PRODUCT_UNAVAILABLE');
    }
    const agent = window.gestorName || 'ParaTuHogar';
    const phone = String(getAgentPhone() || '').replace(/\D/g, '');
    const permanentUrl = new URL(getPermanentProductUrl(product, true));
    if (window.gestorName) {
        permanentUrl.searchParams.set('ref', window.gestorName);
        permanentUrl.searchParams.set('contact', phone);
    }
    const longProductUrl = permanentUrl.toString();
    const productUrl = await getOrGenerateShortLink(agent, longProductUrl);
    return `🔥 *OFERTA DISPONIBLE*

📦 *${product.nombre}*
💰 *Precio:* $${product.precio} USD
🛡️ *Garantía:* ${product.garantia || 'Consultar'}
🚚 *Entrega:* ${product.mensajeria || 'Consultar'}

🔎 Fotos y detalles:
${productUrl}

📲 Atendido por ${agent}`;
}

async function copyProductOffer(name, button) {
    const product = getProductForQuickAction(name);
    if (!product) return;
    if (!isProductCurrentlyAvailable(product)) {
        updateGestorSalesPulse();
        return alert('Este producto está agotado. La oferta no se puede copiar ni compartir.');
    }
    try {
        const offerText = await buildProductOfferText(product);
        await navigator.clipboard.writeText(offerText);
        rememberSharedProduct(product);
        trackSpy('COPIO_OFERTA', product.nombre);
        if (button) {
            const previous = button.innerHTML;
            button.innerHTML = `<span class="material-symbols-outlined text-lg">check</span><span class="text-[8px] font-black uppercase">Listo</span>`;
            button.classList.add('text-emerald-600');
            setTimeout(() => {
                button.innerHTML = previous;
                button.classList.remove('text-emerald-600');
            }, 1600);
        }
    } catch (error) {
        alert('No se pudo copiar la oferta. Revisa los permisos del navegador.');
    }
}

async function shareProductWhatsApp(name) {
    const product = getProductForQuickAction(name);
    if (!product) return;
    if (!isProductCurrentlyAvailable(product)) {
        updateGestorSalesPulse();
        return alert('Este producto está agotado. Su enlace fue retirado de las ofertas compartibles.');
    }
    trackSpy('COMPARTIO_WHATSAPP', product.nombre);
    const shareWindow = window.open('about:blank', '_blank');
    const offerText = await buildProductOfferText(product);
    rememberSharedProduct(product);
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(offerText)}`;
    if (shareWindow) shareWindow.location.replace(shareUrl);
    else window.location.href = shareUrl;
}

async function downloadProductCardImage(name, button) {
    const product = getProductForQuickAction(name);
    if (!product || !product.thumbnail) return alert('Este producto todavía no tiene imagen disponible.');
    const previous = button ? button.innerHTML : '';
    try {
        if (button) button.innerHTML = `<span class="loader w-4 h-4 border-blue-600"></span><span class="text-[8px] font-black uppercase">Bajando</span>`;
        const response = await fetch(fixDriveUrl(product.thumbnail));
        if (!response.ok) throw new Error('No se pudo obtener la imagen.');
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Oferta_${product.nombre.replace(/[^a-z0-9]+/gi, '_').slice(0, 55)}.jpg`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        trackSpy('DESCARGO_FOTO', product.nombre);
    } catch (error) {
        console.error(error);
        alert('No se pudo descargar la imagen de este producto.');
    } finally {
        if (button) button.innerHTML = previous;
    }
}

function addProductFromCard(name) {
    const product = getProductForQuickAction(name);
    if (!product) return;
    selectedProduct = product;
    addItemToCart();
}

function drawStoryRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function drawStoryText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || '').trim().split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
            if (lines.length === maxLines) break;
        } else {
            current = test;
        }
    }
    if (lines.length < maxLines && current) lines.push(current);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]*$/, '')}…`;
    }
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
}

function loadStoryProductImage(url) {
    return new Promise(resolve => {
        if (!url) return resolve(null);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = fixDriveUrl(url);
    });
}

// Stories shares the same tested renderer, selection and prepared-file flow as Studio.
let storyToolOpening = false;
async function openStoryComposer(name = '') {
    if (storyToolOpening) return;
    storyToolOpening = true;
    try {
        if (!await window.PTHAssets.ensure('studio')) return;
        const product = name ? getProductForQuickAction(name) : null;
        window.PTHContentStudio.openStory(supabaseClient, {
            productName: product?.nombre || '',
            onUsage: (action, count) => trackSpy('USO_HERRAMIENTA', `Story ${action}: ${count} imágenes`)
        });
    } finally { storyToolOpening = false; }
}
function closeStoryComposer() { window.PTHContentStudio?.closeStory(); }
function generateStoryForProduct(name) { return openStoryComposer(name); }
function generateQuickStoryForProduct(name) { return openStoryComposer(name); }

async function loadAnalyticsPro(nombreGestor) {
    const { data: pedidos, error } = await supabaseClient.from('pedidos').select('*');
    if (error || !pedidos) return;

    const level = window.currentGestorLevel || 0;
    const misPedidos = pedidos.filter(p => p.gestor === nombreGestor && p.estado !== 'Cancelado');

    // --- MEJOR HORARIO (EL ORÁCULO DE VENTAS) ---
    const elHorario = document.getElementById('ana-hora-pico');
    if (elHorario) {
        if (level >= 4) {
            elHorario.innerText = getPeakSalesTime(misPedidos);
            elHorario.className = "text-3xl font-black text-primary animate-pulse";
        } else {
            elHorario.innerHTML = `
                <div class="flex flex-col items-center justify-center py-2 opacity-40">
                    <span class="material-symbols-outlined text-4xl mb-2">lock_clock</span>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-center">
                        <span class="text-primary">El Oráculo</span> bloqueado<br>
                        Sube a Nivel 4 para ver tus horas de cierre.
                    </p>
                </div>`;
        }
    }

    // --- TENDENCIA GLOBAL (EL RADAR DE DINERO) ---
    const elTendencia = document.getElementById('ana-tendencia-global');
    if (elTendencia) {
        if (level >= 3) {
            const tendencias = getGlobalTrendRadar(pedidos);
            elTendencia.innerHTML = tendencias.map((t, i) => `
                <div class="flex justify-between items-center mb-1 group">
                    <span class="text-[10px] font-black uppercase text-gray-500">#${i+1} ${t.name}</span>
                    <span class="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                        ${t.count} VENTAS HOY
                    </span>
                </div>
            `).join('');
        } else {
            elTendencia.innerHTML = `
                <div class="flex flex-col items-center justify-center py-2">
                    <div class="relative mb-2">
                        <span class="material-symbols-outlined text-4xl text-slate-200">radar</span>
                        <span class="material-symbols-outlined absolute top-0 right-0 text-sm text-red-500 animate-ping">lock</span>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-center text-slate-300">
                        <span class="text-slate-400">Radar de Mercado</span> Bloqueado<br>
                        Mira qué están vendiendo los Pro en Nivel 3.
                    </p>
                </div>`;
        }
    }
}


// --- 3. LÓGICA DE REPORTES (BUZÓN) ---

function previewReportImg() {
    const input = document.getElementById('rep-file');
    if(input.files && input.files[0]) {
        document.getElementById('rep-file-name').innerText = "📷 " + input.files[0].name;
    }
}

async function sendGestorReport() {
    const gestor = window.gestorName;
    const tipo = document.getElementById('rep-tipo').value;
    const msg = document.getElementById('rep-msg').value;
    const fileInput = document.getElementById('rep-file');

    if (!msg) return alert("Por favor describe el detalle.");

    // Subir imagen si existe
    let imgUrl = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `reportes/${Date.now()}_${gestor}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Usamos la misma lógica de upload que ya tienes, pero al bucket 'reportes' o 'productos' si no creaste otro
        // Si no creaste bucket 'reportes', usa 'productos' temporalmente
        const { data, error } = await supabaseClient.storage.from('productos').upload(fileName, file);
        if (!error) imgUrl = fileName;
    }

    // Guardar en Base de Datos
    const { error } = await supabaseClient.from('reportes_gestor').insert([{
        gestor: gestor,
        categoria: tipo,
        mensaje: msg,
        imagen_url: imgUrl,
        estado: 'Pendiente'
    }]);

    if (error) {
        alert("Error al enviar reporte: " + error.message);
    } else {
        alert("✅ Gracias por tu aporte. Lo revisaremos.");
        document.getElementById('form-reporte-gestor').reset();
        document.getElementById('rep-file-name').innerText = "";
    }
}

// ==========================================
// FORZAR FUNCIÓN DE SALIDA (GLOBAL)
// ==========================================
window.doLogout = function() {
    if(!confirm("¿Cerrar sesión? \n\nNOTA: Este dispositivo quedará vinculado a tu cuenta.")) return;

    const sessionRaw = localStorage.getItem('pth_session');

    if (sessionRaw) {
        try {
            const session = JSON.parse(sessionRaw);

            // 1. CAPTURAR DATOS
            const nombre = session.name;

            // INTELIGENCIA DE TELÉFONO:
            // Si es un Gestor normal, el teléfono está en session.data.telefono
            // Si eres TÚ (Admin hardcodeado), a veces no está, así que forzamos el tuyo.
            let telefono = session.data?.telefono || "";

            // Si por alguna razón es el Admin y no tiene teléfono, ponemos el del dueño
            if ((!telefono || telefono === "") && (nombre.includes("Admin") || nombre.includes("Marcel"))) {
                telefono = "5356071095"; // TU NÚMERO DE RESPALDO
            }

            if (nombre && telefono) {
                // 2. CREAR EL AMARRE (30 DÍAS)
                // Al hacer Login directo, te damos el máximo nivel de retención (30 días)
                // porque has demostrado identidad física en el dispositivo.
                const amarreData = {
                    nombre: nombre,
                    telefono: telefono,
                    timestamp: new Date().getTime(),
                    expiresAt: new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
                };

                localStorage.setItem('pth_referrer_smart', JSON.stringify(amarreData));
                localStorage.setItem('pth_referrer', JSON.stringify(amarreData));
                console.log(`🔒 Dispositivo amarrado a: ${nombre} (${telefono})`);
            }
        } catch (e) {
            console.error("Error al guardar rastro:", e);
        }
    }

    // 3. LIMPIEZA Y RECARGA
    window.PTHSecureData.logout();
    localStorage.removeItem('pth_session');
    window.gestorName = null;
    window.currentUserData = null;
    window.isAdmin = false;
    window.location.href = window.location.origin + window.location.pathname;
};
// ==========================================
    // HERRAMIENTAS DE MARKETING MASIVO
    // ==========================================

    // 1. COPIAR LISTA DE OFERTAS (AMETRALLADORA)
    async function legacyCopyCategoryOffersV1() {
    const gestor = window.gestorName || 'Ventas';
    const miTelefono = getAgentPhone(); // <--- Aquí usamos el "Cerebro"

    const visibleProducts = productosRaw.filter(p => {
        return (activeCategory === 'TODOS' || (p.categoria && p.categoria.toUpperCase().includes(activeCategory))) && p.disponible === "SI";
    });

    if (visibleProducts.length === 0) return alert("No hay productos.");

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `⏳ Procesando links...`;

    let textoFinal = `🌟 *CATÁLOGO DISPONIBLE - ${activeCategory}* 🌟\n\n`;

    for (const p of visibleProducts) {
        // Construimos link con TU teléfono
        let rawLink = `${getPermanentProductUrl(p, true)}?ref=${encodeURIComponent(gestor)}&contact=${miTelefono}`;
        let linkInteligente = await getOrGenerateShortLink(gestor, rawLink);

        textoFinal += `📦 *${p.nombre}*\n`;
        textoFinal += `💰 Precio: $${p.precio} USD\n`;
        textoFinal += `🔗 Ver: ${linkInteligente}\n`;
        textoFinal += `--------------------------------\n`;
    }

    // El link de abajo ahora usará TU teléfono obligatoriamente
    textoFinal += `\n✅ *Pedir aquí:* https://wa.me/${miTelefono}`;

    navigator.clipboard.writeText(textoFinal).then(() => {
        btn.innerHTML = `✅ ¡COPIADO!`;
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    });
}

    // 2. DESCARGAR PACK DE FOTOS (ZIP)
    async function downloadCategoryPhotos() {
    if (window.PTHAssets && !await window.PTHAssets.ensure('zip')) return;
        if (typeof JSZip === 'undefined') return alert("Librería ZIP no cargada. Recarga la página.");

        const visibleProducts = productosRaw.filter(p => {
            return (activeCategory === 'TODOS' || (p.categoria && p.categoria.toUpperCase().includes(activeCategory))) && p.disponible === "SI";
        });

        if (visibleProducts.length === 0) return alert("No hay productos.");
        if (visibleProducts.length > 20) {
            if(!confirm(`Vas a descargar ${visibleProducts.length} imágenes. Esto puede tardar unos segundos. ¿Continuar?`)) return;
        }

        const btn = event.currentTarget;
        const oldText = btn.innerHTML;
        btn.innerHTML = `⏳ Comprimiendo...`;
        btn.disabled = true;

        const zip = new JSZip();
        const folder = zip.folder(`Catalogo_${activeCategory}`);

        try {
            // Recorremos productos y descargamos fotos
            const promises = visibleProducts.map(async (p) => {
                try {
                    const url = fixDriveUrl(p.thumbnail);
                    const response = await fetch(url);
                    if(!response.ok) throw new Error('Network response was not ok');
                    const blob = await response.blob();

                    // Nombre del archivo limpio
                    const safeName = p.nombre.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                    folder.file(`${safeName}.jpg`, blob);
                } catch (err) {
                    console.warn("Error descargando imagen para ZIP:", p.nombre);
                }
            });

            await Promise.all(promises);

            // Generar ZIP y descargar
            const content = await zip.generateAsync({type:"blob"});
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(content);
            link.download = `Pack_Fotos_${activeCategory}_${new Date().toLocaleDateString()}.zip`;
            link.click();

            alert("✅ Pack descargado exitosamente.");

        } catch (e) {
            console.error(e);
            alert("Hubo un error generando el ZIP.");
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
    // ==========================================
    // FUNCIONES POWER-UP (PDF, STORY, SOCIAL)
    // ==========================================

    // 1. FILTRO TIBURÓN (Actualización de renderProducts)
    // Busca tu función 'renderProducts' antigua y asegúrate de añadir esta lógica de filtrado:
    /*
        const filterHighComm = document.getElementById('filter-high-comm')?.checked;

        const filtered = productosRaw.filter(p => {
            // ... (tus filtros anteriores) ...
            const matchComm = !filterHighComm || (Number(p.comision) > 10); // Lógica nueva

            return matchSearch && matchCat && matchComm && p.disponible === "SI";
        });
    */

    // 2. COMPARTIR REDES SOCIALES
    async function shareProductSocial(name, network) {
    const p = productosRaw.find(prod => prod.nombre === name);
    if(!p) return;

    const gestor = window.gestorName || '';
    const userData = window.currentUserData || {};
    const miTelefono = userData.telefono || new URLSearchParams(window.location.search).get('tel') || '';

    let rawLink = `${window.location.origin}${window.location.pathname}?search=${encodeURIComponent(p.nombre)}`;
    if (gestor) rawLink += `&ref=${encodeURIComponent(gestor)}&contact=${miTelefono}`;

    // Generar link corto antes de compartir
    const finalLink = await getOrGenerateShortLink(gestor, rawLink);


    if (network === 'wa') {
        const text = `🔥 ¡Oferta Flash! *${p.nombre}* a solo *$${p.precio} USD*. \n\nVer detalles aquí: ${finalLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (network === 'fb') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(finalLink)}`, '_blank');
    }
}


    // 4. GENERADOR DE INSTAGRAM STORY (DISEÑO PREMIUM 2.0)
    // ==========================================
    async function generateStoryImage() {
        if (selectedProduct) return openStoryComposer(selectedProduct.nombre);
    }

    // Función auxiliar para dibujar rectángulos redondeados
    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // Helper: Obtener imagen en Base64 para el PDF
    function getImageDataUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = url;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg"));
            };
            img.onerror = (e) => reject(e);
        });
    }



    // Auxiliar para texto en varias líneas (Story)
    function wrapText(context, text, x, y, maxWidth, lineHeight) {
        var words = text.split(' ');
        var line = '';

        for(var n = 0; n < words.length; n++) {
          var testLine = line + words[n] + ' ';
          var metrics = context.measureText(testLine);
          var testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
          }
          else {
            line = testLine;
          }
        }
        context.fillText(line, x, y);
    }

    // ==========================================
    // LÓGICA DE ACCESO Y SEGURIDAD (RESTAURADA)
    // ==========================================



    // 2. Proceso de Login
    // PROCESO DE LOGIN ÚNICO Y SEGURO (ADMIN + GESTORES + ESTADOS)
// PROCESO DE LOGIN ÚNICO Y SEGURO (ADMIN + GESTORES + ESTADOS)
// PROCESO DE LOGIN ÚNICO Y SEGURO (ADMIN + GESTORES + ESTADOS)
async function processLogin() {
    const user = document.getElementById("log-user")?.value.trim();
    const pass = document.getElementById("log-pass")?.value.trim();
    if (!user || !pass) return alert("Ingresa usuario y contraseña.");
    try {
        const profile = await window.PTHSecureData.login(user, pass);
        const adminMode = window.PTHWorkView.canSwitch(profile);
        window.currentUserData = profile;
        saveSessionToMemory(profile.nombre, adminMode, profile);
        closeLogin();
        document.getElementById("search-bar").value = "";
        setupSession(profile.nombre, adminMode);
        loadInternalAssets();
    } catch (error) { alert(error.message); }
}

window.togglePassword = function(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
        input.type = "text";
        icon.innerText = "visibility_off";
    } else {
        input.type = "password";
        icon.innerText = "visibility";
    }
};

    // 3. Proceso de Registro


    // 4. Funciones Auxiliares
    function saveSessionToMemory(name, isAdmin, data) {
        const session = { name: name, isAdmin: isAdmin, data: data };
        localStorage.setItem('pth_session', JSON.stringify(session));
        window.PTHAnalytics?.excludeInternal();
    }

    function closeLogin() {
        document.getElementById('login-overlay').classList.add('hidden');
    }

    // ==========================================
// 1. LÓGICA DE LOGÍSTICA (PESTAÑAS)
// ==========================================
// Variable global para controlar el filtro
let currentStatusFilter = 'TODOS';

function filterLogisticaByStatus(status, btnElement) {
    currentStatusFilter = status;

    // 1. Solución al error de "innerText of null":
    // Verificamos si el elemento existe antes de intentar escribir en él
    const label = document.getElementById('label-estado-actual');
    if (label) {
        label.innerText = status;
    }

    // 2. Gestión Visual de los Botones (Estilo Activo)
    // Quitamos el estilo 'active' de todos y lo ponemos solo al clickeado
    if (btnElement) {
        document.querySelectorAll('.btn-filter').forEach(b => {
            // Restaurar estilo base (gris/transparente)
            b.classList.remove('bg-primary', 'text-white', 'shadow-md');
            b.classList.add('text-gray-500', 'border-transparent');
        });

        // Aplicar estilo activo al botón actual
        btnElement.classList.remove('text-gray-500', 'border-transparent');
        btnElement.classList.add('bg-primary', 'text-white', 'shadow-md');
    }

    // 3. Renderizar la tabla con el nuevo filtro
    renderAdminLogistica();
}



// Exportar SOLO lo que se ve en pantalla (Filtrado)
function exportLogisticaCurrentView() {
    // Reutilizamos la tabla HTML ya renderizada porque ya tiene los filtros aplicados
    exportToExcel('admin-table-logistica', `Pedidos_${currentStatusFilter}`);
}


// ==========================================
// 2. LÓGICA DE INVENTARIO (BUSCADOR + EXPORTAR)
// ==========================================

// Variable global para inventario (necesaria para el buscador)


// Modificamos la carga de admin para llenar esta variable
/*
   EN TU FUNCIÓN loadAdminData(), ASEGÚRATE DE AÑADIR ESTO:
   if (productos) {
       inventoryRawAdmin = productos; // <--- GUARDAR AQUÍ
       renderAdminInventario(); // Llamar sin argumentos
   }
*/



// Exportar Inventario a Excel (Limpio)
async function exportInventoryExcel() {
    if (window.PTHAssets && !await window.PTHAssets.ensure('xlsx')) return;
    if(!inventoryRawAdmin || inventoryRawAdmin.length === 0) return alert("No hay datos");

    // Preparamos datos limpios para el Excel
    const dataForExcel = inventoryRawAdmin.map(p => ({
        SKU_Virtual: (p.categoria ? p.categoria.substring(0,3).toUpperCase() : "GEN") + "-" + p.id.substring(0,4).toUpperCase(),
        Producto: p.nombre,
        Precio_USD: p.precio,
        Comision_Gestor: p.comision,
        Categoria: p.categoria,
        Stock: p.disponible,
        Garantia: p.garantia
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_ANEB_${new Date().toLocaleDateString().replace(/\//g,'-')}.xlsx`);
}

// FUNCIÓN PARA ACTUALIZAR CATEGORÍAS EN EL FORMULARIO
    // REEMPLAZAR LA ACTUAL updateFormCategories() POR ESTA:
async function updateFormCategories() {
    const datalist = document.getElementById('lista-categorias');
    if (!datalist) return;

    const { data } = await supabaseClient
            .from('categorias')
            .select('nombre')
            .order('orden', { ascending: true });

    if (data) {
        datalist.innerHTML = data.map(c => `<option value="${c.nombre}">`).join('');
    }
}
    // --- FUNCIÓN DE EXPORTACIÓN EXCEL AVANZADA (LOGÍSTICA) ---
async function exportLogisticaExcel() {
    if (window.PTHAssets && !await window.PTHAssets.ensure('xlsx')) return;
    // 1. Validar que haya datos
    if (!pedidosRawAdmin || pedidosRawAdmin.length === 0) {
        return alert("No hay datos cargados para exportar.");
    }

    const searchInput = document.getElementById('search-logistica');
    const query = searchInput ? searchInput.value.toLowerCase() : "";

    // 2. Aplicar los MISMOS filtros que se ven en pantalla
    const datosFiltrados = pedidosRawAdmin.filter(p => {
        // Filtro de Texto
        const fecha = new Date(p.fecha).toLocaleDateString().toLowerCase();
        const textoMatch = fecha.includes(query) ||
                           (p.cliente || "").toLowerCase().includes(query) ||
                           (p.proveedor || "").toLowerCase().includes(query) ||
                           (p.gestor || "").toLowerCase().includes(query);

        // Filtro de Estado
        let estadoMatch = false;
        if (currentStatusFilter === 'TODOS') estadoMatch = true;
        else if (currentStatusFilter === 'FINALIZADOS') estadoMatch = (p.estado === 'Entregado' || p.estado === 'Cancelado');
        else estadoMatch = (p.estado === currentStatusFilter);

        return textoMatch && estadoMatch;
    });

    if (datosFiltrados.length === 0) {
        return alert("No hay pedidos que coincidan con los filtros actuales.");
    }

    // 3. Formatear los datos para que el Excel se vea Profesional
    // Aquí elegimos qué columnas salen y con qué nombre
    const dataParaExcel = datosFiltrados.map(p => ({
        "ID PEDIDO": p.orden_dia || '-',
        "Fecha": new Date(p.fecha).toLocaleDateString(),
        "Cliente": p.cliente,
        "CI": p.ci || '-',
        "Teléfono": p.telefono,     // ¡Muy importante para logística!
        "Dirección": p.direccion,   // ¡Muy importante para logística!
        "Proveedor": p.proveedor || 'General',
        "Producto": p.producto,
        "Gestor": p.gestor,
        "Total Venta": p.total,
        "Comisión Gestor": p.comision_total,
        "Estado Actual": p.estado,  // Saldrá el texto limpio (ej: "Pendiente")
        "Pago Comisión": p.pago_gestor || 'Pendiente'
    }));

    // 4. Generar el archivo
    const ws = XLSX.utils.json_to_sheet(dataParaExcel);

    // Ajustar ancho de columnas automáticamente (Opcional, pero se ve mejor)
    const wscols = [
        {wch: 12}, // Fecha
        {wch: 25}, // Cliente
        {wch: 15}, // CI
        {wch: 15}, // Teléfono
        {wch: 40}, // Dirección
        {wch: 15}, // Proveedor
        {wch: 40}, // Producto
        {wch: 20}, // Gestor
        {wch: 10}, // Total
        {wch: 10}, // Comisión
        {wch: 15}, // Estado
        {wch: 15}  // Pago
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logística");

    // Nombre del archivo con fecha y filtro
    const fechaHoy = new Date().toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `Logistica_${currentStatusFilter}_${fechaHoy}.xlsx`);
}

// --- FUNCIÓN PARA ACTUALIZAR PRECIO Y COMISIÓN ---
function updateCartItemPrice(index, newValue) {
    // Compatibilidad defensiva ante páginas antiguas o llamadas manuales.
    // El carrito ya no permite alterar el precio configurado del producto.
    const item = cart[index];
    if (!item) return;
    item.precio_venta = Number(item.precio);
    item.comision_actual = Number(item.comision) || 0;
    item.comision_original_pool = Number(item.comision_original_pool_base || item.comision_original_pool || item.comision) || 0;
    renderCart();
}
// Variable global para la tasa
let globalCUPRate = 450;

// Al cargar la página, intentamos recuperar la tasa guardada
window.addEventListener('load', () => {
    const savedRate = localStorage.getItem('pth_daily_rate');
    if(savedRate) {
        globalCUPRate = parseFloat(savedRate);
        const input = document.getElementById('daily-rate');
        if(input) input.value = globalCUPRate;
    }
    // ... resto de tu window.load
});

function updateGlobalRate(val) {
    globalCUPRate = parseFloat(val);
    localStorage.setItem('pth_daily_rate', val); // Guardar para que no se borre al recargar

    // Si estás en el catálogo (vista cliente/gestor), refrescar productos
    if(!document.getElementById('sec-catalogo').classList.contains('hidden')) {
        renderProducts();
    }
    // Si estás en admin, refrescar tablas
    if(!document.getElementById('sec-admin-master').classList.contains('hidden')) {
        renderAdminCortes(); // Para recalcular pagos en CUP
    }
}

// --- FUNCIÓN MAESTRA DE CÁLCULO DE PRECIO CUP ---


// Llamar a esto dentro de loadAdminData()
// if (pedidos && productos) { renderAnaliticaCompleta(pedidos, productos, vistas); }

function renderAnaliticaCompleta(pedidos, productos, vistasRaw) {
    renderAnaliticaProveedores(pedidos);
    renderAnaliticaCancelacion(pedidos);
    renderAnaliticaConversion(pedidos, vistasRaw);
    renderAnaliticaZombies(pedidos, productos);
    renderAnaliticaGestores(pedidos);
}

// 1. TOP PROVEEDORES (Facturación)
function renderAnaliticaProveedores(pedidos) {
    const ventas = pedidos.filter(p => p.estado !== 'Cancelado');
    const mapProv = {};

    ventas.forEach(p => {
        const prov = p.proveedor || 'General';
        mapProv[prov] = (mapProv[prov] || 0) + Number(p.total || 0);
    });

    const sorted = Object.entries(mapProv).sort(([,a], [,b]) => b - a);

    document.getElementById('list-analitica-proveedores').innerHTML = sorted.map(([name, total], i) => `
        <div class="flex justify-between items-center text-[10px] border-b border-indigo-50 dark:border-gray-700 pb-2 last:border-0">
            <div class="flex items-center gap-2">
                <span class="font-bold text-indigo-300 w-4">#${i+1}</span>
                <span class="font-black uppercase text-gray-700 dark:text-gray-300">${name}</span>
            </div>
            <span class="font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 rounded">$${total.toLocaleString()}</span>
        </div>
    `).join('');
}

// 2. TASA DE CANCELACIÓN
function renderAnaliticaCancelacion(pedidos) {
    const total = pedidos.length;
    if (total === 0) return;

    const cancelados = pedidos.filter(p => p.estado === 'Cancelado').length;
    const rate = (cancelados / total) * 100;

    document.getElementById('stat-cancel-rate').innerText = `${rate.toFixed(1)}%`;
    document.getElementById('bar-cancel-rate').style.width = `${Math.min(rate, 100)}%`;

    // Cambiar color si es alarmante (>15%)
    const bar = document.getElementById('bar-cancel-rate');
    if(rate > 15) bar.className = "bg-red-600 h-2 rounded-full animate-pulse";
    else bar.className = "bg-emerald-500 h-2 rounded-full";
}

// 3. PRODUCTOS ZOMBIE (Sin ventas)
function renderAnaliticaZombies(pedidos, productos) {
    // Crear un Set de nombres de productos vendidos para búsqueda rápida
    const vendidosSet = new Set();
    pedidos.forEach(p => {
        // Limpieza básica para coincidir nombres
        // Asumiendo formato "1x Nombre [USD]"
        let nombre = p.producto;
        if(nombre.includes('x ')) nombre = nombre.split('x ')[1];
        if(nombre.includes('[')) nombre = nombre.split('[')[0].trim();
        vendidosSet.add(nombre.toLowerCase());
    });

    // Filtrar productos que NO están en el set de vendidos
    const zombies = productos.filter(prod => !vendidosSet.has(prod.nombre.toLowerCase()));

    const container = document.getElementById('list-analitica-zombies');

    if (zombies.length === 0) {
        container.innerHTML = `<p class="text-xs text-emerald-500 font-bold">¡Excelente! Todo el catálogo tiene ventas.</p>`;
        return;
    }

    container.innerHTML = zombies.map(z => `
        <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
            <div class="flex items-center gap-2 overflow-hidden">
                <span class="material-symbols-outlined text-gray-300 text-sm">block</span>
                <span class="text-[10px] font-bold text-gray-600 truncate uppercase">${z.nombre}</span>
            </div>
            <button onclick="editProduct('${z.id}')" class="text-[9px] font-black text-primary hover:underline">REVISAR</button>
        </div>
    `).join('');
}

// 4. EFECTIVIDAD (Ventas vs Vistas) - (Igual al anterior pero refinado)
function renderAnaliticaConversion(pedidos, vistasRaw) {
    const ventasMap = {};
    pedidos.filter(p => p.estado !== 'Cancelado').forEach(p => {
        let nombre = p.producto;
        if(nombre.includes('x ')) nombre = nombre.split('x ')[1];
        if(nombre.includes('[')) nombre = nombre.split('[')[0].trim();
        ventasMap[nombre] = (ventasMap[nombre] || 0) + 1;
    });

    const vistasMap = {};
    if(vistasRaw) {
        vistasRaw.forEach(v => {
            vistasMap[v.nombre_producto] = (vistasMap[v.nombre_producto] || 0) + 1;
        });
    }

    const ratios = [];
    for (const [prod, views] of Object.entries(vistasMap)) {
        if(views > 2) {
            const sales = ventasMap[prod] || 0;
            const rate = (sales / views) * 100;
            ratios.push({ name: prod, rate: rate });
        }
    }

    const sorted = ratios.sort((a,b) => b.rate - a.rate).slice(0, 5);

    document.getElementById('list-analitica-conversion').innerHTML = sorted.map(item => `
        <div class="flex justify-between items-center text-[10px] mb-2">
            <span class="font-bold text-gray-500 truncate w-2/3" title="${item.name}">${item.name}</span>
            <div class="flex items-center gap-1">
                 <div class="w-10 h-1 bg-gray-100 rounded-full"><div class="h-full bg-emerald-500" style="width: ${item.rate}%"></div></div>
                 <span class="font-black text-emerald-600">${item.rate.toFixed(0)}%</span>
            </div>
        </div>
    `).join('');
}
// Variable global para guardar el conteo
let gestorSalesCount = 0;

async function legacyGenerateFlashResponse() {
    // 1. Obtener lo que el gestor escribió en el buscador
    const searchInput = document.getElementById('search-bar');
    const query = searchInput ? searchInput.value.trim() : "";

    // 2. Filtros para saber qué productos mostrar
    const isGestor = window.gestorName ? true : false;
    const filterCheckbox = document.getElementById('filter-high-comm');
    const filterHighComm = filterCheckbox ? filterCheckbox.checked : false;

    // Filtramos sobre la data cruda
    const visibleProducts = productosRaw.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(query.toLowerCase());
        const matchCat = activeCategory === 'TODOS' || (p.categoria && p.categoria.toUpperCase().includes(activeCategory));
        const matchComm = !filterHighComm || (Number(p.comision || 0) > 10);
        return matchSearch && matchCat && matchComm && p.disponible === "SI";
    });

    if (visibleProducts.length === 0) return alert("❌ No hay productos en pantalla para generar respuesta.");

    // --- EFECTO VISUAL DE CARGA EN EL BOTÓN ---
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<span class="loader w-4 h-4 border-amber-800"></span>`;
    btn.disabled = true;

    try {
        // 3. DEFINIR LA URL BASE CORRECTA
        // Si estás abriendo el archivo local (file://), usamos tu web real. Si no, usamos la actual.
        let baseUrl = window.location.origin + window.location.pathname;
        if (window.location.protocol === 'file:') {
            baseUrl = "https://paratuhogar.github.io/paratuhogar/"; // TU URL REAL AQUÍ
        }

        // 4. CONSTRUIR EL LINK LARGO
        const gestor = window.gestorName || '';
        const tel = window.currentUserData?.telefono || '';
        const longLink = `${baseUrl}?search=${encodeURIComponent(query)}&ref=${encodeURIComponent(gestor)}&contact=${tel}`;

        // 5. ¡MAGIA! GENERAR EL LINK CORTO (Esperamos a Supabase)
        const shortLink = await getOrGenerateShortLink(gestor, longLink);

        // 6. CONSTRUIR EL MENSAJE
        let mensaje = `👋 Hola! Sí, para *"${query || activeCategory}"* tengo estas opciones disponibles ahora mismo:\n\n`;

        // Listar máximo 5 productos
        visibleProducts.slice(0, 5).forEach(p => {
            const precio = showInCUP ? `CUP ${calculateProductCUP(p.precio, p.pagos).toLocaleString()}` : `$${p.precio} USD`;
            mensaje += `▫️ *${p.nombre}* ➝ *${precio}*\n`;
        });

        if (visibleProducts.length > 5) {
            mensaje += `... y ${visibleProducts.length - 5} opciones más.\n`;
        }

        mensaje += `\n👀 *MIRA LAS FOTOS Y DETALLES AQUÍ:* 👇\n${shortLink}\n\n`;
        mensaje += `Me avisas cuál te gusta y te lo separo. 😉`;

        // 7. COPIAR AL PORTAPAPELES
        await navigator.clipboard.writeText(mensaje);

        // Feedback de éxito
        btn.innerHTML = "✅ ¡LISTO!";
        btn.classList.remove("bg-amber-400", "text-amber-900");
        btn.classList.add("bg-green-500", "text-white");

    } catch (e) {
        console.error(e);
        alert("Error generando el link corto. Se copiará el largo.");
    } finally {
        // Restaurar botón después de 2 segundos
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.add("bg-amber-400", "text-amber-900");
            btn.classList.remove("bg-green-500", "text-white");
            btn.disabled = false;
        }, 2000);
    }
}



// 2. FUNCIÓN PARA DIBUJAR EL BOTÓN (Candado vs Rayo)
function legacyRenderFlashButton() {
    const container = document.getElementById('container-flash-btn');
    if (!container) return;

    const META_VENTAS = 3; // La meta para desbloquear

    if (gestorSalesCount >= META_VENTAS) {
        // --- NIVEL PRO: DESBLOQUEADO ---
        container.innerHTML = `
            <button onclick="generateFlashResponse()" class="h-full py-2.5 px-4 rounded-xl bg-amber-400 text-amber-900 border border-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-black shadow-md active:scale-95 animate-pulse" title="Generar respuesta rápida">
                <span class="material-symbols-outlined text-lg">flash_on</span>
                <span class="hidden sm:inline">Flash</span>
            </button>`;
    } else {
        // --- NIVEL NOVATO: BLOQUEADO (GAMIFICACIÓN) ---
        const faltan = META_VENTAS - gestorSalesCount;
        container.innerHTML = `
            <button onclick="alertLockedFeature(${faltan})" class="h-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold" title="Bloqueado hasta la 3ra venta">
                <span class="material-symbols-outlined text-lg">lock</span>
                <span class="hidden sm:inline">Flash</span>
            </button>`;
    }
}





// Helper: Bloquear Botón (Mantiene el nombre y añade candado)
function lockButton(btn, toolName, reqLevel, salesPitch) {
    if (!btn) return;

    // Estilo visual gris
    btn.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold transition-all";

    // Muestra: Candado + Nombre Herramienta (Ya no dice solo "Nivel X")
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">${toolName}</span>`;

    // Alerta de ventas
    btn.onclick = (e) => {
        e.preventDefault();
        alert(`🔒 HERRAMIENTA BLOQUEADA: ${toolName}\n\n${salesPitch}`);
    };
    btn.removeAttribute("onclick");
    btn.title = `Bloqueado - Requiere Nivel ${reqLevel}`;
}

// Helper: Desbloquear Botón
function unlockButton(btn, icon, label, actionStr, colorClasses) {
    if (!btn) return;
    btn.className = `flex-1 xl:flex-none py-2.5 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer ${colorClasses}`;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">${icon}</span> <span class="hidden sm:inline">${label}</span>`;
    btn.setAttribute("onclick", actionStr);
    btn.onclick = null;
    btn.title = label;
}

// Helper: Bloquear Botón
function lockButton(btn, label, reqLevel) {
    if (!btn) return;
    // Reseteamos clases para forzar el gris
    btn.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold transition-all";
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">Nivel ${reqLevel}</span>`;
    btn.onclick = (e) => {
        e.preventDefault();
        alert(`🔒 HERRAMIENTA BLOQUEADA\n\nNecesitas Nivel ${reqLevel} para usar '${label}'.\n¡Sigue vendiendo para desbloquear!`);
    };
    btn.removeAttribute("onclick"); // Quitamos cualquier onclick inline antiguo
}

// Helper: Desbloquear Botón
function unlockButton(btn, icon, label, actionStr, colorClasses) {
    if (!btn) return;
    // Aplicamos estilos "vivos"
    btn.className = `flex-1 xl:flex-none py-2.5 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer ${colorClasses}`;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">${icon}</span> <span class="hidden sm:inline">${label}</span>`;

    // Asignamos la función
    btn.setAttribute("onclick", actionStr);
    btn.onclick = null; // Limpiamos el bloqueo manual para dejar que actúe el atributo onclick
}

// Helper para restaurar el estilo original
function restoreButtonStyle(btn, icon, label, action, colorClasses) {
    if (!btn) return;
    // Restauramos las clases base + los colores específicos
    btn.className = `flex-1 xl:flex-none py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold ${colorClasses}`;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">${icon}</span> <span class="hidden sm:inline">${label}</span>`;
    btn.setAttribute('onclick', action);
    btn.onclick = null; // Limpiamos el evento bloqueado para que el atributo onclick funcione
    btn.title = label;
}



// 3. MENSAJE MOTIVACIONAL (Cuando hacen clic en el candado)
function alertLockedFeature(faltan) {
    alert(`🔒 ¡HERRAMIENTA BLOQUEADA! 🔒\n\nEl "Botón Flash" te permite responder a clientes en 3 segundos.\n\n🎯 OBJETIVO: Necesitas 3 ventas entregadas.\n📉 TE FALTAN: ${faltan} ventas.\n\n¡Sigue vendiendo para desbloquear esta ventaja injusta! 🚀`);
}
// ==========================================
// 🚀 NUEVAS FUNCIONES PRO: CRM Y PERSISTENCIA
// ==========================================



// 1. CARGA DE CLIENTES (CRM) - VERSIÓN PRIVADA
let crmClients = [];

async function loadClientCRM() {
    // Obtenemos quién está conectado
    const gestorActual = window.gestorName;
    const esAdmin = window.isAdmin;

    // Si nadie ha iniciado sesión (es cliente público), no cargamos nada por seguridad
    if (!gestorActual && !esAdmin) {
        crmClients = [];
        return;
    }

    // Preparamos la consulta
    let query = supabaseClient
        .from('pedidos')
        .select('cliente, ci, telefono, direccion')
        .order('fecha', { ascending: false })
        .limit(300); // Revisamos los últimos 1000

    // FILTRO DE ORO: Si NO es admin, filtra solo sus ventas
    if (!esAdmin && gestorActual) {
        query = query.eq('gestor', gestorActual);
    }

    const { data, error } = await query;

    if (!data) return;

    // Filtramos duplicados por Teléfono (igual que antes)
    const uniqueMap = new Map();
    data.forEach(p => {
        if (p.telefono && !uniqueMap.has(p.telefono)) {
            uniqueMap.set(p.telefono, p);
        }
    });

    crmClients = Array.from(uniqueMap.values());

    // Llenar el Datalist del HTML
    const dataList = document.getElementById('crm-datalist');
    if(dataList) {
        dataList.innerHTML = crmClients.map(c =>
            `<option value="${c.cliente} | ${c.telefono}">${c.direccion ? c.direccion.substring(0,30) + '...' : ''}</option>`
        ).join('');
    }

    console.log(`CRM Cargado: ${crmClients.length} clientes encontrados para ${gestorActual || 'Admin'}.`);
}

// 2. AUTO-RELLENADO (Al seleccionar en el buscador)
function autofillClient(val) {
    if(!val) return;

    // Intentamos buscar en la base de datos
    const phoneKey = val.split('|')[1]?.trim();
    const client = crmClients.find(c => c.telefono === phoneKey);

    if (client) {
        // CASO 1: CLIENTE RECURRENTE (EXISTE)
        document.getElementById('check-nombre').value = client.cliente || '';
        document.getElementById('check-ci').value = client.ci || '';
        document.getElementById('check-tel').value = client.telefono || '';
        document.getElementById('check-dir').value = client.direccion || '';
    } else {
        // CASO 2: CLIENTE NUEVO (NO EXISTE EN LA LISTA)
        // Si lo que escribiste en el buscador no es un cliente viejo,
        // asumimos que es el NOMBRE del nuevo cliente.

        // Solo copiamos si el campo nombre está vacío para no borrar lo que hayas pegado
        if(document.getElementById('check-nombre').value === "") {
             document.getElementById('check-nombre').value = val.replace('|', '').trim();
        }
    }
}

// 3. SISTEMA DE AUTO-GUARDADO (Anti-pérdida de datos)
function initAutoSaveSystem() {
    // Campos a vigilar
    const fields = ['check-nombre', 'check-ci', 'check-tel', 'check-dir', 'check-vuelto'];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;

        // A. Recuperar al cargar
        let saved; try { saved = localStorage.getItem('autosave_' + id); } catch (_) {}
        if(saved) el.value = saved;

        // B. Guardar al escribir
        el.addEventListener('input', () => {
            try { localStorage.setItem('autosave_' + id, el.value); } catch (_) { /* Existing optional autosave must not interrupt typing. */ }
        });
    });
}

function clearAutoSave() {
    // Borrar datos después de una venta exitosa
    const fields = ['check-nombre', 'check-ci', 'check-tel', 'check-dir', 'check-vuelto'];
    fields.forEach(id => {
        localStorage.removeItem('autosave_' + id);
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
    // Limpiar buscador
    const search = document.getElementById('crm-search');
    if(search) search.value = "";
}
// ==========================================
// ⚡ MODO FLASH: PEGADO INTELIGENTE
// ==========================================

// ==========================================
// ⚡ MODO FLASH 4.0: CORRECCIÓN DE TELÉFONO
// ==========================================

async function magicPaste() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return alert("⚠️ El portapapeles está vacío.");

        // 1. LIMPIEZA INICIAL
        let raw = text
            .replace(/(Nombre|Nom|Cliente|Dirección|Dir|Direccion|Teléfono|Telefono|Telf|Cel|Móvil|WhatsApp|CI|Carnet|Id):?/gi, " ")
            .replace(/\t/g, " ")
            .trim();

        // ---------------------------------------------------------
        // PASO A: EXTRACCIÓN DE DATOS
        // ---------------------------------------------------------

        // A1. CARNET DE IDENTIDAD (11 dígitos)
        const ciMatch = raw.match(/\b\d{11}\b/);
        let ci = ciMatch ? ciMatch[0] : "";
        if (ci) raw = raw.replace(ci, " ");

        // A2. TELÉFONO (CORREGIDO)
        // Esta nueva regex busca: Opcional (+53 o 53) + Bloque que empieza por 5 y tiene entre 7 y 15 caracteres (digitos, espacios o guiones)
        const phoneRegex = /(?:\+?53)?\s*[\.\-]?\s*(5[\d\s\-\.]{7,15})/;
        const phoneMatch = raw.match(phoneRegex);
        let phone = "";

        if (phoneMatch) {
            // Limpiamos todo lo que no sea número
            let digits = phoneMatch[0].replace(/\D/g, '');

            // Si empieza con 53 y es largo (10 dígitos), quitamos el 53
            if (digits.length === 10 && digits.startsWith('53')) digits = digits.substring(2);

            // VALIDACIÓN FINAL: Solo aceptamos si quedaron 8 dígitos exactos
            if (digits.length === 8 && digits.startsWith('5')) {
                phone = digits;
                raw = raw.replace(phoneMatch[0], " "); // Borramos el teléfono del texto original
            }
        }

        // ---------------------------------------------------------
        // PASO B: SEPARACIÓN DE NOMBRE Y DIRECCIÓN
        // ---------------------------------------------------------

        let cleanText = raw.replace(/\r\n|\n|\r/g, " , ").replace(/\s+/g, " ").trim();

        const addressKeywords = [
            'calle', 'ave', 'avenida', 'av.', 'entre', 'esq', 'esquina',
            'pto', 'reparto', 'rpto', 'edif', 'edificio', 'apto', 'apartamento',
            'carretera', 'finca', 'zona', 'municipio', 'provincia', 'habana',
            'bajos', 'altos', 'km', 'no.', 'número', '#'
        ];

        let nombre = "";
        let direccion = "";

        // ESTRATEGIA: Buscar dónde empieza la dirección
        let splitIndex = -1;
        const lowerText = cleanText.toLowerCase();

        for (let word of addressKeywords) {
            // Buscamos la palabra clave con espacio antes o después para no confundir (ej: "Calle")
            const idx = lowerText.indexOf(word + " ") !== -1 ? lowerText.indexOf(word + " ") : lowerText.indexOf(" " + word);

            if (idx !== -1) {
                // Si encontramos "Calle", cortamos ahí.
                // Verificación extra: Si el índice es muy pequeño (< 3), es que el texto EMPIEZA con la dirección.
                if (idx < 3) {
                     // Caso raro: "Calle 23... Juan Perez". Asumimos que nombre está al final si hay comas, o es un caso difícil.
                     // Para tu ejemplo, el nombre está ANTES, así que el idx será > 3.
                } else {
                    splitIndex = idx;
                    break; // Nos quedamos con la primera coincidencia
                }
            }
        }

        if (splitIndex > -1) {
            nombre = cleanText.substring(0, splitIndex).trim();
            direccion = cleanText.substring(splitIndex).trim();
        } else {
            // Si no hay palabras clave, usamos comas
            if (cleanText.includes(",")) {
                const parts = cleanText.split(",");
                // El más largo suele ser dirección
                parts.sort((a, b) => a.length - b.length);
                nombre = parts[0];
                direccion = parts.slice(1).join(", ");
            } else {
                // Fallback final: Mitad y mitad
                nombre = cleanText;
            }
        }

        // ---------------------------------------------------------
        // PASO C: RELLENADO
        // ---------------------------------------------------------

        // Limpieza final
        const cleanStr = (s) => s ? s.replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim() : "";
        nombre = cleanStr(nombre);
        direccion = cleanStr(direccion);

        // Convertir nombre a Mayúsculas Bonitas
        if (nombre) document.getElementById('check-nombre').value = nombre.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());

        if (phone) document.getElementById('check-tel').value = phone;
        if (ci) document.getElementById('check-ci').value = ci;
        if (direccion) document.getElementById('check-dir').value = direccion;

        // Disparar evento
        document.getElementById('check-nombre').dispatchEvent(new Event('input'));

        // Toast de confirmación
        // alert(`✅ Datos Detectados:\n👤 ${nombre}\n📞 ${phone}\n🏠 ${direccion.substring(0, 20)}...`);

    } catch (err) {
        console.error(err);
        alert("⚠️ Error al analizar. Pega manualmente.");
    }
}

// Función auxiliar para poner Mayúsculas Bonitas
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

/* ============================================== */
/*    SISTEMA DE GAMIFICACIÓN "SOLO LEVELING"     */
/*           LÓGICA DE VENTANA DESLIZANTE         */
/* ============================================== */

// Datos Maestros de Niveles
// Datos Maestros de Niveles (Actualizado)
function getLevelData(sales) {
    // --- NIVEL 10: EL TERRATENIENTE (Amarre) ---
    if (sales >= 200) return {
        lvl: 10, name: "Warlord", next: 500, color: "text-red-600",
        duration: 8760, // 1 Año
        hasShortLink: true,
        power: "Dueño de Clientes (Amarre)"
    };

    // --- NIVEL 5: EMPERADOR ---
if (sales >= 70) return {
    lvl: 5, name: "Emperador", next: 200, color: "text-purple-600",
    duration: 8760,
    hasShortLink: true,
    power: "Amarre Total" // <--- Cambiado aquí
};

    // --- NIVEL 4: MONARCA (PDF) ---
    if (sales >= 40) return {
        lvl: 4, name: "Monarca", next: 70, color: "text-emerald-500",
        duration: 4320,
        hasShortLink: true
    };

    // --- NIVEL 3: ÉLITE ---
    if (sales >= 20) return {
        lvl: 3, name: "Élite", next: 40, color: "text-indigo-500",
        duration: 2160,
        hasShortLink: true,
        power: "Radar de Riesgos"
    };

    // --- NIVEL 2: EXPERTO ---
if (sales >= 10) return {
    lvl: 2, name: "Experto", next: 20, color: "text-blue-500",
    duration: 720,
    hasShortLink: true,
    power: "Magic Studio" // <--- Agregado aquí
};

    // --- NIVEL 1: NOVATO (Flash) ---
    if (sales >= 3)  return {
        lvl: 1, name: "Novato", next: 10, color: "text-orange-500",
        duration: 720,
        hasShortLink: true
    };

    return {
        lvl: 0, name: "Iniciado", next: 3, color: "text-gray-500",
        duration: 168,
        hasShortLink: true
    };
}

async function showAgentWelcomeModal(nombre) {
    const modal = document.getElementById('modal-welcome-agent');
    if(!modal) return;

    try {
        let salesCount = 0;

        // Lógica de conteo de ventas (Igual que tenías)
        if (nombre === "Marcel Montano") {
            salesCount = 80;
        } else {
            const { count, error } = await supabaseClient
                .from('pedidos')
                .select('id', { count: 'exact', head: true })
                .eq('gestor', nombre)
                .eq('estado', 'Entregado');
            if (error) throw error;
            salesCount = count || 0;
        }

        const lvlData = getLevelData(salesCount);
        const currentLvl = lvlData.lvl;

        // Guardamos nivel global
        window.currentGestorLevel = currentLvl;

        // === AQUÍ ESTÁ LA CORRECCIÓN ===
        const lastSeenLevel = localStorage.getItem('pth_last_seen_level');

        // Si el nivel actual es IGUAL al último que vio...
        if (lastSeenLevel && parseInt(lastSeenLevel) === currentLvl) {
            console.log("El usuario sigue en el mismo nivel. Pasando al cartel de precios...");

            // ¡ESTA ES LA LÍNEA QUE TE FALTABA!
            // Si no muestra nivel, intenta mostrar precios.
            showPriceIntro();

            return; // Salimos para que NO salga el cartel azul de nivel
        }
        // ==============================

        // (El resto de tu código para dibujar el cartel azul sigue aquí igual...)
        const tiers = [
            { lvl: 1, name: "Novato", tool: "Story Maker", boost: 1.5, phrase: "Crearás piezas visuales listas para publicar." },
            { lvl: 2, name: "Experto", tool: "Magic Studio AI & Fotos", boost: 2.2, phrase: "Tu publicidad ahora será creada por Inteligencia Artificial." },
            { lvl: 3, name: "Élite", tool: "Radar de Tendencias", boost: 2.8, phrase: "Publicarás exactamente lo que los clientes están buscando hoy." },
            { lvl: 4, name: "Monarca", tool: "Catálogo PDF Pro", boost: 3.5, phrase: "Tu imagen profesional será irresistible para clientes de alto valor." },
            { lvl: 5, name: "Emperador", tool: "Amarre Total", boost: 5.0, phrase: "Has alcanzado el poder máximo. Tu red de clientes es ahora un activo eterno." }
        ];

        // DIBUJAR LISTA (Copia esto tal cual tenías)
        const listHTML = tiers.map(t => {
            const isUnlocked = currentLvl >= t.lvl;
            return `
            <div class="flex items-center gap-4 py-1 ${isUnlocked ? 'opacity-100' : 'opacity-40'}">
                <span class="material-symbols-outlined ${isUnlocked ? 'text-emerald-400' : 'text-slate-700'} text-xl">
                    ${isUnlocked ? 'check_circle' : 'lock'}
                </span>
                <div class="flex-1 border-b border-white/5 pb-2">
                    <div class="flex justify-between items-center">
                        <p class="text-[11px] font-black uppercase tracking-wide text-white">${t.tool}</p>
                        <span class="text-[10px] font-black ${isUnlocked ? 'text-emerald-400' : 'text-slate-500'}">LVL ${t.lvl}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        const nextTier = tiers.find(t => t.lvl === currentLvl + 1) || tiers[4];
        let baseline = salesCount === 0 ? 1.5 : salesCount;
        let extraSales = Math.ceil(baseline * nextTier.boost);
        let totalPotential = Math.ceil(salesCount + extraSales);

        document.getElementById('welcome-features-list').innerHTML = listHTML;
        document.getElementById('welcome-next-tier-name').innerText = nextTier.tool;
        document.getElementById('welcome-extra-sales').innerText = extraSales;
        document.getElementById('welcome-total-potential').innerText = totalPotential;
        document.getElementById('welcome-motivational-phrase').innerText = `"${nextTier.phrase}"`;
        document.getElementById('welcome-rank-tag').innerText = "RANGO: " + lvlData.name;

        let durationText = lvlData.lvl === 5 ? "365 DÍAS" : (lvlData.lvl === 0 ? "7 DÍAS" : (lvlData.duration / 720) + " MESES");
        document.getElementById('welcome-link-duration').innerText = durationText;
        document.getElementById('welcome-next-power').innerText = "NIVEL " + (currentLvl < 5 ? currentLvl + 1 : 5);

        // Mostrar Modal Azul
        setTimeout(() => { modal.classList.remove('hidden'); }, 800);

    } catch (e) { console.error("Error en Bienvenida:", e); }
}

function closeWelcomeAgent() {
    // 1. Ocultar modal azul
    const modal = document.getElementById('modal-welcome-agent');
    if(modal) modal.classList.add('hidden');

    // 2. Guardar nivel actual
    if (window.currentGestorLevel !== undefined) {
        localStorage.setItem('pth_last_seen_level', window.currentGestorLevel);
    }

    // 3. PUENTE: Llamar al siguiente cartel
    console.log("Cerrando nivel. Intentando mostrar noticias...");
    setTimeout(() => {
        showPriceIntro();
    }, 500);
}

// --- FUNCIÓN DE BLOQUEO DE HERRAMIENTAS (FALTABA ESTO) ---
// --- CORRECCIÓN: FUNCIÓN PARA DESBLOQUEAR BOTONES ---
// --- CORRECCIÓN: FUNCIÓN PARA GESTIONAR CANDADOS Y MENSAJES ---
// --- FUNCIÓN DE GESTIÓN DE CANDADOS ---
function applyLockedFeatures() {
    const level = window.currentGestorLevel || 0;
    const sales = window.gestorSalesCount || 0;

    // VALIDACIÓN MODO DIOS: Si eres tú, todo se desbloquea
    const isGodMode = window.gestorName === "Marcel Montano" || window.gestorName === "Diana" || window.isAdmin || window.PTHWorkView.canSwitch(window.currentUserData);

    // Referencias a los botones por ID
    const btnCopy = document.getElementById('btn-copy-bulk');
    const btnZip = document.getElementById('btn-zip-bulk');
    const btnPdf = document.getElementById('btn-pdf-bulk');
    const btnStudio = document.getElementById('btn-magic-studio');

    // Estilo base para botones desbloqueados
    const baseStyle = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer hover:scale-105 active:scale-95 shadow-sm whitespace-nowrap";

    // ======================================================
    // SIEMPRE DESBLOQUEADO (FRICCIÓN CERO PARA COMPARTIR)
    // ======================================================
    if (btnCopy) {
        btnCopy.className = `${baseStyle} bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50`;
        btnCopy.innerHTML = `<span class="material-symbols-outlined text-lg">campaign</span> <span>Mensaje</span>`;
        btnCopy.title = "Crear mensaje de ofertas para WhatsApp";
        btnCopy.onclick = function() { copyCategoryOffers(); };
    }

    // ------------------------------------------------------
    // NIVEL 2 (10 Ventas): PACK DE FOTOS
    // ------------------------------------------------------
    if (level >= 2 || isGodMode) {
        if (btnZip) {
            btnZip.className = `${baseStyle} bg-white text-blue-600 border-blue-100 hover:bg-blue-50`;
            btnZip.innerHTML = `<span class="material-symbols-outlined text-lg">folder_zip</span> <span>Fotos</span>`;
            btnZip.title = "Descargar Pack Fotos";
            btnZip.onclick = function() { downloadCategoryPhotos(); };
        }
    } else {
        lockButton(btnZip, "Pack Fotos", 2, "Descarga 50 fotos en un clic.");
    }

    // Catálogo PDF profesional: disponible para todos los gestores,
    // subgestores y administradores con una sesión válida.
    const hasCatalogAccess = Boolean(localStorage.getItem('pth_session'));
    if (hasCatalogAccess) {
        if (btnPdf) {
            btnPdf.className = `${baseStyle} bg-red-50 text-red-600 border-red-100 hover:bg-red-500 hover:text-white`;
            btnPdf.innerHTML = `<span class="material-symbols-outlined text-lg">picture_as_pdf</span> <span>PDF</span>`;
            btnPdf.title = "Crear catálogo PDF profesional";
            btnPdf.onclick = function() { downloadCatalogPDF(); };
        }
    } else {
        lockButton(btnPdf, "Catálogo PDF", 0, "Inicia sesión como gestor para acceder.");
    }

    // MAGIC STUDIO: disponible para todos los gestores y administradores
    // con una sesión válida, sin requisitos de nivel ni promociones.
    const hasStudioAccess = Boolean(localStorage.getItem('pth_session'));

    if (hasStudioAccess) {
        if(btnStudio) {
            btnStudio.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-purple-400 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer";
            btnStudio.innerHTML = `<span class="material-symbols-outlined text-xl">auto_fix</span><span class="hidden md:inline text-xs font-black">Magic Studio</span>`;
            btnStudio.title = "Magic Studio - Activo para todos los gestores";
            btnStudio.onclick = function() { goToStudio(); };
        }
    } else {
        lockButton(btnStudio, "Magic Studio", 0, "Inicia sesión como gestor para acceder.");
    }
}



// Función auxiliar simple para bloquear
function lockButtonDirect(btn, name, lvl) {
    btn.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold";
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">${name}</span>`;
    btn.onclick = function(e) {
        e.preventDefault();
        alert(`🔒 Bloqueado: Sube a Nivel ${lvl} para usar ${name}.`);
    };
}

// Helper simple para bloquear
function lockButtonDirect(btn, toolName, reqLevel) {
    if (!btn) return;
    btn.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold transition-all";
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">${toolName}</span>`;
    btn.onclick = function(e) {
        e.preventDefault();
        alert(`🔒 HERRAMIENTA BLOQUEADA: ${toolName}\n\nNecesitas Nivel ${reqLevel} para usar esto.\n¡Sigue vendiendo!`);
    };
}

// Helper simple solo para bloquear (el desbloqueo ya lo hicimos arriba manual)
function lockButton(btn, toolName, reqLevel, salesPitch) {
    if (!btn) return;
    btn.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold transition-all";
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">${toolName}</span>`;
    btn.onclick = (e) => {
        e.preventDefault();
        alert(`🔒 HERRAMIENTA BLOQUEADA: ${toolName}\n\n${salesPitch}\n\n🎯 Necesitas Nivel ${reqLevel}.`);
    };
    btn.title = `Bloqueado - Requiere Nivel ${reqLevel}`;
}

// Helpers visuales (Necesarios para que funcione lo de arriba)
function lockButtonVisual(btn, icon, text, lockText) {
    if(!btn) return;
    btn.onclick = () => alert(`⚠️ HERRAMIENTA BLOQUEADA\n\nNecesitas subir de nivel para usar '${text}'.\nSigue vendiendo para desbloquear.`);
    btn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
    btn.classList.remove('hover:border-indigo-500', 'hover:text-indigo-600', 'hover:bg-indigo-50');
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">${lockText}</span>`;
}

/* ============================================== */
/*    LÓGICA DE BLOQUEO DE HERRAMIENTAS (PRO)     */
/* ============================================== */



// Helper: Bloquear Botón (Mantiene el nombre y añade candado)
function lockButton(btn, toolName, reqLevel, salesPitch) {
    if (!btn) return;

    // Forzamos el estilo GRIS y Cursor de bloqueo
    btn.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 text-xs font-bold transition-all";

    // Ponemos el nombre de la herramienta (NO "Nivel X")
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">lock</span> <span class="hidden sm:inline">${toolName}</span>`;

    // Eliminamos onclick anterior y ponemos la alerta nueva
    btn.removeAttribute("onclick");
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert(`🔒 HERRAMIENTA BLOQUEADA: ${toolName}\n\n${salesPitch}`);
    };
    btn.title = `Bloqueado - Requiere Nivel ${reqLevel}`;
}

// Helper: Desbloquear Botón
// Helper: Desbloquear Botón (CORREGIDO PARA VERSE EN MÓVIL)
function unlockButton(btn, icon, label, actionStr, colorClasses) {
    if (!btn) return;

    // 1. Estilos: Añadimos 'shadow-sm' y aseguramos que se vea bien
    btn.className = `flex-1 py-2.5 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer hover:scale-105 active:scale-95 shadow-sm ${colorClasses}`;

    // 2. HTML: Quitamos 'hidden sm:inline' para que el texto SIEMPRE se vea
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">${icon}</span> <span>${label}</span>`;

    // 3. Acción: Asignamos el clic correctamente
    btn.setAttribute("onclick", actionStr);
    btn.onclick = null; // Limpiamos bloqueos anteriores
    btn.title = label;
}

// 1. CHEQUEO PRINCIPAL (Se llama al cargar el Dashboard)
// 1. CHEQUEO PRINCIPAL (Se llama al cargar el Dashboard)
// 1. CHEQUEO PRINCIPAL (Se llama al cargar el Dashboard)
// --- CORRECCIÓN: FUNCIÓN PARA VERIFICAR NIVEL ---
async function checkGamificationStatus() {
    const gestor = window.gestorName;
    if (!gestor) return;

    // --- MODO DIOS (Para ti) ---
    if (gestor === "Marcel Montano" || gestor === "Diana") {
    window.currentGestorLevel = 5;
    updateGamificationUI(80);
        renderFlashButton();
        applyLockedFeatures();
        return;
    }

    // Un subgestor conserva su progreso por sus propias ventas, aunque el
    // pedido financiero pertenezca a su gestor principal.
    const hierarchy = await resolveSalesHierarchy(gestor);
    let levelQuery = supabaseClient
        .from('pedidos')
        .select('id', { count: 'exact' })
        .eq('estado', 'Entregado');
    levelQuery = hierarchy?.isSubgestor
        ? levelQuery.eq('subgestor_nombre', gestor)
        : levelQuery.eq('gestor', gestor);
    const { count, error } = await levelQuery;

    if (error) {
        console.error("Error obteniendo nivel:", error);
        return;
    }

    const sales = count || 0;

    // 1. Guardar el nivel en una variable global para que todos la vean
    const levelData = getLevelData(sales);
    window.currentGestorLevel = levelData.lvl;
    window.gestorSalesCount = sales;

    // 2. Actualizar la tarjeta azul de arriba
    updateGamificationUI(sales);

    // 3. ¡IMPORTANTE! Forzar el desbloqueo de los botones
    renderFlashButton();     // Desbloquea el rayito amarillo
    applyLockedFeatures();   // Desbloquea Texto, Fotos y PDF

    console.log(`Nivel detectado: ${window.currentGestorLevel} con ${sales} ventas.`);
}

// 2. ACTUALIZACIÓN VISUAL (Tarjeta Dashboard + Modal Carrera)
// 2. ACTUALIZACIÓN VISUAL (ESTILO SOLO LEVELING)
// 2. ACTUALIZACIÓN VISUAL MAESTRA (SYSTEM UI)
// 2. ACTUALIZACIÓN VISUAL (MODO CLARO Y LEGIBLE)
// 2. ACTUALIZACIÓN VISUAL (MODO SYSTEM + DATOS PRECISOS)
// 2. ACTUALIZACIÓN VISUAL (MODO LEGIBLE Y ESPAÑOL)
function updateGamificationUI(sales) {
    const data = getLevelData(sales);

    // ===============================================
    // PARTE A: TARJETA DEL DASHBOARD (BANNER)
    // ===============================================
    const dashTitle = document.getElementById('dash-lvl-title');
    const dashBadge = document.getElementById('dash-lvl-badge');
    const dashMsg = document.getElementById('dash-link-msg');
    const dashCounter = document.getElementById('dash-lvl-counter');
    const dashBar = document.getElementById('dash-lvl-progress');
    // Buscamos el botón dentro del contenedor padre o por clase si es necesario,
    // pero aquí inyectaremos el HTML del botón directamente para asegurar que se vea bien.

    if (dashTitle) {
        // Título traducido y poderoso
        const tituloEspanol = data.name === "Shadow Monarch" ? "MONARCA DE LAS SOMBRAS" : data.name.toUpperCase();
        dashTitle.innerText = tituloEspanol;
        dashBadge.innerText = `NIVEL ${data.lvl}`;

        // Mensaje de Sistema en Español
        const dias = data.duration / 24;
        const tiempoTexto = data.lvl === 5 ? "∞ (ETERNO)" : `${dias} DÍAS`;
        dashMsg.innerHTML = `<span class="text-purple-400 font-bold">SISTEMA:</span> Duración del enlace extendida a <span class="text-white font-black text-sm">${tiempoTexto}</span>`;

        // Barra
        dashCounter.innerText = `${sales} / ${data.next} VENTAS`;
        const percent = Math.min(100, (sales / data.next) * 100);
        dashBar.style.width = `${percent}%`;

        // Colores según nivel
        if (data.lvl === 5) {
            dashBar.className = "h-full bg-purple-600 shadow-[0_0_20px_#9333ea] w-full transition-all duration-1000";
            dashTitle.className = "text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-fuchsia-500 drop-shadow-md";
        } else {
            dashBar.className = "h-full bg-cyan-500 shadow-[0_0_20px_#06b6d4] w-full transition-all duration-1000";
            dashTitle.className = "text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 drop-shadow-md";
        }
    }

    // ACTUALIZAR BOTÓN "ABRIR SISTEMA" (Hacerlo evidente)
    // Buscamos el botón que llama a openGamificationModal() dentro de la tarjeta
    const btnSystem = document.querySelector("button[onclick='openGamificationModal()']");
    if(btnSystem) {
        // Le damos un estilo de botón sólido y brillante
        btnSystem.className = "mt-4 w-full py-3 rounded-md bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-black uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(147,51,234,0.5)] transition-all transform hover:scale-[1.02] border border-purple-400 flex items-center justify-center gap-3";
        btnSystem.innerHTML = `<span class="material-symbols-outlined animate-pulse">ads_click</span> VER MI PROGRESO`;
    }

    // ===============================================
    // PARTE B: MODAL DE NIVELES (TEXTO GRANDE)
    // ===============================================

    const slName = document.getElementById('sl-player-name');
if (slName) {
    slName.innerText = window.gestorName ? window.gestorName.toUpperCase() : "AGENTE";
    document.getElementById('sl-job-title').innerText = data.name.toUpperCase();
    document.getElementById('sl-current-rank').innerText = `RANGO ${data.lvl}`;
    document.getElementById('sl-level-num').innerText = data.lvl;

    const percent = Math.min(100, (sales / data.next) * 100);
    document.getElementById('sl-xp-bar').style.width = `${percent}%`;
    document.getElementById('sl-xp-text').innerText = `${sales} / ${data.next}`;

    // --- INICIO DE LA CORRECCIÓN ---
    const dias = Math.floor(data.duration / 24); // Calculamos los días reales basados en la config
    let textoTiempo = "";

    if (dias >= 365) {
        textoTiempo = "1 AÑO";
    } else if (dias >= 30) {
        textoTiempo = `${dias} DÍAS`; // Opcional: podrías poner `${Math.floor(dias/30)} MESES`
    } else if (dias === 7) {
        textoTiempo = "1 SEMANA";
    } else {
        textoTiempo = `${dias} DÍAS`;
    }
    // --- FIN DE LA CORRECCIÓN ---

    document.getElementById('sl-mana-text').innerText = textoTiempo;
}

    // CONFIGURACIÓN DE TARJETAS (IGUAL A IMAGEN 1)
    const levelsConfig = [
        {
            lvl: 0, name: "INICIADO", req: "Registro",
            color: "cyan",
            features: [
                { icon: "link", title: "Enlace Básico", desc: "Tienda activa 24h." },
                { icon: "image", title: "Descarga Foto", desc: "Baja fotos individuales." }
            ]
        },
        {
            lvl: 1, name: "NOVATO", req: "3 Ventas",
            color: "orange",
            features: [
                { icon: "flash_on", title: "Respuesta Rápida", desc: "Copia precios al instante." },
                { icon: "fit_screen", title: "Creador Historias", desc: "Diseños para WhatsApp." }
            ]
        },
        {
    lvl: 2, name: "EXPERTO", req: "10 Ventas",
    color: "blue",
    features: [
        { icon: "auto_fix", title: "Magic Studio", desc: "Generador de anuncios IA." }, // Añadido aquí
        { icon: "folder_zip", title: "Pack de Fotos", desc: "Descarga todo en 1 clic." }
    ]
},
        {
            lvl: 3, name: "ÉLITE", req: "20 Ventas",
            color: "indigo",
            features: [
                { icon: "radar", title: "Radar de Ventas", desc: "Descubre qué se vende hoy." },
                { icon: "autorenew", title: "IA de Textos", desc: "Mejora tu publicidad." }
            ]
        },
        {
            lvl: 4, name: "MONARCA", req: "40 Ventas",
            color: "emerald",
            features: [
                { icon: "picture_as_pdf", title: "Catálogo PDF", desc: "Tu portafolio profesional." },
                { icon: "receipt_long", title: "Reporte Contable", desc: "Control total de dinero." }
            ]
        },
        {
    lvl: 5, name: "EMPERADOR", req: "70+ Ventas",
    color: "purple",
    features: [
        { icon: "workspace_premium", title: "Soporte VIP", desc: "Atención prioritaria 24/7." },
        { icon: "lock_person", title: "Cliente Eterno", desc: "Comisión de por vida." }
    ]
}
    ];

    const grid = document.getElementById('gamification-grid');
    if (grid) {
        grid.innerHTML = levelsConfig.map(l => {
            const isUnlocked = data.lvl >= l.lvl;
            const isCurrent = data.lvl === l.lvl;

            // Estilos de borde y fondo
            let borderClass = `border-${l.color}-500`;
            let textTitle = isUnlocked ? "text-white" : "text-slate-500";
            let bgClass = isUnlocked ? `bg-${l.color}-900/10` : "bg-slate-900/40";
            let shadowClass = isCurrent ? `shadow-[0_0_30px_rgba(255,255,255,0.15)]` : (isUnlocked ? `shadow-[0_0_15px_rgba(0,0,0,0.5)]` : "");
            let opacity = (isUnlocked && !isCurrent && data.lvl > l.lvl) ? "opacity-70" : "opacity-100";

            return `
            <div class="relative rounded-xl border-2 ${borderClass} ${bgClass} ${shadowClass} ${opacity} p-6 flex flex-col justify-between h-full transition-all duration-300 hover:scale-[1.01]">

                ${isCurrent ? `<span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-${l.color}-500 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest animate-pulse border border-white">TU NIVEL ACTUAL</span>` : ''}

                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-3xl font-black uppercase ${textTitle} tracking-wide leading-none mb-1">${l.name}</h4>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">REQUISITO: <span class="text-${l.color}-400">${l.req}</span></p>
                    </div>
                    <div class="px-3 py-1 rounded bg-[#020617] border border-slate-700">
                        <span class="text-xs font-bold text-slate-400">NIVEL ${l.lvl}</span>
                    </div>
                </div>

                <div class="space-y-4 mb-2">
                    ${l.features.map(f => `
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-lg bg-black/50 border border-slate-700 flex items-center justify-center shrink-0">
                                <span class="material-symbols-outlined text-xl ${isUnlocked ? `text-${l.color}-400` : 'text-slate-600'}">${f.icon}</span>
                            </div>
                            <div>
                                <p class="text-base font-bold ${isUnlocked ? 'text-slate-100' : 'text-slate-500'} leading-tight">${f.title}</p>
                                <p class="text-xs font-medium ${isUnlocked ? 'text-slate-400' : 'text-slate-600'} leading-tight mt-0.5">${f.desc}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${!isUnlocked ? `<div class="absolute inset-0 bg-[#020617]/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl"><span class="material-symbols-outlined text-5xl text-slate-600">lock</span></div>` : ''}
            </div>`;
        }).join('');
    }
}

// --- FUNCIÓN PARA DIBUJAR EL BOTÓN FLASH (CANDADO O RAYO) ---
function renderFlashButton() {
    const container = document.getElementById('container-flash-btn');
    if (!container) return;
    const hasSellerSession = Boolean(localStorage.getItem('pth_session'));

    if (hasSellerSession) {
        container.innerHTML = `
            <button onclick="generateFlashResponse()" class="w-full h-full py-2.5 px-4 rounded-xl bg-amber-400 text-amber-900 border border-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-black shadow-md active:scale-95" title="Crear una respuesta rápida para WhatsApp">
                <span class="material-symbols-outlined text-lg">flash_on</span>
                <span class="hidden sm:inline">Flash</span>
            </button>`;
    } else {
        container.innerHTML = '';
    }
}

// Helpers visuales para el modal
function unlockButtonsInCard(card) {
    const btns = card.querySelectorAll('button');
    btns.forEach(btn => {
        btn.classList.remove('btn-tool-locked');
        btn.classList.add('text-xs', 'font-bold', 'text-gray-700', 'bg-white', 'border', 'border-gray-200', 'shadow-sm', 'px-3', 'py-2', 'rounded-lg', 'w-full', 'flex', 'items-center', 'gap-2', 'hover:bg-blue-50', 'hover:text-primary', 'transition-all');
        // Quitamos la alerta de bloqueo
        btn.onclick = null;
        // Aquí podrías poner la función real si existiera, ej: btn.onclick = functionRef;
    });
}

function lockButtonsInCard(card) {
    // Ya vienen con la clase btn-tool-locked del HTML
}

// Funciones del Modal
function openGamificationModal() {
    document.getElementById('modal-gamification').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeGamificationModal() {
    document.getElementById('modal-gamification').classList.add('hidden');
    document.body.style.overflow = 'auto';
}
function alertLockedInfo(title, desc) {
    alert(`🔒 ¡HERRAMIENTA BLOQUEADA!\n\n${title}\n${desc}\n\nSube de nivel para desbloquear.`);
}

/* ============================================== */
/*        LÓGICA DEL "ENLACE VITAL"               */
/* ============================================== */

// 1. Guardar Referido al entrar (INIT)
// ==============================================
// LÓGICA DE REFERIDOS: ÚLTIMO CLIC GANA (LAST CLICK WINS)
// ==============================================

async function initSmartReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlGestor = urlParams.get('ref') || urlParams.get('gestor');
    let urlTel = urlParams.get('contact') || urlParams.get('tel');

    // CASO 1: HAY NUEVOS DATOS EN LA URL (Sobrescribir)
    if (urlGestor) {
        // Recuperar teléfono si falta
        if (!urlTel) {
            const { data } = await supabaseClient.from('gestores').select('telefono').eq('nombre', urlGestor).maybeSingle();
            if (data) urlTel = data.telefono;
        }

        // --- MAGIA: VERIFICAR SI EL GESTOR TIENE MÁS DE 500 CLICS ---
        let diasDuracion = 30; // Por defecto 30 días
        try {
            // Contar cuántos clics tiene este gestor en la base de datos
            const { count } = await supabaseClient
                .from('link_analytics')
                .select('id', { count: 'exact', head: true })
                .eq('agent_name', urlGestor);

            // Si tiene más de 500 clics, le premiamos con 6 meses (180 días)
            if (count && count >= 500) {
                diasDuracion = 180;
                console.log("🌟 Enlace VIP (6 Meses) aplicado para:", urlGestor);
            }
        } catch (e) { console.error("Error verificando clics", e); }

        const dataGuardar = {
            nombre: urlGestor,
            telefono: urlTel || "",
            timestamp: new Date().getTime(),
            // Aplicar la duración calculada
            expiresAt: new Date().getTime() + (diasDuracion * 24 * 60 * 60 * 1000)
        };
        localStorage.setItem('pth_referrer_smart', JSON.stringify(dataGuardar));
        localStorage.setItem('pth_referrer', JSON.stringify(dataGuardar));

        // Rastro IP
        registrarRastroIP(urlGestor);
    }
    // CASO 2: URL LIMPIA (Mantener lo que había)
    else {
        const stored = localStorage.getItem('pth_referrer_smart');
        if (stored) {
            const data = JSON.parse(stored);
            const now = new Date().getTime();

            if (now > data.expiresAt) {
                console.log("Amarre expirado por tiempo.");
                localStorage.removeItem('pth_referrer_smart');
            } else {
                console.log("Amarre activo mantenido:", data.nombre);
            }
        }
    }
}

// Función auxiliar para limpiar si expiró
function checkExpiration() {
    const stored = localStorage.getItem('pth_referrer_smart');
    if (!stored) return;

    const data = JSON.parse(stored);
    const now = new Date().getTime();

    if (now > data.expiresAt) {
        console.log("❌ El amarre del gestor ha expirado. Cliente libre.");
        localStorage.removeItem('pth_referrer_smart');
        localStorage.removeItem('pth_referrer');
    } else {
        console.log(`🔒 Cliente amarrado a: ${data.nombre} (Vigente)`);
    }
}

// 2. Recuperar Referido al comprar (VALIDACIÓN SEVERA)
async function getActiveReferrer() {
    const stored = localStorage.getItem('pth_referrer_smart');
    if (!stored) return null;

    const data = JSON.parse(stored);
    const now = new Date().getTime();

    // A. ¿Caducó por fecha fija?
    if (now > data.expiresAt) {
        console.log("❌ Enlace caducado por tiempo.");
        localStorage.removeItem('pth_referrer_smart');
        return null;
    }

    // B. VALIDACIÓN DOBLE: ¿El gestor sigue manteniendo el nivel?
    // Si bajó de nivel ayer, hoy su enlace antiguo podría ser inválido.
    const today = new Date();
    today.setDate(today.getDate() - 30);

    const hierarchy = await resolveSalesHierarchy(data.nombre, true);
    let referralSalesQuery = supabaseClient
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Entregado')
        .gte('created_at', today.toISOString());
    referralSalesQuery = hierarchy?.isSubgestor
        ? referralSalesQuery.eq('subgestor_nombre', data.nombre)
        : referralSalesQuery.eq('gestor', data.nombre);
    const { count } = await referralSalesQuery;

    const currentSales = count || 0;
    const currentData = getLevelData(currentSales);
    const allowedHours = currentData.duration;

    // Calcular horas reales transcurridas desde el clic original
    const hoursElapsed = (now - data.timestamp) / (1000 * 60 * 60);

    if (hoursElapsed > allowedHours) {
        console.log(`❌ PENALIZACIÓN: El gestor bajó de nivel. Enlace invalidado retroactivamente.`);
        localStorage.removeItem('pth_referrer_smart');
        return null;
    }

    return data;
}

// EJECUTAR AL CARGAR
window.addEventListener('load', () => {
    initSmartReferral(); // Revisar URL al entrar
    // ... tus otros inits ...
});

async function magicPasteProduct() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return alert("⚠️ El portapapeles está vacío.");

        const cleanText = text.trim();
        const lines = cleanText.split('\n').filter(line => line.trim() !== '');

        // 1. NOMBRE (Primera línea limpia)
        let nombre = lines[0].replace(/\*/g, '').trim();

        // 2. PRECIO (Busca números grandes o 'usd')
        const priceMatch = cleanText.match(/Precio\s*[:\s]*(\d+)|(\d+)\s*usd/i);
        let precio = priceMatch ? (priceMatch[1] || priceMatch[2]) : "";

        // 3. MENSAJERÍA (LÓGICA MEJORADA: Captura la frase completa)
        let envio = "";
        // Buscamos línea por línea alguna que hable de mensajería
        for (let line of lines) {
            const lower = line.toLowerCase();
            if (lower.includes('mensajería') || lower.includes('envío') || lower.includes('transporte')) {
                // Borramos la palabra "Mensajería:" del inicio y guardamos el resto
                envio = line.replace(/^(mensajería|envío|transporte)\s*[:.-]*\s*/i, '').trim();
                break; // Ya la encontramos, dejamos de buscar
            }
        }
        // Si no encontró nada en las líneas, busca si dice "gratis" en algún lado
        if (!envio && cleanText.toLowerCase().includes('gratis')) {
            envio = "Gratis (Consultar zonas)";
        }
        if (!envio) envio = "Consultar"; // Valor por defecto

        // 4. GARANTÍA
        const warMatch = cleanText.match(/Garantía\s*[:\s]*(.+)/i);
        let garantia = warMatch ? warMatch[1].trim() : "Sí";

        // 5. CATEGORÍA AUTOMÁTICA
        let cat = "VARIOS";
        const lowerText = cleanText.toLowerCase();
        if(lowerText.includes('lavadora') || lowerText.includes('secadora')) cat = "LAVADO";
        else if(lowerText.includes('nevera') || lowerText.includes('freezer')) cat = "REFRIGERACIÓN";
        else if(lowerText.includes('split') || lowerText.includes('aire')) cat = "CLIMATIZACIÓN";
        else if(lowerText.includes('cocina') || lowerText.includes('horno')) cat = "COCINA";

        // 6. RELLENAR EL FORMULARIO
        document.getElementById('p-nombre').value = nombre;
        document.getElementById('p-precio').value = precio;
        document.getElementById('p-categoria').value = cat;
        document.getElementById('p-garantia').value = garantia;

        // AQUI RELLENAMOS EL NUEVO CAMPO VISIBLE
        document.getElementById('p-mensajeria').value = envio;

        // Comisión sugerida
        document.getElementById('p-comision').value = (precio > 100) ? 15 : 5;

        // Descripción en Editor
        ProductDescriptionEditorApi.writeProductDescription(cleanText.replace(/\n/g, '<br>'), { editor: quill });

    } catch (err) {
        console.error(err);
        alert("⚠️ Error al leer portapapeles.");
    }
}

// --- SISTEMA DE PERSISTENCIA DE TASA ---

// 1. Ejecutar al cargar la página
window.addEventListener('load', () => {
});

// --- CARGA DE TASA DESDE LA NUBE ---


// 2. Modificar la función updateGlobalRate existente
// --- GUARDAR TASA EN LA NUBE ---


// --- FUNCIÓN COPIAR DESCRIPCIÓN SIMPLE (NIVEL 0) ---
// --- FUNCIÓN COPIAR DESCRIPCIÓN SIMPLE (CORREGIDA) ---
// Ahora recibimos el botón (btnElement) como parámetro
function copySimpleDesc(btnElement) {
    if(!selectedProduct) return;
    if (!Object.prototype.hasOwnProperty.call(selectedProduct, 'descripcion')) {
        const product = selectedProduct;
        return ensureProductDescriptions([product]).then(() => {
            if (selectedProduct === product) copySimpleDesc(btnElement);
        }).catch(error => alert(error.message));
    }
    trackSpy('COPIO_INFO', selectedProduct.nombre);

    // --- 1. LÓGICA DE LIMPIEZA INTELIGENTE ---
    let rawHtml = selectedProduct.descripcion || "Sin descripción detallada.";

    // Reemplazamos etiquetas HTML por saltos de línea y viñetas
    let descFormateada = rawHtml
        .replace(/<br\s*\/?>/gi, "\n")       // <br> se convierte en Salto
        .replace(/<\/p>/gi, "\n\n")          // Fin de párrafo </p> se convierte en Doble Salto
        .replace(/<\/div>/gi, "\n")          // Fin de div se convierte en Salto
        .replace(/<li>/gi, "• ")             // <li> se convierte en viñeta
        .replace(/<\/li>/gi, "\n")           // Fin de item de lista se convierte en Salto
        .replace(/&nbsp;/g, " ");            // Espacios raros se convierten en normales

    // Ahora sí, quitamos cualquier otra etiqueta HTML sobrante (negritas, colores, etc)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = descFormateada;
    const descLimpia = tempDiv.textContent || tempDiv.innerText || "";

    // --- 2. CONSTRUCCIÓN DEL MENSAJE ---
    const texto =
`📦 *${selectedProduct.nombre}*

📝 *Detalles:*
${descLimpia.trim()}

💰 *Precio:* $${selectedProduct.precio} USD
🛡️ *Garantía:* ${selectedProduct.garantia || 'Sí'}
🚚 *Mensajería:* ${selectedProduct.mensajeria || 'Consultar'}`;

    // --- 3. COPIAR AL PORTAPAPELES ---
    navigator.clipboard.writeText(texto).then(() => {
        const original = btnElement.innerHTML;

        // Feedback visual (Botón verde)
        btnElement.innerHTML = `<span class="material-symbols-outlined text-xl text-green-500">check</span>Copiado`;
        btnElement.classList.add("border-green-500", "text-green-500");

        setTimeout(() => {
            btnElement.innerHTML = original;
            btnElement.classList.remove("border-green-500", "text-green-500");
        }, 2000);

    }).catch(err => {
        alert("Error al copiar: " + err);
    });
}

function customerPhoneCandidates(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    const candidates = new Set();
    if (!digits) return [];

    candidates.add(digits);
    // La tabla histórica usa 8 dígitos para Cuba. Conservamos ambos formatos.
    if (digits.startsWith('53') && digits.length === 10) candidates.add(digits.slice(2));
    if (digits.length === 8) candidates.add('53' + digits);
    return [...candidates];
}

function canonicalCustomerPhone(phone) {
    const candidates = customerPhoneCandidates(phone);
    if (!candidates.length) return '';
    const cubanLocal = candidates.find(value => value.length === 8);
    return cubanLocal || candidates[0];
}

async function findPermanentCustomerOwner(phone) {
    const candidates = customerPhoneCandidates(phone);
    if (!candidates.length) return null;

    let { data, error } = await supabaseClient
        .from('customer_bindings')
        .select('phone, agent_name, protected_until, last_activity_at, last_activity_type, last_purchase_at')
        .in('phone', candidates)
        .limit(1);

    // Compatibilidad mientras se ejecuta customer-protection.sql en Supabase.
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const legacy = await supabaseClient
            .from('customer_bindings')
            .select('phone, agent_name')
            .in('phone', candidates)
            .limit(1);
        data = legacy.data;
        error = legacy.error;
    }

    if (error) {
        console.error('No se pudo consultar la protección del cliente:', error);
        return null;
    }
    const binding = data?.[0] || null;
    if (!binding) return null;
    return {
        ...binding,
        isActive: true,
        daysRemaining: null
    };
}

async function recordCustomerClosure(phone, agentName, orderId = null) {
    const validAgent = typeof agentName === 'string' && agentName.trim() && agentName !== 'Venta Directa' && agentName !== 'Directo';
    const canonicalPhone = canonicalCustomerPhone(phone);
    if (!validAgent || !canonicalPhone) return { owner: null, created: false };

    const existing = await findPermanentCustomerOwner(phone);
    const newOwner = agentName.trim();
    const now = new Date();
    const transferred = Boolean(existing?.agent_name && existing.agent_name !== newOwner);
    const payload = {
        agent_name: newOwner,
        protected_until: null,
        last_activity_at: now.toISOString(),
        last_activity_type: transferred ? 'cierre_nuevo_gestor' : (existing ? 'compra_recurrente' : 'primera_compra'),
        last_purchase_at: now.toISOString(),
        last_order_id: orderId ? String(orderId) : null,
        previous_agent_name: transferred ? existing.agent_name : (existing?.previous_agent_name || null),
        transferred_at: transferred ? now.toISOString() : (existing?.transferred_at || null),
        updated_at: now.toISOString()
    };

    let mutation;
    if (existing) {
        mutation = await supabaseClient.from('customer_bindings').update(payload).in('phone', customerPhoneCandidates(phone));
    } else {
        mutation = await supabaseClient.from('customer_bindings').insert([{ phone: canonicalPhone, ...payload }]);
    }

    // Sin la migración, mantenemos al menos la reasignación por cierre.
    if (mutation.error && (mutation.error.code === '42703' || mutation.error.code === 'PGRST204')) {
        mutation = existing
            ? await supabaseClient.from('customer_bindings').update({ agent_name: newOwner }).in('phone', customerPhoneCandidates(phone))
            : await supabaseClient.from('customer_bindings').insert([{ phone: canonicalPhone, agent_name: newOwner }]);
    }

    if (mutation.error) {
        console.error('No se pudo registrar el cierre del cliente:', mutation.error);
        return { owner: existing?.agent_name || null, created: false, error: mutation.error };
    }

    // Auditoría no bloqueante; requiere customer-protection.sql.
    supabaseClient.from('customer_binding_events').insert([{
        phone: canonicalPhone,
        previous_agent_name: transferred ? existing.agent_name : null,
        agent_name: newOwner,
        event_type: payload.last_activity_type,
        order_id: orderId ? String(orderId) : null,
        protected_until: null
    }]).then(({ error }) => { if (error) console.warn('Auditoría de atribución no disponible.', error); });

    return { owner: newOwner, previousOwner: existing?.agent_name || null, created: !existing, transferred };
}

async function renewCustomerProtection(phone, agentName, activityType = 'seguimiento_registrado') {
    const binding = await findPermanentCustomerOwner(phone);
    if (!binding?.agent_name || binding.agent_name !== agentName) return { renewed: false, reason: 'not_owner' };

    const now = new Date();
    const { error } = await supabaseClient.from('customer_bindings').update({
        protected_until: null,
        last_activity_at: now.toISOString(),
        last_activity_type: activityType,
        updated_at: now.toISOString()
    }).in('phone', customerPhoneCandidates(phone)).eq('agent_name', agentName);

    if (error) return { renewed: false, error };
    supabaseClient.from('customer_binding_events').insert([{
        phone: canonicalCustomerPhone(phone), agent_name: agentName, event_type: activityType,
        protected_until: null
    }]).then(() => {});
    protectedCustomerCountOwner = null;
    return { renewed: true };
}

window.renewCustomerProtection = renewCustomerProtection;

async function obtenerDuenoReal(telefonoCliente) {
    // Escudo protector: Solo acepta nombres reales, rechaza espacios en blanco
    const esValido = (nombre) => nombre && typeof nombre === 'string' && nombre.trim() !== "";

    // 1. Quien realiza el cierre completo recibe la nueva comisión.
    if (esValido(window.gestorName)) return window.gestorName;

    // 2. Un cliente que compra desde el enlace del gestor está siendo cerrado por él.
    const referrer = await getActiveReferrer();
    if (referrer && esValido(referrer.nombre)) return referrer.nombre;

    // 3. Si compra directamente, conserva para siempre al gestor que lo captó.
    if (telefonoCliente) {
        const binding = await findPermanentCustomerOwner(telefonoCliente);
        if (binding?.isActive && esValido(binding.agent_name)) return binding.agent_name;
    }

    // 4. SIN DUEÑO (TRÁFICO ORGÁNICO)
    // La IP no decide comisiones: puede representar una casa o red compartida.
    // Si nadie trajo a este cliente, la venta va directamente a la tienda.
    return "Venta Directa";
}

// --- SÚPER FUNCIÓN IA: MULTI-FOTO + CATEGORÍAS INTELIGENTES ---
// --- SÚPER FUNCIÓN IA: MULTI-FOTO + CATEGORÍAS INTELIGENTES ---
async function superMagicAI() {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;

    // --- 0. GESTIÓN DE API KEY SEGURA ---
    // Intentamos recuperar la clave del navegador
    let apiKey = localStorage.getItem('pth_gemini_api_key');

    // Si no existe, la pedimos al usuario
    if (!apiKey) {
        apiKey = prompt("🔑 CONFIGURACIÓN INICIAL:\n\nPara usar la IA, introduce tu API KEY de Google Gemini.\n(Solo se te pedirá esta vez y se guardará en tu navegador).");

        if (!apiKey || apiKey.trim() === "") {
            return alert("⚠️ Se requiere una API Key válida para continuar.");
        }
        // Guardamos la clave limpia
        localStorage.setItem('pth_gemini_api_key', apiKey.trim());
    }

    // --- 1. OBTENER CATEGORÍAS ---
    const listaOrigen = (typeof inventoryRawAdmin !== 'undefined' && inventoryRawAdmin.length > 0) ? inventoryRawAdmin : productosRaw;
    let categoriasTexto = "VARIOS";
    if (listaOrigen && listaOrigen.length > 0) {
        const catsUnicas = [...new Set(listaOrigen.map(p => p.categoria ? p.categoria.toUpperCase().trim() : 'VARIOS'))];
        categoriasTexto = catsUnicas.join(', ');
    }

    // --- 2. DATOS DE ENTRADA ---
    let clipboardText = "";
    try { clipboardText = await navigator.clipboard.readText(); } catch (e) { }

    const imageParts = [];
    let photosFound = 0;
    for (let i = 0; i < 4; i++) {
        const input = document.getElementById(`file-${i}`);
        if (input && input.files && input.files[0]) {
            const base64Data = await fileToBase64(input.files[0]);
            imageParts.push({ inline_data: { mime_type: input.files[0].type, data: base64Data } });
            photosFound++;
        }
    }

    if (!clipboardText && photosFound === 0) {
        return alert("⚠️ Falta información: Copia texto o sube fotos.");
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="flex items-center gap-2"><span class="loader w-4 h-4 border-white"></span><span>Analizando...</span></div>`;

    try {
        // --- 3. PROMPT ---
        const parts = [];
        let prompt = `Eres un asistente experto en inventario de electrodomésticos.
        CATEGORÍAS EXISTENTES: [ ${categoriasTexto} ].
        INSTRUCCIONES:
        1. Analiza el Texto y las Fotos.
        2. Elige una categoría de la lista dada. Si no encaja, usa VARIOS.
        3. Extrae Nombre, Precio (solo numero), Garantía y Mensajería.
        4. Genera una descripción HTML vendedora usando emojis.

        Responde SOLO con este JSON (sin markdown):
        {
            "nombre": "Nombre producto",
            "precio": 0,
            "categoria": "CATEGORIA",
            "garantia": "Garantía",
            "mensajeria": "Info envío",
            "descripcion_html": "<p>Detalles...</p>"
        }`;

        parts.push({ text: prompt });
        if (clipboardText) parts.push({ text: `TEXTO PORTAPAPELES: ${clipboardText}` });
        imageParts.forEach(imgPart => parts.push(imgPart));

        // --- 4. PETICIÓN A GOOGLE (USANDO LA KEY DEL USUARIO) ---
        // Usamos el modelo gemini-1.5-flash que es el estándar actual gratuito
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;


        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: parts }] })
        });

        if (!response.ok) {
            const errorData = await response.json();

            // Si el error es de permiso (Key invalida o bloqueada), borramos la key para pedirla de nuevo
            if (response.status === 400 || response.status === 403) {
                localStorage.removeItem('pth_gemini_api_key');
                throw new Error("La API Key introducida no es válida o ha sido revocada. Por favor, inténtalo de nuevo para introducir una nueva.");
            }

            console.error("ERROR GOOGLE:", errorData);
            throw new Error(`Google dice: ${errorData.error.message}`);
        }

        const data = await response.json();

        // --- 5. PROCESAR ---
        if(!data.candidates || data.candidates.length === 0) throw new Error("La IA no devolvió resultados.");

        const rawText = data.candidates[0].content.parts[0].text;
        const jsonString = rawText.replace(/```json|```/g, '').trim();
        const resultado = JSON.parse(jsonString);

        // Rellenar campos
        document.getElementById('p-nombre').value = resultado.nombre || "";
        document.getElementById('p-precio').value = resultado.precio || "";
        document.getElementById('p-categoria').value = resultado.categoria || "VARIOS";
        document.getElementById('p-garantia').value = resultado.garantia || "";
        if(document.getElementById('p-mensajeria')) document.getElementById('p-mensajeria').value = resultado.mensajeria || "";

        const precioNum = parseFloat(resultado.precio) || 0;
        document.getElementById('p-comision').value = (precioNum > 100) ? 15 : 5;

        ProductDescriptionEditorApi.writeProductDescription(resultado.descripcion_html || '', { editor: quill });

        btn.className = "w-2/3 bg-green-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2";
        btn.innerHTML = `¡ÉXITO!`;
        setTimeout(() => { btn.className = originalContent; btn.innerHTML = originalContent; btn.disabled = false; }, 2000);

    } catch (error) {
        console.error(error);
        alert("❌ ERROR IA:\n" + error.message);
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// Función auxiliar (Asegúrate de tenerla en el código, si ya la tienes no la dupliques)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// --- LÓGICA NIVEL 4: MEJOR HORARIO (Basado en pedidos del gestor) ---
function getPeakSalesTime(misPedidos) {
    if (!misPedidos || misPedidos.length === 0) return "Sin datos";

    // Creamos un mapa de 24 horas
    const horasConteo = Array(24).fill(0);

    misPedidos.forEach(p => {
        const fecha = new Date(p.fecha || p.created_at);
        const hora = fecha.getHours();
        horasConteo[hora]++;
    });

    // Encontramos la hora con más pedidos
    const maxVentas = Math.max(...horasConteo);
    const horaPico = horasConteo.indexOf(maxVentas);

    // Formateamos el rango (Ej: 14:00 - 16:00)
    const inicio = horaPico;
    const fin = (horaPico + 2) % 24;

    const format = (h) => h === 0 ? "12 AM" : h > 12 ? `${h - 12} PM` : `${h} AM`;

    return `${format(inicio)} - ${format(fin)}`;
}

// --- LÓGICA NIVEL 3: RADAR DE TENDENCIAS (Global - Últimos 7 días) ---
function getGlobalTrendRadar(todosLosPedidos) {
    if (!todosLosPedidos || todosLosPedidos.length === 0) return "Analizando mercado...";

    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    // Filtramos solo pedidos recientes para detectar "Tendencia", no historia
    const pedidosRecientes = todosLosPedidos.filter(p => new Date(p.fecha || p.created_at) >= hace7Dias);

    const conteoProductos = {};
    pedidosRecientes.forEach(p => {
        // Limpiamos el nombre del producto (ej: "1x Split..." -> "Split")
        let nombre = p.producto.replace(/^\d+x\s+/, '').split('[')[0].trim();
        conteoProductos[nombre] = (conteoProductos[nombre] || 0) + 1;
    });

    // Ordenamos y tomamos los 3 mejores
    return Object.entries(conteoProductos)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
}

// 1. Cargar gestores pendientes (Llamar esto dentro de loadAdminData)
// Variables globales para los filtros
let globalAgentsList = [];
let currentAgentFilter = 'TODOS';



// Función para aplicar filtros visuales
function filterAgents(tipo, btn) {
    currentAgentFilter = tipo;

    // Actualizar estilo de botones
    document.querySelectorAll('.btn-agent-filter').forEach(b => {
        b.classList.remove('bg-slate-800', 'text-white', 'shadow-lg', 'border-slate-700');
        b.classList.add('bg-white', 'text-gray-500', 'border-gray-200');
    });

    // Activar el botón presionado
    btn.classList.remove('bg-white', 'text-gray-500', 'border-gray-200');
    btn.classList.add('bg-slate-800', 'text-white', 'shadow-lg', 'border-slate-700');

    renderAgentTeamTable();
}

// Función que dibuja la tabla


async function generarComprobanteVenta(datosPedido, accion) {
    if (window.PTHAssets && !await window.PTHAssets.ensure('pdf')) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. IDENTIFICACIÓN ÚNICA DEL GESTOR (Para texto y para link)
    const session = JSON.parse(localStorage.getItem('pth_session'));
    const referrer = JSON.parse(localStorage.getItem('pth_referrer_smart'));

    let nombreFinal = "ASESOR DE VENTAS";
    let telfFinal = "5356071095"; // Teléfono de respaldo (Dueño)

    // Prioridad 1: Sesión activa (Gestor logueado)
    if (session && session.name) {
        nombreFinal = session.name;
        telfFinal = session.data?.telefono || getAgentPhone();
    }
    // Prioridad 2: Referido guardado (Cliente con dueño asignado)
    else if (referrer && (referrer.nombre || referrer.name)) {
        nombreFinal = referrer.nombre || referrer.name;
        telfFinal = referrer.telefono || telfFinal;
    }

    // Construcción del Link Personalizado
    let linkPersonal = window.location.origin + window.location.pathname;
    if (nombreFinal !== "ASESOR DE VENTAS") {
        linkPersonal += `?ref=${encodeURIComponent(nombreFinal)}&contact=${telfFinal}`;
        linkPersonal = await getOrGenerateShortLink(nombreFinal, linkPersonal);
    } else {
        linkPersonal += `?s=oficial`;
    }

    // PALETA DE COLORES PREMIUM
    const cPrimary = [26, 71, 137];   // Azul Profundo
    const cSecondary = [44, 111, 181]; // Azul Accento
    const cSlate = [30, 41, 59];      // Gris Oscuro para textos
    const cLight = [100, 116, 139];   // Gris suave para etiquetas

    // --- 1. CABECERA (HEADER PREMIUM) ---
    doc.setFillColor(...cPrimary);
    doc.rect(0, 0, 210, 50, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.text("FACTURA", 15, 35);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const fechaActual = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`EMITIDA EL: ${fechaActual.toUpperCase()}`, 195, 33, { align: "right" });

    // --- 2. BLOQUES DE DATOS (CLIENTE VS GESTOR) ---
    doc.setTextColor(...cLight);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL CLIENTE (FACTURADO A)", 15, 65);
    doc.text("DATOS DEL COMERCIAL (ATENDIDO POR)", 120, 65);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 67, 195, 67);

    // Información del Cliente
    doc.setTextColor(...cSlate);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(datosPedido.cliente.toUpperCase(), 15, 75);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Carnet ID: ${datosPedido.ci || 'No especificado'}`, 15, 81);
    doc.setTextColor(...cLight);
    doc.text("Dirección de Entrega:", 15, 87);
    doc.setTextColor(...cSlate);
    doc.text(datosPedido.direccion, 15, 92, { maxWidth: 85 });

    // Información del Gestor (USANDO LAS VARIABLES UNIFICADAS)
    doc.setFont("helvetica", "bold");
    doc.text(nombreFinal.toUpperCase(), 120, 75);

    doc.setFont("helvetica", "normal");
    doc.text(`WhatsApp: +${telfFinal}`, 120, 81);

    const emailFinal = session?.data?.email || "ventas@paratuhogar.cu";
    doc.text(`Correo: ${emailFinal}`, 120, 86);

    // Botón / Link Interactivo
    doc.setTextColor(...cSecondary);
    doc.setFont("helvetica", "bold");
    doc.text("VISITAR MI TIENDA ONLINE", 120, 95);
    doc.setDrawColor(...cSecondary);
    doc.line(120, 96, 172, 96);
    doc.link(120, 92, 60, 6, { url: linkPersonal });

    // --- 3. TABLA DE PRODUCTOS ---
    const filasTabla = datosPedido.items.map(i => [
        i.nombre.toUpperCase(),
        i.qty,
        `$${i.price.toLocaleString()}.00`,
        `$${(i.price * i.qty).toLocaleString()}.00`
    ]);

    if (Number(datosPedido.mensajeria) > 0) {
        filasTabla.push([
            'SERVICIO DE ENTREGA Y LOGÍSTICA A DOMICILIO',
            '1',
            `$${datosPedido.mensajeria.toLocaleString()}.00`,
            `$${datosPedido.mensajeria.toLocaleString()}.00`
        ]);
    }

    doc.autoTable({
        startY: 110,
        head: [['DESCRIPCIÓN DEL EQUIPO / SERVICIO', 'CANT', 'PRECIO UNIT.', 'SUBTOTAL']],
        body: filasTabla,
        theme: 'striped',
        headStyles: { fillColor: cPrimary, textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { textColor: cSlate, fontSize: 10 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center', cellWidth: 15 },
            2: { halign: 'right', cellWidth: 35 },
            3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    // --- 4. RESUMEN FINANCIERO ---
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFillColor(...cPrimary);
    doc.rect(125, finalY, 70, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("TOTAL A PAGAR:", 130, finalY + 9.5);
    doc.setFontSize(14);
    doc.text(`$${datosPedido.totalUSD.toLocaleString()}.00`, 190, finalY + 9.5, { align: "right" });

    // --- 5. NOTAS Y PIE DE PÁGINA ---
    doc.setTextColor(...cLight);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("NOTAS E INSTRUCCIONES DE PAGO:", 15, finalY + 10);
    doc.setFont("helvetica", "normal");
    const notas =[
        "• El pago se realiza en efectivo o transferencia al momento de recibir el equipo.",
        "• Verifique el estado del producto antes de que el mensajero se retire.",
        "• Esta factura reserva el producto por un periodo de 24 horas."
    ];
    doc.text(notas, 15, finalY + 16);

    // NUEVO: TÉRMINOS Y CONDICIONES DE GARANTÍA
    const yGarantia = finalY + 16 + (notas.length * 3.5) + 3;
    doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS Y CONDICIONES DE LA GARANTÍA:", 15, yGarantia);
    doc.setFont("helvetica", "normal");

    const terminosText = "1- La Garantía del producto solo contempla la reposición por desperfectos de fábrica, en caso de que el producto se encuentre agotado, se le reintegra el monto total pagado.\n2- No CUBRE Roturas o Quemaduras por MALA MANIPULACIÓN.\n3- Antes de abrir el Producto el cliente debe revisar las características y compatibilidad del mismo, una vez abierto el producto no se aceptan devoluciones.\n4- Los productos que presenten problemas son revisados en nuestras instalaciones, a excepción de aquellos que sea preferible revisar en el domicilio para determinar las causas (Ej: split) y los que determine la empresa.";

    // Auto-ajustar texto para que no se salga de los bordes (180 es el ancho)
    const terminosLimpio = doc.splitTextToSize(terminosText, 180);
    doc.text(terminosLimpio, 15, yGarantia + 5);

    // Calcular la posición final (Footer Y) para que no choque el texto de gracias
    const footerY = yGarantia + 5 + (terminosLimpio.length * 3.5) + 12;

    doc.setFontSize(22);
    doc.setTextColor(...cPrimary);
    doc.setFont("helvetica", "bold");
    doc.text("¡Gracias por elegirnos!", 195, footerY, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(...cLight);
    doc.setFont("helvetica", "normal");
    doc.text("Generado automáticamente por el Sistema de Gestión paratuhogar.cu", 105, 285, { align: "center" });

    // --- 6. SALIDA ---
    const nombreArchivo = `Factura_${datosPedido.cliente.replace(/\s+/g, '_')}.pdf`;

    if (accion === 'compartir' && navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });
        try {
            await navigator.share({ files: [file], title: 'Su Factura - paratuhogar' });
        } catch (err) { doc.save(nombreArchivo); }
    } else {
        doc.save(nombreArchivo);
    }
}

// Función para verificar si un teléfono ya pertenece a un Gestor Nivel 5
async function checkCustomerOwnership(phone) {
    if (!phone) return null;
    try {
        const { data, error } = await supabaseClient
            .from('customer_bindings')
            .select('agent_name')
            .eq('phone', phone.replace(/\D/g, ''))
            .single();

        if (data && data.agent_name) {
            console.log("💎 Cliente vinculado permanentemente a:", data.agent_name);
            return data.agent_name;
        }
    } catch (e) {
        // console.log("Cliente sin dueño previo");
    }
    return null;
}

// Función para dejar rastro de IP al usar un link
// --- COPIA ESTO EN index.html (Reemplaza la función antigua) ---

async function registrarRastroIP(nombreGestor) {
    if (!nombreGestor) return;

    let ip = "";
    let pais = "Desconocido";

    try {
        // USAMOS ESTA API QUE ES MÁS FIABLE Y GRATUITA
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();

        if (data.success) {
            ip = data.ip;
            pais = data.country || "Desconocido"; // Aquí obtenemos el país real
        } else {
            // Si falla, intentamos solo obtener la IP
            const res2 = await fetch('https://api.ipify.org?format=json');
            const data2 = await res2.json();
            ip = data2.ip;
        }
    } catch (e) {
        console.error("Error obteniendo ubicación:", e);
        return;
    }

    try {
        const fingerprint = navigator.userAgent + "|" + screen.width;
        // Cooldown de 30 minutos para no saturar
        const margenTiempo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        // Verificar si ya existe reciente
        const { data: existente } = await supabaseClient
            .from('link_analytics')
            .select('id')
            .eq('agent_name', nombreGestor)
            .eq('ip_address', ip)
            .gte('timestamp', margenTiempo)
            .limit(1);

        // Guardar si es nuevo
        if (!existente || existente.length === 0) {
            const ua = navigator.userAgent;
            const tipoDispositivo = /Mobi|Android/i.test(ua) ? 'Móvil' : 'Escritorio';
            const sistemaOperativo = ua.includes("Win") ? "Windows" : ua.includes("Mac") ? "MacOS" : "Móvil";

            // AQUÍ GUARDAMOS EL PAÍS REAL EN LA BASE DE DATOS
            await supabaseClient.from('link_analytics').insert([{
                agent_name: nombreGestor,
                ip_address: ip,
                pais: pais,
                device_type: tipoDispositivo,
                os: sistemaOperativo,
                browser: fingerprint,
                timestamp: new Date().toISOString()
            }]);
            console.log(`📍 Rastro registrado: ${ip} (${pais})`);
        }
    } catch (e) {
        console.error("Error guardando rastro:", e);
    }
}

// Función para buscar si una IP tiene dueño en las últimas 48 horas
async function buscarDuenoPorIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const { ip } = await res.json();

        // Generamos la misma huella para comparar
        const fingerprint = navigator.userAgent + "|" + screen.width;

        // Buscamos en las últimas 24 horas (más estricto es mejor)
        const limiteTiempo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data } = await supabaseClient
            .from('link_analytics')
            .select('agent_name')
            .eq('ip_address', ip)
            .eq('browser', fingerprint) // <--- COMPARAMOS LA HUELLA EXACTA AQUÍ
            .gte('timestamp', limiteTiempo)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            console.log(`🕵️ Detectado por Huella Digital: ${data.agent_name}`);
            return data.agent_name;
        }
        return null;
    } catch (e) { return null; }
}

// --- NUEVA FUNCIÓN: GRÁFICA DE ORIGEN DE VENTAS ---
function renderSourceChart(ventas) {
    const existingChart = document.getElementById('chart-sources-container');
    if (existingChart) existingChart.remove();
    renderGestorPerformance(ventas);
}
function esMensajeriaAmbigua(texto) {
    if (!texto) return false;
    const t = texto.toLowerCase();
    // Palabras clave que indican que no hay un precio fijo simple
    return t.includes('consultar') || t.includes('adicional') || t.includes('periferia') || t.includes('depende') || t.includes('variable');
}

// --- LÓGICA DE PESTAÑAS DEL DASHBOARD ---
function showDashSection(section) {
    prepareGestorDashboardLayout();

    // Ocultar todo
    document.getElementById('sub-dash-resumen').classList.add('hidden');
    document.getElementById('sub-dash-precios').classList.add('hidden');
    document.getElementById('sub-dash-comisiones').classList.add('hidden');
    document.getElementById('sub-dash-rendimiento').classList.add('hidden');
    document.getElementById('gestor-home')?.classList.add('hidden');
    document.querySelectorAll('#sec-dashboard > .gestor-legacy-block').forEach(block => block.classList.add('hidden'));

    // Desactivar botones
    document.getElementById('btn-dash-resumen').className = "px-4 py-2 bg-white text-gray-500 rounded-xl text-xs font-black uppercase border border-gray-100 transition-all";
    document.getElementById('btn-dash-precios').className = "px-4 py-2 bg-white text-gray-500 rounded-xl text-xs font-black uppercase border border-gray-100 transition-all";
    document.getElementById('btn-dash-comisiones').className = "shrink-0 rounded-xl border border-emerald-100 bg-white px-4 py-2 text-xs font-black uppercase text-emerald-700 transition-all";
    document.getElementById('btn-dash-rendimiento').className = "shrink-0 rounded-xl border border-blue-100 bg-white px-4 py-2 text-xs font-black uppercase text-blue-700 transition-all";

    // Activar selección
    if(section === 'resumen') {
        document.getElementById('gestor-home')?.classList.remove('hidden');
        document.getElementById('btn-dash-resumen').className = "px-4 py-2 bg-[#1a4789] text-white rounded-xl text-xs font-black uppercase shadow-md transition-all";
        document.getElementById('gestor-advanced-icon')?.classList.remove('rotate-180');
    } else if (section === 'comisiones') {
        document.getElementById('sub-dash-comisiones').classList.remove('hidden');
        document.getElementById('btn-dash-comisiones').className = "shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white shadow-md transition-all";
        renderCommissionCenter();
    } else if (section === 'rendimiento') {
        document.getElementById('sub-dash-rendimiento').classList.remove('hidden');
        document.getElementById('btn-dash-rendimiento').className = "shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase text-white shadow-md transition-all";
        renderGestorPerformance();
    } else {
        // === AQUÍ INYECTAMOS EL TEXTO SECRETO ===
        // Solo se escribe cuando el usuario entra a esta sección
        document.getElementById('sub-dash-precios').classList.remove('hidden');
        document.getElementById('btn-dash-precios').className = "px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all";

        const esSubgestor = Boolean(window.currentUserData?.parent_id);
        const textoSecreto = esSubgestor
            ? `Estos son los precios, productos visibles y comisiones asignados por tu gestor principal.
               <br><b>No puedes modificarlos.</b> Cualquier ajuste debes coordinarlo directamente con tu gestor.`
            : `Aquí puedes subir el precio de los productos marcados como "Flexibles".
               <br>Todo lo que subas por encima del precio base es <b>100% ganancia extra para ti</b>.
               Cuando los clientes entren por tu link, verán los precios que tú estableciste.`;

        const pricingTitle = document.querySelector('#sub-dash-precios h3');
        if (pricingTitle) pricingTitle.textContent = esSubgestor ? 'Precios y comisiones asignados' : 'Configurador de Precios';

        const elMsg = document.getElementById('msg-instrucciones-seguro');
        if(elMsg) elMsg.innerHTML = textoSecreto;

        renderGestorPricing(); // Refrescar lista
    }
}

// --- RENDERIZAR LISTA DE EDICIÓN DE PRECIOS ---
// --- RENDERIZAR LISTA DE EDICIÓN DE PRECIOS ---
async function renderGestorPricing() {
    const container = document.getElementById('list-gestor-precios');
    if(!container) return;

    const hierarchy = await resolveSalesHierarchy(window.gestorName);
    const esSubgestor = Boolean(hierarchy?.isSubgestor);
    const gestorConfigurador = hierarchy?.pricingOwnerName || window.gestorName;

    // 1. Filtrar TODOS los productos disponibles en stock
    const { data: productosBase, error: errProd } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('disponible', 'SI')
        .order('nombre');

    if(errProd || !productosBase || productosBase.length === 0) {
        container.innerHTML = `<p class="text-gray-400 col-span-full text-center">No hay productos en stock.</p>`;
        return;
    }

    // Los subgestores siempre leen la configuración de su gestor principal.
    // Nunca poseen una tabla de precios/comisiones independiente.
    const { data: misPrecios, error: errPrecios } = await supabaseClient
        .from('precios_personalizados')
        .select('*')
        .eq('gestor', gestorConfigurador);

    if (errPrecios) return;

    const productosConfigurables = esSubgestor
        ? productosBase.filter(p => {
            const saved = misPrecios.find(c => c.producto_id === p.id);
            return !saved || saved.visible_subgestor !== false;
        })
        : productosBase;

    container.innerHTML = productosConfigurables.map(p => {
        const saved = misPrecios.find(c => c.producto_id === p.id);
        const isFlexible = p.precio_flexible === 'SI';

        const precioActual = isFlexible
            ? (saved ? parseFloat(saved.nuevo_precio) : parseFloat(p.precio))
            : parseFloat(p.precio);

        const comisionSubgestor = saved ? parseFloat(saved.comision_subgestor) || 0 : 0;

        // --- FILTRAR VISIBILIDAD (Por defecto es visible = true) ---
        const visibleSubgestor = saved ? (saved.visible_subgestor !== false) : true;

        const gananciaBase = parseFloat(p.comision);
        const gananciaTotal = isFlexible
            ? (gananciaBase + (precioActual - parseFloat(p.precio)))
            : gananciaBase;

        const nombreSafe = p.nombre.replace(/"/g, '&quot;');
        const minPricePermitido = parseFloat(p.precio) - gananciaBase;

        const priceInputHtml = isFlexible && !esSubgestor
            ? `<input type="number" id="input-price-${p.id}" value="${precioActual}" min="${minPricePermitido}"
                  oninput="calcGainUI('${p.id}', ${p.precio}, ${p.comision}, true)"
                  class="w-full rounded-lg border-gray-200 text-xs font-black text-slate-700 px-3 py-1.5">`
            : `<input type="number" id="input-price-${p.id}" value="${precioActual}" disabled
                  class="w-full rounded-lg border-gray-200 bg-gray-100 text-xs font-black text-gray-400 px-3 py-1.5 cursor-not-allowed" title="Este producto tiene un precio fijo obligatorio">`;

        const badgeFlexible = isFlexible
            ? `<span class="bg-blue-100 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded">📈 PRECIO LIBRE</span>`
            : `<span class="bg-slate-100 text-slate-600 text-[8px] font-black px-1.5 py-0.5 rounded">🔒 PRECIO FIJO</span>`;

        const subgestorCommInputHtml = esSubgestor
            ? `<div class="flex justify-between items-center pt-2">
                    <div>
                        <span class="block text-[9px] font-black uppercase text-slate-400">Comisión asignada por ${gestorSafeText(hierarchy.parent.nombre)}</span>
                        <span class="text-xs font-black text-emerald-500">Tu Ganancia: $${comisionSubgestor.toFixed(0)}</span>
                    </div>
               </div>`
            : `<div>
                    <!-- INTERRUPTOR VISIBILIDAD PARA EL SUBGESTOR (AUTO-GUARDADO AL CAMBIAR) -->
                    <div class="flex justify-between items-center mb-2 border-b border-gray-150 pb-2">
                        <span class="text-[9px] font-black uppercase text-indigo-400">Mostrar a mis Subgestores</span>
                        <label class="relative inline-flex items-center cursor-pointer select-none">
                            <input type="checkbox" id="input-visible-${p.id}" ${visibleSubgestor ? 'checked' : ''} onchange="saveMyPrice('${p.id}', ${p.precio}, ${p.comision})" class="sr-only peer">
                            <div class="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    <div class="flex justify-between items-center mb-1">
                        <label class="text-[9px] font-black uppercase text-purple-400">Comisión para el Subgestor ($)</label>
                        <span id="gain-label-${p.id}" class="text-[9px] font-bold text-emerald-500">
                            Tu Ganancia Pasiva: $${(gananciaTotal - comisionSubgestor).toFixed(0)}
                        </span>
                    </div>
                    <div class="flex gap-2">
                        <input type="number" id="input-sub-com-${p.id}" value="${comisionSubgestor}" min="0" max="${gananciaTotal}"
                            oninput="calcGainUI('${p.id}', ${p.precio}, ${p.comision}, ${isFlexible})"
                            class="w-full rounded-lg border-gray-200 text-xs font-black text-slate-700 px-3 py-1.5">

                        <button onclick="saveMyPrice('${p.id}', ${p.precio}, ${p.comision})"
                            class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-lg font-bold text-xs shadow-md active:scale-95 transition-all">
                            <span class="material-symbols-outlined text-lg">save</span>
                        </button>
                    </div>
               </div>`;

        return `
        <div class="bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm flex flex-col gap-3">
            <div class="flex gap-3">
                <img src="${fixDriveUrl(p.thumbnail)}" class="w-12 h-12 rounded-lg object-contain bg-gray-50">
                <div class="overflow-hidden flex-1">
                    <div class="flex justify-between items-start gap-1">
                        <p class="text-[10px] font-bold text-gray-400 uppercase truncate">${p.categoria}</p>
                        ${badgeFlexible}
                    </div>
                    <p class="text-xs font-black text-slate-700 leading-tight truncate mt-0.5">${nombreSafe}</p>
                    <p class="text-[10px] text-gray-500">Base: $${p.precio} | Comi. Total: $${p.comision}</p>
                </div>
            </div>

            <div class="bg-gray-50 p-3 rounded-xl space-y-3">
                <!-- 1. PRECIO DE VENTA -->
                <div>
                    <label class="text-[9px] font-black uppercase text-indigo-400 block mb-1">Precio de Venta al Público</label>
                    ${priceInputHtml}
                </div>

                <!-- 2. COMISIÓN Y VISIBILIDAD -->
                ${subgestorCommInputHtml}
            </div>
        </div>`;
    }).join('');
}

window.calcGainUI = function(id, basePrice, baseComm, isFlexible) {
    const inputPrice = document.getElementById(`input-price-${id}`);
    const inputSubCom = document.getElementById(`input-sub-com-${id}`);
    const label = document.getElementById(`gain-label-${id}`);

    if(!inputPrice || !inputSubCom || !label) return;

    const valPrice = isFlexible ? (parseFloat(inputPrice.value) || basePrice) : basePrice;
    const valSubCom = parseFloat(inputSubCom.value) || 0;

    const extra = isFlexible ? (valPrice - basePrice) : 0;
    const totalComm = baseComm + extra;
    const parentGain = totalComm - valSubCom;

    if (valSubCom > totalComm) {
        label.innerText = `⚠️ Excede comisión total ($${totalComm.toFixed(0)})`;
        label.className = "text-red-500 text-[9px] font-bold";
    } else {
        label.innerText = `Tu Ganancia Pasiva: $${parentGain.toFixed(0)}`;
        label.className = "text-emerald-500 text-[9px] font-bold";
    }
}

// Hacemos la función global asignándola a window
// --- GUARDAR PRECIO Y COMISIÓN CON SOPORTE PARA DESCUENTOS ---
window.saveMyPrice = async function(prodId, basePrice, baseComm) {
    const hierarchy = await resolveSalesHierarchy(window.gestorName);
    if (hierarchy?.isSubgestor) {
        return alert(`🔒 Tus precios y comisiones los configura ${hierarchy.parent.nombre}.`);
    }

    const inputPrice = document.getElementById(`input-price-${prodId}`);
    const inputSubCom = document.getElementById(`input-sub-com-${prodId}`);
    const inputVisible = document.getElementById(`input-visible-${prodId}`);

    const newPrice = parseFloat(inputPrice.value);
    const newSubCom = parseFloat(inputSubCom.value) || 0;
    const isVisible = inputVisible ? inputVisible.checked : true;

    const gestorActual = window.gestorName;

    if (!gestorActual) return alert("Error de sesión. Por favor recarga la página.");
    if (isNaN(newPrice)) return alert("El precio no es válido.");

    // --- REGLA DE DESCUENTO: El precio mínimo permitido es el PRECIO AL COSTO ---
    const minPrice = basePrice - baseComm;
    if (newPrice < minPrice) {
        return alert(`El precio mínimo permitido (al costo) es $${minPrice}`);
    }

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;

    const isToggle = event.type === 'change';
    if (!isToggle) {
        btn.innerHTML = `<span class="loader" style="width:15px;height:15px;border:2px solid white;border-bottom-color:transparent;border-radius:50%;display:inline-block;animation:rotation 1s linear infinite"></span>`;
        btn.disabled = true;
    }

    try {
        // CORRECCIÓN DE SEGURIDAD: Usar .limit(1) en vez de .maybeSingle() evita el error PGRST116 si hay registros duplicados
        const { data: results, error: searchError } = await supabaseClient
            .from('precios_personalizados')
            .select('id')
            .eq('gestor', gestorActual)
            .eq('producto_id', prodId)
            .limit(1);

        if (searchError) throw searchError;

        // Extraemos el primer registro si existe
        const existing = (results && results.length > 0) ? results[0] : null;

        let errorGuardado;

        if (existing) {
            const { error } = await supabaseClient
                .from('precios_personalizados')
                .update({
                    nuevo_precio: newPrice,
                    comision_subgestor: newSubCom,
                    visible_subgestor: isVisible
                })
                .eq('id', existing.id);
            errorGuardado = error;
        } else {
            const { error } = await supabaseClient
                .from('precios_personalizados')
                .insert([{
                    gestor: gestorActual,
                    producto_id: prodId,
                    nuevo_precio: newPrice,
                    comision_subgestor: newSubCom,
                    visible_subgestor: isVisible
                }]);
            errorGuardado = error;
        }

        if (errorGuardado) throw errorGuardado;

        if (!isToggle) {
            btn.innerHTML = `<span class="material-symbols-outlined">check</span>`;
            btn.classList.replace('bg-indigo-600', 'bg-emerald-500');

            setTimeout(() => {
                btn.innerHTML = `<span class="material-symbols-outlined text-lg">save</span>`;
                btn.classList.replace('bg-emerald-500', 'bg-indigo-600');
                btn.disabled = false;

                window.PTHSecureData.clearCaches();
                localStorage.removeItem('pth_catalogo_cache_time');
                loadProducts();
            }, 1500);
        } else {
            window.PTHSecureData.clearCaches();
            localStorage.removeItem('pth_catalogo_cache_time');
            loadProducts();
        }

    } catch (e) {
        alert("Error al guardar: " + e.message);
        if (!isToggle) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

// Función para actualizar la etiqueta de ganancia en tiempo real
function calcGainUI(id, basePrice, baseComm) {
    const input = document.getElementById(`input-price-${id}`);
    const label = document.getElementById(`gain-label-${id}`);

    // Parseamos el nuevo precio. Si está vacío, asumimos el precio base.
    const newVal = parseFloat(input.value) || basePrice;

    // Calculamos la ganancia total: Comisión Base + (Sobreprecio)
    const extra = newVal - basePrice;
    const total = baseComm + extra;

    if (newVal < basePrice) {
        label.innerText = `⚠️ Pierdes $${Math.abs(extra).toFixed(0)}`;
        label.classList.remove('text-emerald-500');
        label.classList.add('text-red-500');
    } else {
        label.innerText = `Ganancia: $${total.toFixed(0)}`;
        label.classList.remove('text-red-500');
        label.classList.add('text-emerald-500');
    }
}

// --- CONFIGURACIÓN DE NOTICIAS ---
// Cambia este texto cuando pongas una funcionalidad nueva para que le salga a todos de nuevo
const CURRENT_CAMPAIGN = 'info_precios_v1';

function showPriceIntro() {
    const yaVisto = localStorage.getItem(CURRENT_CAMPAIGN); // 'info_precios_v1'

    if (!yaVisto) {
        // Muestra el de precios si es nuevo
        const modal = document.getElementById('modal-intro-precios');
        if (modal) modal.classList.remove('hidden');
    }
}

// --- LÓGICA DEL CARTEL RADAR DE RIESGOS ---
const RADAR_CAMPAIGN_KEY = 'info_radar_riesgos_v1';

function showRadarIntro() {
    // 🚫 DESACTIVADO:
    // Simulamos que el cartel ya fue visto para que el sistema nunca lo abra
    // y evitamos que las gestoras se queden con la pantalla bloqueada.
    localStorage.setItem(RADAR_CAMPAIGN_KEY, 'true');
    return;
}

function closeRadarIntro() {
    // Cerramos el modal y restauramos el scroll
    document.getElementById('modal-intro-radar').classList.add('hidden');
    document.body.style.overflow = 'auto';

    // Lo guardamos en memoria para que NUNCA MÁS le vuelva a salir
    localStorage.setItem(RADAR_CAMPAIGN_KEY, 'true');
}

function closePriceIntro() {
    document.getElementById('modal-intro-precios').classList.add('hidden');
    localStorage.setItem(CURRENT_CAMPAIGN, 'true');
    showDashSection('precios');

}

// Función para saltar al Studio con los filtros actuales
function goToStudio() {
    // 1. Capturar qué está viendo el gestor ahora mismo
    const searchInput = document.getElementById('search-bar');
    const query = searchInput ? searchInput.value.trim() : "";
    trackSpy('USO_HERRAMIENTA', 'Magic Studio');


    // 'activeCategory' es la variable global que ya usas en tu código actual
    const category = activeCategory || "TODOS";


    // 2. Construir la URL con parámetros
    // Ejemplo: studio.html?q=refrigerador&cat=LINEA%20BLANCA
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category && category !== 'TODOS') params.append('cat', category);

    // 3. Viajar al Studio
    window.location.href = `studio.html?${params.toString()}`;
}

// CORRECCIÓN DE ERROR FATAL
// Agrega esto al final de tu script para que la consola no bloquee el resto
window.filterMyOrders = function() {
    const input = document.getElementById('search-mi-historial');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const rows = document.getElementById("list-mis-pedidos").getElementsByTagName("div");

    // Lógica simple de filtrado visual si usas divs, o adáptalo a tu tabla
    // Si tu función original loadProDashboard ya maneja esto,
    // asegúrate de que filterMyOrders esté definida en el ámbito global (window).
    if(typeof renderMyOrdersList === 'function' && typeof myOrdersData !== 'undefined') {
        const filtered = myOrdersData.filter(p => p.cliente.toUpperCase().includes(filter));
        renderMyOrdersList(filtered);
    }
};

// ==========================================
// FUNCIONES DE LOS BOTONES (TEXTO, FOTOS, PDF)
// ==========================================

// 1. BOTÓN TEXTO: Copiado Masivo
function getProductsVisibleOnScreen() {
    const renderedNames = [...document.querySelectorAll('#productos-container h3')]
        .map(node => node.textContent.trim())
        .filter(Boolean);

    const ordered = renderedNames
        .map(name => productosRaw.find(product => product.nombre === name))
        .filter(Boolean);

    if (ordered.length) return ordered;

    const query = (document.getElementById('search-bar')?.value || '').trim().toLowerCase();
    const highCommission = Boolean(document.getElementById('filter-high-comm')?.checked);
    return productosRaw.filter(product => {
        const matchesQuery = !query || String(product.nombre || '').toLowerCase().includes(query);
        const matchesCategory = activeCategory === 'TODOS' ||
            String(product.categoria || '').toUpperCase().includes(activeCategory);
        const matchesCommission = !highCommission || Number(product.comision || 0) > 10;
        return matchesQuery && matchesCategory && matchesCommission && product.disponible === 'SI';
    });
}

// Optional sales tools never delay catalogue startup.
const salesToolOpening = new Map();
function invokeSalesTool(name, args, buttonId) {
    if (salesToolOpening.has(name)) return salesToolOpening.get(name);
    const element = document.getElementById(buttonId);
    const button = element?.tagName === 'BUTTON' ? element : element?.querySelector('button');
    const original = button?.innerHTML, wasDisabled = button?.disabled;
    const token = window.PTHSecureData?.token();
    let restored = false;
    const restoreButton = () => {
        if (restored) return;
        restored = true;
        if (button) { button.innerHTML = original; button.disabled = wasDisabled; }
    };
    if (button) { button.disabled = true; button.textContent = 'Cargando herramienta…'; }
    const opening = Promise.resolve().then(async () => {
        try {
            if (!window.PTHSalesTools) await window.PTHAssets.load('sales');
            if (token !== window.PTHSecureData?.token()) throw Error('La sesión cambió. Vuelve a pulsar el botón.');
            restoreButton();
            return await window.PTHSalesTools[name](...args);
        } catch (error) {
            alert('No se pudo abrir la herramienta. ' + error.message + ' Puedes volver a intentarlo.');
        } finally { restoreButton(); salesToolOpening.delete(name); }
    });
    salesToolOpening.set(name, opening);
    return opening;
}
function legacyCopyCategoryOffersV2() { return invokeSalesTool('legacyCopyCategoryOffersV2', [], 'btn-copy-bulk'); }
function openSalesComposer(mode = 'quick') { return invokeSalesTool('openSalesComposer', [mode], mode === 'quick' ? 'container-flash-btn' : 'btn-copy-bulk'); }
function generateFlashResponse() { return openSalesComposer('quick'); }
function copyCategoryOffers() { return openSalesComposer('broadcast'); }
function downloadCategoryPhotos() { return invokeSalesTool('downloadCategoryPhotos', [], 'btn-zip-bulk'); }
function downloadCatalogPDF() { return invokeSalesTool('downloadCatalogPDF', [], 'btn-pdf-bulk'); }

async function verificarDuenioAlEscribir(telefono) {
    const status = document.getElementById('customer-owner-status');
    if (!telefono || telefono.replace(/\D/g, '').length < 8) {
        if (status) status.classList.add('hidden');
        return;
    }

    console.log("🔍 Verificando dueño para el teléfono:", telefono);

    const binding = await findPermanentCustomerOwner(telefono);
    const dueno = await obtenerDuenoReal(telefono);

    if (dueno && dueno !== "Venta Directa") {
        console.log("✅ Cliente reconocido. El dueño es: " + dueno);

        if (status) {
            const isInternal = Boolean(localStorage.getItem('pth_session'));
            const isCurrentOwner = binding?.agent_name === window.gestorName;
            const hasOtherOwner = Boolean(binding?.agent_name && !isCurrentOwner);
            status.className = `mt-2 rounded-xl border px-3 py-2 text-[10px] font-black leading-relaxed ${isCurrentOwner ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : hasOtherOwner ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-700'}`;
            if (isInternal && isCurrentOwner) {
                status.textContent = '🔐 Este cliente es tuyo sin fecha de vencimiento. Mantén el seguimiento para que otro gestor no tenga la oportunidad de recuperarlo con un nuevo cierre.';
            } else if (isInternal && hasOtherOwner) {
                status.textContent = `ℹ️ Cliente atendido anteriormente por ${binding.agent_name}. Si tú realizas el cierre completo, esta venta, la comisión y la nueva protección serán tuyas.`;
            } else {
                status.textContent = `🤝 Esta compra será atendida por ${dueno}.`;
            }
            status.classList.remove('hidden');
        }

        // Buscamos el teléfono del gestor en la base de datos para pintar el botón flotante
        const { data } = await supabaseClient
            .from('gestores')
            .select('telefono')
            .eq('nombre', dueno)
            .maybeSingle();

        if (data && data.telefono) {
            // Pintamos el botón de WhatsApp con la cara/nombre del gestor dueño
            renderFloatingWA(dueno, data.telefono);
        }
    } else if (status) {
        status.className = 'mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black leading-relaxed text-blue-700';
        status.textContent = window.gestorName
            ? 'Nuevo cliente: quedará protegido para ti cuando registres su primer pedido.'
            : 'Cliente nuevo: su asesor quedará asociado cuando complete el pedido.';
        status.classList.remove('hidden');
    }
}
// === MOTOR DEL PROYECTO RADAR (MODO ESPIA) ===

// 1. Función Maestra de Rastreo
// === SENSORES DE INTELIGENCIA v3.0 (MODO DIOS) ===
let tiempoInicioLectura = 0;
let productoActualLectura = "";



let searchSpyTimer;
function filterProducts() {
    renderProducts(); // Rapidez visual

    const term = document.getElementById('search-bar').value.trim();
    clearTimeout(searchSpyTimer);

    // Solo enviamos al radar si hay 3 letras o más Y el usuario paró de escribir 1.2 segundos
    if (term.length >= 3) {
        searchSpyTimer = setTimeout(() => {
            trackSpy('BUSQUEDA', term);
        }, 1200);
    }
}

// 1. trackSpy mejorado para esperar al gestor
async function trackSpy(accion, detalle, duracion = 0) {
    // 1. PORTERO: Si estamos redirigiendo, CALLARSE.
    if (sessionStorage.getItem('pth_redirecting') === 'true') return;

    try {
        // 2. ESPERA INTELIGENTE: Si es inicio de sesión, dar tiempo a que cargue la memoria
        if (accion === 'INICIO_SESION') await new Promise(r => setTimeout(r, 1500));

        // 3. RECUPERACIÓN DE GESTOR (Jerarquía estricta)
        let gestorFinal = 'Directo';

        // A. Memoria Inteligente (Link Corto)
        const refSmart = JSON.parse(localStorage.getItem('pth_referrer_smart'));
        if (refSmart && refSmart.nombre) {
            gestorFinal = refSmart.nombre;
        } else {
            // B. Memoria Histórica
            const refOld = JSON.parse(localStorage.getItem('pth_referrer'));
            if (refOld && refOld.nombre) {
                gestorFinal = refOld.nombre;
            } else {
                // C. Último recurso: IP (Plan B)
                const ipOwner = await buscarDuenoPorIP();
                if (ipOwner) gestorFinal = ipOwner;
            }
        }

        const { ip } = await fetch('https://api.ipify.org?format=json').then(r => r.json());

        await supabaseClient.from('log_espia').insert([{
            ip: ip,
            accion: accion,
            detalle: detalle,
            duracion: duracion,
            gestor_atribuido: gestorFinal,
            dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? 'Móvil' : 'PC'
        }]);
    } catch (e) { console.log("Radar en espera..."); }
}

// 2. captureGhostLead blindado contra duplicados
let ghostTimer;
function captureGhostLead() {
    clearTimeout(ghostTimer);
    ghostTimer = setTimeout(async () => {
        const nombre = document.getElementById('check-nombre').value.trim();
        const telRaw = document.getElementById('check-tel').value.trim();

        // Limpieza de teléfono
        let telLimpio = telRaw.replace(/\D/g, '');
        if (telLimpio.startsWith('53') && telLimpio.length > 8) telLimpio = telLimpio.substring(2);

        if (telLimpio.length < 8) return; // Esperar a que termine de escribir

        // --- LÓGICA DE ASIGNACIÓN DE DUEÑO ---
        let gestorAtribuido = 'Directo';

        // 1. Verificar si este teléfono YA tiene dueño en la base de datos (Amarre)
        const binding = await findPermanentCustomerOwner(telLimpio);

        if (binding && binding.agent_name) {
            gestorAtribuido = binding.agent_name; // ¡Es de un gestor, rescatarlo para él!
        } else {
            // 2. Si no tiene amarre, mirar la memoria local
            const ref = JSON.parse(localStorage.getItem('pth_referrer_smart'));
            if (ref && ref.nombre) {
                gestorAtribuido = ref.nombre;
            }
        }

        const prodNames = cart.map(i => i.nombre).join(', ');

        // Guardar o Actualizar en Leads Fantasma
        await supabaseClient.from('leads_fantasma').upsert([{
            telefono: telLimpio,
            nombre: nombre,
            producto_en_carrito: prodNames || 'Viendo Catálogo',
            gestor_atribuido: gestorAtribuido,
            completado: false // Marcar como pendiente
        }], { onConflict: 'telefono' });

    }, 2000);
}

    async function openMarketingAI() {
    // 1. Validaciones de Acceso (NIVEL 3 o MODO DIOS)
    const level = window.currentGestorLevel || 0;
    trackSpy('USO_HERRAMIENTA', 'Redactor IA');

    // Si NO es Marcel Y tiene menos de nivel 3...
    if (window.gestorName !== "Marcel Montano" && window.gestorName !== "Diana" && level < 3) {
    return alert("🔒 HERRAMIENTA BLOQUEADA\n\nNecesitas ser Nivel 3 (Élite - 20 Ventas) para usar el Redactor IA.");
    }

    const btn = event.currentTarget;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<span class="loader w-4 h-4 border-white"></span>`;
    btn.disabled = true;

    try {
        // 2. Identificar el contexto
        const searchInput = document.getElementById('search-bar');
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const gestor = window.gestorName || 'Ventas';
        const tel = getAgentPhone(); // Tu función que obtiene el tel del gestor

        // Filtrar productos
        let productsToPromote = productosRaw.filter(p => {
            const matchSearch = p.nombre.toLowerCase().includes(query);
            const matchCat = activeCategory === 'TODOS' || (p.categoria && p.categoria.toUpperCase().includes(activeCategory));
            return matchSearch && matchCat && p.disponible === 'SI';
        });

        if (productsToPromote.length === 0) throw new Error("No hay productos visibles para promocionar.");

        // Limitar a 15 productos máximo para no saturar
        if (productsToPromote.length > 15) {
            productsToPromote = productsToPromote.slice(0, 15);
            if(!confirm(`Hay muchos productos. La IA usará los primeros 15 para el post. ¿Continuar?`)) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
                return;
            }
        }

        // =========================================================
        // 3. Preparar la "Maleta" de datos (Payload)
        // AQUÍ ES DONDE PEGAMOS TU CÓDIGO DE LINKS CORTOS
        // =========================================================

        const preparedProducts = [];

        for (const p of productsToPromote) {
             const cleanName = encodeURIComponent(p.nombre.trim());
             const longLink = `${window.location.origin}${window.location.pathname}?search=${cleanName}&ref=${encodeURIComponent(gestor)}&contact=${tel}`;

             // Intentamos generar corto, si falla usamos largo
             let finalLink = longLink;
             try {
                // Verificamos si la función existe antes de llamarla
                if(typeof getOrGenerateShortLink === 'function') {
                    finalLink = await getOrGenerateShortLink(gestor, longLink);
                }
             } catch(e) {
                 console.log("Error generando link corto, usando largo.");
             }

             preparedProducts.push({
                name: p.nombre,
                price: p.precio,
                category: p.categoria,
                link: finalLink
             });
        }

        // =========================================================
        // AÑADIMOS EL TELÉFONO AQUÍ PARA QUE LA IA LO LEA
        // =========================================================

        const payload = {
            timestamp: Date.now(),
            agent: gestor,
            phone: tel,            // <---- ESTA ES LA MAGIA NUEVA AÑADIDA
            category: activeCategory,
            products: preparedProducts
        };

        // 4. Guardar en LocalStorage
        localStorage.setItem('pth_marketing_payload', JSON.stringify(payload));

        // 5. Abrir la página de la IA
        window.open('marketing-ai.html', '_blank');

    } catch (e) {
        alert("⚠️ " + e.message);
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
}

// ESTA FUNCIÓN YA LA TIENES, PERO ASEGÚRATE QUE ESTÉ ASÍ:
// Se usa en el Checkout para verificar si el cliente tiene dueño
async function checkCustomerOwnership(phone) {
    if (!phone) return null;
    try {
        const binding = await findPermanentCustomerOwner(phone);
        if (binding?.agent_name) {
            console.log("💎 PROTECCIÓN DETECTADA: Comisión para", binding.agent_name);
            return binding.agent_name;
        }
    } catch (e) { console.error(e); }
    return null;
}

function renderLockedRanking(allPedidos, nombreGestor) {
    const container = document.getElementById('ranking-list');
    if (!container) return;

    // 1. Verificar Nivel
    const salesCount = window.gestorSalesCount || 0;
    const currentLevel = window.currentGestorLevel || 0;
    const NIVEL_REQUERIDO = 4; // Monarca
    const VENTAS_REQUERIDAS = 40;

    // CASO A: MODO DIOS O NIVEL SUFICIENTE -> MOSTRAR TODO
    if (nombreGestor === "Marcel Montano" || window.isAdmin || window.PTHWorkView.canSwitch(window.currentUserData) || currentLevel >= NIVEL_REQUERIDO) {
        renderRankingAnonimo(allPedidos, nombreGestor);
        return;
    }

    // CASO B: BLOQUEADO (Efecto Borroso)
    const faltan = Math.max(1, VENTAS_REQUERIDAS - salesCount);

    container.innerHTML = `
    <div class="relative w-full h-64 bg-[#020617] rounded-xl overflow-hidden border border-slate-700 group cursor-pointer" onclick="alert('🔒 RANKING GLOBAL BLOQUEADO\\n\\nNecesitas ser NIVEL 4 (Monarca) para ver la competencia.\\n\\n📉 Te faltan: ${faltan} ventas.')">

        <!-- Fondo Falso Borroso (Simulación) -->
        <div class="absolute inset-0 p-4 space-y-4 opacity-30 blur-md select-none pointer-events-none filter grayscale">
            ${[1,2,3,4].map(i => `
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <div class="flex gap-2"><span class="w-8 h-8 bg-slate-700 rounded-full"></span><div class="h-4 w-32 bg-slate-700 rounded"></div></div>
                <div class="h-6 w-16 bg-slate-700 rounded"></div>
            </div>`).join('')}
        </div>

        <!-- Capa de Bloqueo (Overlay) -->
        <div class="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50 hover:bg-black/60 transition-all">

            <div class="relative">
                <span class="material-symbols-outlined text-6xl text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">lock</span>
                <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">LVL 4</div>
            </div>

            <h3 class="mt-4 text-xl font-black text-white uppercase tracking-widest italic">CLASIFICADO</h3>
            <p class="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Ranking Global de Agentes</p>

            <div class="mt-4 px-4 py-2 bg-slate-800/90 border border-slate-600 rounded-lg backdrop-blur-md transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <p class="text-xs text-center text-white">
                    <span class="text-red-400 font-black">BLOQUEADO:</span> Te faltan <span class="text-white font-black text-lg">${faltan}</span> ventas<br>
                    para espiar a la competencia.
                </p>
            </div>
        </div>
    </div>`;
}
async function renderRescueMissions(nombreGestor) {
    // 1. Buscar Leads Fantasma de ESTE gestor que NO han comprado hoy
    const { data: leads, error } = await supabaseClient
        .from('leads_fantasma')
        .select('*')
        .eq('gestor_atribuido', nombreGestor)
        .eq('completado', false) // Asumiendo que tienes una columna boolean 'completado'
        .order('timestamp', { ascending: false })
        .limit(5);

    if (error || !leads || leads.length === 0) return;

    // 2. Buscar si alguno ya compró (para no mostrar falsas alarmas)
    // Traemos los teléfonos de los pedidos de hoy de este gestor
    const { data: pedidosHoy } = await supabaseClient
        .from('pedidos')
        .select('telefono')
        .eq('gestor', nombreGestor)
        .gte('fecha', new Date().toISOString().split('T')[0]);

    const telefonosCompradores = new Set(pedidosHoy.map(p => p.telefono.replace(/\D/g, '').slice(-8)));

    // Filtramos los leads que YA están en pedidos
    const leadsReales = leads.filter(l => {
        const telLead = l.telefono.replace(/\D/g, '').slice(-8);
        return !telefonosCompradores.has(telLead);
    });

    if (leadsReales.length === 0) return;

    // 3. Crear el HTML de Alerta
    const container = document.getElementById('sub-dash-resumen');

    // Eliminar alerta previa si existe
    const oldAlert = document.getElementById('rescue-mission-alert');
    if(oldAlert) oldAlert.remove();

    let htmlLeads = leadsReales.map(l => {
        const tel = l.telefono;
        const nombre = l.nombre || "Cliente";
        const prod = l.producto_en_carrito || "Algo";
        const msg = `Hola ${nombre}, vi que intentabas pedir el ${prod} pero no se completó. ¿Te dio algún error?`;

        return `
        <div class="flex justify-between items-center bg-red-900/30 p-2 rounded-lg border border-red-500/30 mb-2">
            <div>
                <p class="text-xs font-black text-white uppercase">${nombre}</p>
                <p class="text-[10px] text-red-200">${prod}</p>
            </div>
            <a href="https://wa.me/53${tel}?text=${encodeURIComponent(msg)}" target="_blank"
               class="bg-green-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform animate-pulse">
                <i class="fab fa-whatsapp"></i>
            </a>
        </div>`;
    }).join('');

    const htmlAlert = `
    <div id="rescue-mission-alert" class="mb-6 bg-gradient-to-r from-red-600 to-red-800 p-4 rounded-2xl shadow-xl shadow-red-900/50 border border-red-400 relative overflow-hidden">
        <div class="absolute -right-4 -top-4 opacity-20"><span class="material-symbols-outlined text-8xl text-white">emergency_share</span></div>
        <div class="relative z-10">
            <h3 class="text-white font-black uppercase italic text-sm mb-1 flex items-center gap-2">
                <span class="animate-ping w-2 h-2 bg-white rounded-full"></span> Misión de Rescate
            </h3>
            <p class="text-[10px] text-red-100 mb-3 font-medium">Estos clientes pusieron sus datos en TU LINK pero no enviaron el WhatsApp. ¡Contáctalos ya!</p>
            <div class="space-y-1">
                ${htmlLeads}
            </div>
        </div>
    </div>`;

    container.insertAdjacentHTML('afterbegin', htmlAlert);
}

// Función para abrir WhatsApp y consultar costo de envío
function consultarMensajeria(nombreProd) {
    // 1. Recuperar datos del gestor inteligente
    const stored = localStorage.getItem('pth_referrer_smart');
    let telefonoDestino = "5356071095"; // Tu número de respaldo
    let nombreAgente = "Soporte";

    if (stored) {
        try {
            const data = JSON.parse(stored);
            if (data.telefono) {
                let t = data.telefono.replace(/\D/g, '');
                if (t.length === 8) t = "53" + t; // Formato Cuba
                telefonoDestino = t;
                nombreAgente = data.nombre || "Agente";
            }
        } catch (e) { console.error(e); }
    }

    const texto = `Hola ${nombreAgente}, estoy haciendo el pedido de: *${nombreProd}*. El sistema me pide el costo de envío. ¿Me lo puedes indicar?`;
    window.open(`https://wa.me/${telefonoDestino}?text=${encodeURIComponent(texto)}`, '_blank');
}

// --- FUNCIÓN PARA ELIMINAR PEDIDO (GESTOR) ---
// --- FUNCIÓN PARA CANCELAR PEDIDO (ANTES ELIMINAR) ---
// MODIFICADO: Ahora cambia el estado a "Cancelado" en lugar de borrar el registro
async function deleteMyOrder(id) {
    // 1. Confirmación clara para el gestor
    if (!confirm("⚠️ ¿Estás seguro de CANCELAR este pedido?\n\nEl pedido NO se borrará de la base de datos, pero pasará a estado 'Cancelado' y saldrá de tu lista de pendientes.")) return;

    try {
        // 2. CAMBIO CLAVE: Usamos .update() en lugar de .delete()
        const { error } = await supabaseClient
            .from('pedidos')
            .update({ estado: 'Cancelado' }) // <--- Aquí está la magia
            .eq('id', id);

        if (error) throw error;

        // 3. Éxito visual
        alert("🗑️ Pedido marcado como Cancelado.");

        // 4. Actualizar la memoria local para que la interfaz reaccione al instante
        if (typeof myOrdersData !== 'undefined') {
            // Buscamos el pedido en la lista local y le cambiamos el estado
            const index = myOrdersData.findIndex(p => p.id === id);
            if (index !== -1) {
                myOrdersData[index].estado = 'Cancelado';
            }

            // Re-renderizamos la lista.
            // Como el filtro actual seguramente es 'Pendiente', el pedido desaparecerá de la vista automáticamente.
            renderMyOrdersList(myOrdersData);
        } else {
            // Si por alguna razón falla la memoria local, recargamos todo el dashboard
            const gestor = window.gestorName;
            if(gestor) loadProDashboard(gestor);
        }

    } catch (e) {
        console.error(e);
        alert("❌ Error al cancelar: " + e.message);
    }
}

// --- REENVIAR PEDIDO MANUAL (UNIFICADA - GESTORES Y SUBGESTORES) ---
async function reenviarPedidoAdmin(id) {
    const p = myOrdersData.find(item => item.id === id);
    if (!p) return alert("Error: No se encuentran los datos del pedido.");

    // Establecer destino por defecto (La tienda / Elizabeth)
    const PHONE_DUENO = "5356071095";
    let whatsappDestino = PHONE_DUENO;

    // Comprobamos si el usuario actual es un subgestor
    const esSubgestor = window.currentUserData && window.currentUserData.parent_id;

    // Si es subgestor, el reenvío viaja hacia su Gestor Principal (Elías, etc.)
    if (esSubgestor && window.currentUserData.parent_telefono) {
        let parentTel = window.currentUserData.parent_telefono.replace(/\D/g, '');
        if (parentTel.length === 8) parentTel = "53" + parentTel;
        whatsappDestino = parentTel;
        console.log("➡️ Reenvío del subgestor dirigido a su Gestor Principal:", parentTel);
    }

    const fecha = new Date(p.fecha).toLocaleDateString();
    const total = parseFloat(p.total) || 0;
    const envio = parseFloat(p.costo_mensajeria) || 0;
    const precioEquipos = total - envio;

    // PARSEO DE LA DIRECCIÓN PARA EXTRAER NOTAS Y LOCALIDAD
    let dir = p.direccion || "";
    let localidad = "";
    let notas = "";
    let metodoPago = "";
    let vuelto = "";

    const notaMatch = dir.match(/\[NOTA:\s*(.*?)\]/i);
    if (notaMatch) {
        notas = notaMatch[1];
        dir = dir.replace(notaMatch[0], "").trim();
    }

    const locMatch = dir.match(/\((.*?)\)$/);
    if (locMatch) {
        localidad = locMatch[1];
        dir = dir.replace(locMatch[0], "").trim();
    }

    const pagoMatch = notas.match(/\[PAGO:\s*(.*?)\]/i);
    if (pagoMatch) {
        metodoPago = pagoMatch[1];
        notas = notas.replace(pagoMatch[0], "").trim();
    }

    const vueltoMatch = notas.match(/\[VUELTO:\s*(.*?)\]/i);
    if (vueltoMatch) {
        vuelto = vueltoMatch[1];
        notas = notas.replace(vueltoMatch[0], "").trim();
    }

    let mensaje = `🧾 *REENVÍO PEDIDO #${p.orden_dia || '---'}*\n📅 Fecha: ${fecha}\n\n`;
    mensaje += `👤 *CLIENTE*\nNombre: ${p.cliente}\nTel: ${p.telefono}\nDirección: ${dir}\n`;

    if (localidad) {
        mensaje += `📍 Zona: ${localidad}, ${p.municipio || ''}\n`;
    } else {
        mensaje += `📍 Zona: ${p.municipio || ''}\n`;
    }

    if (p.ci && p.ci !== "No especificado") mensaje += `CI: ${p.ci}\n`;
    mensaje += `\n`;

    if (notas) {
        mensaje += `📝 *NOTAS / OBSERVACIONES:*\n${notas}\n\n`;
    }

    mensaje += `🛒 *DETALLE*\n`;
    const productosLineas = p.producto.split(' + ');
    productosLineas.forEach(prod => {
        mensaje += `📦 ${prod}\n`;
    });

    if (productosLineas.length === 1) {
         mensaje += `💵 Equipo: $${precioEquipos}\n\n`;
    } else {
         mensaje += `💵 Equipos (Subtotal): $${precioEquipos}\n\n`;
    }

    mensaje += `💰 *TOTAL A PAGAR: $${total} USD*\n`;
    mensaje += `(Equipos: $${precioEquipos} + Envío: $${envio})\n`;

    if (metodoPago) {
        mensaje += `💳 *MÉTODO PAGO:* ${metodoPago}\n`;
    }
    if (vuelto) {
        mensaje += `⚠️ *OJO VUELTO:* Necesita vuelto de $${vuelto}\n`;
    }

    const miTel = getAgentPhone();
    mensaje += `\n------------------------------------\n👮‍♂️ *DATOS INTERNOS*`;

    if (esSubgestor) {
        // El subgestor envía a su principal informando su propia comisión y nombre
        mensaje += `\nComercial: ${window.currentUserData.nombre}\n`;
        mensaje += `Comisión: $${p.comision_total}\n`; // Mostrará su comisión correspondiente ($8)
        mensaje += `Tel Comercial: ${miTel}\n`;
    } else {
        // El principal envía a la tienda informando la comisión total de la orden
        mensaje += ` (SOLO ALMACÉN)\nComercial: ${p.gestor}\nComisión: $${p.comision_total}\nTel Comercial: ${miTel}\n`;
    }

    window.open(`https://api.whatsapp.com/send?phone=${whatsappDestino}&text=${encodeURIComponent(mensaje)}`, '_blank');
}

// --- FUNCIÓN PARA REENVIAR VALE (DESDE ADMIN) ---
function reenviarValeAdmin(id) {
    // 1. Buscar el pedido en la lista maestra del Admin
    const p = pedidosRawAdmin.find(item => item.id === id);

    if (!p) return alert("Error: No se encuentran los datos del pedido en memoria.");

    // 2. Definir el número destino (La Central / Tu número)
    const PHONE_CENTRAL = "5356071095";

    // 3. Cálculos matemáticos inversos (Para desglosar el total)
    const totalCobrar = parseFloat(p.total) || 0;
    const envio = parseFloat(p.costo_mensajeria) || 0;
    const precioEquipos = totalCobrar - envio;

    // 4. Construir el mensaje (Idéntico al del carrito)
    let mensaje = `🧾 *REENVÍO MANUAL (ADMIN) #${p.orden_dia || '---'}*\n`;
    mensaje += `📅 Fecha: ${new Date(p.fecha).toLocaleDateString()}\n\n`;

    mensaje += `👤 *CLIENTE*\n`;
    mensaje += `Nombre: ${p.cliente}\n`;
    mensaje += `Tel: ${p.telefono}\n`;
    mensaje += `Dirección: ${p.direccion}, ${p.municipio}\n`;

    if(p.ci && p.ci !== "No especificado") {
        mensaje += `CI: ${p.ci}\n`;
    }

    mensaje += `\n🛒 *DETALLE*\n`;
    mensaje += `📦 ${p.producto}\n\n`;

    mensaje += `💰 *TOTAL A PAGAR: $${totalCobrar} USD*\n`;
    mensaje += `(Equipos: $${precioEquipos} + Envío: $${envio})\n`;

    // Datos internos para que el almacén sepa de quién es
    mensaje += `\n------------------------------------\n`;
    mensaje += `👮‍♂️ *DATOS INTERNOS*\n`;
    mensaje += `Comercial: ${p.gestor}\n`;
    mensaje += `Comisión: $${p.comision_total}\n`;

    // 5. Enviar
    // Usamos api.whatsapp.com para asegurar que abra en PC y Móvil
    const url = `https://api.whatsapp.com/send?phone=${PHONE_CENTRAL}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

async function obtenerTelefonoGestor(gestorName) {
    if (!gestorName || gestorName === 'Venta Directa') return null;
    try {
        const { data } = await supabaseClient
            .from('gestores')
            .select('telefono')
            .eq('nombre', gestorName)
            .maybeSingle();
        if (data) return data.telefono;
    } catch(e) {}
    return null;
}



// --- FUNCIÓN PARA REENVIAR VALE (DESDE ADMIN) ---
async function reenviarValeAdmin(id) {
    // 1. Buscar el pedido en la lista maestra del Admin
    const p = pedidosRawAdmin.find(item => item.id === id);

    if (!p) return alert("Error: No se encuentran los datos del pedido en memoria.");

    // 2. Definir el número destino (La Central / Tu número)
    const PHONE_CENTRAL = "5356071095";

    // 3. Cálculos matemáticos inversos (Para desglosar el total)
    const totalCobrar = parseFloat(p.total) || 0;
    const envio = parseFloat(p.costo_mensajeria) || 0;
    const precioEquipos = totalCobrar - envio;

    // PARSEO DE LA DIRECCIÓN PARA EXTRAER NOTAS Y LOCALIDAD
    let dir = p.direccion || "";
    let localidad = "";
    let notas = "";
    let metodoPago = "";
    let vuelto = "";

    const notaMatch = dir.match(/\[NOTA:\s*(.*?)\]/i);
    if (notaMatch) {
        notas = notaMatch[1];
        dir = dir.replace(notaMatch[0], "").trim();
    }

    const locMatch = dir.match(/\((.*?)\)$/);
    if (locMatch) {
        localidad = locMatch[1];
        dir = dir.replace(locMatch[0], "").trim();
    }

    const pagoMatch = notas.match(/\[PAGO:\s*(.*?)\]/i);
    if (pagoMatch) {
        metodoPago = pagoMatch[1];
        notas = notas.replace(pagoMatch[0], "").trim();
    }

    const vueltoMatch = notas.match(/\[VUELTO:\s*(.*?)\]/i);
    if (vueltoMatch) {
        vuelto = vueltoMatch[1];
        notas = notas.replace(vueltoMatch[0], "").trim();
    }

    // 4. Construir el mensaje
    let mensaje = `🧾 *REENVÍO MANUAL (ADMIN) #${p.orden_dia || '---'}*\n`;
    mensaje += `📅 Fecha: ${new Date(p.fecha).toLocaleDateString()}\n\n`;

    mensaje += `👤 *CLIENTE*\n`;
    mensaje += `Nombre: ${p.cliente}\n`;
    mensaje += `Tel: ${p.telefono}\n`;
    mensaje += `Dirección: ${dir}\n`;

    if (localidad) {
        mensaje += `📍 Zona: ${localidad}, ${p.municipio || ''}\n`;
    } else {
        mensaje += `📍 Zona: ${p.municipio || ''}\n`;
    }

    if(p.ci && p.ci !== "No especificado") {
        mensaje += `CI: ${p.ci}\n`;
    }
    mensaje += `\n`;

    if (notas) {
        mensaje += `📝 *NOTAS / OBSERVACIONES:*\n${notas}\n\n`;
    }

    mensaje += `🛒 *DETALLE*\n`;

    const productosLineas = p.producto.split(' + ');
    productosLineas.forEach(prod => {
        mensaje += `📦 ${prod}\n`;
    });

    if (productosLineas.length === 1) {
         mensaje += `💵 Equipo: $${precioEquipos}\n\n`;
    } else {
         mensaje += `💵 Equipos (Subtotal): $${precioEquipos}\n\n`;
    }

    mensaje += `💰 *TOTAL A PAGAR: $${totalCobrar} USD*\n`;
    mensaje += `(Equipos: $${precioEquipos} + Envío: $${envio})\n`;

    if (metodoPago) {
        mensaje += `💳 *MÉTODO PAGO:* ${metodoPago}\n`;
    }
    if (vuelto) {
        mensaje += `⚠️ *OJO VUELTO:* Necesita vuelto de $${vuelto}\n`;
    }

    // Datos internos para que el almacén sepa de quién es
    mensaje += `\n------------------------------------\n`;
    mensaje += `👮‍♂️ *DATOS INTERNOS*\n`;
    mensaje += `Comercial: ${p.gestor}\n`;
    mensaje += `Comisión: $${p.comision_total}\n`;

    const telGestor = await obtenerTelefonoGestor(p.gestor);
    if (telGestor) {
        mensaje += `Tel Comercial: ${telGestor}\n`;
    }

    // 5. Enviar
    const url = `https://api.whatsapp.com/send?phone=${PHONE_CENTRAL}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// --- LÓGICA DE REPORTE DE PRODUCTOS VENDIDOS ---

let productSalesStats = []; // Variable para guardar el cálculo

function calculateProductSales() {
    if (!pedidosRawAdmin || !productosRaw) return;

    const conteo = {};

    // Obtener valores de los filtros de fecha
    const desde = document.getElementById('vp-fecha-desde').value;
    const hasta = document.getElementById('vp-fecha-hasta').value;

    pedidosRawAdmin.forEach(p => {
        // 1. Filtro de Estado: Solo entregados
        if (p.estado !== 'Entregado') return;

        // 2. FILTRO DE TIEMPO
        const fechaPedido = p.fecha.split(' ')[0]; // Extrae solo YYYY-MM-DD del string de fecha
        if (desde && fechaPedido < desde) return;
        if (hasta && fechaPedido > hasta) return;

        const lineas = p.producto.split('+');
        lineas.forEach(linea => {
            const limpia = linea.trim();
            const match = limpia.match(/^(\d+)x\s+(.+?)(\[|$)/);

            if (match) {
                const qty = parseInt(match[1]);
                const nombreExtraido = match[2].trim();
                const nameKey = nombreExtraido.toUpperCase();

                const prodInfo = productosRaw.find(pr => pr.nombre.trim() === nombreExtraido);
                const precioUnitario = prodInfo ? parseFloat(prodInfo.precio) : 0;

                if (!conteo[nameKey]) {
                    conteo[nameKey] = {
                        nombreReal: nombreExtraido,
                        cantidad: 0,
                        ingresos: 0
                    };
                }

                conteo[nameKey].cantidad += qty;
                conteo[nameKey].ingresos += (qty * precioUnitario);
            }
        });
    });

    productSalesStats = Object.values(conteo).sort((a, b) => b.cantidad - a.cantidad);
    renderProductSalesTable();
}

function renderProductSalesTable() {
    const container = document.getElementById('list-ventas-prod');
    const search = document.getElementById('search-ventas-prod').value.toLowerCase();

    if (!container) return;

    // Filtrar por buscador
    const filtered = productSalesStats.filter(item =>
        item.nombreReal.toLowerCase().includes(search)
    );

    // Actualizar contadores superiores
    const totalUnidades = filtered.reduce((acc, item) => acc + item.cantidad, 0);
    document.getElementById('vp-total-unidades').innerText = totalUnidades;
    document.getElementById('vp-total-variedad').innerText = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-400 font-bold text-xs">No hay datos.</td></tr>`;
        return;
    }

    // Calcular el máximo para la barra de porcentaje
    const maxQty = productSalesStats.length > 0 ? productSalesStats[0].cantidad : 1;

    container.innerHTML = filtered.map((item, index) => {
        // Porcentaje relativo al más vendido
        const percent = Math.round((item.cantidad / maxQty) * 100);

        // Colores del ranking
        let rankBadge = `<span class="text-gray-400 font-bold">#${index + 1}</span>`;
        if (index === 0) rankBadge = `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-[10px] font-black border border-yellow-200">🥇 TOP 1</span>`;
        if (index === 1) rankBadge = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-[10px] font-black border border-gray-200">🥈 TOP 2</span>`;
        if (index === 2) rankBadge = `<span class="bg-orange-50 text-orange-600 px-2 py-1 rounded-full text-[10px] font-black border border-orange-100">🥉 TOP 3</span>`;

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-colors border-b dark:border-gray-700">
            <td class="p-4 text-center align-middle">${rankBadge}</td>
            <td class="p-4 align-middle">
                <p class="text-xs font-black text-slate-700 dark:text-white uppercase">${item.nombreReal}</p>
            </td>
            <td class="p-4 text-center align-middle">
                <span class="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                    ${item.cantidad}
                </span>
            </td>
            <td class="p-4 align-middle w-1/3">
                <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div class="bg-indigo-500 h-2.5 rounded-full" style="width: ${percent}%"></div>
                </div>
                <p class="text-[9px] text-gray-400 text-right mt-1 font-bold">${percent}% del líder</p>
            </td>
        </tr>`;
    }).join('');
}

// --- FUNCIÓN PARA PREVISUALIZAR IMAGEN DESDE EL REPO DE FOTOS ---
function previewGithubImage(index) {
    const input = document.getElementById(`img-path-${index}`);
    const img = document.getElementById(`prev-github-${index}`);
    const icon = document.getElementById(`icon-github-${index}`);

    // Obtenemos lo que escribieron en el campo de texto
    const fileName = input.value.trim();

    if (fileName) {
        // === CONFIGURACIÓN DEL NUEVO ALMACÉN ===
        const GITHUB_USER = 'paratuhogar';
        const REPO = 'paratuhogar-fotos'; // <--- ESTO ES LO IMPORTANTE
        const BRANCH = 'main';

        // Construimos la URL directa a la imagen
        const fullUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/${BRANCH}/img_productos/${fileName}`;

        // 1. Asignamos la URL a la etiqueta <img>
        img.src = fullUrl;
        img.classList.remove('hidden'); // Mostramos la imagen
        icon.classList.add('hidden');   // Ocultamos el icono

        // 2. Manejo de ERRORES (Si escribieron mal el nombre o la foto no se ha subido)
        img.onerror = function() {
            img.classList.add('hidden');        // Ocultar la imagen rota
            icon.classList.remove('hidden');    // Mostrar icono de nuevo
            icon.innerText = "broken_image";    // Cambiar icono a "imagen rota"
            icon.classList.add('text-red-400'); // Ponerlo en rojo para avisar
        };

        // 3. Manejo de ÉXITO (Si la foto carga bien)
        img.onload = function() {
            icon.classList.remove('text-red-400'); // Quitar el rojo por si acaso
        };

    } else {
        // Si el campo está vacío (borraron el texto), reseteamos todo
        img.src = "";
        img.classList.add('hidden');
        icon.classList.remove('hidden');
        icon.innerText = "image"; // Icono normal
        icon.classList.remove('text-red-400');
    }
}

// ==========================================
// 🚚 MOTOR DE MENSAJERÍA AUTOMÁTICA
// ==========================================

// Variable global que ahora se llenará desde Supabase
let tarifasMensajeria = {};
let tarifasMensajeriaAdminRaw =[]; // Para el panel de administrador

// ==========================================
// MÓDULO DE MENSAJERÍA (CONECTADO A SUPABASE)
// ==========================================

// 1. CARGAR DATOS (Se llama al cargar la página)
async function loadTarifasMensajeria() {
    const { data, error } = await supabaseClient.from('tarifas_mensajeria').select('*').order('municipio', { ascending: true });

    if (error || !data) return console.error("Error cargando tarifas");

    tarifasMensajeriaAdminRaw = data;
    tarifasMensajeria = {}; // Reseteamos el objeto

    // Reconstruimos el objeto para que la lógica del Carrito siga funcionando igual que antes
    const listaMunicipiosUnicos = new Set();

    data.forEach(item => {
        if (!tarifasMensajeria[item.municipio]) {
            tarifasMensajeria[item.municipio] = {};
        }
        // Creamos la estructura { pq: 6, gr: 10 }
        tarifasMensajeria[item.municipio][item.localidad] = {
            pq: parseFloat(item.precio_pequeno) || 0,
            gr: parseFloat(item.precio_grande) || 0,
            id: item.id
        };
        listaMunicipiosUnicos.add(item.municipio);
    });

    // Actualizamos el desplegable (Select) de Municipios en el Checkout
    const muniSelect = document.getElementById('check-municipio');
    if (muniSelect) {
        muniSelect.innerHTML = '<option value="" disabled selected>Seleccionar Municipio...</option>';
        Array.from(listaMunicipiosUnicos).sort().forEach(muni => {
            muniSelect.innerHTML += `<option value="${muni}">${muni}</option>`;
        });
    }

    // Actualizamos Datalist del Admin para sugerir municipios existentes
    const datalistMuni = document.getElementById('list-municipios');
    if (datalistMuni) {
        datalistMuni.innerHTML = Array.from(listaMunicipiosUnicos).sort().map(m => `<option value="${m}">`).join('');
    }

    // Si el admin está logueado, dibujamos la tabla
    renderAdminMensajeria();
}

// Para asegurarnos de que cargue siempre al entrar a la web:
window.addEventListener('load', () => {
    loadTarifasMensajeria();
});


// 2. DIBUJAR LA TABLA EN EL PANEL ADMIN
function renderAdminMensajeria() {
    const container = document.getElementById('list-admin-mensajeria');
    const searchInput = document.getElementById('search-mensajeria');
    if (!container) return;

    const query = searchInput ? searchInput.value.toLowerCase() : "";

    const filtradas = tarifasMensajeriaAdminRaw.filter(t =>
        t.municipio.toLowerCase().includes(query) ||
        t.localidad.toLowerCase().includes(query)
    );

    container.innerHTML = filtradas.map(t => `
        <tr class="hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-colors">
            <td class="p-4 align-middle">
                <span class="text-xs font-black text-gray-700 dark:text-gray-300 uppercase">${t.municipio}</span>
            </td>
            <td class="p-4 align-middle">
                <span class="text-[10px] font-bold text-gray-500">${t.localidad}</span>
            </td>
            <td class="p-4 text-center align-middle">
                <span class="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">$${t.precio_pequeno}</span>
            </td>
            <td class="p-4 text-center align-middle">
                <span class="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">$${t.precio_grande}</span>
            </td>
            <td class="p-4 text-right align-middle">
                <button onclick="adminEditMensajeria('${t.id}')" class="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm" title="Editar Precio">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onclick="adminDeleteMensajeria('${t.id}', '${t.localidad}')" class="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors shadow-sm ml-1" title="Eliminar Localidad">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </td>
        </tr>
    `).join('');
}

// 3. AGREGAR O EDITAR TARIFA
async function adminSaveMensajeria() {
    const id = document.getElementById('m-id-edit').value;
    const municipio = document.getElementById('m-municipio').value.trim();
    const localidad = document.getElementById('m-localidad').value.trim();
    const precio_pq = parseFloat(document.getElementById('m-precio-pq').value);
    const precio_gr = parseFloat(document.getElementById('m-precio-gr').value);

    if (!municipio || !localidad || isNaN(precio_pq) || isNaN(precio_gr)) {
        return alert("⚠️ Por favor completa todos los campos correctamente.");
    }

    const btn = document.getElementById('btn-save-mensajeria');
    const originalText = btn.innerText;
    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        if (id) {
            // EDITAR
            await supabaseClient.from('tarifas_mensajeria').update({
                municipio, localidad, precio_pequeno: precio_pq, precio_grande: precio_gr
            }).eq('id', id);
        } else {
            // CREAR NUEVO
            await supabaseClient.from('tarifas_mensajeria').insert([{
                municipio, localidad, precio_pequeno: precio_pq, precio_grande: precio_gr
            }]);
        }

        limpiarFormMensajeria();
        await loadTarifasMensajeria(); // Recargar datos desde la nube

    } catch(e) {
        alert("Error al guardar: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 4. ELIMINAR TARIFA
async function adminDeleteMensajeria(id, localidad) {
    if (!confirm(`¿Estás seguro de eliminar el costo de envío para "${localidad}"?`)) return;

    await supabaseClient.from('tarifas_mensajeria').delete().eq('id', id);
    loadTarifasMensajeria(); // Recargar de la nube
}

// 5. PREPARAR FORMULARIO PARA EDICIÓN
function adminEditMensajeria(id) {
    const tarifa = tarifasMensajeriaAdminRaw.find(t => t.id === id);
    if (!tarifa) return;

    document.getElementById('m-id-edit').value = tarifa.id;
    document.getElementById('m-municipio').value = tarifa.municipio;
    document.getElementById('m-localidad').value = tarifa.localidad;
    document.getElementById('m-precio-pq').value = tarifa.precio_pequeno;
    document.getElementById('m-precio-gr').value = tarifa.precio_grande;

    document.getElementById('mensajeria-form-title').innerText = "Editando Tarifa";
    document.getElementById('btn-save-mensajeria').innerText = "Actualizar Tarifa";
}

// 6. LIMPIAR FORMULARIO
function limpiarFormMensajeria() {
    document.getElementById('m-id-edit').value = "";
    document.getElementById('m-municipio').value = "";
    document.getElementById('m-localidad').value = "";
    document.getElementById('m-precio-pq').value = "";
    document.getElementById('m-precio-gr').value = "";

    document.getElementById('mensajeria-form-title').innerText = "Añadir Nueva Tarifa";
    document.getElementById('btn-save-mensajeria').innerText = "Guardar Tarifa";
}

// 7. BORRAR EL EVENTO VIEJO QUE INICIABA LOS MUNICIPIOS
// (Asegúrate de eliminar este bloque viejo de tu código para evitar duplicados):
/*
window.addEventListener('load', () => {
    const muniSelect = document.getElementById('check-municipio');
    if(muniSelect) {
        muniSelect.innerHTML = '<option value="" disabled selected>Seleccionar Municipio...</option>';
        Object.keys(tarifasMensajeria).forEach(muni => {
            muniSelect.innerHTML += `<option value="${muni}">${muni}</option>`;
        });
    }
});
*/


// 2. Función para actualizar repartos
window.actualizarLocalidades = function() {
    const municipio = document.getElementById('check-municipio').value;
    const locSelect = document.getElementById('check-localidad');

    locSelect.innerHTML = '<option value="" disabled selected>Seleccionar Reparto...</option>';

    if(municipio && tarifasMensajeria[municipio]) {
        locSelect.disabled = false;
        Object.keys(tarifasMensajeria[municipio]).forEach(loc => {
            locSelect.innerHTML += `<option value="${loc}">${loc}</option>`;
        });
    } else {
        locSelect.disabled = true;
    }
};

// 3. Detectar si hay un equipo grande en el carrito (Lee directo de Supabase)
function carritoTieneEquipoGrande() {
    return cart.some(item => {
        // Lee la etiqueta exacta de la base de datos. Si dice Grande, cobra como Grande.
        return item.tamaño_envio === 'Grande';
    });
}

// 4. Calcular el precio final de la mensajería
window.obtenerCostoMensajeriaGlobal = function() {
    // Si marcó recogida, el envío es 0
    const isRecogida = document.getElementById('check-recogida')?.checked;
    if (isRecogida) return 0;

    const municipio = document.getElementById('check-municipio')?.value;
    const localidad = document.getElementById('check-localidad')?.value;
    if (newCheckoutShippingOverride && newCheckoutShippingOverride.fingerprint === window.PTHLowConnectivity.fingerprint(cart) && newCheckoutShippingOverride.municipio === municipio && newCheckoutShippingOverride.localidad === localidad && !newCheckoutShippingOverride.pickup) return newCheckoutShippingOverride.cost;

    if (!municipio || !localidad) return 0;

    const tarifa = tarifasMensajeria[municipio][localidad];
    if(!tarifa) return 0;

    let costoBase = carritoTieneEquipoGrande() ? tarifa.gr : tarifa.pq;

    // =====================================================================
    // --- INICIO REGLAS ESPECÍFICAS PARA EL PROVEEDOR A ---
    // (Asegúrate de que 'A' coincida con cómo guardas el nombre en tu base de datos, ej: 'Importadora A')
    const esProveedorA = cart.some(item => (item.proveedor || "").toUpperCase() === 'A' || (item.proveedor || "").toUpperCase().includes('PROVEEDOR A'));

    if (esProveedorA) {

        // 🛑 ESPACIO PARA DECIDIR EL PRECIO DE EQUIPOS GRANDES (PROVEEDOR A)
        // Cambia el 'null' por el precio que decidas (ej: 15).
        // Si lo dejas en 'null', el sistema usará la tarifa normal grande que ya tenías.
        const PRECIO_EQUIPOS_GRANDES_PROVEEDOR_A = null;

        if (carritoTieneEquipoGrande()) {
            // Aplicar tarifa personalizada para equipos grandes si la definiste arriba
            if (PRECIO_EQUIPOS_GRANDES_PROVEEDOR_A !== null) {
                costoBase = PRECIO_EQUIPOS_GRANDES_PROVEEDOR_A;
            }
        } else {
            // LÓGICA PARA EQUIPOS PEQUEÑOS Y MEDIANOS (Aspiradoras)
            const tieneAspiradora = cart.some(item => (item.nombre || "").toUpperCase().includes('ASPIRADORA'));
            const municipiosLejos =['Plaza de la Revolución', 'Playa', 'Cotorro', 'Habana del Este'];
            // Nota: Vedado pertenece a Plaza de la Revolución; Miramar y Santa Fe pertenecen a Playa.

            if (tieneAspiradora && municipiosLejos.includes(municipio)) {
                // Aspiradoras hacia lugares lejos (Vedado, Playa, Cotorro, Habana del Este)
                costoBase = 10;
            } else if (municipio === 'Cotorro' || municipio === 'Habana del Este') {
                // Cotorro y Habana del Este base general en 10
                costoBase = 10;
            } else {
                // Equipos pequeños y aspiradoras a lugares cerca (San Miguel, Cerro, Centro Habana, etc.)
                costoBase = 6;
            }
        }
    }
    // --- FIN REGLAS PROVEEDOR A ---
    // =====================================================================

    const totalEquipos = cart.reduce((acc, item) => acc + item.qty, 0);

    // Si llevan más de 3 equipos, el envío sube un 50%
    if (totalEquipos > 3) {
        costoBase = costoBase * 1.5;
    }

    return costoBase;
};

window.toggleRecogidaEnAlmacen = function() {
    const isChecked = document.getElementById('check-recogida').checked;

    const muni = document.getElementById('check-municipio');
    const loc = document.getElementById('check-localidad');
    const dir = document.getElementById('check-dir');
    const btnCoordinar = document.getElementById('btn-coordinar-almacen');

    // Inteligencia: Detectar si es cliente orgánico (sin gestor asignado)
    const isLogged = !!localStorage.getItem('pth_session'); // ¿Es un admin logueado?
    const referrer = JSON.parse(localStorage.getItem('pth_referrer_smart')); // ¿Viene por link?
    const esClienteOrganico = !isLogged && (!referrer || !referrer.nombre || referrer.nombre === 'Venta Directa');

    if (isChecked) {
        muni.disabled = true; muni.required = false; muni.value = "";
        loc.disabled = true; loc.required = false; loc.innerHTML = '<option value="" disabled selected>No aplica</option>';
        dir.disabled = true; dir.required = false; dir.value = "Recogida en Almacén";

        // Si no tiene gestor, le mostramos el botón directo al administrador
        if (esClienteOrganico && btnCoordinar) {
            btnCoordinar.classList.remove('hidden');
        }
    } else {
        muni.disabled = false; muni.required = true;
        dir.disabled = false; dir.required = true; dir.value = "";
        actualizarLocalidades();

        // Ocultar botón si desmarca la casilla
        if (btnCoordinar) {
            btnCoordinar.classList.add('hidden');
        }
    }
    recalcularTotalFinal(); // Actualiza el precio al instante
};

// ==========================================
// LÓGICA DEL BUZÓN DE INTELIGENCIA (ADMIN)
// ==========================================
let reportesAdminRaw = [];

function formatTeamReportDate(value) {
    if (typeof value !== 'string' || !value.trim()) return 'Fecha no disponible';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-CU', {timeZone: 'America/Havana', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).format(date) + ' (Cuba)';
}

function escapeTeamReportText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function loadAdminReports() {
    const container = document.getElementById('list-admin-reportes');
    if(container) container.innerHTML = `<p class="text-center text-gray-400 text-xs py-4 col-span-full"><span class="loader w-4 h-4 border-indigo-500"></span> Buscando reportes...</p>`;

    try {
        // Buscamos en la tabla donde se guardan los reportes
        const { data, error } = await supabaseClient
            .from('reportes_gestor')
            .select('*')
            .order('created_at', { ascending: false }); // Fecha real, no orden de UUID

        if (error) throw error;

        reportesAdminRaw = data;
        renderAdminReports();
    } catch (e) {
        console.error("Error cargando reportes:", e);
        if(container) container.innerHTML = `<p class="text-center text-red-400 text-xs py-4 col-span-full">Error al conectar con la base de datos.</p>`;
    }
}

function renderAdminReports() {
    const container = document.getElementById('list-admin-reportes');
    if (!container) return;

    if (!reportesAdminRaw || reportesAdminRaw.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 font-bold text-xs py-10 col-span-full">El buzón está vacío. No hay reportes nuevos.</p>`;
        return;
    }

    container.innerHTML = reportesAdminRaw.map(r => {
        // Colores según el tipo de reporte
        let colorTag = "bg-gray-100 text-gray-600 border-gray-200";
        let icon = "info";
        if(r.categoria === 'Problema') { colorTag = "bg-red-50 text-red-600 border-red-200"; icon = "warning"; }
        if(r.categoria === 'Competencia') { colorTag = "bg-orange-50 text-orange-600 border-orange-200"; icon = "query_stats"; }
        if(r.categoria === 'Solicitud') { colorTag = "bg-blue-50 text-blue-600 border-blue-200"; icon = "inventory_2"; }
        if(r.categoria === 'Sugerencia') { colorTag = "bg-emerald-50 text-emerald-600 border-emerald-200"; icon = "lightbulb"; }

        // Botón para ver foto si adjuntaron una
        let imgHtml = '';
        if (r.imagen_url) {
            // Reconstruimos la URL pública de Supabase
            const urlFoto = `https://ljqwaovevfatkiigirhf.supabase.co/storage/v1/object/public/productos/${String(r.imagen_url).split('/').map(encodeURIComponent).join('/')}`;
            imgHtml = `
            <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <a href="${escapeTeamReportText(urlFoto)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-black uppercase hover:bg-indigo-100 transition-colors">
                    <span class="material-symbols-outlined text-[14px]">image</span> Ver Foto Adjunta
                </a>
            </div>`;
        }

        return `
        <div class="bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-start mb-3">
                    <span class="px-2 py-1 rounded text-[9px] font-black uppercase border flex items-center gap-1 ${colorTag}">
                        <span class="material-symbols-outlined text-[12px]">${icon}</span> ${escapeTeamReportText(r.categoria)}
                    </span>
                    <span class="text-[9px] font-black text-gray-400 uppercase bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                        Por: <span class="text-indigo-500">${escapeTeamReportText(r.gestor)}</span>
                    </span>
                </div>
                <p class="mb-3 text-xs text-gray-500">Enviado: ${formatTeamReportDate(r.created_at)}</p>
                <p class="text-xs text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed break-words">${escapeTeamReportText(r.mensaje)}</p>
            </div>
            ${imgHtml}
        </div>`;
    }).join('');
}

let categoriasAdminBD = [];

// 1. CARGAR CATEGORÍAS (Llama a esta función dentro de tu 'loadAdminData()')
async function loadAdminCategorias() {
    const { data, error } = await supabaseClient
        .from('categorias')
        .select('*')
        .order('orden', { ascending: true });

    if (!error && data) {
        categoriasAdminBD = data;
        renderAdminCategorias();
    }
}

// 2. DIBUJAR LA TABLA DE CATEGORÍAS
function renderAdminCategorias() {
    const container = document.getElementById('list-admin-categorias');
    if (!container) return;

    // Usamos inventoryRawAdmin (tu variable global de productos) para contar cuántos equipos hay en cada una
    const conteo = {};
    if (typeof inventoryRawAdmin !== 'undefined') {
        inventoryRawAdmin.forEach(p => {
            const cat = p.categoria ? p.categoria.toUpperCase() : 'VARIOS';
            conteo[cat] = (conteo[cat] || 0) + 1;
        });
    }

    container.innerHTML = categoriasAdminBD.map((c, index) => {
        const cantidad = conteo[c.nombre] || 0;
        const esUltimo = index === categoriasAdminBD.length - 1;
        const esPrimero = index === 0;

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-colors">
            <td class="p-4 text-center align-middle">
                <div class="flex flex-col items-center gap-1">
                    <button onclick="moverCategoria('${c.id}', -1, ${c.orden})" class="text-gray-400 hover:text-indigo-500 disabled:opacity-30" ${esPrimero ? 'disabled' : ''}><span class="material-symbols-outlined text-lg">keyboard_arrow_up</span></button>
                    <span class="text-xs font-black text-gray-700 dark:text-gray-300">${c.orden}</span>
                    <button onclick="moverCategoria('${c.id}', 1, ${c.orden})" class="text-gray-400 hover:text-indigo-500 disabled:opacity-30" ${esUltimo ? 'disabled' : ''}><span class="material-symbols-outlined text-lg">keyboard_arrow_down</span></button>
                </div>
            </td>
            <td class="p-4 align-middle">
                <p class="text-sm font-black text-slate-700 dark:text-white uppercase">${c.nombre}</p>
            </td>
            <td class="p-4 text-center align-middle">
                <span class="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">${cantidad} equipos</span>
            </td>
            <td class="p-4 text-right align-middle">
                <button onclick="adminEditCategoria('${c.id}', '${c.nombre}')" class="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors shadow-sm ml-1" title="Renombrar">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onclick="adminDeleteCategoria('${c.id}', '${c.nombre}', ${cantidad})" class="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors shadow-sm ml-1" title="Eliminar">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// 3. AGREGAR NUEVA
async function adminAddCategoria() {
    let nombre = prompt("Nombre de la nueva categoría:");
    if (!nombre) return;
    nombre = nombre.trim().toUpperCase();

    // Orden: Al final
    const nuevoOrden = categoriasAdminBD.length > 0 ? categoriasAdminBD[categoriasAdminBD.length - 1].orden + 1 : 1;

    const { error } = await supabaseClient.from('categorias').insert([{ nombre: nombre, orden: nuevoOrden }]);
    if (error) return alert("Error: Posiblemente ya existe una categoría con ese nombre.");

    loadAdminCategorias();
}

// 4. EDITAR / RENOMBRAR (¡Mágia! Cambia la categoría de los productos automáticamente)
async function adminEditCategoria(id, nombreViejo) {
    let nuevoNombre = prompt(`Renombrar categoría "${nombreViejo}" a:`, nombreViejo);
    if (!nuevoNombre || nuevoNombre.trim().toUpperCase() === nombreViejo) return;
    nuevoNombre = nuevoNombre.trim().toUpperCase();

    // 1. Actualizar el nombre en la tabla Categorías
    await supabaseClient.from('categorias').update({ nombre: nuevoNombre }).eq('id', id);

    // 2. Actualizar TODOS los productos que tenían ese nombre viejo
    await supabaseClient.from('productos').update({ categoria: nuevoNombre }).eq('categoria', nombreViejo);

    alert(`✅ Categoría renombrada a ${nuevoNombre} y productos actualizados.`);
    loadAdminData(); // Recargamos todo para actualizar inventario
    loadAdminCategorias();
}

// 5. ELIMINAR CATEGORÍA
async function adminDeleteCategoria(id, nombre, cantidadEquipos) {
    if (cantidadEquipos > 0) {
        const confirmar = confirm(`⚠️ CUIDADO: Hay ${cantidadEquipos} equipos en "${nombre}".\n\nSi eliminas esta categoría, esos equipos pasarán automáticamente a "VARIOS".\n\n¿Estás seguro?`);
        if (!confirmar) return;

        // Pasar los equipos a "VARIOS"
        await supabaseClient.from('productos').update({ categoria: 'VARIOS' }).eq('categoria', nombre);
    } else {
        if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    }

    await supabaseClient.from('categorias').delete().eq('id', id);
    loadAdminData();
    loadAdminCategorias();
}

// 6. REORDENAR (Subir o Bajar)
async function moverCategoria(idActual, direccion, ordenActual) {
    // direccion: -1 (subir), 1 (bajar)
    const indexActual = categoriasAdminBD.findIndex(c => c.id === idActual);
    const indexVecino = indexActual + direccion;

    if (indexVecino < 0 || indexVecino >= categoriasAdminBD.length) return;

    const catActual = categoriasAdminBD[indexActual];
    const catVecina = categoriasAdminBD[indexVecino];

    // Intercambiamos los valores de 'orden'
    const ordenTemp = catActual.orden;
    const nuevoOrdenParaActual = catVecina.orden;
    const nuevoOrdenParaVecina = ordenTemp;

    // Actualizamos en base de datos
    await supabaseClient.from('categorias').update({ orden: nuevoOrdenParaActual }).eq('id', catActual.id);
    await supabaseClient.from('categorias').update({ orden: nuevoOrdenParaVecina }).eq('id', catVecina.id);

    loadAdminCategorias();
}



// ==========================================
// SISTEMA DE ADVERTENCIAS B2B / MAYORISTA
// ==========================================

const b2bSteps = [
    {
        icon: "domain",
        title: "SOLO EMPRESAS",
        html: `
            <p class="text-lg font-bold text-center leading-relaxed">
                Esta categoría es <span class="text-amber-500 font-black">EXCLUSIVA para MIPYMES y TCP</span> que puedan nacionalizar la mercancía.
            </p>
            <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mt-4 rounded-r-lg">
                <p class="text-sm font-bold text-red-700 dark:text-red-400">
                    🚫 NO se vende a personas naturales bajo ninguna circunstancia. Es estrictamente para negocios formales.
                </p>
            </div>`
    },
    {
        icon: "gavel",
        title: "PROCESO DE COMPRA",
        html: `
            <p class="text-base font-medium leading-relaxed mb-3">
                ⚠️ <span class="font-black text-slate-900 dark:text-white">NO es "llegar, pagar y recoger".</span> El proceso lleva un trámite legal:
            </p>
            <ul class="space-y-3 text-sm">
                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-amber-500 text-lg">1</span> <b>Pago Adelantado:</b> Es obligatorio el pago por adelantado del total de la mercancía.</li>
                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-amber-500 text-lg">2</span> <b>Facturación:</b> Se emite la factura comercial.</li>
                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-amber-500 text-lg">3</span> <b>Aduana:</b> Se hace el trámite para que el cliente pague los impuestos (Nacionalización).</li>
                <li class="flex items-start gap-2"><span class="material-symbols-outlined text-red-500 text-lg">4</span> <b>Recogida:</b> Una vez liberado, el cliente debe ir OBLIGATORIAMENTE a recogerlo. <b class="text-red-500">NO HAY TRANSPORTE.</b></li>
            </ul>`
    },
    {
        icon: "location_on",
        title: "UBICACIÓN",
        html: `
            <div class="flex flex-col items-center justify-center py-6 text-center">
                <span class="material-symbols-outlined text-6xl text-amber-500 mb-4 animate-bounce">warehouse</span>
                <p class="text-xl font-bold leading-relaxed">
                    Todos los productos de esta categoría se encuentran físicamente en el <br><span class="text-2xl font-black text-slate-900 dark:text-white">Reparto Eléctrico</span>.
                </p>
            </div>`
    },
    {
        icon: "solar_power",
        title: "PANELES SOLARES",
        html: `
            <div class="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-200 dark:border-blue-800">
                <h4 class="font-black text-blue-800 dark:text-blue-300 uppercase mb-3 flex items-center gap-2">
                    <span class="material-symbols-outlined">lightbulb</span> Reglas para Paneles Solares
                </h4>
                <ul class="space-y-3 text-sm text-blue-900 dark:text-blue-100">
                    <li>📦 Solo se venden por <b>CONTENEDOR COMPLETO</b> (No por pallet, ni por unidad).</li>
                    <li>💰 Requiere un <b>30% de pago por adelantado</b>.</li>
                    <li>🚢 Llegan en <b>Abril</b> al puerto del Mariel.</li>
                    <li>🚛 El cliente debe buscar su contenedor directamente en el Mariel.</li>
                </ul>
            </div>`
    },
    {
        icon: "contract",
        title: "TÉRMINOS LEGALES",
        html: `
            <div class="text-xs space-y-3 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 h-64 overflow-y-auto custom-scrollbar">
                <p class="font-black text-slate-900 dark:text-white text-sm">📥 PROCESO DE COMPRA Y CONDICIONES DE IMPORTACIÓN</p>
                <p>Guía detallada para la adquisición de mercancía bajo el régimen de importación vigente.</p>

                <p class="font-bold text-slate-800 dark:text-slate-200 mt-2">1. Identificación Jurídica y Contratación</p>
                <ul class="list-disc pl-4 space-y-1">
                    <li><b>Requisito Obligatorio:</b> El cliente debe poseer una licencia activa de MIPYME o TCP.</li>
                    <li><b>Intermediación:</b> El Contrato Comercial se formaliza obligatoriamente a través de una Importadora Estatal acreditada.</li>
                    <li><b>Acreditación:</b> Si es la primera operación, deberá completar el registro ante la entidad importadora.</li>
                </ul>

                <p class="font-bold text-slate-800 dark:text-slate-200 mt-2">2. Modalidades de Pago</p>
                <ul class="list-disc pl-4 space-y-1">
                    <li><b>Transferencia Bancaria:</b> Es la vía preferente (transferencia internacional).</li>
                    <li><b>Efectivo en Plaza:</b> Se acepta USD / EUR físico en oficinas corporativas autorizadas.</li>
                </ul>

                <p class="font-bold text-slate-800 dark:text-slate-200 mt-2">3. Estado y Ubicación de la Mercancía</p>
                <ul class="list-disc pl-4 space-y-1">
                    <li><b>Régimen de Importación:</b> La mercancía es necesario nacionalizarla dentro del Almacén Inbond (Reparto Eléctrico).</li>
                    <li><b>Custodia:</b> Los equipos permanecen bajo custodia de la Aduana General de la República hasta la liberación.</li>
                </ul>

                <p class="font-bold text-slate-800 dark:text-slate-200 mt-2">4. Gestión Aduanal y Plazos</p>
                <ul class="list-disc pl-4 space-y-1">
                    <li><b>Trámites:</b> El equipo gestiona la Declaración de Mercancía (DM) y el permiso de extracción.</li>
                    <li><b>Tiempos:</b> Este proceso toma habitualmente entre 24 y 48 horas hábiles.</li>
                </ul>

                <p class="font-bold text-slate-800 dark:text-slate-200 mt-2">5. Entrega y Aranceles</p>
                <ul class="list-disc pl-4 space-y-1">
                    <li><b>Condición de Entrega:</b> Modalidad DAP. Entrega exclusiva en puerta del Almacén Inbond.</li>
                    <li><b>Costos Tributarios:</b> El cliente asume aranceles aduanales y gastos operativos del MINCEX. No son sobrecargos comerciales.</li>
                </ul>
            </div>`
    }
];

// Variables para saber qué interrumpió el modal
let currentB2BStep = 0;
let pendingB2BAction = null; // 'category' o 'product'
let pendingB2BTarget = null; // nombre de la categoría o del producto

// Modificada para recibir la acción y el destino
function openB2BModal(action, target) {
    currentB2BStep = 0;
    pendingB2BAction = action;
    pendingB2BTarget = target;
    document.getElementById('modal-b2b-warnings').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderB2BStep();
}

function closeB2BModal() {
    document.getElementById('modal-b2b-warnings').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function renderB2BStep() {
    const step = b2bSteps[currentB2BStep];

    document.getElementById('b2b-icon').innerText = step.icon;
    document.getElementById('b2b-title').innerText = step.title;
    document.getElementById('b2b-content').innerHTML = step.html;

    // Dibujar los punticos de progreso
    const dotsHtml = b2bSteps.map((_, i) => `
        <div class="w-2.5 h-2.5 rounded-full transition-all ${i === currentB2BStep ? 'bg-white scale-125' : 'bg-white/30'}"></div>
    `).join('');
    document.getElementById('b2b-dots').innerHTML = dotsHtml;

    // Actualizar el texto del botón
    const btnText = document.getElementById('b2b-btn-text');
    if (currentB2BStep === b2bSteps.length - 1) {
        btnText.innerText = "Acepto las condiciones";
        document.getElementById('btn-b2b-next').classList.replace('text-amber-400', 'text-emerald-400');
    } else {
        btnText.innerText = "De acuerdo, continuar";
        document.getElementById('btn-b2b-next').classList.replace('text-emerald-400', 'text-amber-400');
    }
}

// Lógica inteligente al terminar los pasos
function nextB2BStep() {
    if (currentB2BStep < b2bSteps.length - 1) {
        currentB2BStep++;
        renderB2BStep();
    } else {
        // 1. Guardar en sesión para no volver a molestar
        sessionStorage.setItem('pth_b2b_accepted', 'true');

        // 2. Cerrar Modal
        closeB2BModal();

        // 3. Ejecutar la acción que quedó pendiente (¡La Magia!)
        if (pendingB2BAction === 'category') {
            filterByCategory(pendingB2BTarget);
        } else if (pendingB2BAction === 'product') {
            openDetail(pendingB2BTarget); // Reintenta abrir el producto, pero ahora pasará libre
        }
    }
}
// ==========================================
// CONTINUACIÓN DE LÓGICA PARA PANELES SOLARES
// ==========================================
function acceptSolarWarning() {
    document.getElementById('modal-solar-warning').classList.add('hidden');
    const productName = document.getElementById('solar-product-name').value;

    // Volver a llamar a openDetail, pero pasándole "true" para que salte la advertencia
    openDetail(productName, true);
}


// ==========================================
// ORDENAMIENTO POR DEFECTO (CLIENTES VS GESTORES)
// ==========================================
const loadProductsOriginal = loadProducts;
loadProducts = async function() {
    await loadProductsOriginal(); // Carga todos los productos

    if (window.gestorName) {
        // Si es GESTOR: Forzar que vea los equipos con Mayor Ganancia por defecto
        document.querySelectorAll('#sort-selector').forEach(sel => sel.value = 'comision_desc');
    } else {
        // Si es CLIENTE: Forzar que vea "Lo Más Nuevo" por defecto
        const publicSel = document.getElementById('sort-selector-public');
        if(publicSel) publicSel.value = 'nuevo';
    }

    // Ejecutamos el ordenamiento
    if (typeof applySort === "function") {
        applySort();
    }
};


// ==========================================
// RADAR GESTOR: RECORDATORIO DE INACTIVIDAD B2B
// ==========================================
let idleB2BTimer;

function startB2BIdleTimer() {
    return; // <--- AÑADE ESTO PARA DESACTIVARLO

    clearTimeout(idleB2BTimer);

    // 1. Validar que sea un gestor (Si es cliente normal, no lo molestamos)
    if (!window.gestorName) return;

    // 2. Si ya se le recordó en esta sesión, no insistimos más
    if (sessionStorage.getItem('pth_b2b_reminded')) return;

    // 3. Verificar en qué categoría está
    const isMayorista = activeCategory && (activeCategory.toUpperCase().includes('MAYORISTA') || activeCategory.toUpperCase().includes('B2B') || activeCategory.toUpperCase().includes('MIPYME'));

    // Si ya está en la categoría mayorista, no activamos el reloj
    if (isMayorista) return;

    // 4. Si está viendo otras cosas, activamos un reloj de 60 segundos
    idleB2BTimer = setTimeout(() => {
        // Doble validación por si cambió de categoría justo en el segundo 59
        const isStillOutsideB2B = activeCategory && !(activeCategory.toUpperCase().includes('MAYORISTA') || activeCategory.toUpperCase().includes('B2B') || activeCategory.toUpperCase().includes('MIPYME'));

        if (isStillOutsideB2B) {
            document.getElementById('modal-b2b-reminder').classList.remove('hidden');
            sessionStorage.setItem('pth_b2b_reminded', 'true'); // Marcar como visto
        }
    }, 60000); // 60,000 ms = 60 segundos
}

// Función para el botón "Ver Mayorista Ahora" del recordatorio
function goToMayoristaFromReminder() {
    document.getElementById('modal-b2b-reminder').classList.add('hidden');

    // Buscamos la categoría B2B y saltamos a ella
    // (Asegúrate de que 'MAYORISTA' coincida con cómo se llama en tu menú)
    filterByCategory('MAYORISTA');
}

// Inyectamos el reloj en el clic de categorías
const originalFilterByCategory = filterByCategory;
filterByCategory = function(cat) {
    originalFilterByCategory(cat);
    startB2BIdleTimer(); // Reinicia el reloj de inactividad cada vez que cambie de categoría
};

// Iniciar el reloj 5 segundos después de que cargue la web (solo si el gestor está logueado)
window.addEventListener('load', () => {
    setTimeout(startB2BIdleTimer, 5000);
});

function setVPQuickFilter(days) {
    const hoy = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(hoy.getDate() - days);

    // Formatear a YYYY-MM-DD para los inputs
    const isoHoy = hoy.toISOString().split('T')[0];
    const isoInicio = fechaInicio.toISOString().split('T')[0];

    document.getElementById('vp-fecha-desde').value = isoInicio;
    document.getElementById('vp-fecha-hasta').value = isoHoy;

    calculateProductSales();
}

function resetVPFilters() {
    document.getElementById('vp-fecha-desde').value = "";
    document.getElementById('vp-fecha-hasta').value = "";
    calculateProductSales();
}
function populateInventarioProveedorFilter() {
    const selectProv = document.getElementById('filter-inventario-proveedor');
    if (!selectProv || !inventoryRawAdmin) return;

    const currentVal = selectProv.value || 'TODOS';
    // Extrae los proveedores únicos y los ordena alfabéticamente
    const proveedores = [...new Set(inventoryRawAdmin.map(p => p.proveedor || 'General'))].sort();

    selectProv.innerHTML = '<option value="TODOS">Todos los Proveedores</option>' +
                          proveedores.map(p => `<option value="${p}">${p}</option>`).join('');
    selectProv.value = currentVal;
}

// 1. Población dinámica de proveedores sin duplicados ni espacios basura
function updateFormProviders() {
    const selectProv = document.getElementById('p-proveedor');
    if (!selectProv) return;

    // Recuperamos los productos cargados actualmente para extraer los proveedores existentes
    const listaOriginal = (typeof inventoryRawAdmin !== 'undefined' && inventoryRawAdmin.length > 0) ? inventoryRawAdmin : productosRaw;

    // Extraemos nombres únicos aplicando .trim() para limpiar espacios accidentales anteriores
    const proveedoresUnicos = [...new Set(listaOriginal.map(p => (p.proveedor || 'General').trim()))].sort();

    // Guardamos el valor seleccionado actualmente para no perderlo al redibujar
    const valorActual = selectProv.value;

    // Renderizamos las opciones limpias
    selectProv.innerHTML = proveedoresUnicos.map(p => `<option value="${p}">${p}</option>`).join('');

    // Si había un valor seleccionado válido, lo mantenemos seleccionado
    if (valorActual && proveedoresUnicos.includes(valorActual)) {
        selectProv.value = valorActual;
    }
}

// 2. Función para registrar un nuevo proveedor de forma controlada y desinfectada
function agregarNuevoProveedor() {
    let nuevoProv = prompt("Escribe el nombre del nuevo Proveedor / Almacén:");
    if (!nuevoProv) return;

    // Eliminamos cualquier espacio accidental al inicio o al final
    nuevoProv = nuevoProv.trim();

    if (nuevoProv === "") return;

    const selectProv = document.getElementById('p-proveedor');
    if (!selectProv) return;

    // Comprobamos si ya existe en la lista para evitar duplicarlo
    let existe = false;
    for (let i = 0; i < selectProv.options.length; i++) {
        if (selectProv.options[i].value.toLowerCase() === nuevoProv.toLowerCase()) {
            selectProv.selectedIndex = i; // Si ya existe, simplemente lo seleccionamos
            existe = true;
            break;
        }
    }

    if (!existe) {
        // Creamos la nueva opción de manera segura
        const opt = document.createElement('option');
        opt.value = nuevoProv;
        opt.innerHTML = nuevoProv;
        selectProv.appendChild(opt);
        selectProv.value = nuevoProv; // La dejamos seleccionada
    }
}

// --- AUTO-ASIGNACIÓN DEL 50% DE COMISIÓN (VERSIÓN BLINDADA MULTI-ARRAY) ---
    async function autoAssignHalfCommissions() {
        const gestorActual = window.gestorName;
        if (!gestorActual) return alert("Error de sesión. Por favor recarga la página.");

        const hierarchy = await resolveSalesHierarchy(gestorActual);
        if (hierarchy?.isSubgestor) {
            return alert(`🔒 Solo ${hierarchy.parent.nombre}, como gestor principal, puede asignar comisiones.`);
        }

        const confirmar = confirm("¿Deseas asignar automáticamente el 50% de la comisión de todos los productos en stock donde aún no has definido una comisión para tus subgestores?\n\n(Las comisiones que ya configuraste de manera manual se mantendrán intactas).");
        if (!confirmar) return;

        const btn = event.currentTarget;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span class="loader" style="width:12px;height:12px;border:2px solid currentColor;border-bottom-color:transparent;border-radius:50%;display:inline-block;animation:rotation 1s linear infinite"></span> Procesando...`;
        btn.disabled = true;

        try {
            // 1. Obtener todos los productos en stock actualmente
            const { data: productosBase, error: errProd } = await supabaseClient
                .from('productos')
                .select('*')
                .eq('disponible', 'SI');

            if (errProd) throw errProd;

            // 2. Obtener precios personalizados guardados por este gestor
            const { data: misPrecios, error: errPrecios } = await supabaseClient
                .from('precios_personalizados')
                .select('*')
                .eq('gestor', gestorActual);

            if (errPrecios) throw errPrecios;

            // Listas separadas para evitar conflicto de llaves en PostgREST
            const toInsert = [];
            const toUpdate = [];

            productosBase.forEach(p => {
                const saved = misPrecios.find(c => c.producto_id === p.id);
                const hasCustomCom = saved && parseFloat(saved.comision_subgestor) > 0;

                // Solo actuamos sobre aquellos productos donde no se ha definido comisión (es nula o 0)
                if (!hasCustomCom) {
                    const baseComm = parseFloat(p.comision) || 0;
                    const halfComm = Math.floor(baseComm / 2); // Redondear comisión hacia abajo de forma entera

                    if (saved && saved.id) {
                        // Si ya existía el registro de precio, va a la lista de UPDATE (con ID de la fila)
                        toUpdate.push({
                            id: saved.id,
                            gestor: gestorActual,
                            producto_id: p.id,
                            nuevo_precio: saved.nuevo_precio,
                            comision_subgestor: halfComm,
                            // No se debe perder una decisión expresa de ocultar un producto.
                            // Las filas antiguas sin decisión se normalizan como visibles.
                            visible_subgestor: saved.visible_subgestor !== false
                        });
                    } else {
                        // Si es un producto totalmente nuevo para este gestor, va a la lista de INSERT (absolutamente sin ID)
                        toInsert.push({
                            gestor: gestorActual,
                            producto_id: p.id,
                            nuevo_precio: p.precio,
                            comision_subgestor: halfComm,
                            // No dependemos del valor por defecto de la base de datos.
                            visible_subgestor: true
                        });
                    }
                }
            });

            const totalOperaciones = toInsert.length + toUpdate.length;

            if (totalOperaciones === 0) {
                alert("ℹ️ Todos tus productos activos ya cuentan con comisiones de subgestor personalizadas.");
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                return;
            }

            // 3. Ejecutar las operaciones correspondientes de forma limpia en Supabase
            if (toInsert.length > 0) {
                const { error: errIns } = await supabaseClient
                    .from('precios_personalizados')
                    .insert(toInsert);
                if (errIns) throw errIns;
            }

            if (toUpdate.length > 0) {
                const { error: errUpd } = await supabaseClient
                    .from('precios_personalizados')
                    .upsert(toUpdate);
                if (errUpd) throw errUpd;
            }

            alert(`✅ ¡Asignación masiva exitosa!\nSe han configurado ${totalOperaciones} productos con el 50% de comisión para tu red.`);

            // Forzar limpieza de caché y refrescar vistas
            window.PTHSecureData.clearCaches();
            localStorage.removeItem('pth_catalogo_cache_time');
            renderGestorPricing();
            loadProducts();

        } catch (e) {
            console.error(e);
            alert("❌ Ocurrió un error al procesar la asignación masiva: " + e.message);
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }


// =====================================================
// SISTEMA DE VALORACIONES Y ESTRELLAS (CORREGIDO Y ADAPTADO AL INVENTARIO)
// =====================================================

// Generador de opiniones específicas y coherentes según el inventario real (CSV)
function getDefaultReviews(productId, productName, category) {
    const nameLower = productName.toLowerCase();
    const catUpper = (category || "").toUpperCase();

    // 1. RESEÑAS ESPECÍFICAS DE PRODUCTOS DEL CSV (Por ID único)
    const specificReviews = {
        // Bocinas Logitech Z150 (Corregido para Audio)
        "435f9f98-447d-4365-b10b-a5f1ba22cc47": [
            { cliente_nombre: "Julio César", calificacion: 5, comentario: "Para su tamaño tienen un sonido estéreo muy nítido y limpio. Ideales para la laptop o la PC de escritorio.", fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Split inverter 1T Panasonic
        "083b9688-bb43-4d26-bfd0-7f6f2af364ab": [
            { cliente_nombre: "Yusniel M.", calificacion: 5, comentario: "Enfría la sala súper rápido y casi no se siente el ruido. El ahorro con el inverter se nota bastante en la corriente.", fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
            { cliente_nombre: "Claudia Santana", calificacion: 5, comentario: "Excelente equipo, original y sellado de fábrica. El flujo de aire es muy potente.", fecha: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Mini DC UPS - Nemo
        "0187dacd-d620-40fa-8d5f-9bb295482f50": [
            { cliente_nombre: "Humberto Ruiz", calificacion: 5, comentario: "Una maravilla para mantener el router encendido durante los apagones. Me dura más de 4 horas sin problema.", fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Estación de energía portátil Infinisolar 2000W
        "02474b2c-975f-4594-b006-e4c6ebda68b3": [
            { cliente_nombre: "Carlos Alberto", calificacion: 5, comentario: "Excelente inversión para la casa. Levanta el refrigerador, luces y ventiladores a la vez. Muy silencioso.", fecha: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Batidora MARWA 3.5L
        "03a51755-848e-4731-aa41-8bfa42b5ef68": [
            { cliente_nombre: "Lisandra Cruz", calificacion: 5, comentario: "Vaso gigante y con tremenda fuerza. Ideal para batidos y puré, me encanta.", fecha: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
            { cliente_nombre: "Mayra Gómez", calificacion: 5, comentario: "Muy buena batidora de uso diario. Tritura el hielo sin esfuerzo alguno.", fecha: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Lavadora semiautomática 7kg Milexus
        "055e32df-6a95-4e9e-a8cb-57b547306a9b": [
            { cliente_nombre: "Dianelys P.", calificacion: 5, comentario: "Lava muy limpio y exprime excelente. Muy práctica y compacta para apartamentos de poco espacio.", fecha: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Smart TV 32" Samsung
        "07aa81c1-a2b5-470a-a2bc-866174966cfd": [
            { cliente_nombre: "Michel L.", calificacion: 5, comentario: "Calidad de imagen increíble como todo lo de Samsung. Conectó al Wi-Fi de inmediato.", fecha: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Bicicleta de montaña 24 Huffy
        "0540fe9c-4efa-4c00-89a4-4bc7535ba0f7": [
            { cliente_nombre: "Reinier Oliva", calificacion: 5, comentario: "Súper fuerte, ideal para las calles de La Habana. Los cambios Shimano responden de maravilla.", fecha: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Olla Reina 4L EKO
        "216dde2c-e55f-459f-bede-194b73b812f8": [
            { cliente_nombre: "Magaly S.", calificacion: 5, comentario: "Ablanda los frijoles en un momento. Muy útil que venga con la junta de repuesto.", fecha: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        // Arrocera Decakila
        "23156c57-fa37-4134-b026-19727aaef40a": [
            { cliente_nombre: "Mirtha H.", calificacion: 5, comentario: "Me encanta la vaporera de arriba, puedo hacer los vegetales mientras se cocina el arroz abajo. Ahorra tiempo.", fecha: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
        ]
    };

    // 1. Si el producto tiene reseñas personalizadas por ID, las devolvemos inmediatamente
    if (specificReviews[productId]) {
        return specificReviews[productId];
    }

    // 2. Si no, devolvemos ejemplos genéricos coherentes basados en su categoría o palabras clave
    if (nameLower.includes('bateria') || nameLower.includes('batería')) {
        return [
            { cliente_nombre: "Jorge Luis", calificacion: 5, comentario: "Excelente rendimiento y retención de carga. Se nota la diferencia de calidad al usarla.", fecha: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() }
        ];
    } else if (catUpper === "MUNDO FRIO" || nameLower.includes('split') || nameLower.includes('nevera') || nameLower.includes('refrigerador')) {
        return [
            { cliente_nombre: "Gisela Ramos", calificacion: 5, comentario: "Buen rendimiento. Mantiene la temperatura perfecta y la entrega a domicilio fue rápida.", fecha: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() }
        ];
    } else if (catUpper === "COCINA") {
        return [
            { cliente_nombre: "Beatriz M.", calificacion: 5, comentario: "Muy buena calidad. La atención fue excelente desde el primer contacto en el chat.", fecha: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() }
        ];
    } else if (catUpper === "TECNOLOGÍA") {
        return [
            { cliente_nombre: "Roberto Diaz", calificacion: 5, comentario: "Muy confiable y de excelente marca. Funciona exactamente como se describe en la ficha técnica.", fecha: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }
        ];
    }

    // 3. Si no cumple ninguna de estas reglas, devolvemos array vacío (activará "Sé el primero en opinar")
    return [];
}

function renderVerifiedStars(value) {
    const rating = Math.max(0, Math.min(5, Number(value) || 0));
    return Array.from({ length: 5 }, (_, index) =>
        `<span class="material-symbols-outlined text-sm ${index < rating ? 'font-fill text-amber-400' : 'text-slate-200'}">star</span>`
    ).join('');
}

function getApproximateReviewDate(value) {
    if (!value) return 'Fecha de entrega verificada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha de entrega verificada';
    return date.toLocaleDateString('es-CU', { month: 'long', year: 'numeric' });
}

function renderVerifiedOpinionCard(review, compact = false) {
    const catalogProduct = (Array.isArray(productosRaw) ? productosRaw : []).find(product =>
        (review.producto_id && String(product.id) === String(review.producto_id))
        || String(product.nombre || '').trim().toLowerCase() === String(review.producto_nombre || '').trim().toLowerCase()
    );
    const isCurrentlyUnavailable = catalogProduct && !isProductCurrentlyAvailable(catalogProduct);
    const municipality = review.mostrar_municipio && review.municipio
        ? `<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span>${gestorSafeText(review.municipio)}</span>`
        : '';
    const authorizedPhoto = review.foto_autorizada && review.foto_url ? review.foto_url : '';
    const catalogPhoto = review.producto_imagen_url || catalogProduct?.thumbnail || catalogProduct?.imagen || '';
    const productReferencePhoto = catalogPhoto ? fixDriveUrl(catalogPhoto) : '';
    const productImage = productReferencePhoto
        ? `<img src="${gestorSafeText(productReferencePhoto)}" alt="Imagen del producto adquirido" class="${compact ? 'h-16 w-16' : 'h-24 w-24'} shrink-0 rounded-2xl border border-slate-100 bg-white object-contain p-2 shadow-sm" loading="lazy">`
        : '';
    const realPhoto = authorizedPhoto
        ? `<figure class="mt-4">
            <img src="${gestorSafeText(authorizedPhoto)}" alt="Foto real autorizada de la compra entregada" class="${compact ? 'h-28' : 'h-44'} w-full rounded-2xl bg-white object-contain" loading="lazy">
            <figcaption class="mt-1 text-[8px] font-bold text-slate-400">Foto real compartida con autorización</figcaption>
        </figure>`
        : '';
    return `
        <article class="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 ${compact ? 'p-4' : 'p-6'} shadow-sm">
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-white">
                    <span class="material-symbols-outlined text-xs">verified</span> Compra entregada
                </span>
                <span class="text-[9px] font-bold capitalize text-slate-400">${getApproximateReviewDate(review.fecha_entrega)}</span>
                ${municipality ? `<span class="text-[9px] font-bold text-slate-400">${municipality}</span>` : ''}
            </div>
            <p class="mt-4 text-[9px] font-black uppercase tracking-wider text-[#1a4789]">Producto adquirido</p>
            <div class="mt-2 flex items-center gap-3">
                ${productImage}
                <div class="min-w-0">
                    <p class="text-xs font-black leading-snug text-slate-800">${gestorSafeText(review.producto_nombre || 'Producto verificado')}</p>
                    ${isCurrentlyUnavailable ? '<span class="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-500">Agotado actualmente</span>' : ''}
                    ${productReferencePhoto ? '<p class="mt-2 text-[8px] font-bold text-slate-400">Imagen de referencia del equipo comprado</p>' : ''}
                </div>
            </div>
            <p class="mt-4 ${compact ? 'text-xs' : 'text-sm'} font-bold leading-relaxed text-slate-700">“${gestorSafeText(review.comentario)}”</p>
            <div class="mt-4 grid grid-cols-2 gap-2">
                <div class="rounded-xl bg-white p-3 shadow-sm">
                    <p class="text-[8px] font-black uppercase text-slate-400">Atención</p>
                    <div class="mt-1 flex">${review.valoracion_atencion ? renderVerifiedStars(review.valoracion_atencion) : '<span class="text-[9px] font-bold text-slate-400">Comentario verificado</span>'}</div>
                </div>
                <div class="rounded-xl bg-white p-3 shadow-sm">
                    <p class="text-[8px] font-black uppercase text-slate-400">Mensajería</p>
                    <div class="mt-1 flex">${review.valoracion_mensajeria ? renderVerifiedStars(review.valoracion_mensajeria) : '<span class="text-[9px] font-bold text-slate-400">No valorada</span>'}</div>
                </div>
            </div>
            ${realPhoto}
            <p class="mt-3 flex items-center gap-1 text-[8px] font-bold text-slate-400"><span class="material-symbols-outlined text-xs">privacy_tip</span> Identidad protegida · publicación autorizada</p>
        </article>`;
}

async function loadVerifiedSocialProof() {
    const list = document.getElementById('verified-social-proof-list');
    const deliveredLabel = document.getElementById('social-proof-delivered-count');
    if (!list && !deliveredLabel) return;
    try {
        const [reviewsResult, deliveredResult] = await Promise.all([
            supabaseClient
                .from('opiniones_verificadas')
                .select('id, producto_id, producto_nombre, producto_imagen_url, comentario, valoracion_atencion, valoracion_mensajeria, municipio, mostrar_municipio, foto_url, foto_autorizada, fecha_entrega')
                .eq('aprobada', true)
                .eq('consentimiento_publicacion', true)
                .order('fecha_entrega', { ascending: false })
                .limit(6),
            supabaseClient.rpc('contar_pedidos_entregados')
        ]);

        if (deliveredLabel) {
            const deliveredCount = Number(deliveredResult.data);
            deliveredLabel.textContent = !deliveredResult.error && Number.isFinite(deliveredCount)
                ? `${deliveredCount} ${deliveredCount === 1 ? 'pedido entregado confirmado' : 'pedidos entregados confirmados'}`
                : 'Opiniones vinculadas a entregas confirmadas';
        }

        if (!list) return;
        const reviews = reviewsResult.error ? [] : (reviewsResult.data || []);
        if (!reviews.length) {
            list.innerHTML = `
                <div class="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                    <span class="material-symbols-outlined text-3xl text-slate-300">verified_user</span>
                    <p class="mt-2 text-xs font-black text-slate-700">Preparando opiniones verificadas</p>
                    <p class="mx-auto mt-1 max-w-md text-[10px] font-bold leading-relaxed text-slate-400">Solo mostraremos experiencias de compras entregadas cuando el cliente haya autorizado expresamente su publicación.</p>
                </div>`;
            return;
        }
        list.innerHTML = reviews.slice(0, 3).map(review => renderVerifiedOpinionCard(review)).join('');
    } catch (error) {
        console.error('No se pudo cargar la prueba social verificada:', error);
        if (deliveredLabel) deliveredLabel.textContent = 'Opiniones vinculadas a entregas confirmadas';
        if (list) list.innerHTML = `
            <div class="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                <p class="text-xs font-black text-slate-600">Las opiniones verificadas estarán disponibles próximamente.</p>
            </div>`;
    }
}

window.addEventListener('load', loadVerifiedSocialProof);

// Cargar únicamente opiniones verificadas del producto.
async function loadProductReviews(productId, productName, category) {
    const listContainer = document.getElementById('detail-reviews-list');
    const avgStarsContainer = document.getElementById('detail-avg-stars');
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="text-center py-4 text-xs text-slate-500">Cargando opiniones...</div>`;

    let realReviews = [];
    try {
        const { data, error } = await supabaseClient
            .from('opiniones_verificadas')
            .select('producto_id, producto_nombre, producto_imagen_url, comentario, valoracion_atencion, valoracion_mensajeria, municipio, mostrar_municipio, foto_url, foto_autorizada, fecha_entrega')
            .eq('producto_id', String(productId))
            .eq('aprobada', true)
            .eq('consentimiento_publicacion', true)
            .order('fecha_entrega', { ascending: false })
            .limit(5);

        if (!error && data) {
            realReviews = data;
        }
    } catch (e) {
        console.error("Error al cargar opiniones reales", e);
    }

    // EVALUAR ESTADO VACÍO: Si el producto no tiene opiniones en la base de datos
    if (realReviews.length === 0) {
        avgStarsContainer.innerHTML = `<span class="text-xs text-slate-500 dark:text-slate-400">Sin valoraciones aún</span>`;
        listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700/80 text-center text-slate-400">
            <span class="material-symbols-outlined text-3xl mb-2 text-slate-300">rate_review</span>
            <p class="text-xs font-black uppercase text-slate-600 dark:text-slate-300 mb-1">Aún no hay opiniones</p>
            <p class="text-[10px] text-slate-500">¿Compraste este equipo? Sé el primero en compartir tu experiencia.</p>
        </div>`;
        return;
    }

    // Calcular promedio de las opiniones de la base de datos
    const ratedReviews = realReviews.filter(review => Number(review.valoracion_atencion) > 0);
    if (ratedReviews.length) {
        const avg = ratedReviews.reduce((sum, review) => sum + Number(review.valoracion_atencion), 0) / ratedReviews.length;
        avgStarsContainer.innerHTML = `${renderVerifiedStars(Math.round(avg))} <span class="text-xs text-slate-500 dark:text-slate-400">(${ratedReviews.length})</span>`;
    } else {
        avgStarsContainer.innerHTML = `<span class="text-xs text-slate-500 dark:text-slate-400">${realReviews.length} ${realReviews.length === 1 ? 'compra verificada' : 'compras verificadas'}</span>`;
    }
    listContainer.innerHTML = realReviews.map(review => renderVerifiedOpinionCard(review, true)).join('');
}

// Control interactivo de las estrellas en el formulario
window.setFormStars = function(rating) {
    document.getElementById('input-rating').value = rating;
    const stars = document.querySelectorAll('#form-stars span');
    stars.forEach((star, idx) => {
        if (idx < rating) {
            star.classList.add('font-fill');
            star.classList.remove('text-gray-300');
        } else {
            star.classList.remove('font-fill');
            star.classList.add('text-gray-300');
        }
    });
};

// Enviar opinión a la base de datos
window.submitProductReview = async function() {
    if (!selectedProduct) return;

    const nameInput = document.getElementById('input-review-name');
    const commentInput = document.getElementById('input-review-comment');
    const ratingInput = document.getElementById('input-rating');
    const btn = document.getElementById('btn-submit-review');

    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();
    const rating = parseInt(ratingInput.value);

    if (!name || !comment) {
        return alert("⚠️ Por favor ingresa tu nombre y escribe un comentario.");
    }

    const oldText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Enviando...";

    try {
        const { error } = await supabaseClient
            .from('valoraciones')
            .insert([{
                producto_id: selectedProduct.id,
                cliente_nombre: name,
                calificacion: rating,
                comentario: comment
            }]);

        if (error) throw error;

        alert("✅ ¡Muchas gracias por tu opinión! Se ha publicado con éxito.");

        // Limpiar campos
        commentInput.value = "";
        nameInput.value = "";
        setFormStars(5); // Reset a 5 estrellas

        // Recargar las opiniones del producto inmediatamente
        await loadProductReviews(selectedProduct.id, selectedProduct.nombre, selectedProduct.categoria);

    } catch (e) {
        console.error(e);
        alert("Ocurrió un inconveniente al enviar la opinión. Inténtalo más tarde.");
    } finally {
        btn.disabled = false;
        btn.innerText = oldText;
    }
}
