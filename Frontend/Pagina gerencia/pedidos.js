/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE ACOMPANHAMENTO DE PEDIDOS (VERSÃO 3.0)
 * ==================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const pedidosContainer = document.getElementById('pedidos-container');
    const msgSemPedidos = document.getElementById('mensagem-sem-pedidos');
    const token = localStorage.getItem('authToken');
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    // --- Verificação de Autenticação ---
    if (!token || !usuario) {
        Notificacao.erro('Acesso Negado', 'Você precisa estar logado para acessar esta página.')
            .then(() => window.location.href = '/login-gerencia');
        return;
    }

    /**
     * Renderiza um único card de pedido/sessão na tela.
     * @param {object} sessao - O objeto da sessão ativa.
     */
    function renderizarCardPedido(sessao) {
        const totalFormatado = sessao.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Determina o status geral do card
        let statusGeral = 'aguardando';
        let statusTexto = 'Aguardando Pedido';
        if (sessao.itens && sessao.itens.length > 0) {
            const todosEntregues = sessao.itens.every(item => item.status === 'entregue');
            if (todosEntregues) {
                statusGeral = 'todos_entregues';
                statusTexto = 'Todos os Itens Entregues';
            } else {
                statusGeral = 'pedido_feito';
                statusTexto = 'Pedido Feito';
            }
        }

        const card = document.createElement('div');
        card.className = 'pedido-card';
        card.id = `sessao-${sessao.sessao_id}`;
        card.dataset.status = statusGeral;

        card.innerHTML = `
            <div class="card-header">
                <div>
                    <h3>${sessao.nome_mesa}</h3>
                    <div class="cliente-nome"><i class="fas fa-user"></i> ${sessao.nome_cliente}</div>
                </div>
                <span class="status-tag ${statusGeral}">${statusTexto}</span>
            </div>
            <div class="card-body">
                <ul class="lista-itens">
                    ${sessao.itens.length > 0 ? sessao.itens.map(item => `
                        <li>
                            <div class="item-info">
                                <span class="item-nome">${item.nome_produto}</span>
                                <span class="item-quantidade">x${item.quantidade}</span>
                            </div>
                            <div class="item-categoria">${item.categoria}</div>
                            ${item.observacao ? `<div class="item-observacao">${item.observacao}</div>` : ''}
                            <div class="item-actions">
                                <button 
                                    class="btn-entregar" 
                                    data-item-id="${item.pedido_item_id}" 
                                    ${item.status === 'entregue' ? 'disabled' : ''}
                                >
                                    ${item.status === 'entregue' ? '<i class="fas fa-check-circle"></i> Entregue' : 'Confirmar Entrega'}
                                </button>
                            </div>
                        </li>
                    `).join('') : '<li>Nenhum item pedido ainda.</li>'}
                </ul>
            </div>
            <div class="card-footer">
                <span>Total: ${totalFormatado}</span>
            </div>
        `;
        pedidosContainer.appendChild(card);
    }

    /**
     * Busca os pedidos/sessões ativos da API e os renderiza na tela.
     */
    /**
 * Busca os pedidos/sessões ativos da API e os renderiza na tela.
 */
/**
 * Busca os pedidos/sessões ativos da API e os renderiza na tela.
 */
// SUBSTITUA A FUNÇÃO INTEIRA NO SEU ARQUIVO pedidos.js

