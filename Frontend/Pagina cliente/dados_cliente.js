/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE COLETA DE DADOS DO CLIENTE (dados_cliente.html)
 * ==================================================================
 * - Coleta o nome do cliente e inicia uma nova sessão de pedidos.
 * - Gerencia os teclados virtuais para os campos do formulário.
 *
 * Depende do objeto `Notificacao` fornecido por `notificacoes.js` (versão cliente).
 */


document.addEventListener('DOMContentLoaded', () => {
    // --- AUTENTICAÇÃO E VERIFICAÇÃO DE DADOS ---
    // Recupera token e nome da mesa do localStorage para garantir que o cliente está autenticado
    const token = localStorage.getItem('token');
    const nomeMesa = localStorage.getItem('nomeMesa');

    // Se não houver token ou nome da mesa, exibe erro e redireciona para login
    if (!token || !nomeMesa) {
        Notificacao.erro('Acesso Inválido', 'Você precisa fazer o login da mesa primeiro.')
            .then(() => {
                window.location.href = '/login';
            });
        return;
    }

    // --- ELEMENTOS DO DOM ---
    // Seleciona elementos principais da página
    const welcomeMessage = document.getElementById('welcome-mesa-name');
    const form = document.getElementById('dados-cliente-form');
    const nomeInput = document.getElementById('nome');

    // Exibe mensagem de boas-vindas personalizada
    welcomeMessage.textContent = `Olá, ${nomeMesa}!`;

    // ==================================================================
    // INÍCIO DA LÓGICA DO TECLADO VIRTUAL INTEGRADA
    // ==================================================================

    // --- SELETORES DOS ELEMENTOS DO TECLADO ---
    // Seleciona teclados virtual (numérico e alfabético) e inputs relacionados
    const numericKeyboard = document.getElementById('virtual-keyboard');
    const alphaKeyboard = document.getElementById('virtual-keyboard-alpha');
    
    const numericInputs = document.querySelectorAll('.numeric-input');
    const alphaInputs = document.querySelectorAll('.alpha-input');

    let activeInput = null;
    let isShiftActive = false;

    // --- FUNÇÕES GENÉRICAS PARA TECLADOS ---

    // Exibe o teclado virtual correspondente ao input clicado
    const showKeyboard = (keyboardElement, inputElement) => {
        activeInput = inputElement;
        const label = document.querySelector(`label[for=${activeInput.id}]`);
        const keyboardLabel = keyboardElement.querySelector('.keyboard-header span');
        
        if (keyboardLabel && label) {
            keyboardLabel.textContent = label.textContent;
        }

        // Esconde outros teclados e mostra o selecionado
        document.querySelectorAll('.virtual-keyboard-container').forEach(kb => {
            if (kb !== keyboardElement) {
                kb.classList.remove('visible');
                kb.classList.add('hidden');
            }
        });

        keyboardElement.classList.remove('hidden');
        setTimeout(() => keyboardElement.classList.add('visible'), 10);

        document.body.classList.add('keyboard-active');
        activeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Esconde todos os teclados virtuais
    const hideAllKeyboards = () => {
        document.querySelectorAll('.virtual-keyboard-container.visible').forEach(kb => {
            kb.classList.remove('visible');
            setTimeout(() => kb.classList.add('hidden'), 300);
        });
        
        document.body.classList.remove('keyboard-active');
        activeInput = null;
    };

    // --- EVENT LISTENERS PARA ABRIR OS TECLADOS ---
    // Mostra o teclado numérico ao clicar em inputs numéricos
    numericInputs.forEach(input => {
        input.addEventListener('click', (e) => {
            e.preventDefault();
            showKeyboard(numericKeyboard, input);
        });
    });

    // Mostra o teclado alfabético ao clicar em inputs de texto
    alphaInputs.forEach(input => {
        input.addEventListener('click', (e) => {
            e.preventDefault();
            showKeyboard(alphaKeyboard, input);
        });
    });

    // --- LÓGICA DO TECLADO NUMÉRICO ---
    // Adiciona funcionalidade às teclas do teclado numérico
    numericKeyboard.addEventListener('click', (e) => {
        if (!activeInput) return;
        const target = e.target;

        if (target.dataset.key) {
            activeInput.value += target.dataset.key;
        } else if (target.id === 'keyboard-backspace') {
            activeInput.value = activeInput.value.slice(0, -1);
        } else if (target.id === 'keyboard-confirm' || target.closest('.keyboard-close-btn')) {
            hideAllKeyboards();
        }
    });

    // --- LÓGICA DO TECLADO ALFABÉTICO ---
    // Gerencia shift e letras maiúsculas/minúsculas
    const shiftKey = document.getElementById('shift-key');
    const alphaKeys = alphaKeyboard.querySelectorAll('.keyboard-key[data-key]');

    // Alterna o estado do shift (maiúsculo/minúsculo)
    const toggleShift = () => {
        isShiftActive = !isShiftActive;
        shiftKey.classList.toggle('active', isShiftActive);
        alphaKeys.forEach(key => {
            if (key.dataset.key !== ' ') {
                key.textContent = isShiftActive ? key.textContent.toUpperCase() : key.textContent.toLowerCase();
            }
        });
    };

    // Adiciona funcionalidade às teclas do teclado alfabético
    alphaKeyboard.addEventListener('click', (e) => {
        if (!activeInput) return;
        const target = e.target;

        if (target.dataset.key) {
            let char = target.dataset.key;
            // Se shift está ativo ou início de palavra, insere maiúscula
            if (isShiftActive || activeInput.value.length === 0 || activeInput.value.slice(-1) === ' ') {
                activeInput.value += char.toUpperCase();
                if (isShiftActive) {
                    toggleShift();
                }
            } else {
                activeInput.value += char;
            }
        } else if (target.id === 'shift-key') {
            toggleShift();
        } else if (target.id === 'backspace-alpha') {
            activeInput.value = activeInput.value.slice(0, -1);
        } else if (target.id === 'confirm-alpha' || target.closest('.keyboard-close-btn')) {
            hideAllKeyboards();
        }
    });

    // ==================================================================
    // FIM DA LÓGICA DO TECLADO VIRTUAL
    // ==================================================================


    // --- EVENT LISTENER PRINCIPAL DO FORMULÁRIO ---
    // Captura o envio do formulário de dados do cliente
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Fecha qualquer teclado aberto ao enviar
        hideAllKeyboards();

        const submitButton = form.querySelector('button[type="submit"]');
        const nomeCliente = nomeInput.value.trim();

        // Validação: exige nome preenchido
        if (!nomeCliente) {
            Notificacao.erro('Campo Obrigatório', 'Por favor, informe seu nome para continuar.');
            return;
        }

        // Desabilita botão e mostra spinner
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';

        // Monta objeto com dados do cliente
        const dadosCliente = {
            nome: nomeCliente,
            telefone: document.getElementById('telefone').value,
            cpf: document.getElementById('cpf').value
        };

        try {
            // Envia requisição para iniciar sessão do cliente
            const response = await fetch('/api/mesas/sessoes/iniciar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dadosCliente)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Não foi possível iniciar a sessão.');
            }

            // Salva dados da sessão e redireciona para o cardápio
            localStorage.removeItem('sessaoId');
            localStorage.removeItem('dadosCliente');
            localStorage.setItem('sessaoId', result.sessaoId);
            localStorage.setItem('dadosCliente', JSON.stringify({ nome: result.nomeCliente }));

            window.location.href = '/cardapio';

        } catch (error) {
            // Exibe erro caso não consiga iniciar sessão
            Notificacao.erro('Erro ao Iniciar Sessão', error.message);
        } finally {
            // Reabilita botão e restaura texto
            submitButton.disabled = false;
            submitButton.innerHTML = 'Ver o Cardápio';
        }
    });
});
