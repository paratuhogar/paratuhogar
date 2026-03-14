/* ======================================================
   MÓDULO DE CAMPAÑA: DOMINIO DE TRÁFICO (CLICS) v3.5
   Cinta de Noticias Móvil, Rey Absoluto y Fricción Cero.
   ====================================================== */

const TrafficCampaign = {
    myClicks: 0,
    allAgentsData: [],
    topAgent: null, // Ahora guardará al #1 absoluto de la tabla
    originalSalesHTML: "", 

    init: async function() {
        if (!window.gestorName) return; 

        // 1. Extraer datos de Supabase (Esto toma milisegundos)
        await this.fetchClickData();

        // 2. Inyectar todo INMEDIATAMENTE al terminar la descarga (sin setTimeout)
        this.injectGlobalRibbon();  // La cinta de noticias móvil
        this.injectProgressBar();   // La barra en el dashboard
        this.overrideRanking();     // El ranking por defecto
        this.applyRewards();        // Desbloqueo de botones
    },

    // --- 1. PROCESAR DATOS DE SUPABASE ---
    // --- 1. PROCESAR DATOS DE SUPABASE (CORREGIDO) ---
    fetchClickData: async function() {
        // 1. Calculamos la fecha de hace 30 días para tener un Ranking Activo
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);

        // 2. ROMPEMOS EL LÍMITE DE SUPABASE (de 1000 a 50000) y traemos lo más nuevo
        const { data, error } = await supabaseClient
            .from('link_analytics')
            .select('agent_name')
            .gte('timestamp', hace30Dias.toISOString()) // Solo últimos 30 días
            .order('timestamp', { ascending: false })   // Los más nuevos primero
            .limit(50000);                              // Límite masivo

        if (error || !data) {
            console.error("Error cargando tráfico:", error);
            return;
        }

        let agentClicks = {};

        data.forEach(row => {
            const agent = row.agent_name;
            
            // Filtros: ignorar tráfico vacío, directo o del dueño
            if (!agent || agent === 'Directo' || agent === 'Venta Directa' || agent === 'Marcel Montano') return;

            agentClicks[agent] = (agentClicks[agent] || 0) + 1;
        });

        // Convertir a Array ordenado de mayor a menor
        this.allAgentsData = Object.entries(agentClicks)
            .map(([name, clicks]) => ({ name, clicks: clicks }))
            .sort((a, b) => b.clicks - a.clicks);
        
        // El #1 absoluto es el primero de la lista
        if (this.allAgentsData.length > 0) {
            this.topAgent = this.allAgentsData[0];
        } else {
            this.topAgent = null;
        }

        // Buscar cuántos clics tiene el gestor que está viendo la pantalla
        const myData = this.allAgentsData.find(a => a.name === window.gestorName);
        this.myClicks = myData ? myData.clicks : 0;
    },

    // --- 2. CINTA GLOBAL ESTILO NOTICIAS (DISEÑO SOLO LEVELING / TEXTO ORIGINAL) ---
    // --- 2. CINTA GLOBAL ESTILO NOTICIAS (CON ROTACIÓN DE MENSAJES) ---
    injectGlobalRibbon: function() {
        const mainContainer = document.querySelector('main');
        if (!mainContainer) return;
        if (document.getElementById('traffic-global-ribbon')) return; // Evitar duplicados

        // 1. Inyectamos los estilos CSS del Sistema para la cinta
        const style = document.createElement('style');
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
                padding-left: 50%; 
                animation: ticker 20s linear infinite;
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
            .sl-purple-glow { text-shadow: 0 0 8px rgba(168, 85, 247, 0.8); }
        `;
        document.head.appendChild(style);

        // ==========================================
        // 2. MAGIA: ROTACIÓN ALEATORIA DE MENSAJES
        // ==========================================
        const mensajesFomo = [
            `<span class="ml-12 text-[13px] font-black tracking-widest text-emerald-400 flex items-center gap-2 bg-emerald-900/30 px-4 py-1 border border-emerald-500/50 rounded shadow-[0_0_15px_rgba(16,185,129,0.2)]"><span class="animate-ping w-2 h-2 bg-emerald-500 rounded-full"></span>PREDICCIÓN DEL SISTEMA: <span class="text-white text-lg drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">+80%</span> DE PROBABILIDAD DE LLEVARSE LAS VENTAS HOY 💰</span>`,
            
            `<span class="ml-12 text-[13px] font-black tracking-widest text-amber-400 bg-amber-950/50 px-4 py-1 border border-amber-500/50 rounded flex items-center gap-2">⚠️ <span class="text-white animate-pulse">¡ALERTA AL RESTO!</span> ESTÁ ACAPARANDO EL TRÁFICO Y LAS COMISIONES DEL DÍA 💸</span>`,
            
            `<span class="ml-12 text-[14px] font-black tracking-widest text-green-400 flex items-center gap-2">🤑 <span class="bg-green-600 text-white px-2 py-0.5 rounded animate-pulse">VENTA INMINENTE:</span> TIENE LA MAYOR PROBABILIDAD DE COBRAR COMISIONES HOY</span>`
        ];
        
        // Elige uno al azar cada vez que carga la página
        const mensajeElegido = mensajesFomo[Math.floor(Math.random() * mensajesFomo.length)];


        let ribbonHTML = '';
        if (this.topAgent && this.topAgent.clicks > 0) {
            const isMe = this.topAgent.name === window.gestorName;
            const name = isMe ? "¡ERES TÚ!" : this.topAgent.name.toUpperCase();
            
            ribbonHTML = `
            <div id="traffic-global-ribbon" class="sl-ticker-wrap font-system">
                <div class="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2 border-cyan-400 z-20"></div>
                <div class="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2 border-cyan-400 z-20"></div>
                
                <div class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#020617] via-[#020617] to-transparent w-16 z-10 flex items-center pl-4 pointer-events-none">
                    <span class="text-xl animate-pulse">🔥</span>
                </div>

                <div class="sl-ticker-move">
                    <div class="sl-ticker-item pl-16">
                        <span class="text-cyan-400 font-black mr-3 sl-text-glow">[MENSAJE DEL SISTEMA]</span> 
                        
                        <span class="text-white">
                            <span class="${isMe ? 'text-purple-400 sl-purple-glow' : 'text-cyan-300 sl-text-glow'} font-black">${name}</span> 
                            ES QUIÉN MÁS COMPARTE SU LINK, TIENE YA <span class="bg-cyan-950/60 border border-cyan-500/50 px-2 py-0.5 rounded text-cyan-300 ml-1 shadow-[0_0_10px_rgba(6,182,212,0.3)]">${this.topAgent.clicks} CLICS DE CLIENTES</span>
                        </span>
                        
                        <!-- AQUI SE INYECTA EL MENSAJE ROTATIVO -->
                        ${mensajeElegido}
                        
                        <span class="ml-12 text-purple-400 font-black sl-purple-glow flex items-center gap-1">
                            ¡COMPARTE TU LINK EN GRUPOS PARA QUITARLE EL PUESTO! 🚀
                        </span>
                    </div>
                </div>
            </div>`;
        } else {
            ribbonHTML = `
            <div id="traffic-global-ribbon" class="sl-ticker-wrap font-system border-slate-700 shadow-none">
                <div class="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2 border-slate-500 z-20"></div>
                <div class="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2 border-slate-500 z-20"></div>
                
                <div class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#020617] via-[#020617] to-transparent w-16 z-10 flex items-center pl-4 pointer-events-none">
                    <span class="text-xl">🏆</span>
                </div>

                <div class="sl-ticker-move" style="animation-duration: 20s;">
                    <div class="sl-ticker-item pl-16 text-slate-400">
                        <span class="text-amber-500 font-black mr-3">[ALERTA DE MISIÓN]</span> 
                        <span>EL PUESTO #1 DEL RANKING DE TRÁFICO ESTÁ LIBRE. ¡COMPARTE TU LINK AHORA Y DOMINA A LA COMPETENCIA! 🚀</span>
                    </div>
                </div>
            </div>`;
        }

        // Insertar al principio del <main>
        mainContainer.insertAdjacentHTML('afterbegin', ribbonHTML);
    },

    // --- 3. BARRA DE PROGRESO (DASHBOARD) ---
    injectProgressBar: function() {
        const container = document.querySelector('#sub-dash-resumen .grid'); 
        if (!container) return;

        let nextGoal = 50;
        let rewardText = "PACK FOTOS MASIVO";
        if (this.myClicks >= 50) { nextGoal = 200; rewardText = "CATÁLOGO PDF PRO"; }
        if (this.myClicks >= 200) { nextGoal = 500; rewardText = "LINK DE 6 MESES"; }
        if (this.myClicks >= 500) { nextGoal = this.myClicks; rewardText = "NIVEL MÁXIMO ALCANZADO"; }

        let percent = Math.min(100, (this.myClicks / nextGoal) * 100);

        const html = `
        <div class="col-span-1 md:col-span-2 bg-[#020617] border border-orange-500/30 p-5 rounded-sm shadow-[0_0_15px_rgba(249,115,22,0.1)] mb-4 font-system mt-4 relative overflow-hidden group">
            <div class="absolute -right-10 -top-10 opacity-10 group-hover:opacity-20 transition-opacity">
                <span class="material-symbols-outlined text-[10rem] text-orange-500">ads_click</span>
            </div>
            <div class="relative z-10">
                <div class="flex justify-between items-end mb-2">
                    <div>
                        <p class="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                            <span class="material-symbols-outlined text-sm animate-pulse">visibility</span> TRÁFICO TOTAL ATRAÍDO
                        </p>
                        <h3 class="text-white text-sm md:text-lg font-black tracking-wide">META: DESBLOQUEAR <span class="text-orange-400">${rewardText}</span></h3>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl font-black text-white">${this.myClicks}</span>
                        <span class="text-[10px] md:text-xs text-orange-500 font-bold block md:inline">/ ${nextGoal} CLICS</span>
                    </div>
                </div>
                <div class="h-4 w-full bg-slate-900 border border-slate-700 skew-x-[-10deg] overflow-hidden relative">
                    <div class="h-full bg-orange-500 shadow-[0_0_15px_#f97316] transition-all duration-1000" style="width: ${percent}%"></div>
                </div>
            </div>
        </div>`;

        container.insertAdjacentHTML('afterend', html);
    },

    // --- 4. RANKING DE CLICS (POR DEFECTO) ---
    overrideRanking: function() {
        const rankingContainer = document.getElementById('ranking-list');
        if (!rankingContainer) return;

        this.originalSalesHTML = rankingContainer.innerHTML;

        let clicksHTML = this.allAgentsData.map((agent, index) => {
            const rank = index + 1;
            const isMe = agent.name === window.gestorName;
            const displayName = isMe ? agent.name.toUpperCase() : agent.name.substring(0, 5).toUpperCase() + '***';
            const bgClass = isMe ? "bg-orange-950/40 border-l-4 border-orange-500" : "bg-[#0f172a] border-l-4 border-transparent";
            const textClass = isMe ? "text-orange-400 font-black" : "text-slate-300 font-bold";

            return `
            <div class="flex items-center justify-between p-4 ${bgClass} border-b border-slate-800/50 hover:bg-slate-800 transition-colors">
                <div class="flex items-center gap-4">
                    <span class="text-sm font-mono text-slate-500 w-6">#${rank}</span>
                    <span class="${textClass} tracking-wider uppercase text-sm">${displayName} ${isMe ? '<span class="text-[9px] bg-orange-600 text-white px-1.5 rounded ml-2">TÚ</span>' : ''}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-lg font-black text-white font-mono">${agent.clicks}</span>
                    <span class="text-[9px] text-slate-500 uppercase font-bold">Clics</span>
                </div>
            </div>`;
        }).join('');

        if(this.allAgentsData.length === 0) {
            clicksHTML = `<div class="p-6 text-center text-slate-500 text-xs font-bold uppercase">Nadie ha generado tráfico. ¡Sé el primero!</div>`;
        }

        this.currentClicksHTML = `<div class="divide-y divide-slate-800">` + clicksHTML + `</div>`;

        const parent = rankingContainer.parentElement;
        const header = parent.querySelector('.border-b');
        
        header.innerHTML = `
            <div class="flex w-full">
                <button id="tab-ranking-clicks" onclick="TrafficCampaign.switchTab('clicks')" class="flex-1 py-3 bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest transition-all">👁️ Top Tráfico</button>
                <button id="tab-ranking-sales" onclick="TrafficCampaign.switchTab('sales')" class="flex-1 py-3 bg-[#020617] text-slate-400 font-bold text-[10px] uppercase tracking-widest transition-all border-b border-slate-700 hover:bg-slate-800">💰 Top Ventas</button>
            </div>
        `;

        rankingContainer.innerHTML = this.currentClicksHTML;
    },

    switchTab: function(tab) {
        const container = document.getElementById('ranking-list');
        const btnClicks = document.getElementById('tab-ranking-clicks');
        const btnSales = document.getElementById('tab-ranking-sales');

        if (tab === 'clicks') {
            container.innerHTML = this.currentClicksHTML;
            btnClicks.className = "flex-1 py-3 bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest transition-all";
            btnSales.className = "flex-1 py-3 bg-[#020617] text-slate-400 font-bold text-[10px] uppercase tracking-widest transition-all border-b border-slate-700 hover:bg-slate-800";
        } else {
            container.innerHTML = this.originalSalesHTML;
            btnSales.className = "flex-1 py-3 bg-cyan-600 text-white font-black text-[10px] uppercase tracking-widest transition-all";
            btnClicks.className = "flex-1 py-3 bg-[#020617] text-slate-400 font-bold text-[10px] uppercase tracking-widest transition-all border-b border-slate-700 hover:bg-slate-800";
        }
    },

    // --- 5. APLICAR DESBLOQUEOS ---
    applyRewards: function() {
        const btnZip = document.getElementById('btn-zip-bulk'); // Botón de Fotos
        const btnPdf = document.getElementById('btn-pdf-bulk'); // Botón PDF

        if (this.myClicks >= 50 && btnZip) {
            btnZip.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-blue-100 bg-white text-blue-600 transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer hover:bg-blue-50 shadow-sm";
            btnZip.innerHTML = `<span class="material-symbols-outlined text-lg">folder_zip</span> <span>Fotos</span>`;
            btnZip.onclick = function() { downloadCategoryPhotos(); };
            btnZip.title = "Pack de Fotos Desbloqueado por Tráfico";
        }

        if (this.myClicks >= 200 && btnPdf) {
            btnPdf.className = "flex-1 xl:flex-none py-2.5 px-4 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer shadow-sm";
            btnPdf.innerHTML = `<span class="material-symbols-outlined text-lg">picture_as_pdf</span> <span>PDF Pro</span>`;
            btnPdf.onclick = function() { downloadCatalogPDF(); };
            btnPdf.title = "Catálogo PDF Desbloqueado por Tráfico";
        }

        if (this.myClicks >= 500) {
            const durVisual = document.getElementById('welcome-link-duration');
            if (durVisual) {
                durVisual.innerText = "6 MESES (VIP)";
                durVisual.classList.add("text-orange-500", "animate-pulse");
            }
        }
    },

    // --- 6. MODAL EDUCATIVO ---
    showMissionModal: async function() {
        const seen = localStorage.getItem('seen_traffic_campaign_v4'); 
        if (seen) return;

        const baseUrl = window.location.origin + window.location.pathname;
        const myTel = window.currentUserData?.telefono || '';
        const longLink = `${baseUrl}?gestor=${encodeURIComponent(window.gestorName)}&tel=${myTel}`;
        
        let finalLink = longLink;
        if(typeof getOrGenerateShortLink === 'function') {
            finalLink = await getOrGenerateShortLink(window.gestorName, longLink);
        }

        const waText = `🚨 *OFERTAS DE ELECTRODOMÉSTICOS EN LA HABANA* 🚨\n\nNuevos, con garantía real y pago contra entrega.\n\n👇 *Toca aquí para ver el catálogo y precios:* 👇\n${finalLink}\n\nSi necesitas algo, escríbeme directamente.`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

        const html = `
        <div id="modal-traffic-campaign" class="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 font-system overflow-y-auto">
            <div class="w-full max-w-lg bg-[#020617] border-2 border-orange-500 relative p-6 shadow-[0_0_50px_rgba(249,115,22,0.2)] my-auto animate-pop-in rounded-lg">
                
                <!-- Deco Superior -->
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-yellow-500 to-orange-600"></div>

                <div class="flex items-center gap-4 mb-4 border-b border-slate-800 pb-4">
                    <div class="w-12 h-12 bg-orange-500/20 border border-orange-500 rounded-lg flex items-center justify-center animate-pulse shrink-0">
                        <span class="material-symbols-outlined text-orange-500 text-3xl">share</span>
                    </div>
                    <div>
                        <h2 class="text-xl md:text-2xl font-black text-white uppercase tracking-widest leading-none">OPERACIÓN TRÁFICO</h2>
                        <p class="text-orange-400 font-bold text-[10px] tracking-[0.2em] mt-1 uppercase">El secreto de las comisiones pasivas</p>
                    </div>
                </div>

                <div class="space-y-4 text-slate-300 text-sm leading-relaxed mb-6">
                    <div class="bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded">
                        <p><b class="text-white">¿Por qué hay gestores que ganan dinero mientras duermen?</b></p>
                        <p class="text-xs mt-1 text-slate-400">Porque saben que su <span class="text-blue-400 font-bold">Enlace Inteligente</span> trabaja por ellos. Cuando publicas tu link y alguien entra, el sistema le pega una <b>etiqueta invisible (cookie)</b> en su celular con tu nombre.</p>
                    </div>

                    <div class="bg-orange-950/30 border-l-4 border-orange-500 p-3 rounded text-orange-200 text-xs">
                        💡 <b>LA VENTAJA:</b> Si ese cliente no tiene dinero hoy, pero entra en 15 días desde su historial y pide un equipo... <b>¡LA COMISIÓN ES TUYA AUTOMÁTICAMENTE!</b> No tienes ni que hablar con él.
                    </div>

                    <p class="text-xs">
                        🎯 <b>NUEVA MISIÓN:</b> El sistema contará cada persona real que atraigas con tu enlace. Podrás ver tu posición en el <b>Top Influencia</b>. Además, desbloquearás poderes sin necesidad de hacer ventas:
                    </p>

                    <div class="bg-[#0f172a] p-4 rounded border border-slate-700">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">RECOMPENSAS POR TRÁFICO:</h4>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                <span class="bg-slate-800 text-white font-black text-[10px] px-2 py-1 rounded w-16 text-center">50 Clics</span>
                                <span class="text-xs font-bold text-blue-400 flex-1">🔓 Desbloquea Descarga de Fotos.</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="bg-slate-800 text-white font-black text-[10px] px-2 py-1 rounded w-16 text-center">200 Clics</span>
                                <span class="text-xs font-bold text-red-400 flex-1">🔓 Desbloquea Catálogo PDF Pro.</span>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="bg-orange-600 text-white font-black text-[10px] px-2 py-1 rounded w-16 text-center shadow-[0_0_10px_#ea580c] mt-0.5">500 Clics</span>
                                <div class="flex-1 leading-tight">
                                    <span class="text-xs font-black text-orange-400 block">👑 ENLACE VIP (DURA 6 MESES)</span>
                                    <span class="text-[10px] text-slate-400">Atrapa a tus clientes por medio año entero.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl mb-4">
                    <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">TU ARMA LISTA (CÓPIALO AHORA):</p>
                    <div class="flex gap-2 mb-3">
                        <input type="text" id="mission-quick-link" value="${finalLink}" readonly class="w-full bg-black/50 text-emerald-200 border border-emerald-500/30 rounded-lg p-3 text-xs font-mono font-bold focus:ring-0">
                        <button onclick="TrafficCampaign.copyQuickLink(this)" class="bg-slate-700 text-white px-4 rounded-lg font-black text-xs hover:bg-slate-600 transition-all shadow-lg active:scale-95">
                            COPIAR
                        </button>
                    </div>
                    <a href="${waUrl}" target="_blank" class="w-full py-3 bg-[#25D366] text-white rounded-lg font-black text-sm uppercase flex items-center justify-center gap-2 hover:bg-[#20bd5c] transition-all shadow-lg shadow-green-900/50 active:scale-95">
                        <i class="fab fa-whatsapp text-lg"></i> ENVIAR A TUS CONTACTOS
                    </a>
                </div>

                <button onclick="document.getElementById('modal-traffic-campaign').remove(); localStorage.setItem('seen_traffic_campaign_v4', 'true');" class="w-full py-3 bg-transparent border border-slate-600 text-slate-400 font-bold text-xs uppercase tracking-[0.2em] hover:bg-slate-800 hover:text-white transition-all rounded">
                    Cerrar ventana
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
    },

    copyQuickLink: function(btn) {
        const input = document.getElementById('mission-quick-link');
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            const oldText = btn.innerText;
            btn.innerHTML = "¡COPIADO!";
            btn.classList.add("bg-emerald-500");
            setTimeout(() => {
                btn.innerHTML = oldText;
                btn.classList.remove("bg-emerald-500");
            }, 2000);
        });
    }
};

window.addEventListener('load', () => {
    setTimeout(() => TrafficCampaign.init(), 100);
});