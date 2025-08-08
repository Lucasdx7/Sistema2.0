// /Frontend/Pagina_dev/dev.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Configuração Inicial e Autenticação ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/dev-login';
        return;
    }

    const API_BASE_URL = '/api/dev';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // --- 2. Elementos do DOM ---
    const userTableBody = document.getElementById('user-table-body');
    const sessionTableBody = document.getElementById('session-table-body');
    const sessionCount = document.getElementById('session-count');
    const wsStatus = document.getElementById('status-websocket');

    // --- 3. Funções de Notificação ---
    const showError = (message) => Swal.fire({ icon: 'error', title: 'Erro', text: message });
    const showSuccess = (message) => Swal.fire({ icon: 'success', title: 'Sucesso', text: message });

    // --- 4. Lógica de Gerenciamento de Usuários ---
    async function carregarUsuarios() {
        try {
            const response = await fetch(`${API_BASE_URL}/usuarios`, { headers });
            if (response.status >= 401) {
                localStorage.removeItem('token');
                await Swal.fire({ icon: 'warning', title: 'Sessão Expirada', text: 'Por favor, faça login novamente.' });
                window.location.href = '/dev-login';
                return;
            }
            if (!response.ok) throw new Error('Falha ao carregar usuários.');
            
            const usuarios = await response.json();
            userTableBody.innerHTML = '';
            usuarios.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.nome}</td>
                    <td>${user.email}</td>
                    <td>${user.nivel_acesso}</td>
                    <td><button class="action-btn change-password-btn" data-user-id="${user.id}" data-user-name="${user.nome}">Alterar Senha</button></td>
                `;
                userTableBody.appendChild(row);
            });
        } catch (error) {
            showError(error.message);
        }
    }

    userTableBody.addEventListener('click', async (event) => {
        const changePasswordBtn = event.target.closest('.change-password-btn');
        if (!changePasswordBtn) return;
        
        const { userId, userName } = changePasswordBtn.dataset;

        const { value: novaSenha } = await Swal.fire({
            title: `Alterar senha de ${userName}`,
            input: 'password',
            inputLabel: 'Nova Senha',
            inputPlaceholder: 'Mínimo de 4 caracteres',
            showCancelButton: true,
            confirmButtonText: 'Alterar',
            inputValidator: (v) => !v || v.length < 4 ? 'A senha precisa ter no mínimo 4 caracteres!' : null
        });

        if (novaSenha) {
            try {
                const response = await fetch(`${API_BASE_URL}/alterar-senha`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ usuarioId: userId, novaSenha })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                showSuccess(result.message);
            } catch (error) {
                showError(error.message);
            }
        }
    });

    // --- 5. Lógica de Gerenciamento de Sessões (WebSocket e Ações) ---
    function conectarWebSocket() {
        const wsUrl = `ws://${window.location.host}?clientType=dev&page=dev-painel`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Conectado ao servidor WebSocket como DEV.');
            wsStatus.textContent = 'Conectado';
            wsStatus.className = 'status-badge status-online';
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'SESSIONS_UPDATE') {
                renderSessions(data.payload);
            }
        };

        ws.onclose = () => {
            console.log('Desconectado. Tentando reconectar em 5s...');
            wsStatus.textContent = 'Desconectado';
            wsStatus.className = 'status-badge status-offline';
            setTimeout(conectarWebSocket, 5000);
        };

        ws.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            wsStatus.textContent = 'Erro';
            wsStatus.className = 'status-badge status-offline';
            ws.close();
        };
    }

    function renderSessions(sessions) {
        sessionTableBody.innerHTML = '';
        sessionCount.textContent = sessions.length;
        if (sessions.length === 0) {
            sessionTableBody.innerHTML = '<tr><td colspan="6">Nenhuma sessão ativa no momento.</td></tr>';
            return;
        }
        sessions.forEach(s => {
            const row = document.createElement('tr');
            let actionsHtml = '';

            if (s.clientType === 'dev') {
                actionsHtml = '<span>Painel Atual</span>';
            } else {
                actionsHtml += `<button class="action-btn disconnect-btn" data-session-id="${s.id}" title="Forçar desconexão do WebSocket"><i class="fas fa-power-off"></i></button>`;
                if ((s.clientType === 'cliente' || s.clientType === 'gerencia') && s.userId) {
                    actionsHtml += `<button class="action-btn force-close-btn" data-session-id="${s.userId}" title="Finalizar a conta/sessão deste usuário"><i class="fas fa-store-slash"></i></button>`;
                }
            }

            row.innerHTML = `
                <td>${s.id}</td>
                <td>${s.clientType}</td>
                <td>${s.page || 'N/A'}</td>
                <td>${s.ip}</td>
                <td>${new Date(s.connectedAt).toLocaleTimeString()}</td>
                <td class="actions-cell">${actionsHtml}</td>
            `;
            sessionTableBody.appendChild(row);
        });
    }

    sessionTableBody.addEventListener('click', async (event) => {
        const disconnectBtn = event.target.closest('.disconnect-btn');
        const forceCloseBtn = event.target.closest('.force-close-btn');

        if (!disconnectBtn && !forceCloseBtn) return;

        if (disconnectBtn) {
            const sessionId = disconnectBtn.dataset.sessionId;
            const confirm = await Swal.fire({
                title: 'Desconectar WebSocket?',
                text: `A conexão da sessão ${sessionId} será fechada.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sim, desconectar'
            });
            if (confirm.isConfirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/disconnect-session`, {
                        method: 'POST', headers, body: JSON.stringify({ clientId: sessionId })
                    });
                    if (!response.ok) throw new Error((await response.json()).message);
                    showSuccess((await response.json()).message);
                } catch (error) { showError(error.message); }
            }
        }

        if (forceCloseBtn) {
            const sessaoId = forceCloseBtn.dataset.sessionId;
            const { value: formaPagamento, isConfirmed } = await Swal.fire({
                title: 'Finalizar Sessão de Cliente',
                text: `Selecione a forma de pagamento para encerrar a sessão ID ${sessaoId}.`,
                input: 'select',
                inputOptions: {
                    'dinheiro': 'Dinheiro', 'cartao': 'Cartão', 'pix': 'PIX',
                    'dev_force': 'Forçado pelo DEV (sem pgto)'
                },
                inputPlaceholder: 'Selecione uma opção',
                showCancelButton: true,
                confirmButtonText: 'Confirmar e Finalizar',
                confirmButtonColor: '#d33',
                inputValidator: (value) => !value && 'Você precisa selecionar uma opção!'
            });

            if (isConfirmed && formaPagamento) {
                try {
                    const response = await fetch(`${API_BASE_URL}/force-close-session`, {
                        method: 'POST', headers, body: JSON.stringify({ sessaoId, formaPagamento })
                    });
                    if (!response.ok) throw new Error((await response.json()).message);
                    showSuccess((await response.json()).message);
                } catch (error) { showError(error.message); }
            }
        }
    });

    // --- 6. Inicialização ---
    carregarUsuarios();
    conectarWebSocket();
});



