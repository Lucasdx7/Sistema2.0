// /Frontend/Pagina gerencia/gerencia-core.js (Versão "Maestro" Final)

document.addEventListener('DOMContentLoaded', () => {
    // Previne que o script rode mais de uma vez
    if (window.gerenciaWsConectado) return;
    window.gerenciaWsConectado = true;

    console.log('%c[Gerencia Core] Iniciando script maestro...', 'color: blue; font-weight: bold;');

    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('%c[Gerencia Core] ERRO: Token não encontrado.', 'color: red;');
        return;
    }

    function getUserInfoFromToken(jwt) {
        try {
            const payload = JSON.parse(atob(jwt.split('.')[1]));
            return { id: payload.id, cargo: payload.nivel_acesso };
        } catch (e) { return null; }
    }

    const userInfo = getUserInfoFromToken(token);
    if (!userInfo || !userInfo.id || !userInfo.cargo) {
        console.error('%c[Gerencia Core] ERRO: Informações (ID, Cargo) não encontradas no token.', 'color: red;');
        return;
    }

    function connect() {
        const pageName = window.location.pathname.split('/').pop().split('.')[0] || 'desconhecida';
        const wsUrl = `ws://${window.location.host}?clientType=${userInfo.cargo}&page=${pageName}&userId=${userInfo.id}`;
        
        console.log(`%c[Gerencia Core] Conectando a: ${wsUrl}`, 'color: purple;');
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => console.log('%c[Gerencia Core] WebSocket Conectado.', 'color: green;');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // ==================================================================
            // --- ROTEADOR DE MENSAGENS INTELIGENTE ---
            // Ele chama funções que devem existir no script da página específica.
            // ==================================================================
            switch (data.type) {
                case 'FORCE_DISCONNECT':
                    // Esta é uma ação global, então é tratada aqui mesmo.
                    Swal.fire({
                        icon: 'warning', title: 'Sessão Encerrada', text: data.payload.reason,
                        allowOutsideClick: false, allowEscapeKey: false,
                    }).then(() => {
                        localStorage.clear();
                        window.location.href = '/login-gerencia';
                    });
                    break;

                case 'SESSIONS_UPDATE':
                    // Procura pela função 'renderSessions' na página atual e a chama.
                    if (typeof renderSessions === 'function') {
                        renderSessions(data.payload, userInfo.id);
                    }
                    break;

                case 'CHAMADO_GARCOM':
                    // Mostra o pop-up de alerta em qualquer página da gerência.
                    Swal.fire({
                        title: '<strong>Chamado!</strong>',
                        html: `<h2>A <strong>${data.payload.nomeMesa}</strong> está solicitando atendimento.</h2>`,
                        icon: 'warning', confirmButtonText: 'OK, Entendido!'
                    });
                    // Se a página tiver uma função 'handleNovoChamado', a executa.
                    if (typeof handleNovoChamado === 'function') {
                        handleNovoChamado();
                    }
                    break;

                case 'NOVO_PEDIDO':
                case 'PEDIDO_ATUALIZADO':
                case 'PAGAMENTO_FINALIZADO':
                    // Se a página tiver uma função 'handleUpdatePedidos', a executa.
                    if (typeof handleUpdatePedidos === 'function') {
                        handleUpdatePedidos();
                    }
                    break;
            }
        };

        ws.onclose = () => {
            window.gerenciaWsConectado = false;
            setTimeout(connect, 5000);
        };
        ws.onerror = (error) => console.error('[Gerencia Core] Erro no WebSocket:', error);
    }

    // Inicia a conexão
    connect();
});
