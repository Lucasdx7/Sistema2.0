/**
 * ==================================================================
 * SCRIPT DA PÁGINA DA CONTA DO CLIENTE (conta_cliente.js) - VERSÃO FINAL
 * Com autenticação de funcionário por NOME DE USUÁRIO para fechar a conta.
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

/**
 * Agrupa pedidos com o mesmo nome, status e observação para exibição.
 * @param {Array} pedidos - A lista de pedidos vinda da API.
 * @returns {Array} - A lista de pedidos agrupados.
 */
function agruparPedidos(pedidos) {
    if (!pedidos || pedidos.length === 0) return [];
    const itensAgrupados = {};
    pedidos.forEach(pedido => {
        const chave = `${pedido.nome_produto}-${pedido.status}-${pedido.observacao || ''}`;
        if (itensAgrupados[chave]) {
            itensAgrupados[chave].quantidade += pedido.quantidade;
        } else {
            itensAgrupados[chave] = { ...pedido };
        }
    });
    return Object.values(itensAgrupados);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Autenticação e Dados da Sessão ---
    const token = localStorage.getItem('token');
    const sessaoId = localStorage.getItem('sessaoId');
    const dadosCliente = JSON.parse(localStorage.getItem('dadosCliente'));
    const nomeMesa = localStorage.getItem('nomeMesa');

    // Validação de sessão: se não houver token ou ID, redireciona para o login.
    if (!token || !sessaoId) {
        Notificacao.erro('Sessão não encontrada', 'Redirecionando para a tela de login.');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2500); // Redireciona após 2.5 segundos
        return;
    }

    // --- Seletores de Elementos do DOM ---
    const clienteNomeEl = document.getElementById('cliente-nome');
    const clienteMesaEl = document.getElementById('cliente-mesa');
    const listaPedidos = document.getElementById('lista-pedidos');
    const subtotalEl = document.getElementById('subtotal-valor');
    const taxaEl = document.getElementById('taxa-servico');
    const totalEl = document.getElementById('total-valor');
    const hiddenButton = document.getElementById('hidden-logout-button');
    const logoutModal = document.getElementById('logout-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const logoutForm = document.getElementById('logout-form');
    const chamarGarcomBtn = document.querySelector('.call-waiter-btn');
    const paymentOptions = document.querySelector('.payment-options');
    const formaPagamentoInput = document.getElementById('forma-pagamento-input');

    if (clienteNomeEl) clienteNomeEl.textContent = dadosCliente?.nome || 'Cliente';
    if (clienteMesaEl) clienteMesaEl.textContent = nomeMesa || 'Mesa';

    // ==================================================================
    // LÓGICA DO TECLADO VIRTUAL
    // ==================================================================
    const keyboard = document.getElementById('virtual-keyboard-alphanumeric');
    const inputs = document.querySelectorAll('.virtual-input');
    const shiftKey = document.getElementById('shift-key');
    const alphaKeys = keyboard.querySelectorAll('.keyboard-key[data-key]');
    let activeInput = null;
    let isShiftActive = false;

    const showKeyboard = (inputElement) => {
        activeInput = inputElement;
        const label = document.querySelector(`label[for=${activeInput.id}]`);
        const keyboardLabel = keyboard.querySelector('#keyboard-target-label');
        if (keyboardLabel && label) keyboardLabel.textContent = `Digite: ${label.textContent}`;
        keyboard.classList.remove('hidden');
        setTimeout(() => keyboard.classList.add('visible'), 10);
        document.body.classList.add('keyboard-active');
    };

    const hideKeyboard = () => {
        if (!keyboard.classList.contains('visible')) return;
        keyboard.classList.remove('visible');
        setTimeout(() => keyboard.classList.add('hidden'), 300);
        document.body.classList.remove('keyboard-active');
        activeInput = null;
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

    inputs.forEach(input => input.addEventListener('click', (e) => { e.stopPropagation(); showKeyboard(input); }));

    keyboard.addEventListener('click', (e) => {
        if (!activeInput) return;
        const target = e.target.closest('.keyboard-key');
        if (!target) return;
        const key = target.dataset.key;
        if (key) {
            let char = key;
            if (isShiftActive) {
                activeInput.value += char.toUpperCase();
                toggleShift();
            } else {
                activeInput.value += char;
            }
        } else if (target.id === 'shift-key') toggleShift();
        else if (target.id === 'backspace-key') activeInput.value = activeInput.value.slice(0, -1);
        else if (target.id === 'confirm-key') hideKeyboard();
    });

    document.addEventListener('click', (e) => {
        if (activeInput && !keyboard.contains(e.target) && !e.target.matches('.virtual-input')) {
            hideKeyboard();
        }
    });
    keyboard.querySelector('.keyboard-close-btn').addEventListener('click', hideKeyboard);
    // ==================================================================
    // FIM DO TECLADO VIRTUAL
    // ==================================================================

    async function carregarConta() {
        listaPedidos.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Carregando sua conta...</p>';
        try {
            const response = await fetch(`/api/mesas/sessoes/${sessaoId}/conta`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            listaPedidos.innerHTML = '';
            if (data.pedidos && data.pedidos.length > 0) {
                const pedidosAgrupados = agruparPedidos(data.pedidos);
                pedidosAgrupados.forEach(item => {
                    const li = document.createElement('li');
                    const isCanceled = item.status === 'cancelado';
                    const temObservacao = item.observacao && item.observacao.trim() !== '';
                    if (isCanceled) li.classList.add('cancelado');
                    li.innerHTML = `
                        <div class="produto-info">
                            <img src="${item.imagem_svg || '/img/placeholder.svg'}" alt="${item.nome_produto}">
                            <div>
                                <strong>${item.nome_produto}</strong>
                                <span>${item.quantidade} x R$ ${parseFloat(item.preco_unitario).toFixed(2)}</span>
                                ${isCanceled ? '<span class="cancelado-tag">Cancelado pela gerência</span>' : ''}
                                ${temObservacao ? `<p class="observacao-info">Obs: <em>${item.observacao}</em></p>` : ''}
                            </div>
                        </div>
                        <span>R$ ${(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                    `;
                    listaPedidos.appendChild(li);
                });
            } else {
                listaPedidos.innerHTML = '<p>Ainda não há pedidos registrados nesta conta.</p>';
            }
            const subtotal = parseFloat(data.total) || 0;
            const taxa = subtotal * 0.10;
            const total = subtotal + taxa;
            subtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
            taxaEl.textContent = `R$ ${taxa.toFixed(2)}`;
            totalEl.textContent = `R$ ${total.toFixed(2)}`;
        } catch (error) {
            Notificacao.erro('Erro ao Carregar Conta', error.message);
            listaPedidos.innerHTML = `<p class="error-message">Não foi possível carregar os detalhes da sua conta.</p>`;
        }
    }

    async function chamarGarcom() {
        chamarGarcomBtn.disabled = true;
        chamarGarcomBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chamando...';
        try {
            const response = await fetch('/api/mesas/chamar-garcom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Não foi possível completar a chamada.');
            Notificacao.sucesso('Chamado Enviado!', 'Um garçom foi notificado e virá até sua mesa em breve.');
        } catch (error) {
            Notificacao.erro('Falha na Chamada', error.message);
        } finally {
            setTimeout(() => {
                chamarGarcomBtn.disabled = false;
                chamarGarcomBtn.innerHTML = '<i class="fas fa-bell"></i> Chamar Garçom';
            }, 10000);
        }
    }

    function fecharModalLogout() {
        hideKeyboard();
        logoutModal.classList.add('hidden');
        logoutForm.reset();
        paymentOptions.querySelectorAll('.payment-btn').forEach(btn => btn.classList.remove('selected'));
    }

    // --- Event Listeners ---
    hiddenButton.addEventListener('click', () => logoutModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', fecharModalLogout);
    if (chamarGarcomBtn) chamarGarcomBtn.addEventListener('click', chamarGarcom);

    paymentOptions.addEventListener('click', (e) => {
        const selectedBtn = e.target.closest('.payment-btn');
        if (!selectedBtn) return;
        paymentOptions.querySelectorAll('.payment-btn').forEach(btn => btn.classList.remove('selected'));
        selectedBtn.classList.add('selected');
        formaPagamentoInput.value = selectedBtn.dataset.payment;
    });

    // ==================================================================
    // --- LÓGICA DE LOGOUT ATUALIZADA (COM A CORREÇÃO) ---
    // ==================================================================
    logoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = logoutForm.querySelector('button[type="submit"]');
        const nomeUsuarioFuncionario = document.getElementById('funcionario-usuario').value;
        const senhaFuncionario = document.getElementById('funcionario-senha').value;
        const formaPagamento = formaPagamentoInput.value;

        if (!nomeUsuarioFuncionario || !senhaFuncionario) {
            return Notificacao.erro('Campos Vazios', 'Nome de usuário e senha do funcionário são obrigatórios.');
        }
        if (!formaPagamento) {
            return Notificacao.erro('Campo Obrigatório', 'Por favor, selecione a forma de pagamento.');
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autorizando...';

        try {
            // 1. Autentica as credenciais do FUNCIONÁRIO
            const authResponse = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    nome_usuario: nomeUsuarioFuncionario, 
                    senha: senhaFuncionario 
                })
            });
            const authResult = await authResponse.json();
            if (!authResponse.ok) {
                throw new Error(authResult.message || 'Credenciais do funcionário inválidas.');
            }

            const tokenFuncionario = authResult.token;
            const nivelAcessoFuncionario = authResult.usuario.nivel_acesso;

            // Validação extra de permissão no frontend
            if (nivelAcessoFuncionario !== 'geral' && nivelAcessoFuncionario !== 'pedidos') {
                throw new Error('Este funcionário não tem permissão para fechar contas.');
            }

            // 2. Fecha a conta usando o token do funcionário
            const closeResponse = await fetch(`/api/mesas/sessoes/${sessaoId}/fechar`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenFuncionario}`
                },
                body: JSON.stringify({ forma_pagamento: formaPagamento })
            });
            const closeResult = await closeResponse.json();
            if (!closeResponse.ok) {
                throw new Error(closeResult.message);
            }

            // 3. Limpa APENAS os dados da sessão do cliente e redireciona
            localStorage.removeItem('token');
            localStorage.removeItem('sessaoId');
            localStorage.removeItem('dadosCliente');
            localStorage.removeItem('nomeMesa');
            
            Notificacao.sucesso('Sessão Encerrada!', 'Obrigado pela preferência e volte sempre.');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2500);

        } catch (error) {
            Notificacao.erro('Falha na Autorização', error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Autorizar e Encerrar Conta';
        }
    });

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
    carregarConta();
    conectarWebSocket();
});
