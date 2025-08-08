/**
 * ==================================================================
 * SCRIPT PRINCIPAL DA PÁGINA DO CARDÁPIO DO CLIENTE (Paginausuario.html)
 * VERSÃO FINAL E COM DEPURAÇÃO
 * ==================================================================
 */

/**
 * Aplica uma família de fontes ao corpo do documento e loga a ação.
 * @param {string} fontFamily - A string da família de fontes (ex: "'Poppins', sans-serif").
 */
function aplicarFonteGlobal(fontFamily) {
    console.log(`[FONTE] Aplicando a fonte "${fontFamily}" ao CSS.`);
    document.documentElement.style.setProperty('--font-principal-cliente', fontFamily);
}

/**
 * Busca a configuração de fonte da API e a aplica na página.
 */
async function carregarEaplicarFonte() {
    try {
        console.log("[FONTE] Buscando a fonte da API em /api/public/config/fonte.");
        const response = await fetch('/api/public/config/fonte');

        if (!response.ok) {
            console.error(`[FONTE] Erro na busca! Status: ${response.status}. Usando fonte padrão.`);
            aplicarFonteGlobal("'Roboto', sans-serif");
            return;
        }

        const data = await response.json();
        console.log("[FONTE] Resposta da API recebida:", data);

        if (data && data.fonte_cliente) {
            aplicarFonteGlobal(data.fonte_cliente);
        } else {
            console.warn("[FONTE] A API respondeu, mas não encontrou a chave 'fonte_cliente'. Usando fonte padrão.");
            aplicarFonteGlobal("'Roboto', sans-serif");
        }
    } catch (error) {
        console.error("[FONTE] Falha crítica ao buscar a fonte.", error);
        aplicarFonteGlobal("'Roboto', sans-serif");
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // --- Bloco de autenticação inicial ---
    const token = localStorage.getItem('token');
    const sessaoId = localStorage.getItem('sessaoId');

    if (!token || !sessaoId) {
        Notificacao.erro('Sessão Expirada', 'Por favor, faça o login novamente para acessar o cardápio.')
            .then(() => window.location.href = '/login');
        return;
    }

    // --- Constantes e Variáveis de Estado ---
    const API_URL = '/api';
    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
    let cardapioCompleto = [];

    // --- Elementos do DOM ---
    const navMenu = document.querySelector('.nav-menu');
    const menuList = document.querySelector('.menu-list');
    const profileIcon = document.querySelector('.fa-user.icon');
    const aboutIcon = document.querySelector('.fa-info-circle.icon'); // <-- ALTERAÇÃO 1: Adicionada a referência ao ícone "Sobre"
    const cartIcon = document.querySelector('.cart-icon');
    const cartBadge = document.querySelector('.cart-icon .badge');
    const productModal = document.getElementById('product-details-modal');
    const productModalCloseBtn = document.getElementById('product-modal-close-btn');
    const productModalBody = document.getElementById('product-modal-body');

    // --- Funções de Interação com a API ---
    async function apiCall(endpoint) {
        const options = { headers: { 'Authorization': `Bearer ${token}` } };
        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erro de comunicação com o servidor.' }));
                throw new Error(errorData.message);
            }
            return response.json();
        } catch (error) {
            console.error(`Falha na chamada da API para ${endpoint}:`, error);
            throw error;
        }
    }

    // --- Funções de Lógica de Negócio ---
    function isHappyHourAtivo(inicio, fim) {
        if (!inicio || !fim) return false;
        const agora = new Date();
        const horaAtual = agora.getHours().toString().padStart(2, '0') + ":" + agora.getMinutes().toString().padStart(2, '0');
        return horaAtual >= inicio.slice(0, 5) && horaAtual < fim.slice(0, 5);
    }

    // --- Funções do Carrinho ---
    function adicionarAoCarrinho(produto) {
        carrinho.push(produto);
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        atualizarBadgeCarrinho();
        Notificacao.sucesso(`${produto.nome} adicionado ao pedido!`);
        const addButton = document.querySelector(`.menu-item[data-id='${produto.id}'] .add-button`);
        if (addButton) {
            addButton.innerHTML = '<i class="fas fa-check"></i>';
            addButton.classList.add('added');
            setTimeout(() => {
                addButton.innerHTML = '+';
                addButton.classList.remove('added');
            }, 1200);
        }
    }

    function atualizarBadgeCarrinho() {
        cartBadge.textContent = carrinho.length;
        cartBadge.style.display = carrinho.length > 0 ? 'flex' : 'none';
    }

    // --- Funções de Renderização ---
    function renderizarCategorias(categorias) {
        navMenu.innerHTML = '';
        categorias.forEach(cat => {
            if (!cat.ativo) return;
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.dataset.filter = cat.id;
            li.textContent = cat.nome;
            if (cat.is_happy_hour && !isHappyHourAtivo(cat.happy_hour_inicio, cat.happy_hour_fim)) {
                li.classList.add('happy-hour-inativo');
                li.title = `Happy Hour disponível das ${cat.happy_hour_inicio.slice(0,5)} às ${cat.happy_hour_fim.slice(0,5)}`;
            }
            navMenu.appendChild(li);
        });
    }

    function renderizarProdutos(idCategoria) {
        const categoria = cardapioCompleto.find(cat => cat.id == idCategoria);
        menuList.innerHTML = '';
        if (!categoria || !categoria.produtos || categoria.produtos.length === 0) {
            menuList.innerHTML = '<p>Nenhum produto encontrado nesta categoria.</p>';
            return;
        }
        const happyHourInativo = categoria.is_happy_hour && !isHappyHourAtivo(categoria.happy_hour_inicio, categoria.happy_hour_fim);
        categoria.produtos.forEach(prod => {
            if (!prod.ativo) return;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'menu-item';
            Object.keys(prod).forEach(key => { itemDiv.dataset[key] = prod[key]; });
            const botaoAdicionar = happyHourInativo ? `<button class="add-button" disabled title="Disponível apenas durante o Happy Hour">+</button>` : `<button class="add-button">+</button>`;
            const servePessoas = parseInt(prod.serve_pessoas, 10) || 0;
            itemDiv.innerHTML = `
                <img src="${prod.imagem_svg || 'https://via.placeholder.com/150x100'}" alt="${prod.nome}">
                <div class="item-details">
                    <h3>
                        ${prod.nome}
                        ${servePessoas > 0 ? `<span class="serves-info">Serve até ${servePessoas} ${servePessoas > 1 ? 'pessoas' : 'pessoa'}</span>` : ''}
                    </h3>
                    <p>${prod.descricao}</p>
                </div>
                <div class="item-action">
                    <button class="details-button" title="Ver detalhes"><i class="fas fa-info-circle"></i></button>
                    ${botaoAdicionar}
                    <span class="item-price">R$ ${parseFloat(prod.preco  ).toFixed(2)}</span>
                </div>
            `;
            if (happyHourInativo) itemDiv.classList.add('item-inativo');
            menuList.appendChild(itemDiv);
        });
    }

    function abrirModalDeDetalhesProduto(produto) {
        const servePessoas = parseInt(produto.serve_pessoas, 10) || 0;
        productModalBody.innerHTML = `
            <img src="${produto.imagem_svg || 'https://via.placeholder.com/500x250'}" alt="${produto.nome}" class="product-modal-image">
            <div class="product-modal-content">
                <h2>${produto.nome}</h2>
                ${servePessoas > 0 ? `<span class="serves">Serve até ${servePessoas} ${servePessoas > 1 ? 'pessoas' : 'pessoa'}</span>` : ''}
                <p>${produto.descricao_detalhada || produto.descricao}</p>
            </div>
        `;
        productModal.classList.remove('hidden'  );
    }

    // --- Função Principal de Inicialização ---
    // Substitua a função inicializarCardapio inteira por esta em Usuario.js

