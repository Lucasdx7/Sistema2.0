
/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE CONFIGURAÇÕES (configuracoes.js) - VERSÃO FINAL
 * Com a exibição correta de "Mesas Fechadas" no relatório de atividade.
 * ==================================================================
 * Controla as configurações do sistema, permissões, relatórios e personalização da interface.
 */ 


// Aguarda o carregamento completo do DOM para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    // Seleciona todos os elementos necessários da página para manipulação posterior
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');
    const fonteClienteSelect = document.getElementById('fonte-cliente-select');
    const salvarFonteBtn = document.getElementById('salvar-fonte-btn');
    const relatorioUsuarioSelect = document.getElementById('relatorio-usuario-select');
    const relatorioPeriodoSelect = document.getElementById('relatorio-periodo-select');
    const gerarRelatorioBtn = document.getElementById('gerar-relatorio-btn');
    const relatorioResultadoContainer = document.getElementById('relatorio-resultado-container');
    const permissoesForm = document.getElementById('permissoes-form');
    const permissoesGrid = document.querySelector('.permissions-grid');
    

    // --- Autenticação ---
    // Verifica se o usuário está autenticado e tem permissão de acesso
    const token = localStorage.getItem('authToken');
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    if (!token || !usuario || usuario.nivel_acesso !== 'geral') {
        document.body.innerHTML = '<div class="error-page"><h1>Acesso Negado</h1><p>Você não tem permissão para acessar esta página.</p></div>';
        return;
    }

    // --- Funções ---
    // Função para realizar logout do sistema
    function fazerLogout() {
        localStorage.clear();
        window.location.href = '/login-gerencia';
    }

    // Salva as configurações alteradas no backend
    async function salvarConfiguracoes(configs) {
        try {
            const response = await fetch('/api/configuracoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(configs)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            Notificacao.sucesso('Configuração salva!', result.message);
        } catch (error) {
            Notificacao.erro('Erro ao Salvar', error.message);
        }
    }

    // Carrega as configurações iniciais do backend ao abrir a página
    async function carregarConfiguracoesIniciais() {
        try {
            const chaves = 'fonte_cliente,permissoes_home';
            const response = await fetch(`/api/configuracoes/${chaves}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Falha ao carregar dados.');
            const configs = await response.json();
            if (configs.fonte_cliente) fonteClienteSelect.value = configs.fonte_cliente;
            renderizarCheckboxesPermissao(configs.permissoes_home || []);
            await carregarUsuariosParaRelatorio();
        } catch (error) {
            Notificacao.erro('Erro de Carregamento', error.message);
        }
    }

    // --- Seção de Personalização ---
    // Listener para salvar a fonte selecionada pelo cliente
    salvarFonteBtn.addEventListener('click', () => {
        const novaFonte = fonteClienteSelect.value;
        salvarConfiguracoes({ 'fonte_cliente': novaFonte });
    });

    // --- Seção de Relatórios ---
    // Carrega a lista de usuários para seleção no relatório de atividades
    async function carregarUsuariosParaRelatorio() {
        try {
            const response = await fetch('/api/configuracoes/usuarios-para-relatorio', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Falha ao buscar funcionários.');
            const usuarios = await response.json();
            relatorioUsuarioSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
            usuarios.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.nome} (${user.nivel_acesso || 'N/A'})`;
                option.dataset.nome = user.nome;
                relatorioUsuarioSelect.appendChild(option);
            });
        } catch (error) {
            Notificacao.erro('Erro', error.message);
        }
    }

    // Gera o relatório de atividades do usuário selecionado
    async function gerarRelatorio() {
    const usuarioId = relatorioUsuarioSelect.value;
    const periodo = relatorioPeriodoSelect.value;
    if (!usuarioId) return Notificacao.aviso('Campo Obrigatório', 'Por favor, selecione um funcionário.');

        const selectedOption = relatorioUsuarioSelect.options[relatorioUsuarioSelect.selectedIndex];
        const nomeUsuario = selectedOption.dataset.nome;
        
        let deleteButton = document.getElementById('delete-user-btn');
        if (deleteButton) deleteButton.remove();

        if (usuarioId != usuario.id) {
            deleteButton = document.createElement('button');
            deleteButton.id = 'delete-user-btn';
            deleteButton.className = 'btn btn-danger';
            deleteButton.innerHTML = `<i class="fas fa-trash-alt"></i> Deletar ${nomeUsuario}`;
            deleteButton.onclick = () => deletarUsuario(usuarioId, nomeUsuario);
            gerarRelatorioBtn.parentNode.insertBefore(deleteButton, gerarRelatorioBtn.nextSibling);
        }

        gerarRelatorioBtn.disabled = true;
        gerarRelatorioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
        relatorioResultadoContainer.classList.add('hidden');


       try {
        // CORREÇÃO: A URL agora aponta para a rota dentro do módulo de relatórios
        const response = await fetch(`/api/relatorios/atividade?usuarioId=${usuarioId}&periodo=${periodo}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const atividades = await response.json();
        if (!response.ok) throw new Error(atividades.message);
            relatorioResultadoContainer.classList.remove('hidden');
            
            if (atividades.length === 0) {
                relatorioResultadoContainer.innerHTML = '<p>Nenhuma atividade encontrada para este funcionário no período selecionado.</p>';
            } else {
                let htmlResult = '<ul>';
                atividades.forEach(ativ => {
                    // ==================================================================
                    // --- AQUI ESTÁ A CORREÇÃO ---
                    // Se a ação for 'Mesas Fechadas', usamos o texto diretamente.
                    // Caso contrário, formatamos como antes.
                    // ==================================================================
                    const acaoFormatada = ativ.acao === 'Mesas Fechadas' 
                        ? ativ.acao 
                        : ativ.acao.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                    
                    htmlResult += `<li><strong>${acaoFormatada}:</strong> ${ativ.total} vezes</li>`;
                });
                htmlResult += '</ul>';
                relatorioResultadoContainer.innerHTML = htmlResult;
            }
        } catch (error) {
            Notificacao.erro('Erro ao Gerar Relatório', error.message);
        } finally {
            gerarRelatorioBtn.disabled = false;
            gerarRelatorioBtn.textContent = 'Gerar Relatório';
        }
    }
    gerarRelatorioBtn.addEventListener('click', gerarRelatorio);
    relatorioUsuarioSelect.addEventListener('change', () => {
        relatorioResultadoContainer.classList.add('hidden');
        const deleteButton = document.getElementById('delete-user-btn');
        if (deleteButton) deleteButton.remove();
    });

    // Deleta um usuário do sistema após confirmação
    async function deletarUsuario(id, nome) {
    const confirmado = await Notificacao.confirmar('Deletar Funcionário', `Tem certeza que deseja deletar permanentemente o funcionário '${nome}'?`);
    if (confirmado) {
        try {
            // CORREÇÃO: A URL agora aponta para a rota dentro do módulo de configurações
            const response = await fetch(`/api/configuracoes/usuarios/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            Notificacao.sucesso('Funcionário Deletado!', result.message);
                carregarUsuariosParaRelatorio();
                relatorioResultadoContainer.classList.add('hidden');
                const deleteButton = document.getElementById('delete-user-btn');
                if (deleteButton) deleteButton.remove();
            } catch (error) {
                Notificacao.erro('Falha ao Deletar', error.message);
            }
        }
    }

    // --- Seção de Permissões ---
    // Renderiza os checkboxes de permissões para os módulos do sistema
    function renderizarCheckboxesPermissao(permissoesAtivas = []) {
        const modulos = [
            { id: 'card-cardapio', label: 'Gerenciar Cardápio' },
            { id: 'card-mesas', label: 'Gerenciar Mesas' },
            { id: 'card-chamados', label: 'Chamados de Garçom' },
            { id: 'card-logs', label: 'Logs do Sistema' },
            { id: 'card-pedidos', label: 'Acompanhar Pedidos' },
            { id: 'card-relatorios', label: 'Relatórios de Vendas' },
            { id: 'card-config', label: 'Configurações' }
        ];
        permissoesGrid.innerHTML = '';
        modulos.forEach(modulo => {
            const isChecked = permissoesAtivas.includes(modulo.id);
            permissoesGrid.innerHTML += `<div class="permission-item"><input type="checkbox" id="perm-${modulo.id}" name="permissoes" value="${modulo.id}" ${isChecked ? 'checked' : ''}><label for="perm-${modulo.id}">${modulo.label}</label></div>`;
        });
    }

    // Listener para salvar as permissões selecionadas ao enviar o formulário
    permissoesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('input[name="permissoes"]:checked');
        const permissoesSelecionadas = Array.from(checkboxes).map(cb => cb.value);
        salvarConfiguracoes({ 'permissoes_home': permissoesSelecionadas });
    });


    // --- Inicialização e Menu de Perfil ---
    // Inicializa a página, carrega configurações e configura o menu de perfil
    if (dropdownUserName) dropdownUserName.textContent = usuario.nome;
    if (dropdownUserRole) dropdownUserRole.textContent = usuario.nivel_acesso;
    profileMenuBtn.addEventListener('click', () => profileDropdown.classList.toggle('hidden'));
    window.addEventListener('click', (e) => {
        if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fazerLogout();
    });

    carregarConfiguracoesIniciais();
});
