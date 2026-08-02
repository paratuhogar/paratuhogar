/**
 * SISTEMA DE ONBOARDING INDEPENDIENTE PARA GESTORES PRINCIPALES (4 TARJETAS)
 * Este archivo inyecta de forma dinámica un tutorial que explica el sistema,
 * cómo reclutar por WhatsApp, comisiones, aprobaciones y redirecciona al panel.
 */

// Configuración de las Tarjetas Informativas
const tutorialSlides = [
    {
        title: "¡Tu propia Red de Vendedores! 👥",
        icon: "group_add",
        html: `
            <p class="text-sm leading-relaxed text-slate-300">
                Ahora puedes reclutar a tus propios subgestores para multiplicar tus ventas. Para evitar que tus clientes normales se confundan y se registren como vendedores por error, la pestaña de registro está oculta en tus enlaces de venta convencionales.
            </p>
            <div class="bg-blue-950/40 border border-blue-900/50 p-4 rounded-xl space-y-2 mt-2 text-xs">
                <p class="font-bold text-blue-300">Aprobación de Vendedores:</p>
                <p class="text-slate-400">Cuando alguien se registre con tu link, aparecerá en tu sección de <b>"Solicitudes de Ingreso"</b>. Deberás contactarlo por WhatsApp, explicarle el trabajo y aprobarlo desde tu panel para activar su cuenta.</p>
            </div>
        `
    },
    {
        title: "Reclutamiento y WhatsApp 📢",
        icon: "share",
        html: `
            <p class="text-sm leading-relaxed text-slate-300">
                La mejor manera de hacer crecer tu red es utilizando el <b>Enlace de Reclutamiento</b> que aparece en la parte superior de tu panel.
            </p>
            <div class="bg-blue-950/40 border border-blue-900/50 p-4 rounded-xl space-y-2 mt-2 text-xs">
                <p class="font-bold text-blue-300">🚀 ¿Cómo usarlo para captar?</p>
                <p class="text-slate-400">Copia tu enlace y compártelo en tus estados, canales o grupos de WhatsApp de empleo, clasificados o ventas en Cuba. El sistema identificará de forma automática a cualquiera que se una a través de él y lo pondrá en tu lista de espera.</p>
            </div>
        `
    },
    {
        title: "Control Manual de Comisiones 💰",
        icon: "tune",
        html: `
            <p class="text-sm leading-relaxed text-slate-300">
                No usamos porcentajes. En tu pestaña <span class="text-indigo-400 font-bold">"Mis Precios (Config)"</span> verás todo el catálogo disponible en stock (sean precios libres o fijos).
            </p>
            <ul class="space-y-3 mt-2 text-xs text-slate-400 list-none">
                <li class="flex gap-2"><span class="text-indigo-400 font-bold">▪️</span> <b>Precios Libres:</b> Configura el precio público y determina el reparto manual en dólares.</li>
                <li class="flex gap-2"><span class="text-indigo-400 font-bold">▪️</span> <b>Precios Fijos:</b> No puedes alterar el precio final, pero sí escribir exactamente qué monto de la comisión base le otorgas al subgestor.</li>
                <li class="flex gap-2"><span class="text-emerald-400 font-bold">💡</span> Tus subgestores verán su ganancia asignada (ej: <b>"GANAS $25"</b>) directamente en su tienda antes de vender.</li>
            </ul>
        `
    },
    {
        title: "Flujo de Pedidos y Nómina 🏍️",
        icon: "verified",
        html: `
            <p class="text-sm leading-relaxed text-slate-300">
                Cuando tus subgestores o sus clientes hagan un pedido, el WhatsApp te llegará a ti, no a la tienda principal. Los verás en tu cola de <b>"Pedidos por Aprobar"</b>.
            </p>
            <ul class="space-y-3 mt-2 text-xs text-slate-400 list-none">
                <li class="flex gap-2"><span class="text-blue-400 font-bold">1.</span> Revisa los datos de envío, corrígelos si es necesario y aprueba el pedido para que viaje a la tienda central.</li>
                <li class="flex gap-2"><span class="text-blue-400 font-bold">2.</span> La tienda te pagará el 100% de la comisión cuando se entregue el equipo.</li>
                <li class="flex gap-2"><span class="text-blue-400 font-bold">3.</span> Usa tu pestaña de <b>Nómina</b> para ver cuánto debes transferirle a cada vendedor y márcalo como liquidado.</li>
            </ul>
        `
    }
];

let currentSlideIndex = 0;

// Validador de inicio de sesión y rol
function checkOnboardingStatus() {
    const savedSession = localStorage.getItem('pth_session');
    if (!savedSession) return;

    try {
        const s = JSON.parse(savedSession);
        
        // 1. Evitar que le aparezca a administradores principales de logística
        if (s.isAdmin) return;

        // 2. Evitar que le aparezca a subgestores (quienes tienen un parent_id)
        if (s.data && s.data.parent_id) return;

        // 3. Verificar si ya completó el onboarding antes
        const onboardingDone = localStorage.getItem('pth_subgestor_onboarding_v1');
        if (onboardingDone) return;

        // Si cumple todas las condiciones (es Gestor Principal y es su primera vez), inyectamos el tutorial
        injectOnboardingModal();
    } catch (e) {
        console.error("Error en validador de onboarding:", e);
    }
}

