/* ======================================================
   SYSTEM EVENTS MANAGER - PROYECTO SOLO LEVELING
   Versión: 1.0 (Evento Febrero)
   ====================================================== */

const SystemEvent = {
    // CONFIGURACIÓN DEL EVENTO ACTUAL
    config: {
        id: "feb_quest_2026", // Cambia esto para que el anuncio vuelva a salir
        title: "EVENTO DE TEMPORADA",
        subTitle: "LA CACERÍA DE FEBRERO",
        missionText: "El Administrador ha activado una bonificación temporal.<br><br>🎯 <b>OBJETIVO:</b> Entrega equipos.<br>💰 <b>RECOMPENSA:</b> Cada <span style='color:#00f0ff'>5 VENTAS</span> recibes <span style='color:#fbbf24'>$5 USD EXTRA</span>.<br><br>El contador se reinicia al completar el combo.",
        startDate: "2026-02-01", // Fecha inicio conteo
        target: 5 // Meta del combo
    },

    // INICIALIZADOR
    init: async function() {
        if (!window.gestorName) return; // Solo para gestores
        
        // 1. Inyectar Estilos CSS
        this.injectStyles();

        // 2. Calcular Progreso Real
        const progress = await this.calculateProgress();

        // 3. Renderizar Barra en Dashboard (Siempre visible)
        this.renderComboBar(progress);

        // 4. Mostrar Modal (Solo si no lo ha visto hoy)
        const lastSeen = localStorage.getItem(`event_seen_${this.config.id}`);
        if (!lastSeen) {
            this.renderModal();
        }
    },

    // LÓGICA MATEMÁTICA (Consulatas a BD)
    calculateProgress: async function() {
        const { count, error } = await supabaseClient
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .eq('gestor', window.gestorName)
            .eq('estado', 'Entregado')
            .gte('created_at', this.config.startDate);

        if (error) return { current: 0, total_bonus: 0 };

        const totalVentas = count || 0;
        const currentCombo = totalVentas % this.config.target; // Residuo (Ej: 13 % 5 = 3)
        const cycles = Math.floor(totalVentas / this.config.target); // Ciclos (Ej: 13 / 5 = 2)
        
        return {
            current: currentCombo,
            total_sales: totalVentas,
            total_bonus: cycles * 5 // Dinero ganado
        };
    },

    // RENDERIZAR LA BARRA DE COMBO (DASHBOARD)
    renderComboBar: function(data) {
        const container = document.getElementById('sub-dash-resumen');
        if (!container) return;

        // Crear bloques del combo
        let blocksHTML = '';
        for (let i = 1; i <= this.config.target; i++) {
            const isFilled = i <= data.current;
            const glowClass = isFilled ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-slate-800 border border-slate-700';
            blocksHTML += `<div class="h-3 flex-1 rounded-sm transform skew-x-[-10deg] transition-all duration-500 ${glowClass}"></div>`;
        }

        const html = `
        <div class="mb-6 font-system animate-fade-in">
            <div class="flex justify-between items-end mb-2">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-cyan-400 animate-pulse">military_tech</span>
                    <span class="text-xs font-bold text-white tracking-widest uppercase">COMBO DE CAZA</span>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-slate-400 font-bold uppercase">BONUS ACUMULADO</span>
                    <span class="block text-xl font-black text-amber-400 text-shadow-glow">$${data.total_bonus} USD</span>
                </div>
            </div>
            
            <!-- BARRA SEGMENTADA -->
            <div class="flex gap-1 mb-2">
                ${blocksHTML}
            </div>
            
            <div class="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                <span>Progreso: ${data.current} / 5</span>
                <span>${data.current === 0 && data.total_bonus > 0 ? '¡COMBO COMPLETADO! EMPEZANDO DE NUEVO...' : '¡COMPLETA 5 PARA RECLAMAR!'}</span>
            </div>
        </div>`;

        // Insertar al principio del dashboard
        const div = document.createElement('div');
        div.innerHTML = html;
        container.insertBefore(div, container.firstChild);
    },

    // RENDERIZAR EL MODAL (SOLO LEVELING)
    renderModal: function() {
        const modalId = 'sys-event-modal';
        if (document.getElementById(modalId)) return;

        const html = `
        <div id="${modalId}" class="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-system animate-pop-in">
            <div class="scanline fixed inset-0 pointer-events-none"></div>
            
            <div class="w-full max-w-md bg-[#020617] border-2 border-[#1e3a8a] relative p-1 shadow-[0_0_50px_rgba(0,240,255,0.15)]">
                <!-- Decoración Esquinas -->
                <div class="absolute top-[-2px] left-[-2px] w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
                <div class="absolute top-[-2px] right-[-2px] w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
                <div class="absolute bottom-[-2px] left-[-2px] w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
                <div class="absolute bottom-[-2px] right-[-2px] w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>

                <!-- Header Azul -->
                <div class="bg-gradient-to-r from-[#0f172a] to-[#1e3a8a]/50 p-4 border-b border-[#1e3a8a] flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black font-black text-xs animate-pulse">!</div>
                        <span class="text-xs font-bold text-cyan-400 tracking-[0.2em]">MENSAJE DEL SISTEMA</span>
                    </div>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${this.config.title}</span>
                </div>

                <!-- Cuerpo -->
                <div class="p-8 text-center relative z-10">
                    <div class="mb-6 relative inline-block">
                        <span class="material-symbols-outlined text-6xl text-white drop-shadow-[0_0_15px_#00f0ff]">swords</span>
                        <div class="absolute inset-0 bg-cyan-400 blur-2xl opacity-20 animate-pulse"></div>
                    </div>

                    <h2 class="text-3xl font-black text-white uppercase tracking-wider mb-2 text-shadow-glow">
                        ${this.config.subTitle}
                    </h2>

                    <div class="text-sm text-slate-300 leading-relaxed font-medium mb-8 border-t border-b border-white/5 py-4">
                        ${this.config.missionText}
                    </div>

                    <!-- Barra Loading Falsa -->
                    <div class="mb-2 flex justify-between text-[9px] font-bold text-cyan-600 uppercase">
                        <span>Sincronización</span>
                        <span>100%</span>
                    </div>
                    <div class="h-1 w-full bg-slate-800 mb-6 relative overflow-hidden">
                        <div class="absolute top-0 left-0 h-full w-full bg-cyan-500 shadow-[0_0_10px_#00f0ff]"></div>
                    </div>

                    <button onclick="SystemEvent.closeModal()" class="w-full py-4 bg-transparent border border-cyan-500 text-cyan-400 font-black text-lg uppercase tracking-[0.2em] hover:bg-cyan-500 hover:text-black transition-all hover:shadow-[0_0_30px_rgba(0,240,255,0.4)]">
                        ACEPTAR MISIÓN
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
    },

    closeModal: function() {
        const modal = document.getElementById('sys-event-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 500);
            localStorage.setItem(`event_seen_${this.config.id}`, 'true');
        }
    },

    injectStyles: function() {
        if (document.getElementById('sys-event-styles')) return;
        const css = `
            .text-shadow-glow { text-shadow: 0 0 10px rgba(0, 240, 255, 0.5); }
            .font-system { font-family: 'Rajdhani', sans-serif; }
        `;
        const style = document.createElement('style');
        style.id = 'sys-event-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }
};

// Auto-ejecutar cuando cargue la página
window.addEventListener('load', () => {
    // Esperamos un poco a que Supabase cargue
    setTimeout(() => SystemEvent.init(), 1500);
});