// /Frontend/Pagina_dev/Devlogin.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('dev-login-form'); // Verifique se o ID do seu <form> é este
    if (!loginForm) {
        console.error('Formulário de login não encontrado! Verifique o ID do elemento <form>.');
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o recarregamento da página

        // Pega os elementos dos inputs. Verifique se os IDs estão corretos no seu HTML.
        const userInput = document.getElementById('dev-username'); 
        const passwordInput = document.getElementById('dev-password');

        // Pega os valores dos inputs
        const usuarioValue = userInput.value;
        const senhaValue = passwordInput.value;

        // Validação simples no frontend
        if (!usuarioValue || !senhaValue) {
            alert('Por favor, preencha o usuário e a senha.');
            return;
        }

        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            // --- A CORREÇÃO CRUCIAL ESTÁ AQUI ---
            // O objeto dentro de JSON.stringify() DEVE ter as chaves 'usuario' e 'senha'
            // para corresponder ao que a API espera em `req.body`.
            const response = await fetch('/auth/dev-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usuario: usuarioValue, // Chave: 'usuario'
                    senha: senhaValue      // Chave: 'senha'
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Se o login for bem-sucedido (status 200-299)
                console.log('Login bem-sucedido!', data);
                localStorage.setItem('token', data.token);
                window.location.href = '/dev-painel'; // Redireciona para o painel
            } else {
                // Se o login falhar (status 400, 401, 500, etc.)
                // Mostra a mensagem de erro vinda do servidor
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }

        } catch (error) {
            // Captura erros de rede ou erros lançados pelo bloco acima
            console.error('Falha no processo de login:', error);
            alert(`Erro no login: ${error.message}`);
        } finally {
            // Este bloco sempre executa, reabilitando o botão
            submitButton.disabled = false;
            submitButton.innerHTML = 'Entrar';
        }
    });
});