// Inyección dinámica de HTML en el body
function injectOnboardingModal() {
    const modalHTML = `
    <div id="subgestor-onboarding-overlay" class="fixed inset-0 z-[500000] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-[#090e17] border-2 border-blue-900/50 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.15)] relative p-6 md:p-8 flex flex-col justify-between" style="font-family: 'Rajdhani', sans-serif;">
            
            <!-- Botón Cerrar (Omitir) -->
            <button onclick="closeOnboardingTutorial()" class="absolute top-4 right-4 z-50 text-slate-500 hover:text-white transition-colors">
                <span class="material-symbols-outlined text-lg">close</span>
            </button>

            <!-- Cabecera Animada -->
            <div class="text-center space-y-4">
                <div class="relative w-16 h-16 mx-auto mb-2">
                    <div class="absolute inset-0 bg-blue-500 rounded-2xl blur-md opacity-25"></div>
                    <div class="bg-slate-900 w-16 h-16 rounded-2xl border border-blue-500/30 flex items-center justify-center relative z-10">
                        <span id="onboarding-icon" class="material-symbols-outlined text-3xl text-blue-400">group_add</span>
                    </div>
                </div>
                
                <h3 id="onboarding-title" class="text-xl md:text-2xl font-black text-white uppercase italic tracking-tight">---</h3>
            </div>

            <!-- Cuerpo Dinámico -->
            <div id="onboarding-body" class="my-6 min-h-[220px] flex flex-col justify-center">
                <!-- Se inyecta aquí -->
            </div>

            <!-- Navegación Inferior -->
            <div class="border-t border-slate-800 pt-5 space-y-4">
                <!-- Indicador de pasos (Puntitos) -->
                <div id="onboarding-dots" class="flex justify-center gap-2">
                    <!-- Se inyecta aquí -->
                </div>

                <!-- Botones de Acción -->
                <div class="flex gap-3">
                    <button id="btn-onboarding-back" onclick="navigateOnboarding(-1)" class="flex-1 py-3 bg-slate-900 border border-slate-700 text-slate-400 rounded-xl text-xs font-black uppercase transition-all hover:bg-slate-800">
                        Atrás
                    </button>
                    <button id="btn-onboarding-next" onclick="navigateOnboarding(1)" class="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                        Siguiente
                    </button>
                </div>
            </div>

        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    renderOnboardingSlide();
}

function renderOnboardingSlide() {
    const slide = tutorialSlides[currentSlideIndex];
    
    document.getElementById('onboarding-icon').innerText = slide.icon;
    document.getElementById('onboarding-title').innerText = slide.title;
    document.getElementById('onboarding-body').innerHTML = slide.html;

    // Actualizar puntitos indicadores
    const dotsHtml = tutorialSlides.map((_, i) => `
        <div class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === currentSlideIndex ? 'bg-blue-400 scale-125' : 'bg-slate-800'}"></div>
    `).join('');
    document.getElementById('onboarding-dots').innerHTML = dotsHtml;

    // Controlar visibilidad del botón "Atrás"
    const btnBack = document.getElementById('btn-onboarding-back');
    if (currentSlideIndex === 0) {
        btnBack.classList.add('invisible');
    } else {
        btnBack.classList.remove('invisible');
    }

    // Modificar el botón final para ir a la sección
    const btnNext = document.getElementById('btn-onboarding-next');
    if (currentSlideIndex === tutorialSlides.length - 1) {
        btnNext.innerText = "Ir a mi Red de Subgestores"; 
        btnNext.className = "flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black uppercase transition-all hover:brightness-110 shadow-lg shadow-emerald-500/20 animate-pulse";
    } else {
        btnNext.innerText = "Siguiente";
        btnNext.className = "flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20";
    }
}

function navigateOnboarding(direction) {
    if (direction === 1 && currentSlideIndex === tutorialSlides.length - 1) {
        closeOnboardingTutorial();
        // Redirección automática al finalizar el tutorial de 4 tarjetas
        window.location.href = 'subgestores.html'; 
        return;
    }

    currentSlideIndex += direction;
    renderOnboardingSlide();
}

function closeOnboardingTutorial() {
    const overlay = document.getElementById('subgestor-onboarding-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
    // Guardar marca para que no vuelva a aparecer
    localStorage.setItem('pth_subgestor_onboarding_v1', 'true');
}

// Este archivo puede cargarse bajo demanda cuando el evento load ya ocurrió.
// En ambos casos conservamos el mismo retraso para no interrumpir la entrada al panel.
if (document.readyState === 'complete') {
    setTimeout(checkOnboardingStatus, 3500);
} else {
    window.addEventListener('load', () => {
        setTimeout(checkOnboardingStatus, 3500);
    }, { once: true });
}