async function inicializarCardapio() {
    try {
        // 1. Aplica a fonte primeiro para uma melhor experiência visual
        await carregarEaplicarFonte();
        
        // 2. Busca as categorias e os produtos em paralelo
        const [categorias, produtos] = await Promise.all([
            apiCall('/categorias'), // Nova rota: GET /api/categorias
            apiCall('/produtos/todos')  // Nova rota: GET /api/produtos/todos
        ]);

        // 3. Estrutura os dados: aninha os produtos dentro de suas categorias
        cardapioCompleto = categorias.map(categoria => {
            return {
                ...categoria, // Inclui todos os dados da categoria
                // Filtra apenas os produtos que pertencem a esta categoria
                produtos: produtos.filter(produto => produto.id_categoria === categoria.id)
            };
        });

        // 4. O resto da lógica para renderizar a página permanece o mesmo
        renderizarCategorias(cardapioCompleto);
        
        const urlParams = new URLSearchParams(window.location.search);
        const categoriaIdDesejada = urlParams.get('categoria');
        
        let categoriaInicial = cardapioCompleto.find(cat => cat.id == categoriaIdDesejada && cat.ativo) || cardapioCompleto.find(cat => cat.ativo && (!cat.is_happy_hour || isHappyHourAtivo(cat.happy_hour_inicio, cat.happy_hour_fim)));
        
        if (categoriaInicial) {
            renderizarProdutos(categoriaInicial.id);
            const itemMenuAtivo = navMenu.querySelector(`li[data-filter='${categoriaInicial.id}']`);
            if (itemMenuAtivo) itemMenuAtivo.classList.add('active');
        } else {
            menuList.innerHTML = '<p>Nenhum item disponível no cardápio no momento.</p>';
        }
    } catch (error) {
        Notificacao.erro('Falha ao Carregar', 'Não foi possível carregar o cardápio.');
        menuList.innerHTML = '<p class="error-message">Não foi possível carregar o cardápio.</p>';
    }
}


    // --- Event Listeners ---
    profileIcon.addEventListener('click', () => { window.location.href = '/conta'; });

    // <-- ALTERAÇÃO 2: Adicionado o evento de clique para o ícone "Sobre"
    if (aboutIcon) {
        aboutIcon.addEventListener('click', () => {
            window.location.href = '/sobre';
        });
    }
    
    cartIcon.addEventListener('click', () => {
        if (carrinho.length === 0) {
            Notificacao.erro('Carrinho Vazio', 'Adicione itens ao seu pedido antes de continuar.');
            return;
        }
        window.location.href = '/confirmar-pedido';
    });

    menuList.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (!menuItem) return;
        if (e.target.closest('.add-button') && !e.target.closest('.add-button').disabled) {
            const produto = { id: menuItem.dataset.id, nome: menuItem.dataset.nome, descricao: menuItem.dataset.descricao, preco: parseFloat(menuItem.dataset.preco), imagem_svg: menuItem.dataset.imagem_svg, descricao_detalhada: menuItem.dataset.descricao_detalhada, serve_pessoas: parseInt(menuItem.dataset.serve_pessoas, 10) || 0 };
            adicionarAoCarrinho(produto);
        }
        if (e.target.closest('.details-button')) {
            const produto = { nome: menuItem.dataset.nome, descricao: menuItem.dataset.descricao, descricao_detalhada: menuItem.dataset.descricao_detalhada, serve_pessoas: menuItem.dataset.serve_pessoas, imagem_svg: menuItem.dataset.imagem_svg };
            abrirModalDeDetalhesProduto(produto);
        }
    });

    navMenu.addEventListener('click', (e) => {
        if (e.target && e.target.matches('li.nav-item')) {
            document.querySelectorAll('.nav-menu li').forEach(item => item.classList.remove('active'));
            e.target.classList.add('active');
            renderizarProdutos(e.target.dataset.filter);
        }
    });

    productModalCloseBtn.addEventListener('click', () => productModal.classList.add('hidden'));
    productModal.addEventListener('click', (e) => { if (e.target === productModal) productModal.classList.add('hidden'); });

    // --- Lógica do WebSocket ---
    // /Frontend/Pagina cliente/Usuario.js (ou onde este código estiver)

