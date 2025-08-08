/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE LOGS DO SISTEMA (logs.html) - VERSÃO FINAL
 * Com filtros de data e termo de busca.
 * ==================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const logsTableBody = document.querySelector('#logs-table tbody');
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');

    // --- Elementos dos Filtros ---
    const filtroDataInput = document.getElementById('filtro-data');
    const filtroTermoInput = document.getElementById('filtro-termo');
    const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');

    // --- Verificação de Autenticação ---
    const token = localStorage.getItem('authToken');
    const usuarioString = localStorage.getItem('usuario');

    if (!token || !usuarioString) {
        Notificacao.erro('Acesso Negado', 'Você precisa estar logado.')
            .then(() => window.location.href = '/login-gerencia');
        return;
    }
    const usuario = JSON.parse(usuarioString);
    

    // --- Funções ---

    function fazerLogout() {
        localStorage.clear();
        window.location.href = '/login-gerencia';
    }

    /**
     * Busca os logs da API com base nos filtros e os renderiza na tabela.
     */
    async function carregarLogs() {
    const data = filtroDataInput.value;
    const termo = filtroTermoInput.value.trim();

    // CORREÇÃO: A URL agora aponta para a rota dentro do módulo de relatórios
    const url = new URL('/api/relatorios/logs', window.location.origin);
    if (data) url.searchParams.append('data', data);
    if (termo) url.searchParams.append('termo', termo);

    logsTableBody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando logs...</td></tr>';

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erro de comunicação.' }));
                throw new Error(errorData.message);
            }
            
            const logs = await response.json();
            logsTableBody.innerHTML = '';

            if (logs.length === 0) {
                logsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum log encontrado para os filtros aplicados.</td></tr>';
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');
                const dataFormatada = new Date(log.data_hora).toLocaleString('pt-BR');
                tr.innerHTML = `
                    <td>${dataFormatada}</td>
                    <td>${log.nome_usuario || 'Usuário Deletado'}</td>
                    <td><span class="log-action">${log.acao}</span></td>
                    <td>${log.detalhes}</td>
                `;
                logsTableBody.appendChild(tr);
            });

        } catch (error) {
            Notificacao.erro('Falha ao Carregar Logs', error.message);
            logsTableBody.innerHTML = `<tr><td colspan="4" class="text-center error-message">Não foi possível carregar os logs.</td></tr>`;
        }
    }

    function limparFiltros() {
        filtroDataInput.value = '';
        filtroTermoInput.value = '';
        carregarLogs(); // Recarrega a lista completa
    }

    // --- Event Listeners ---
    btnAplicarFiltros.addEventListener('click', carregarLogs);
    btnLimparFiltros.addEventListener('click', limparFiltros);
    // Permite buscar pressionando Enter no campo de texto
    filtroTermoInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            carregarLogs();
        }
    });

    // --- Lógica do Menu de Perfil (sem alterações) ---
    if (dropdownUserName) dropdownUserName.textContent = usuario.nome;
    if (dropdownUserRole) dropdownUserRole.textContent = usuario.nivel_acesso;
    profileMenuBtn.addEventListener('click', () => profileDropdown.classList.toggle('hidden'));
    window.addEventListener('click', (e) => {
        if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmado = await Notificacao.confirmar('Sair do Sistema', 'Você tem certeza?');
        if (confirmado) fazerLogout();
    });

    function conectarWebSocket(usuario) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl );

    ws.onmessage = (event) => {
        try {
            const mensagem = JSON.parse(event.data);
            const token = localStorage.getItem('authToken');

            switch (mensagem.type) {
                case 'CHAMADO_GARCOM':
                    // A verificação de permissão foi movida para cá e corrigida.
                    // Primeiro, atualizamos o contador para todos que podem ver o card.
                    atualizarContador('chamados', token);

                    // Em seguida, verificamos se o card de chamados está visível para decidir se mostramos o pop-up.
                    const cardChamados = document.querySelector('.card-chamados');
                    if (cardChamados && getComputedStyle(cardChamados).display !== 'none') {
                        Swal.fire({
                            title: '<strong>Chamado!</strong>',
                            html: `<h2>A <strong>${mensagem.nomeMesa}</strong> está solicitando atendimento.</h2>`,
                            icon: 'warning',
                            confirmButtonText: 'OK, Entendido!'
                        });
                    }
                    break;

                case 'NOVO_PEDIDO':
                case 'PEDIDO_ATUALIZADO':
                    // Apenas atualiza o contador, sem pop-up.
                    atualizarContador('pedidos', token);
                    break;
            }
        } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
        }
    };

    ws.onclose = () => setTimeout(() => conectarWebSocket(usuario), 5000);
}

    // --- Inicialização ---
    carregarLogs(); // Carga inicial sem filtros
});
