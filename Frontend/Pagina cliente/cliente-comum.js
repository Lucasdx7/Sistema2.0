// /Frontend/Pagina cliente/cliente-comum.js (Versão Aprimorada e Centralizada)

document.addEventListener('DOMContentLoaded', () => {
    // ==================================================================
    // --- BLOCO DE PREVENÇÃO DE DUPLICIDADE ---
    // Se uma conexão já foi estabelecida por este script, ele não faz mais nada.
    // Isso impede que o script crie múltiplas conexões se for carregado mais de uma vez.
    if (window.clienteWsConectado) {
        return;
    }
    // ==================================================================

    console.log('[Cliente Comum] Script de sessão WebSocket carregado.');

    const sessaoId = localStorage.getItem('sessaoId');
    if (!sessaoId) {
        console.log('[Cliente Comum] Nenhuma sessão ativa. WebSocket não será conectado.');
        return;
    }

    const getPageName = () => {
        try {
            const path = window.location.pathname.split('/').pop();
            return path.split('.')[0].toLowerCase() || 'desconhecida';
        } catch (e) {
            return 'desconhecida';
        }
    };

    const wsUrl = `ws://${window.location.host}?clientType=cliente&page=${getPageName()}&sessaoId=${sessaoId}`;
    console.log(`[Cliente Comum] Conectando ao WebSocket em: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[Cliente Comum] Conectado ao WebSocket como Cliente.');
        // Marca que a conexão foi feita para evitar que o script rode de novo.
        window.clienteWsConectado = true;
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('[Cliente Comum] Mensagem recebida:', data);

            // Mantém a sua lógica original de desconexão, mas usando SweetAlert para consistência.
            if (data.type === 'FORCE_DISCONNECT' || (data.type === 'SESSAO_ATUALIZADA' && data.payload.status === 'finalizada')) {
                console.warn(`[Cliente Comum] Recebido comando de desconexão: ${data.payload?.reason || 'Sessão finalizada'}`);
                
                // Marca que a conexão foi intencionalmente fechada para não tentar reconectar.
                window.sessaoFechadaIntencionalmente = true;

                Swal.fire({
                    icon: 'warning',
                    title: 'Sessão Encerrada',
                    text: 'Sua sessão foi finalizada. Você será redirecionado para a tela de login.',
                    allowOutsideClick: false,
                    allowEscapeKey: false
                }).then(() => {
                    localStorage.clear(); // Limpa todos os dados para segurança
                    window.location.href = '/login';
                });
            }
        } catch (error) {
            console.error('[Cliente Comum] Erro ao processar mensagem do WebSocket:', error);
        }
    };

    ws.onclose = () => {
        console.log('[Cliente Comum] WebSocket desconectado.');
        window.clienteWsConectado = false; // Permite a reconexão

        // Só tenta reconectar se a sessão não foi fechada de propósito.
        if (!window.sessaoFechadaIntencionalmente) {
            console.log('Tentando reconectar em 5 segundos...');
            setTimeout(() => new WebSocket(wsUrl), 5000); // Simplificado
        }
    };

    ws.onerror = (error) => {
        console.error('[Cliente Comum] Erro no WebSocket do Cliente:', error);
        ws.close(); // Força o onclose para acionar a lógica de reconexão
    };
});