// A função original, agora aprimorada para se identificar corretamente.
function conectarWebSocket() {
    // 1. Pega o ID da sessão. Se não houver, não conecta. (Lógica de segurança)
    const sessaoId = localStorage.getItem('sessaoId');
    if (!sessaoId) {
        console.warn('[WSS] Não foi possível conectar: sessaoId não encontrado.');
        return;
    }

    // 2. (NOVO) Detecta a página atual para enviar ao servidor.
    const paginaAtual = window.location.pathname.split('/').pop().replace('.html', '') || 'cardapio';

    // 3. (MUDANÇA PRINCIPAL) Monta a URL completa com todos os parâmetros.
    const wsUrl = `ws://${window.location.host}?clientType=cliente&page=${paginaAtual}&userId=${sessaoId}`;
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => console.log(`[WEBSOCKET] Conexão estabelecida para a página '${paginaAtual}'.`);

    // A sua lógica de tratamento de mensagens permanece quase idêntica.
    socket.onmessage = (event) => {
        console.log('[WEBSOCKET] Mensagem recebida:', event.data);
        try {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'CONFIG_ATUALIZADA':
                    console.log('[WEBSOCKET] Evento CONFIG_ATUALIZADA detectado. Payload:', data.payload);
                    if (data.payload && data.payload.fonte_cliente) {
                        Notificacao.info('A aparência do cardápio foi atualizada!');
                        aplicarFonteGlobal(data.payload.fonte_cliente);
                    } else {
                        console.warn('[WEBSOCKET] Evento recebido, mas sem payload de fonte.');
                    }
                    break;
                
                case 'CARDAPIO_ATUALIZADO':
                    Notificacao.sucesso('O cardápio foi atualizado!');
                    inicializarCardapio();
                    break;

                // 4. (MUDANÇA) Renomeado de 'LOGOUT_FORCADO' para o nosso novo padrão.
                case 'FORCE_DISCONNECT':
                    console.warn(`[WSS] Recebido comando de desconexão forçada. Motivo: ${data.message}`);
                    socket.close(); // Fecha a conexão para não tentar reconectar
                    localStorage.clear();
                    // Usamos o SweetAlert2 para consistência com o resto do app
                    Swal.fire({
                        icon: 'warning',
                        title: 'Sessão Encerrada',
                        text: data.message || 'Sua sessão foi encerrada pela gerência.',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    }).then(() => {
                        window.location.href = '/login';
                    });
                    break;
            }
        } catch (e) {
            console.error('[WSS] Erro ao processar mensagem:', e);
        }
    };

    socket.onclose = (event) => {
        // Não tenta reconectar se foi um fechamento normal (código 1000)
        if (event.code !== 1000) {
            console.log('[WEBSOCKET] Conexão fechada inesperadamente. Tentando reconectar...');
            setTimeout(conectarWebSocket, 5000);
        } else {
            console.log('[WEBSOCKET] Conexão fechada normalmente.');
        }
    };

    socket.onerror = (error) => {
        console.error('[WEBSOCKET] Erro na conexão:', error);
        socket.close(); // Força o fechamento para acionar a lógica de reconexão do onclose
    };
}


    // --- INICIALIZAÇÃO ---
    atualizarBadgeCarrinho();
    inicializarCardapio();
    conectarWebSocket();
});
