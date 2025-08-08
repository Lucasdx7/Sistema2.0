// /Frontend/Pagina_dev/dev.js (Versão com a ordem das funções corrigida)

document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================
    // --- SEÇÃO 1: CONFIGURAÇÃO INICIAL E AUTENTICAÇÃO ---
    // ===================================================================
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

    // ===================================================================
    // --- SEÇÃO 2: ELEMENTOS DO DOM ---
    // ===================================================================
    const userTableBody = document.getElementById('user-table-body');
    const sessionTableBody = document.getElementById('session-table-body');
    const sessionCount = document.getElementById('session-count');
    const wsStatus = document.getElementById('status-websocket');
    const statusServer = document.getElementById('status-server');
    const statusDb = document.getElementById('status-db');
    const latencyApi = document.getElementById('latency-api');
    const logContainer = document.getElementById('log-container');
    const logFilter = document.getElementById('log-filter');
    const logPauseBtn = document.getElementById('log-pause-btn');
    const logClearBtn = document.getElementById('log-clear-btn');
    const apiPerformanceBody = document.getElementById('api-performance-body');

    // ===================================================================
    // --- SEÇÃO 3: ESTADO DA APLICAÇÃO E NOTIFICAÇÕES ---
    // ===================================================================
    const showError = (message) => Swal.fire({ icon: 'error', title: 'Erro', text: message });
    const showSuccess = (message) => Swal.fire({ icon: 'success', title: 'Sucesso', text: message });
    let isLogPaused = false;
    let apiPerformanceData = {};

    // ===================================================================
    // --- SEÇÃO 4: LÓGICA DE GERENCIAMENTO DE USUÁRIOS ---
    // ===================================================================
    // Encontre a função carregarUsuarios e atualize o `row.innerHTML`

