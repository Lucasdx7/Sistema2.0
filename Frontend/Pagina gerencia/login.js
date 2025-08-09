
// /Frontend/Pagina gerencia/login.js - CÓDIGO COMPLETO E CORRIGIDO
// Script responsável pelo login e registro de novos gerentes na página de login da gerência.

// Aguarda o carregamento completo do DOM para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    // Seleciona todos os elementos necessários da página para manipulação posterior
    const loginForm = document.getElementById('login-form');
    const registerModal = document.getElementById('register-modal');
    const openModalBtn = document.getElementById('open-register-modal-btn');
    const closeModalBtn = document.getElementById('close-register-modal-btn');
    const registerForm = document.getElementById('register-form');

    // --- Lógica de Login com Notificações e Delay ---
    // Adiciona listener para o formulário de login, faz requisição para autenticação e trata notificações
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-senha').value;

            Notificacao.mostrarCarregando('Verificando credenciais...');

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Credenciais inválidas.');
                }

                // Armazena os dados no localStorage
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));

                // Exibe uma notificação de sucesso com temporizador
                await Notificacao.sucessoComTimer(
                    'Login bem-sucedido!',
                    'Você será redirecionado em breve.',
                    1000 // 2 segundos de espera
                );

                // Redireciona APÓS a notificação fechar
                window.location.href = '/gerencia-home';

            } catch (error) {
                Notificacao.erro('Falha no Login', error.message);
            }
        });
    }
    
    // --- Lógica do Modal de Registro ---
    // Adiciona listeners para abrir e fechar o modal de registro de novo gerente
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            registerModal.classList.remove('hidden');
        });
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            registerModal.classList.add('hidden');
        });
    }
    if (registerModal) {
        registerModal.addEventListener('click', (e) => {
            if (e.target === registerModal) {
                registerModal.classList.add('hidden');
            }
        });
    }

    // --- Lógica de Registro com Notificações ---
    // Adiciona listener para o formulário de registro, faz requisição para criar novo gerente e trata notificações
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nome = document.getElementById('register-nome').value;
            const email = document.getElementById('register-email').value;
            const senha = document.getElementById('register-senha').value;
            const nivel_acesso = document.querySelector('input[name="nivel_acesso"]:checked').value;
            const tokenSecreto = document.getElementById('register-token').value;
            const usuario = nome;

            Notificacao.mostrarCarregando('Registrando...');

            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, email, senha, nivel_acesso, tokenSecreto, usuario })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao registrar.');
                }

                await Notificacao.sucesso('Sucesso!', 'Novo gerente registrado com sucesso!');
                
                registerModal.classList.add('hidden');
                registerForm.reset();

            } catch (error) {
                Notificacao.erro('Falha no Registro', error.message);
            }
        });
    }

    
});