//1. Health Check (Verificação de Saúde do Sistema)
//Esta é a melhoria mais rápida e de maior impacto que podemos fazer.
//O que é? Uma seção no topo do painel que mostra o status em tempo real dos componentes vitais do seu sistema.
//Como seria?
//Status do Servidor: Um indicador (verde/vermelho) mostrando se o servidor Node.js está online.
//Status do Banco de Dados: Um indicador mostrando se a conexão com o MySQL está ativa.
//Latência da API: Um número mostrando o tempo de resposta (em ms) de um endpoint básico da API, para medir a "saúde" e a velocidade da comunicação.
//Por que é útil? Permite que você veja com um único olhar se o sistema está operando normalmente ou se há um problema crítico (ex: o banco de dados caiu) sem precisar olhar os logs do servidor.
//2. Visualizador de Logs em Tempo Real (Aprimorado)
//Atualmente, você tem um log de eventos do WebSocket. Podemos expandir isso para um visualizador de logs completo.
//O que é? Uma seção que transmite todos os console.log importantes do seu servidor diretamente para o painel DEV.
//Como seria?
//Logs Coloridos: Usar cores diferentes para tipos de log ([INFO], [WARN], [ERROR]).
//Filtro de Logs: Um campo de busca para filtrar os logs por palavras-chave (ex: "sessaoId: 21", "ERRO").
//Botão de Pausar/Limpar: Para pausar o fluxo de logs e para limpar a tela.
//Por que é útil? Você poderia depurar problemas de produção em tempo real sem precisar ter acesso direto ao terminal do servidor. Veria erros de SQL, falhas de login e outros eventos críticos instantaneamente.


//5. Análise de Performance da API
//Esta é uma melhoria mais avançada, mas extremamente poderosa.
//O que é? Um dashboard que monitora a performance das suas rotas da API.
//Como seria?
//Um middleware no seu backend que mede o tempo de execução de cada rota da API.
//Os dados (rota, tempo de execução, status code) seriam enviados para o painel DEV via WebSocket.
//O painel exibiria uma tabela com:
//Endpoint: (ex: POST /api/pedidos)
//Média de Tempo: (ex: 45ms)
//Total de Chamadas: (ex: 152)
//Taxa de Erro: (ex: 2%)
//Por que é útil? Ajuda a identificar gargalos de performance. Se você notar que a rota de relatórios está demorando muito (>500ms), saberá que precisa otimizar aquela query SQL.