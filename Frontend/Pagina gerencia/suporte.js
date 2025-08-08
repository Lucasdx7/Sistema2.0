document.addEventListener('DOMContentLoaded', () => {
    const formSuporte = document.getElementById('form-suporte');
    const nomeInput = document.getElementById('nome');
    const telefoneInput = document.getElementById('telefone');
    const problemaTextarea = document.getElementById('problema');

    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');

    const token = localStorage.getItem('authToken');
    const usuarioString = localStorage.getItem('usuario');

    if (!token || !usuarioString) {
        // A notificação de erro já espera o usuário interagir
        Notificacao.erro('Acesso Negado', 'Você precisa estar logado.')
            .then(() => window.location.href = '/login-gerencia');
        return;
    }
    const usuario = JSON.parse(usuarioString);

    function fazerLogout() {
        localStorage.clear();
        window.location.href = '/login-gerencia';
    }

    function preencherDadosUsuario() {
        if (dropdownUserName) dropdownUserName.textContent = usuario.nome;
        if (dropdownUserRole) dropdownUserRole.textContent = usuario.nivel_acesso;
        if (nomeInput && usuario.nome) {
            nomeInput.value = usuario.nome;
        }
    }

    async function enviarChamado(event) {
        event.preventDefault();

        const formData = {
            nome: nomeInput.value.trim(),
            telefone: telefoneInput.value.trim(),
            problema: problemaTextarea.value.trim()
        };

        if (!formData.nome || !formData.telefone || !formData.problema) {
            // A notificação de erro padrão já exige que o usuário clique em "OK"
            Notificacao.erro('Atenção', 'Por favor, preencha todos os campos do formulário.');
            return;
        }

        Notificacao.mostrarCarregando('Enviando chamado...');

        try {
            const response = await fetch('/api/suporte/enviar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Falha ao enviar o chamado.');
            }

            // A notificação de sucesso agora vai esperar o usuário clicar em "OK"
            await Notificacao.sucesso(
                'Chamado Enviado!',
                'Sua solicitação foi enviada com sucesso.'
            );
            
            formSuporte.reset();
            preencherDadosUsuario();

        } catch (error) {
            // A notificação de erro também vai esperar a interação do usuário
            Notificacao.erro('Oops... Ocorreu um erro', error.message);
        } 
        // O bloco 'finally' foi removido para que o Swal.close() não seja chamado prematuramente.
        // A biblioteca SweetAlert2 gerencia a troca da notificação de "carregando" pela de "sucesso" ou "erro".
    }


    function conectarWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        const ws = new WebSocket(wsUrl );

        ws.onopen = () => console.log('Conexão WebSocket estabelecida para a gerência.');

        ws.onmessage = (event) => {
            try {
                const mensagem = JSON.parse(event.data);
                if (mensagem.type === 'CHAMADO_GARCOM') {
                   Swal.fire({
                        title: '<strong>Chamado!</strong>',
                        html: `<h2>A <strong>${mensagem.nomeMesa}</strong> está solicitando atendimento.</h2>`,
                        icon: 'warning',
                        confirmButtonText: 'OK, Entendido!',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                    });
                }
            } catch (error) {
                console.error('Erro ao processar mensagem WebSocket:', error);
            }
        };

        ws.onclose = () => {
            console.log('Conexão WebSocket fechada. Tentando reconectar em 5 segundos...');
            setTimeout(conectarWebSocket, 5000);
        };

        ws.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            ws.close();
        };
    }

    formSuporte.addEventListener('submit', enviarChamado);

    profileMenuBtn.addEventListener('click', () => profileDropdown.classList.toggle('hidden'));
    window.addEventListener('click', (e) => {
        if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmado = await Notificacao.confirmar('Sair do Sistema', 'Deseja mesmo sair?');
        if (confirmado) fazerLogout();
    });
    conectarWebSocket();
    preencherDadosUsuario();
});
