/**
 * ==================================================================
 * SCRIPT DA PÁGINA INICIAL DA GERÊNCIA (Gerencia-Home.html)
 * VERSÃO FINAL COM LÓGICA DE PERMISSÕES E CONTADORES
 * ==================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');
    const chamadosBadge = document.getElementById('chamados-count-badge');
    const pedidosBadge = document.getElementById('pedidos-count-badge');

    // --- Função Principal de Inicialização ---
    async function inicializarPagina() {
        const token = localStorage.getItem('authToken');
        const usuarioString = localStorage.getItem('usuario');

        if (!token || !usuarioString) {
            Notificacao.erro('Acesso Negado', 'Você precisa estar logado.')
                .then(() => window.location.href = '/login-gerencia');
            return;
        }
        

        const usuario = JSON.parse(usuarioString);
        preencherPerfil(usuario);
        
        // A função de configurar o dashboard agora é assíncrona
        await configurarDashboard(usuario); 
        
        // Só depois de configurar o dashboard, atualizamos os contadores
        atualizarContadores(token);
        
        conectarWebSocket(usuario);
    }

    // --- Funções de Lógica ---

    function fazerLogout() {
        localStorage.clear();
        window.location.href = '/login-gerencia';
    }

    function preencherPerfil(usuario) {
        if (dropdownUserName) dropdownUserName.textContent = usuario.nome;
        if (dropdownUserRole) dropdownUserRole.textContent = usuario.nivel_acesso;
    }

    async function configurarDashboard(usuario) {
        const nivelAcesso = usuario.nivel_acesso;

        if (nivelAcesso === 'geral') {
            return; // Usuário geral vê tudo por padrão
        }

        // Para qualquer outro nível, esconde todos os cards restritos primeiro
        document.querySelectorAll('.permissao-geral').forEach(card => {
            card.style.display = 'none';
        });

        try {
            const response = await fetch('/api/public/config/permissoes-home');
            if (!response.ok) throw new Error('Falha ao buscar permissões.');
            
            const data = await response.json();
            const permissoesPermitidas = data.permissoes || [];

            permissoesPermitidas.forEach(cardClass => {
                const card = document.querySelector(`.${cardClass}`);
                if (card) {
                    card.style.display = 'block';
                }
            });
        } catch (error) {
            console.error("Erro ao aplicar permissões:", error);
        }
    }

    // /Frontend/Pagina gerencia/gerencia-home.js

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


    async function atualizarContador(tipo, token) {
        const badge = tipo === 'chamados' ? chamadosBadge : pedidosBadge;
        const url = tipo === 'chamados' ? '/api/chamados/pendentes/count' : '/api/pedidos/pendentes/count';
        
        if (!badge) return;

        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return;
            
            const data = await response.json();
            const count = data.count || 0;
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        } catch (error) {
            console.error(`Erro ao atualizar contador de ${tipo}:`, error);
        }
    }

    function atualizarContadores(token) {
        // Verifica se o card de chamados está visível antes de buscar o contador
        const cardChamados = document.querySelector('.card-chamados');
        if (cardChamados && getComputedStyle(cardChamados).display !== 'none') {
            atualizarContador('chamados', token);
        }

        // Verifica se o card de pedidos está visível antes de buscar o contador
        const cardPedidos = document.querySelector('.card-pedidos');
        if (cardPedidos && getComputedStyle(cardPedidos).display !== 'none') {
            atualizarContador('pedidos', token);
        }
    }

    // --- Event Listeners ---
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


    

    // --- Ponto de Entrada ---
    inicializarPagina();
});