async function carregarUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/usuarios`, { headers });
        if (response.status >= 401) {
            // ... (código de erro existente)
            return;
        }
        if (!response.ok) throw new Error('Falha ao carregar usuários.');
        
        const usuarios = await response.json();
        userTableBody.innerHTML = '';
        usuarios.forEach(user => {
            const row = document.createElement('tr');
            // ****** AQUI ESTÁ A MUDANÇA ******
            // Adicionamos o botão "Editar" e passamos todos os dados do usuário via atributos data-*
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.nome}</td>
                <td>${user.email}</td>
                <td>${user.nivel_acesso}</td>
                <td class="actions-cell">
                    <button class="action-btn edit-user-btn" 
                            data-user-id="${user.id}" 
                            data-user-nome="${user.nome}" 
                            data-user-email="${user.email}" 
                            data-user-nivel="${user.nivel_acesso}"
                            title="Editar Usuário">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn change-password-btn" 
                            data-user-id="${user.id}" 
                            data-user-name="${user.nome}"
                            title="Alterar Senha">
                        <i class="fas fa-key"></i> Senha
                    </button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    } catch (error) {
        showError(error.message);
    }
}


    // Encontre o eventListener da userTableBody e adicione a lógica para o 'edit-user-btn'

userTableBody.addEventListener('click', async (event) => {
    const changePasswordBtn = event.target.closest('.change-password-btn');
    const editUserBtn = event.target.closest('.edit-user-btn'); // <<-- NOVA LINHA

    // Lógica para alterar senha (existente)
    if (changePasswordBtn) {
        // ... (seu código para alterar senha continua aqui, sem alterações)
        const { userId, userName } = changePasswordBtn.dataset;
        // ... etc
    }

    // ****** AQUI ESTÁ A NOVA LÓGICA ******
    // Lógica para editar o usuário
    if (editUserBtn) {
        const { userId, userNome, userEmail, userNivel } = editUserBtn.dataset;

        const { value: formValues, isConfirmed } = await Swal.fire({
            title: `Editando Usuário: ${userNome}`,
            html: `
                <input id="swal-input-nome" class="swal2-input" placeholder="Nome" value="${userNome}">
                <input id="swal-input-email" class="swal2-input" placeholder="Email" value="${userEmail}">
                <select id="swal-input-nivel" class="swal2-input">
                    <option value="Pedidos" ${userNivel === 'Pedidos' ? 'selected' : ''}>Pedidos</option>
                    <option value="Geral" ${userNivel === 'Geral' ? 'selected' : ''}>Geral</option>
                    <option value="Dono" ${userNivel === 'Dono' ? 'selected' : ''}>Dono</option>
                    <!-- Não inclua a opção 'dono' para evitar problemas de segurança -->
                </select>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Salvar Alterações',
            preConfirm: () => ({
                nome: document.getElementById('swal-input-nome').value,
                email: document.getElementById('swal-input-email').value,
                nivel_acesso: document.getElementById('swal-input-nivel').value
            })
        });

        if (isConfirmed && formValues) {
            try {
                const response = await fetch(`${API_BASE_URL}/usuarios/${userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(formValues)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                showSuccess(result.message);
                carregarUsuarios(); // Recarrega a lista para mostrar os dados atualizados
            } catch (error) {
                showError(error.message);
            }
        }
    } else if (changePasswordBtn) {
        // ****** AQUI ESTÁ A LÓGICA RESTAURADA ******
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
                // Não precisa recarregar a lista aqui, pois a senha não é visível
            } catch (error) {
                showError(error.message);
            }
        }
    }
});


    // ===================================================================
    // --- SEÇÃO 5: LÓGICA DE GERENCIAMENTO DE SESSÕES (WebSocket e Ações) ---
    // ===================================================================
    
    // ****** AQUI ESTÁ A CORREÇÃO DA ORDEM ******
    // A função `conectarWebSocket` foi movida para DENTRO desta seção, junto com as outras funções de sessão.
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
            switch (data.type) {
                case 'SESSIONS_UPDATE':
                    renderSessions(data.payload);
                    break;
                case 'SERVER_LOG':
                    addLogEntry(data);
                    break;
                case 'API_PERFORMANCE':
                    updateApiPerformance(data.payload);
                    break;
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
            if (s.clientType === 'dev' && s.page === 'dev-painel') {
                actionsHtml = '<span>Painel Atual</span>';
            } else {
                actionsHtml += `<button class="action-btn disconnect-btn" data-session-id="${s.id}" title="Forçar desconexão do WebSocket"><i class="fas fa-power-off"></i></button>`;
                if ((s.clientType === 'cliente' || s.clientType === 'gerencia') && s.userId) {
                    actionsHtml += `<button class="action-btn force-close-btn" data-session-id="${s.userId}" title="Finalizar a conta/sessão deste usuário"><i class="fas fa-store-slash"></i></button>`;
                }
            }
            row.innerHTML = `<td>${s.id}</td><td>${s.clientType}</td><td>${s.page || 'N/A'}</td><td>${s.ip}</td><td>${new Date(s.connectedAt).toLocaleTimeString()}</td><td class="actions-cell">${actionsHtml}</td>`;
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

    // ===================================================================
    // --- SEÇÃO 6: NOVAS FUNÇÕES (HEALTH CHECK, LOGS, PERFORMANCE) ---
    // ===================================================================
    async function performHealthCheck() {
        try {
            const response = await fetch(`${API_BASE_URL}/health-check`, { headers });
            if (!response.ok) throw new Error('Falha na verificação.');
            const data = await response.json();
            statusServer.textContent = data.server === 'online' ? 'Online' : 'Offline';
            statusServer.className = `status-badge status-${data.server === 'online' ? 'online' : 'offline'}`;
            statusDb.textContent = data.database === 'online' ? 'Online' : 'Offline';
            statusDb.className = `status-badge status-${data.database === 'online' ? 'online' : 'offline'}`;
            latencyApi.textContent = `${data.apiLatency} ms`;
            latencyApi.className = `status-badge status-${data.apiLatency < 200 ? 'online' : 'warn'}`;
        } catch (error) {
            statusServer.textContent = 'Erro';
            statusServer.className = 'status-badge status-offline';
            statusDb.textContent = 'Erro';
            statusDb.className = 'status-badge status-offline';
        }
    }

    function addLogEntry({ level, message }) {
        if (isLogPaused) return;
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level.toLowerCase()}`;
        logEntry.innerHTML = `<span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span><span class="log-level">[${level}]</span><span class="log-message">${message}</span>`;
        const shouldScroll = logContainer.scrollTop + logContainer.clientHeight >= logContainer.scrollHeight - 10;
        logContainer.appendChild(logEntry);
        if (shouldScroll) logContainer.scrollTop = logContainer.scrollHeight;
        const filterText = logFilter.value.toLowerCase();
        if (filterText && !logEntry.textContent.toLowerCase().includes(filterText)) {
            logEntry.style.display = 'none';
        }
    }

    function updateApiPerformance({ method, endpoint, statusCode, duration }) {
        const key = `${method} ${endpoint}`;
        if (!apiPerformanceData[key]) {
            apiPerformanceData[key] = { calls: 0, totalDuration: 0, errors: 0, method, endpoint };
        }
        const entry = apiPerformanceData[key];
        entry.calls++;
        entry.totalDuration += duration;
        if (statusCode >= 400) entry.errors++;
        renderApiPerformance();
    }

    function renderApiPerformance() {
        apiPerformanceBody.innerHTML = '';
        Object.values(apiPerformanceData).sort((a, b) => b.calls - a.calls).forEach(entry => {
            const avgDuration = (entry.totalDuration / entry.calls).toFixed(2);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${entry.endpoint}</td><td>${entry.method}</td><td class="${avgDuration > 500 ? 'text-danger' : ''}">${avgDuration} ms</td><td>${entry.calls}</td><td>${entry.errors} (${((entry.errors / entry.calls) * 100).toFixed(1)}%)</td>`;
            apiPerformanceBody.appendChild(row);
        });
    }

    logPauseBtn.addEventListener('click', () => {
        isLogPaused = !isLogPaused;
        logPauseBtn.textContent = isLogPaused ? 'Continuar' : 'Pausar';
        logContainer.classList.toggle('paused', isLogPaused);
    });
    logClearBtn.addEventListener('click', () => { logContainer.innerHTML = ''; });
    logFilter.addEventListener('input', () => {
        const filterText = logFilter.value.toLowerCase();
        document.querySelectorAll('#log-container .log-entry').forEach(log => {
            log.style.display = log.textContent.toLowerCase().includes(filterText) ? 'block' : 'none';
        });
    });

    // ===================================================================
    // --- SEÇÃO 7: INICIALIZAÇÃO ---
    // ===================================================================
    carregarUsuarios();
    conectarWebSocket();
    performHealthCheck();
    setInterval(performHealthCheck, 30000);
});
