
/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE LOGIN DO CLIENTE (login_cliente.html)
 * ==================================================================
 * Controla o formulário de login, validação, redirecionamento e
 * a funcionalidade do teclado virtual customizado, que aparece
 * apenas ao clicar em um campo de input.
 * Gerencia autenticação do cliente e integração com teclado virtual.
 */

// Aguarda o carregamento completo do DOM para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    // --- SELEÇÃO DOS ELEMENTOS DO DOM ---
    // Seleciona todos os elementos necessários da página para manipulação posterior
    const loginForm = document.getElementById('login-form');
    const usuarioInput = document.getElementById('usuario');
    const senhaInput = document.getElementById('senha');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const keyboardContainer = document.querySelector('.simple-keyboard'); // Seleciona o contêiner do teclado
    
    let activeInput = null;

    // --- INICIALIZAÇÃO E CONFIGURAÇÃO DO TECLADO VIRTUAL ---
    // Inicializa o teclado virtual customizado usando SimpleKeyboard
    const Keyboard = window.SimpleKeyboard.default;
    const keyboard = new Keyboard({
        onChange: input => {
            if (activeInput) {
                activeInput.value = input;
            }
        },
        layout: {
            'default': [
                'q w e r t y u i o p',
                'a s d f g h j k l',
                '{shift} z x c v b n m {backspace}',
                '{numbers} {space} {ent}'
            ],
            'shift': [
                'Q W E R T Y U I O P',
                'A S D F G H J K L',
                '{shift} Z X C V B N M {backspace}',
                '{numbers} {space} {ent}'
            ],
            'numbers': [
                '1 2 3',
                '4 5 6',
                '7 8 9',
                '{abc} 0 {backspace}'
            ]
        },
        display: {
            '{numbers}': '123',
            '{abc}': 'ABC',
            '{shift}': '⇧',
            '{space}': ' ',
            '{backspace}': '⌫',
            '{ent}': 'Entrar'
        },

        // Evento disparado ao pressionar uma tecla do teclado virtual
        onKeyPress: button => {
            handleKeyPress(button);
        }
    });

    /**
     * Lida com as teclas especiais do teclado virtual (shift, números, enter).
     * Alterna layouts ou dispara o submit do formulário.
     */
    function handleKeyPress(button) {
        if (button === "{shift}") {
            // Alterna entre layout normal e shift
            const currentLayout = keyboard.options.layoutName;
            keyboard.setOptions({
                layoutName: currentLayout === "default" ? "shift" : "default"
            });
        } else if (button === "{numbers}" || button === "{abc}") {
            // Alterna entre layout de números e letras
            const currentLayout = keyboard.options.layoutName;
            keyboard.setOptions({
                layoutName: currentLayout === "numbers" ? "default" : "numbers"
            });
        } else if (button === "{ent}") {
            // Dispara o submit do formulário ao pressionar Enter
            loginForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }


    // --- GERENCIAMENTO DO FOCO E VISIBILIDADE DO TECLADO ---

    /**
     * Função chamada quando um campo de input recebe foco.
     * Exibe o teclado virtual e sincroniza o valor do input.
     * @param {Event} event - O evento de foco.
     */
    function onInputFocus(event) {
        activeInput = event.target;
        // Mostra o teclado virtual ao focar no input
        keyboardContainer.style.display = 'block';
        // Atualiza o teclado com o valor atual do input
        keyboard.setInput(activeInput.value);
    }

    // Adiciona o listener de 'focus' para cada um dos inputs de usuário e senha
    [usuarioInput, senhaInput].forEach(input => {
        input.addEventListener('focus', onInputFocus);
    });


    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO DE LOGIN ---
    // Captura o evento de submit do formulário de login do cliente
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Impede o recarregamento da página

        // Oculta o teclado virtual ao enviar o formulário
        keyboardContainer.style.display = 'none';

        // Obtém os valores digitados pelo usuário
        const usuarioValue = usuarioInput.value;
        const senhaValue = senhaInput.value;

        // Validação: impede envio se algum campo estiver vazio
        if (!usuarioValue || !senhaValue) {
            Notificacao.erro('Campos Vazios', 'Por favor, preencha o usuário e a senha da mesa.');
            return;
        }

        // Desabilita o botão e mostra spinner enquanto processa
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            // Envia requisição de login para o backend
            const response = await fetch('/auth/login-cliente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome_usuario: usuarioValue, senha: senhaValue })
            });

            const data = await response.json();

            if (response.ok) {
                // Login bem-sucedido: limpa carrinho, salva token e dados da mesa, redireciona
                localStorage.removeItem('carrinho');
                localStorage.setItem('token', data.token);
                localStorage.setItem('mesaId', data.mesa.id);
                localStorage.setItem('nomeMesa', data.mesa.nome_usuario);
                window.location.href = '/dados-cliente';
            } else {
                // Falha no login: exibe mensagem de erro
                Notificacao.erro('Falha no Login', data.message || 'Usuário ou senha inválidos.');
            }
        } catch (error) {
            // Erro de conexão ou servidor: exibe notificação
            console.error('Erro ao fazer login:', error);
            Notificacao.erro('Erro de Conexão', 'Não foi possível conectar ao servidor. Por favor, chame um garçom.');
        } finally {
            // Reabilita o botão e restaura texto
            submitButton.disabled = false;
            submitButton.innerHTML = 'Entrar no Cardápio';
        }
    });
});
