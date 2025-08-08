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
    // --- Autenticação e Verificação de Dados (Lógica Original) ---
    const token = localStorage.getItem('token');
    const nomeMesa = localStorage.getItem('nomeMesa');

    if (!token || !nomeMesa) {
        Notificacao.erro('Acesso Inválido', 'Você precisa fazer o login da mesa primeiro.')
            .then(() => {
                window.location.href = '/login';
            });
        return;
    }

    // --- Elementos do DOM (Lógica Original) ---
    const welcomeMessage = document.getElementById('welcome-mesa-name');
    const form = document.getElementById('dados-cliente-form');
    const nomeInput = document.getElementById('nome');

    welcomeMessage.textContent = `Olá, ${nomeMesa}!`;

    // ==================================================================
    // INÍCIO DA LÓGICA DO TECLADO VIRTUAL INTEGRADA
    // ==================================================================

    // --- Seletores dos Elementos do Teclado ---
    const numericKeyboard = document.getElementById('virtual-keyboard');
    const alphaKeyboard = document.getElementById('virtual-keyboard-alpha');
    
    const numericInputs = document.querySelectorAll('.numeric-input');
    const alphaInputs = document.querySelectorAll('.alpha-input');

    let activeInput = null;
    let isShiftActive = false;

    // --- Funções Genéricas para Teclados ---

    const showKeyboard = (keyboardElement, inputElement) => {
        activeInput = inputElement;
        const label = document.querySelector(`label[for=${activeInput.id}]`);
        const keyboardLabel = keyboardElement.querySelector('.keyboard-header span');
        
        if (keyboardLabel && label) {
            keyboardLabel.textContent = label.textContent;
        }

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

    const hideAllKeyboards = () => {
        document.querySelectorAll('.virtual-keyboard-container.visible').forEach(kb => {
            kb.classList.remove('visible');
            setTimeout(() => kb.classList.add('hidden'), 300);
        });
        
        document.body.classList.remove('keyboard-active');
        activeInput = null;
    };

    // --- Event Listeners para Abrir os Teclados ---
    numericInputs.forEach(input => {
        input.addEventListener('click', (e) => {
            e.preventDefault();
            showKeyboard(numericKeyboard, input);
        });
    });

    alphaInputs.forEach(input => {
        input.addEventListener('click', (e) => {
            e.preventDefault();
            showKeyboard(alphaKeyboard, input);
        });
    });

    // --- Lógica do Teclado Numérico ---
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

    // --- Lógica do Teclado Alfabético ---
    const shiftKey = document.getElementById('shift-key');
    const alphaKeys = alphaKeyboard.querySelectorAll('.keyboard-key[data-key]');

    const toggleShift = () => {
        isShiftActive = !isShiftActive;
        shiftKey.classList.toggle('active', isShiftActive);
        alphaKeys.forEach(key => {
            if (key.dataset.key !== ' ') {
                key.textContent = isShiftActive ? key.textContent.toUpperCase() : key.textContent.toLowerCase();
            }
        });
    };

    alphaKeyboard.addEventListener('click', (e) => {
        if (!activeInput) return;
        const target = e.target;

        if (target.dataset.key) {
            let char = target.dataset.key;
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


    // --- Event Listener Principal do Formulário (Lógica Original) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Garante que qualquer teclado aberto seja fechado ao enviar o formulário
        hideAllKeyboards();

        const submitButton = form.querySelector('button[type="submit"]');
        const nomeCliente = nomeInput.value.trim();

        if (!nomeCliente) {
            Notificacao.erro('Campo Obrigatório', 'Por favor, informe seu nome para continuar.');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';

        const dadosCliente = {
            nome: nomeCliente,
            telefone: document.getElementById('telefone').value,
            cpf: document.getElementById('cpf').value
        };

       
        try {
            
            const response = await fetch('/api/mesas/sessoes/iniciar', { // <-- URL CORRETA
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

            localStorage.removeItem('sessaoId');
            localStorage.removeItem('dadosCliente');
            localStorage.setItem('sessaoId', result.sessaoId);
            localStorage.setItem('dadosCliente', JSON.stringify({ nome: result.nomeCliente }));

            window.location.href = '/cardapio';

        } catch (error) {
            Notificacao.erro('Erro ao Iniciar Sessão', error.message);
        } finally {
            submitButton.disabled = false;
            // Usei o texto do seu HTML original para o botão
            submitButton.innerHTML = 'Ver o Cardápio';
        }
    });
});
