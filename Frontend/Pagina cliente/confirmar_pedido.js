/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE CONFIRMAÇÃO DE PEDIDO (confirmar_pedido.html) - VERSÃO ATUALIZADA
 * ==================================================================
 */

/**
 * Aplica uma família de fontes ao corpo do documento.
 * @param {string} fontFamily - A string da família de fontes (ex: "'Poppins', sans-serif").
 */
function aplicarFonteGlobal(fontFamily) {
    document.documentElement.style.setProperty('--font-principal-cliente', fontFamily);
}

/**
 * Busca a configuração de fonte da API e a aplica na página.
 */
async function carregarEaplicarFonte() {
    try {
        const response = await fetch('/api/public/config/fonte');
        if (!response.ok) return;
        const data = await response.json();
        if (data.fonte_cliente) {
            aplicarFonteGlobal(data.fonte_cliente);
        }
    } catch (error) {
        console.error("Não foi possível carregar a fonte personalizada.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Autenticação e Variáveis de Estado ---
    const token = localStorage.getItem('token');
    const sessaoId = localStorage.getItem('sessaoId');
    const mesaId = localStorage.getItem('mesaId');

    if (!token || !sessaoId || !mesaId) {
        Notificacao.erro('Sessão Inválida', 'Dados essenciais não encontrados. Você será redirecionado.')
            .then(() => window.location.href = '/login');
        return;
    }

    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
    let produtoIdParaObservacao = null;
    let observacaoOriginalParaEdicao = '';

    // --- Elementos do DOM ---
    const listaResumo = document.getElementById('lista-resumo-pedido');
    const subtotalEl = document.getElementById('subtotal-valor');
    const totalEl = document.getElementById('total-valor');
    const voltarBtn = document.getElementById('voltar-cardapio-btn');
    const confirmarBtn = document.getElementById('confirmar-pedido-btn');
    const cartBadge = document.querySelector('.cart-icon .badge');
    const profileIcon = document.getElementById('profile-icon');
    const aboutIcon = document.getElementById('about-icon'); // <-- ALTERAÇÃO 1: Adicionada a referência ao ícone "Sobre"
    const suggestionContainer = document.getElementById('suggestion-item');
    const observationModal = document.getElementById('observation-modal');
    const modalProductName = document.getElementById('modal-product-name');
    const modalTextarea = document.getElementById('modal-textarea');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // ==================================================================
    // LÓGICA DO TECLADO VIRTUAL
    // ==================================================================
    const keyboard = document.getElementById('virtual-keyboard-alphanumeric');
    const keyboardInput = document.getElementById('modal-textarea');
    const shiftKey = document.getElementById('shift-key');
    const alphaKeys = keyboard.querySelectorAll('.keyboard-key[data-key]');
    let isShiftActive = false;

    const showKeyboard = () => {
        const keyboardLabel = keyboard.querySelector('#keyboard-target-label');
        const productName = document.getElementById('modal-product-name').textContent;
        if (keyboardLabel && productName) keyboardLabel.textContent = `Observação para: ${productName}`;
        keyboard.classList.remove('hidden');
        setTimeout(() => keyboard.classList.add('visible'), 10);
        document.body.classList.add('keyboard-active');
    };

    const hideKeyboard = () => {
        if (!keyboard.classList.contains('visible')) return;
        keyboard.classList.remove('visible');
        setTimeout(() => keyboard.classList.add('hidden'), 300);
        document.body.classList.remove('keyboard-active');
    };

    const toggleShift = () => {
        isShiftActive = !isShiftActive;
        shiftKey.classList.toggle('active', isShiftActive);
        alphaKeys.forEach(key => {
            const char = key.dataset.key;
            if (char.length === 1 && char.match(/[a-zç]/i)) {
                key.textContent = isShiftActive ? char.toUpperCase() : char.toLowerCase();
            }
        });
    };

    keyboardInput.addEventListener('click', (e) => { e.stopPropagation(); showKeyboard(); });

    keyboard.addEventListener('click', (e) => {
        const target = e.target.closest('.keyboard-key');
        if (!target) return;
        const key = target.dataset.key;
        if (key) {
            let char = key;
            if (isShiftActive || keyboardInput.value.length === 0 || keyboardInput.value.slice(-1) === ' ') {
                keyboardInput.value += char.toUpperCase();
                if (isShiftActive) toggleShift();
            } else {
                keyboardInput.value += char;
            }
        } else if (target.id === 'shift-key') toggleShift();
        else if (target.id === 'backspace-key') keyboardInput.value = keyboardInput.value.slice(0, -1);
        else if (target.id === 'confirm-key') hideKeyboard();
    });
    keyboard.querySelector('.keyboard-close-btn').addEventListener('click', hideKeyboard);
    // ==================================================================
    // FIM DO TECLADO VIRTUAL
    // ==================================================================

    function agruparItensDoCarrinho(carrinhoBruto) {
        if (!carrinhoBruto || carrinhoBruto.length === 0) return [];
        const itensAgrupados = {};
        carrinhoBruto.forEach(item => {
            const chave = `${item.id}-${item.observacao || ''}`;
            if (itensAgrupados[chave]) {
                itensAgrupados[chave].quantidade++;
            } else {
                itensAgrupados[chave] = { ...item, quantidade: 1 };
            }
        });
        return Object.values(itensAgrupados);
    }

    function atualizarCarrinho(novoCarrinho, redesenhar = true) {
        carrinho = novoCarrinho;
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        if (redesenhar) renderizarPagina();
    }

    function renderizarPagina() {
        const itensAgrupados = agruparItensDoCarrinho(carrinho);
        listaResumo.innerHTML = '';
        let subtotal = 0;
        if (itensAgrupados.length === 0) {
            listaResumo.innerHTML = '<p class="empty-cart-message">Seu carrinho de pré-pedido está vazio.</p>';
            confirmarBtn.disabled = true;
            confirmarBtn.style.opacity = '0.6';
        } else {
            confirmarBtn.disabled = false;
            confirmarBtn.style.opacity = '1';
        }
        itensAgrupados.forEach(item => {
            const li = document.createElement('li');
            li.className = 'order-item';
            li.dataset.produtoId = item.id;
            li.dataset.observacao = item.observacao || '';
            const precoTotalItem = item.preco * item.quantidade;
            const temObservacao = item.observacao && item.observacao.trim() !== '';
            const servePessoas = parseInt(item.serve_pessoas, 10) || 0;
            li.innerHTML = `
                <img src="${item.imagem_svg || '/img/placeholder.svg'}" alt="${item.nome}" class="order-item-image">
                <div class="order-item-details">
                    <h3>
                        ${item.nome}
                        ${servePessoas > 0 ? `<span class="serves-info">Serve até ${servePessoas} ${servePessoas > 1 ? 'pessoas' : 'pessoa'}</span>` : ''}
                    </h3>
                    <div class="quantity-control">
                        <button class="quantity-btn decrease-btn" title="Diminuir">-</button>
                        <span class="quantity-value">${item.quantidade}</span>
                        <button class="quantity-btn increase-btn" title="Aumentar">+</button>
                    </div>
                    <span class="item-price">R$ ${precoTotalItem.toFixed(2)}</span>
                    ${temObservacao ? `<p class="observacao-info">Obs: <em>${item.observacao}</em></p>` : ''}
                </div>
                <div class="order-item-actions">
                    <button class="action-btn observation-btn ${temObservacao ? 'active' : ''}" title="Adicionar/Editar Observação"><i class="fas fa-comment-dots"></i></button>
                    <button class="action-btn remove-item-btn" title="Remover '${item.nome}' com esta observação"><i class="fas fa-times"></i></button>
                </div>
            `;
            listaResumo.appendChild(li);
            subtotal += precoTotalItem;
        });
        subtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
        totalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
        cartBadge.textContent = carrinho.length;
        cartBadge.style.display = carrinho.length > 0 ? 'flex' : 'none';
    }

    function abrirModalObservacao(produtoId, obsAtual) {
        const itemOriginal = carrinho.find(p => p.id == produtoId);
        if (!itemOriginal) return;
        produtoIdParaObservacao = produtoId;
        observacaoOriginalParaEdicao = obsAtual;
        modalProductName.textContent = itemOriginal.nome;
        modalTextarea.value = obsAtual;
        observationModal.classList.remove('hidden');
    }

    function fecharModalObservacao() {
        hideKeyboard();
        observationModal.classList.add('hidden');
        produtoIdParaObservacao = null;
        observacaoOriginalParaEdicao = '';
    }

    function salvarObservacao() {
        if (!produtoIdParaObservacao) return;
        const novaObservacao = modalTextarea.value.trim();
        const novoCarrinho = carrinho.map(item => {
            if (item.id == produtoIdParaObservacao && (item.observacao || '') === observacaoOriginalParaEdicao) {
                return { ...item, observacao: novaObservacao };
            }
            return item;
        });
        atualizarCarrinho(novoCarrinho);
        fecharModalObservacao();
    }

    listaResumo.addEventListener('click', async (e) => {
        const itemLi = e.target.closest('.order-item');
        if (!itemLi) return;
        const produtoId = itemLi.dataset.produtoId;
        const obs = itemLi.dataset.observacao;
        const itemAmostra = carrinho.find(item => item.id == produtoId && (item.observacao || '') === obs);
        if (e.target.closest('.increase-btn')) {
            if (itemAmostra) atualizarCarrinho([...carrinho, { ...itemAmostra }]);
        } else if (e.target.closest('.decrease-btn')) {
            const indexParaRemover = carrinho.findIndex(item => item.id == produtoId && (item.observacao || '') === obs);
            if (indexParaRemover > -1) {
                const novoCarrinho = [...carrinho];
                novoCarrinho.splice(indexParaRemover, 1);
                atualizarCarrinho(novoCarrinho);
            }
        } else if (e.target.closest('.remove-item-btn')) {
            const confirmado = await Notificacao.confirmar('Remover Item', `Deseja remover todos os itens "${itemAmostra.nome}" ${obs ? 'com esta observação' : ''}?`);
            if (confirmado) {
                const novoCarrinho = carrinho.filter(item => !(item.id == produtoId && (item.observacao || '') === obs));
                atualizarCarrinho(novoCarrinho);
            }
        } else if (e.target.closest('.observation-btn')) {
            abrirModalObservacao(produtoId, obs);
        }
    });

    modalSaveBtn.addEventListener('click', salvarObservacao);
    modalCancelBtn.addEventListener('click', fecharModalObservacao);
    observationModal.addEventListener('click', (e) => { if (e.target === observationModal) fecharModalObservacao(); });

    async function carregarSugestao() {
        try {
            const response = await fetch('/api/produtos/sugestao', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Nenhuma sugestão encontrada.');
            const sugestoes = await response.json();
            suggestionContainer.innerHTML = '';
            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'suggestion-carousel-wrapper';
            sugestoes.forEach(sugestao => {
                const card = document.createElement('div');
                card.className = 'suggestion-card-item';
                card.dataset.produtoId = sugestao.id;
                card.innerHTML = `
                    <div class="suggestion-content">
                        <img src="${sugestao.imagem_svg || '/img/placeholder.svg'}" alt="${sugestao.nome}" class="suggestion-image">
                        <div class="suggestion-details">
                            <h4 class="suggestion-title">${sugestao.nome}</h4>
                            <p class="suggestion-description">${sugestao.descricao}</p>
                        </div>
                    </div>
                    <div class="suggestion-buttons-group">
                        <button class="btn btn-view-category" data-category-id="${sugestao.id_categoria}"><i class="fas fa-tags"></i> Ver em "${sugestao.nome_categoria}"</button>
                        <button class="btn btn-add-suggestion"><i class="fas fa-plus-circle"></i> Adicionar</button>
                    </div>
                `;
                carouselWrapper.appendChild(card);
                card.querySelector('.btn-add-suggestion').addEventListener('click', () => {
                    atualizarCarrinho([...carrinho, sugestao], true);
                    Notificacao.sucesso('Item Adicionado', `"${sugestao.nome}" foi adicionado ao seu carrinho.`);
                    card.querySelector('.btn-add-suggestion').disabled = true;
                    card.querySelector('.btn-add-suggestion').innerHTML = '<i class="fas fa-check"></i> Adicionado';
                });
                card.querySelector('.btn-view-category').addEventListener('click', (e) => {
                    window.location.href = `/cardapio?categoria=${e.currentTarget.dataset.categoryId}`;
                });
            });
            suggestionContainer.appendChild(carouselWrapper);
        } catch (error) {
            console.warn('Não foi possível carregar a sugestão:', error.message);
            suggestionContainer.innerHTML = '<p>Nenhuma sugestão especial no momento.</p>';
        }
    }

    async function confirmarPedido() {
        const confirmado = await Notificacao.confirmar('Confirmar Pedido', 'Seu pedido será enviado para a cozinha. Deseja continuar?');
        if (!confirmado) return;
        confirmarBtn.disabled = true;
        confirmarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        const pedidosParaEnviar = agruparItensDoCarrinho(carrinho).map(item => ({
            id_mesa: mesaId,
            id_sessao: sessaoId,
            id_produto: item.id,
            quantidade: item.quantidade,
            preco_unitario: item.preco,
            observacao: item.observacao || null
        }));
        try {
            const response = await fetch('/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ pedidos: pedidosParaEnviar })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido ao enviar pedido.' }));
                throw new Error(errorData.message);
            }
            atualizarCarrinho([]);
            Notificacao.sucesso('Pedido Enviado!', 'Seu pedido foi enviado para a cozinha e já está sendo preparado.');
            setTimeout(() => { window.location.href = '/cardapio'; }, 2000);
        } catch (error) {
            console.error('Falha ao confirmar pedido:', error);
            Notificacao.erro('Falha ao Enviar', `${error.message}. Por favor, tente novamente ou chame um garçom.`);
        } finally {
            confirmarBtn.disabled = false;
            confirmarBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar e Enviar';
        }
    }

    // --- Event Listeners ---
    voltarBtn.addEventListener('click', () => window.location.href = '/cardapio');
    confirmarBtn.addEventListener('click', confirmarPedido);
    profileIcon.addEventListener('click', () => window.location.href = '/conta');

    // <-- ALTERAÇÃO 2: Adicionado o evento de clique para o ícone "Sobre"
    if (aboutIcon) {
        aboutIcon.addEventListener('click', () => {
            window.location.href = '/sobre';
        });
    }

   // /Frontend/Pagina cliente/seu_arquivo.js

function conectarWebSocket() {
    // 1. Pega o ID da sessão do localStorage. Se não existir, não tenta conectar.
    const sessaoId = localStorage.getItem('sessaoId');
    if (!sessaoId) {
        console.warn('[WSS] Não foi possível conectar: sessaoId não encontrado no localStorage.');
        return;
    }

    // 2. Detecta a página atual a partir da URL do navegador.
    const paginaAtual = window.location.pathname.split('/').pop().replace('.html', '') || 'desconhecida';

    // 3. Monta a URL completa com todos os parâmetros de identificação.
    const wsUrl = `ws://${window.location.host}?clientType=cliente&page=${paginaAtual}&userId=${sessaoId}`;
    
    console.log(`[WSS] Tentando conectar a: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    // 4. Lógica de tratamento de mensagens (incluindo a sua lógica original).
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('[WSS] Mensagem recebida:', data);

            // Sua lógica original para atualizar a fonte
            if (data.type === 'CONFIG_ATUALIZADA' && data.payload && data.payload.fonte_cliente) {
                Notificacao.info('A aparência foi atualizada!');
                aplicarFonteGlobal(data.payload.fonte_cliente);
            }

            // Lógica para o comando de desconexão forçada vindo do painel DEV
            if (data.type === 'FORCE_DISCONNECT') {
                console.warn(`[WSS] Recebido comando de desconexão forçada. Motivo: ${data.message}`);
                socket.close(); // Fecha a conexão
                localStorage.clear(); // Limpa todos os dados da sessão
                alert(data.message || 'Sua sessão foi encerrada pela gerência.');
                window.location.href = '/login'; // Redireciona para a tela de login
            }

        } catch (e) {
            console.error('[WSS] Erro ao processar mensagem:', e);
        }
    };

    // 5. Lógica de reconexão.
    socket.onclose = () => {
        console.log('[WSS] Conexão fechada. Tentando reconectar em 5 segundos...');
        setTimeout(conectarWebSocket, 5000);
    };

    socket.onerror = (error) => {
        console.error('[WSS] Erro na conexão WebSocket:', error);
        socket.close(); // Fecha a conexão em caso de erro para acionar o 'onclose'
    };
}


    // --- INICIALIZAÇÃO ---
    carregarEaplicarFonte();
    renderizarPagina();
    carregarSugestao();
    conectarWebSocket();
});
