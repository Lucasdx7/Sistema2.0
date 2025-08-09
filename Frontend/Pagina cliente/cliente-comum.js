// /Frontend/Pagina cliente/cliente-comum.js (Versão Aprimorada e Centralizada)


document.addEventListener('DOMContentLoaded', () => {
    // ==================================================================
    // --- BLOCO DE PREVENÇÃO DE DUPLICIDADE ---
    // Garante que só uma conexão WebSocket seja criada por vez
    if (window.clienteWsConectado) {
        return;
    }
    // ==================================================================

    console.log('[Cliente Comum] Script de sessão WebSocket carregado.');

    // Recupera o ID da sessão do localStorage
    const sessaoId = localStorage.getItem('sessaoId');
    if (!sessaoId) {
        console.log('[Cliente Comum] Nenhuma sessão ativa. WebSocket não será conectado.');
        return;
    }

    // Função auxiliar para obter o nome da página atual
    const getPageName = () => {
        try {
            const path = window.location.pathname.split('/').pop();
            return path.split('.')[0].toLowerCase() || 'desconhecida';
        } catch (e) {
            return 'desconhecida';
        }
    };

    // Monta a URL do WebSocket com parâmetros de identificação
    const wsUrl = `ws://${window.location.host}?clientType=cliente&page=${getPageName()}&sessaoId=${sessaoId}`;
    console.log(`[Cliente Comum] Conectando ao WebSocket em: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    // Evento disparado ao abrir a conexão WebSocket
    ws.onopen = () => {
        console.log('[Cliente Comum] Conectado ao WebSocket como Cliente.');
        // Marca que a conexão foi feita para evitar que o script rode de novo.
        window.clienteWsConectado = true;
    };

    // Evento disparado ao receber mensagem do servidor
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('[Cliente Comum] Mensagem recebida:', data);

            // Lógica de desconexão forçada ou sessão finalizada
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

    // Evento disparado ao fechar a conexão WebSocket
    ws.onclose = () => {
        console.log('[Cliente Comum] WebSocket desconectado.');
        window.clienteWsConectado = false; // Permite a reconexão

        // Só tenta reconectar se a sessão não foi fechada de propósito.
        if (!window.sessaoFechadaIntencionalmente) {
            console.log('Tentando reconectar em 5 segundos...');
            setTimeout(() => new WebSocket(wsUrl), 5000); // Simplificado
        }
    };

    // Evento disparado em caso de erro na conexão WebSocket
    ws.onerror = (error) => {
        console.error('[Cliente Comum] Erro no WebSocket do Cliente:', error);
        ws.close(); // Força o onclose para acionar a lógica de reconexão
    };
});
