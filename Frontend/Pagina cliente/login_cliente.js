/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE LOGIN DO CLIENTE (login_cliente.html)
 * ==================================================================
 * Controla o formulário de login, validação, redirecionamento e
 * a funcionalidade do teclado virtual customizado, que aparece
 * apenas ao clicar em um campo de input.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- SELEÇÃO DOS ELEMENTOS DO DOM ---
    const loginForm = document.getElementById('login-form');
    const usuarioInput = document.getElementById('usuario');
    const senhaInput = document.getElementById('senha');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const keyboardContainer = document.querySelector('.simple-keyboard'); // Seleciona o contêiner do teclado
    
    let activeInput = null;

    // --- INICIALIZAÇÃO E CONFIGURAÇÃO DO TECLADO VIRTUAL ---
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
        onKeyPress: button => {
            handleKeyPress(button);
        }
    });

    function handleKeyPress(button) {
        if (button === "{shift}") {
            const currentLayout = keyboard.options.layoutName;
            keyboard.setOptions({
                layoutName: currentLayout === "default" ? "shift" : "default"
            });
        } else if (button === "{numbers}" || button === "{abc}") {
            const currentLayout = keyboard.options.layoutName;
            keyboard.setOptions({
                layoutName: currentLayout === "numbers" ? "default" : "numbers"
            });
        } else if (button === "{ent}") {
            loginForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }

    // --- GERENCIAMENTO DO FOCO E VISIBILIDADE DO TECLADO ---
    
    /**
     * Função chamada quando um campo de input recebe foco.
     * @param {Event} event - O evento de foco.
     */
    function onInputFocus(event) {
        activeInput = event.target;
        
        // **NOVO**: Torna o teclado visível ao focar no input
        keyboardContainer.style.display = 'block';
        
        keyboard.setInput(activeInput.value);
    }

    // Adiciona o listener de 'focus' para cada um dos inputs
    [usuarioInput, senhaInput].forEach(input => {
        input.addEventListener('focus', onInputFocus);
    });

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO (SEU CÓDIGO ORIGINAL) ---
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // **NOVO**: Oculta o teclado ao enviar o formulário
        keyboardContainer.style.display = 'none';

        const usuarioValue = usuarioInput.value;
        const senhaValue = senhaInput.value;
        
        if (!usuarioValue || !senhaValue) {
            Notificacao.erro('Campos Vazios', 'Por favor, preencha o usuário e a senha da mesa.');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            const response = await fetch('/auth/login-cliente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome_usuario: usuarioValue, senha: senhaValue })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.removeItem('carrinho');
                localStorage.setItem('token', data.token);
                localStorage.setItem('mesaId', data.mesa.id);
                localStorage.setItem('nomeMesa', data.mesa.nome_usuario);
                window.location.href = '/dados-cliente';
            } else {
                Notificacao.erro('Falha no Login', data.message || 'Usuário ou senha inválidos.');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            Notificacao.erro('Erro de Conexão', 'Não foi possível conectar ao servidor. Por favor, chame um garçom.');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Entrar no Cardápio';
        }
    });
});