// Versão de depuração para o pedidos.js
async function carregarPedidosAtivos() {
    console.log("1. Iniciando carregarPedidosAtivos...");
    const msgSemSessoes = document.getElementById('mensagem-sem-sessoes');
    const pedidosContainer = document.getElementById('pedidos-container');

    if (!msgSemSessoes) {
        console.error("FALHA: Elemento #mensagem-sem-sessoes não encontrado no HTML.");
        return;
    }

    try {
        // CORREÇÃO: A URL agora aponta para a rota dentro do módulo de pedidos
        console.log("2. Buscando dados da API em /api/pedidos/ativos...");
        const response = await fetch('/api/pedidos/ativos', { // <-- URL CORRETA
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("3. Resposta da API recebida. Status:", response.status);

        if (!response.ok) {
            throw new Error(`Falha ao buscar dados. Status: ${response.status}`);
        }
        
        const sessoes = await response.json();
        console.log("4. Dados JSON processados. Número de sessões:", sessoes.length);
        
        pedidosContainer.innerHTML = ''; 

        if (sessoes.length === 0) {
            console.log("5. Nenhuma sessão encontrada. Exibindo mensagem.");
            msgSemSessoes.classList.remove('hidden');
        } else {
            console.log("5. Sessões encontradas. Escondendo mensagem e renderizando cards.");
            msgSemSessoes.classList.add('hidden');
            sessoes.forEach(renderizarCardPedido);
        }
        console.log("6. Função concluída com sucesso.");

    } catch (error) {
        console.error("ERRO na função carregarPedidosAtivos:", error);
        Notificacao.erro('Erro ao Carregar Pedidos', error.message);
    }
}





    /**
     * Lida com o clique no botão "Confirmar Entrega".
     * @param {Event} e - O evento de clique.
     */
    async function handleMarcarComoEntregue(e) {
        const target = e.target;
        if (!target.matches('.btn-entregar')) return;

        const itemId = target.dataset.itemId;
        if (!itemId || target.disabled) return;

        try {
            const response = await fetch(`/api/pedidos/${itemId}/entregar`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao atualizar o item.');
            }

            // Atualiza a UI imediatamente para feedback rápido
            target.disabled = true;
            target.innerHTML = '<i class="fas fa-check-circle"></i> Entregue';
            Notificacao.sucesso('Item marcado como entregue!');
            
            // Recarrega os dados para garantir consistência total do card
            carregarPedidosAtivos();

        } catch (error) {
            Notificacao.erro('Erro', error.message);
        }
    }

    /**
     * Conecta ao WebSocket para receber atualizações em tempo real.
     */
    // /Frontend/Pagina gerencia/pedidos.js

// ... (outras funções) ...


function conectarWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl );

    ws.onopen = () => console.log('Conexão WebSocket estabelecida para acompanhamento de pedidos.');

    ws.onmessage = (event) => {
        const mensagem = JSON.parse(event.data);
        switch (mensagem.type) {
            case 'NOVO_PEDIDO':
            case 'PEDIDO_ATUALIZADO':
            case 'PAGAMENTO_FINALIZADO':
                carregarPedidosAtivos();
                break;
            
            case 'CHAMADO_GARCOM':
                // ==================================================================
                // --- A CORREÇÃO ESTÁ AQUI ---
                // Usamos a configuração de pop-up que exige confirmação.
                // ==================================================================
                if (usuario.nivel_acesso === 'geral' || usuario.nivel_acesso === 'pedidos') {
                    Swal.fire({
                        title: '<strong>Chamado!</strong>',
                        html: `<h2>A <strong>${mensagem.nomeMesa}</strong> está solicitando atendimento.</h2>`,
                        icon: 'warning', // Ícone de aviso, mais chamativo
                        confirmButtonText: 'OK, Entendido!',
                        allowOutsideClick: false, // Impede que o alerta seja fechado ao clicar fora
                        allowEscapeKey: false // Impede que o alerta seja fechado com a tecla 'Esc'
                    });

                    // A lógica de destacar o card é mantida
                    if (mensagem.sessaoId) {
                        const cardChamado = document.querySelector(`#sessao-${mensagem.sessaoId}`);
                        if (cardChamado) cardChamado.classList.add('chamando');
                    }
                }
                break;
        }
    };

    ws.onclose = () => setTimeout(conectarWebSocket, 5000);
    ws.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        ws.close();
    };
}

// ... (resto do seu arquivo) ...

    

    // --- Inicialização e Event Listeners ---
    carregarPedidosAtivos();
    conectarWebSocket();
    pedidosContainer.addEventListener('click', handleMarcarComoEntregue);

    // --- Lógica do Menu de Perfil (simplificada para o exemplo) ---
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    document.getElementById('dropdown-user-name').textContent = usuario.nome;
    document.getElementById('dropdown-user-role').textContent = usuario.nivel_acesso;
    profileMenuBtn.addEventListener('click', () => profileDropdown.classList.toggle('hidden'));
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login-gerencia';
    });
});
