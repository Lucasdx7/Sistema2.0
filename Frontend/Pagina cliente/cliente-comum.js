// /Frontend/Pagina cliente/cliente-comum.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Cliente Comum] Script de sessão WebSocket carregado.');

    // Obtém o ID da sessão do cliente.
    const sessaoId = localStorage.getItem('sessaoId');

    // Se não houver sessão, não faz nada.
    if (!sessaoId) {
        console.log('[Cliente Comum] Nenhuma sessão ativa. WebSocket não será conectado.');
        return;
    }

    // Função para obter o nome da página atual a partir da URL.
    const getPageName = () => {
        try {
            const path = window.location.pathname.split('/').pop(); // Ex: "Paginausuario.html"
            return path.split('.')[0].toLowerCase(); // Retorna "paginausuario"
        } catch (e) {
            return 'desconhecida';
        }
    };

    // Constrói a URL de conexão CORRETA, com todos os parâmetros que o servidor espera.
    const wsUrl = `ws://${window.location.host}?clientType=cliente&page=${getPageName()}&sessaoId=${sessaoId}`;
    console.log(`[Cliente Comum] Conectando ao WebSocket em: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[Cliente Comum] Conectado ao WebSocket como Cliente.');
    };

    // Lógica para receber e processar mensagens do servidor.
    ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        console.log('[Cliente Comum] Mensagem recebida:', data);

        // Verifica se o comando é para forçar a desconexão.
        if (data.type === 'FORCE_DISCONNECT') {
            console.warn(`[Cliente Comum] Recebido comando de desconexão: ${data.payload.reason}`);
            
            // --- LÓGICA DE DESCONEXÃO CORRIGIDA ---

            // 1. Limpa todos os dados da sessão do cliente no navegador.
            localStorage.removeItem('sessaoId');
            localStorage.removeItem('mesaId');
            localStorage.removeItem('nomeMesa');
            localStorage.removeItem('dadosCliente');
            localStorage.removeItem('carrinho');

            // 2. Mostra um alerta simples e imediato para o usuário.
            // O alert() pausa a execução, garantindo que o usuário veja a mensagem.
            alert('Sua sessão foi encerrada por um administrador. Você será redirecionado para a tela de login.');

            // 3. Força o redirecionamento para a página de login.
            // Esta linha será executada assim que o usuário clicar em "OK" no alerta.
            window.location.href = '/login'; 
        }
    } catch (error) {
        console.error('[Cliente Comum] Erro ao processar mensagem do WebSocket:', error);
    }
};
    ws.onclose = () => {
        console.log('[Cliente Comum] WebSocket desconectado. Tentando reconectar em 5 segundos...');
        // Tenta reconectar para manter a sessão viva e receber comandos.
        setTimeout(() => {
            // Recria a conexão chamando a si mesma de forma segura.
            const newWs = new WebSocket(wsUrl);
            // É preciso reatribuir os handlers para a nova conexão.
            newWs.onopen = ws.onopen;
            newWs.onmessage = ws.onmessage;
            newWs.onclose = ws.onclose;
            newWs.onerror = ws.onerror;
        }, 5000);
    };

    ws.onerror = (error) => {
        console.error('[Cliente Comum] Erro no WebSocket do Cliente:', error);
    };
});
