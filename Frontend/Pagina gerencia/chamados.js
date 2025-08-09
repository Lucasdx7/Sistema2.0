
/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE CHAMADOS DE GARÇOM (chamados.html)
 * ==================================================================
 * Controla a exibição e gerenciamento dos chamados em tempo real,
 * incluindo a funcionalidade de limpar chamados atendidos.
 * Exibe, marca como atendido e remove chamados, além de integrar com WebSocket para atualizações em tempo real.
 */

// Aguarda o carregamento completo do DOM para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Elementos do DOM ---
    // Seleciona todos os elementos necessários da página para manipulação posterior
    const chamadosGrid = document.getElementById('chamados-grid');
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');
    const limparChamadosBtn = document.getElementById('limpar-chamados-btn');

    // --- Autenticação ---
    // Verifica se o usuário está autenticado, caso contrário redireciona para o login
    const token = localStorage.getItem('authToken');
    const usuarioString = localStorage.getItem('usuario');

    if (!token || !usuarioString) {
        Notificacao.erro('Acesso Negado', 'Você precisa estar logado para ver esta página.')
            .then(() => window.location.href = '/login-gerencia');
        return;
    }
    const usuario = JSON.parse(usuarioString);

    // --- Funções ---
    // Função para realizar logout do sistema

    function fazerLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('usuario');
        Notificacao.sucesso('Logout realizado com sucesso!');
        setTimeout(() => window.location.href = '/login-gerencia', 1500);
    }

    /**
     * Cria o HTML para um único card de chamado.
     * @param {object} chamado - O objeto do chamado com id, nome_mesa, data_hora, status.
     * @returns {string} - O HTML do card.
     */
    // Cria o HTML para um único card de chamado
    function criarCardChamado(chamado) {
        const data = new Date(chamado.data_hora);
        const horarioFormatado = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isAtendido = chamado.status === 'atendido';

        return `
            <div class="chamado-card ${chamado.status}" data-id="${chamado.id}">
                <div class="card-header">
                    <i class="fas fa-bell"></i>
                    <h3 class="mesa-nome">${chamado.nome_mesa}</h3>
                </div>
                <div class="card-body">
                    <p class="horario">Chamado às: <strong>${horarioFormatado}</strong></p>
                </div>
                <div class="card-footer">
                    ${!isAtendido ? 
                        `<button class="btn-atender">Marcar como Atendido</button>` : 
                        `<span><i class="fas fa-check-circle"></i> Atendido</span>`
                    }
                </div>
            </div>
        `;
    }

    /**
     * Busca os chamados da API e renderiza na tela.
     */
    // Busca os chamados da API e renderiza na tela
    async function carregarChamados() {
        try {
            const response = await fetch('/api/chamados', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar chamados.');
            
            const chamados = await response.json();
            chamadosGrid.innerHTML = ''; // Limpa a área

            if (chamados.length === 0) {
                chamadosGrid.innerHTML = '<p class="empty-message">Nenhum chamado registrado no momento.</p>';
                limparChamadosBtn.disabled = true; // Desabilita o botão se não há chamados
                return;
            }

            // Ordena para que os pendentes apareçam primeiro
            chamados.sort((a, b) => (a.status === 'pendente' ? -1 : 1) - (b.status === 'pendente' ? -1 : 1));

            let atendidosCount = 0;
            chamados.forEach(chamado => {
                if (chamado.status === 'atendido') atendidosCount++;
                chamadosGrid.innerHTML += criarCardChamado(chamado);
            });

            // Habilita ou desabilita o botão de limpar com base na existência de chamados atendidos
            limparChamadosBtn.disabled = atendidosCount === 0;

        } catch (error) {
            Notificacao.erro('Erro ao Carregar', error.message);
            chamadosGrid.innerHTML = `<p class="empty-message error-message">${error.message}</p>`;
        }
    }

    /**
     * Marca um chamado como atendido.
     * @param {string} chamadoId - O ID do chamado a ser atualizado.
     */
    // ...
// Marca um chamado como atendido e atualiza o card na tela
async function atenderChamado(chamadoId) {
    try {
        const response = await fetch(`/api/chamados/${chamadoId}/atender`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao atualizar o status do chamado.');

        Notificacao.sucesso('Chamado atendido!');

        // --- INÍCIO DA NOVA LÓGICA ---
        // Em vez de recarregar tudo, vamos apenas modificar o card existente.
        const card = document.querySelector(`.chamado-card[data-id='${chamadoId}']`);
        if (card) {
            card.classList.remove('pendente');
            card.classList.add('atendido'); // Muda a classe para alterar o estilo

            const footer = card.querySelector('.card-footer');
            if (footer) {
                // Substitui o botão por uma mensagem de "Atendido"
                footer.innerHTML = `<span><i class="fas fa-check-circle"></i> Atendido</span>`;
            }
        }
        // Habilita o botão de limpar, pois agora existe pelo menos um item atendido.
        limparChamadosBtn.disabled = false;
        // --- FIM DA NOVA LÓGICA ---

    } catch (error) {
        Notificacao.erro('Erro', error.message);
        // Se der erro, reabilita o botão para que o usuário possa tentar de novo.
        const card = document.querySelector(`.chamado-card[data-id='${chamadoId}']`);
        if (card) {
            const atenderBtn = card.querySelector('.btn-atender');
            if(atenderBtn) {
                atenderBtn.disabled = false;
                atenderBtn.textContent = 'Marcar como Atendido';
            }
        }
    }
}
// ...

    
    /**
     * Limpa todos os chamados que já foram atendidos.
     */
    // Limpa todos os chamados que já foram atendidos
    async function limparChamadosAtendidos() {
        limparChamadosBtn.disabled = true;
        limparChamadosBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Limpando...';

        try {
            // NOTA: A rota DELETE '/api/chamados/limpar-atendidos' precisa ser criada no backend!
            const response = await fetch('/api/chamados/limpar-atendidos', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const erro = await response.json();
                throw new Error(erro.message || 'Falha ao limpar os chamados.');
            }

            Notificacao.sucesso('Limpeza Concluída', 'Os chamados atendidos foram removidos.');
            await carregarChamados(); // Atualiza a visualização

        } catch (error) {
            Notificacao.erro('Erro na Limpeza', error.message);
        } finally {
            limparChamadosBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Limpar Atendidos';
            // A função carregarChamados() já vai reavaliar se o botão deve estar habilitado ou não.
        }
    }

    /**
     * Conecta ao WebSocket para receber novos chamados em tempo real.
     */
    // Conecta ao WebSocket para receber novos chamados em tempo real
    function conectarWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        const ws = new WebSocket(wsUrl );

        ws.onmessage = (event) => {
            const mensagem = JSON.parse(event.data);
            if (mensagem.type === 'CHAMADO_GARCOM') {
                carregarChamados();
                Swal.fire({
                    title: '<strong>Novo Chamado!</strong>',
                    html: `<h2>A <strong>${mensagem.nomeMesa}</strong> está solicitando atendimento.</h2>`,
                    icon: 'warning',
                    confirmButtonText: 'OK, Entendido!',
                    timer: 10000, // Fecha automaticamente após 10 segundos
                    timerProgressBar: true
                });
            }
        };
        ws.onclose = () => setTimeout(conectarWebSocket, 5000);
    }

    // --- Event Listeners ---
    // Adiciona listeners para menu de perfil, logout, botões de ação e inicialização
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
        const confirmado = await Notificacao.confirmar('Sair do Sistema', 'Deseja mesmo sair?');
        if (confirmado) fazerLogout();
    });

    // Delegação de eventos para os botões "Atender"
    chamadosGrid.addEventListener('click', (e) => {
        const atenderBtn = e.target.closest('.btn-atender');
        if (atenderBtn) {
            const card = atenderBtn.closest('.chamado-card');
            const chamadoId = card.dataset.id;
            atenderBtn.disabled = true;
            atenderBtn.textContent = 'Aguarde...';
            atenderChamado(chamadoId);
        }
    });

    // Event listener para o botão de limpar
    limparChamadosBtn.addEventListener('click', async () => {
        const confirmado = await Notificacao.confirmar(
            'Limpar Chamados Atendidos',
            'Deseja realmente remover o histórico de chamados atendidos? Esta ação não pode ser desfeita.',
            'Sim, limpar agora'
        );

        if (confirmado) {
            limparChamadosAtendidos();
        }
    });
    
    // --- Inicialização ---
    // Carrega os chamados e conecta ao WebSocket ao iniciar a página
    carregarChamados();
    conectarWebSocket();
});