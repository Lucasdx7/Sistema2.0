
/**
 * ==================================================================
 * SCRIPT PRINCIPAL DA PÁGINA DE GERENCIAMENTO (Gerencia.html)
 * ==================================================================
 * Este arquivo controla toda a interatividade da página de gerenciamento,
 * como adicionar/editar/excluir categorias e produtos.
 *
 * Ele depende do objeto `Notificacao` que é fornecido pelo arquivo
 * `notificacoes.js`, que deve ser carregado antes deste script.
 *
 * Controla autenticação, renderização, edição, drag-and-drop, integração com WebSocket e notificações.
 */

// Aguarda o carregamento completo do DOM para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes Globais ---
    // Define URLs base para API e WebSocket
    const API_URL = '/api';
    const WS_URL = `ws://${window.location.host}`;

    
    // --- Elementos do DOM ---
    // Seleciona todos os elementos necessários da página para manipulação posterior
    const listaCategorias = document.getElementById('lista-categorias');
    const listaProdutos = document.getElementById('lista-produtos');
    const nomeCategoriaSelecionada = document.getElementById('nome-categoria-selecionada');
    const formProdutoContainer = document.getElementById('form-produto-container');
    const inputNovaCategoria = document.getElementById('input-nova-categoria');
    const btnAddCategoria = document.getElementById('btn-add-categoria');
    const checkIsHappyHour = document.getElementById('input-is-happy-hour');
    const happyHourFields = document.getElementById('happy-hour-fields');
    const inputHappyHourInicio = document.getElementById('input-happy-hour-inicio');
    const inputHappyHourFim = document.getElementById('input-happy-hour-fim');
    const inputNomeProduto = document.getElementById('input-nome-produto');
    const inputDescricaoProduto = document.getElementById('input-descricao-produto');
    const inputDescricaoDetalhada = document.getElementById('input-descricao-detalhada');
    const inputPrecoProduto = document.getElementById('input-preco-produto');
    const inputImagemProduto = document.getElementById('input-imagem-produto');
    const inputServePessoas = document.getElementById('input-serve-pessoas');
    const btnAddProduto = document.getElementById('btn-add-produto');
    const editModal = document.getElementById('editModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const editForm = document.getElementById('editForm');
    const editItemId = document.getElementById('editItemId');
    const editItemType = document.getElementById('editItemType');
    const closeModalBtn = editModal.querySelector('.close-btn');
    const cancelModalBtn = editModal.querySelector('.cancel-btn');


    const logsTableBody = document.querySelector('#logs-table tbody');
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');

    // --- Verificação de Autenticação e Permissão ---
    // Verifica se o usuário está autenticado, caso contrário redireciona para o login
    const token = localStorage.getItem('authToken');
    const usuarioString = localStorage.getItem('usuario');

    // 1. Verifica se o usuário está logado
    if (!token || !usuarioString) {
        Notificacao.erro('Acesso Negado', 'Você precisa estar logado para acessar esta página.')
            .then(() => {
                window.location.href = '/login-gerencia';
            });
        return; // Interrompe a execução
    }

    const usuario = JSON.parse(usuarioString);
    if (dropdownUserName) dropdownUserName.textContent = usuario.nome;
    if (dropdownUserRole) dropdownUserRole.textContent = usuario.nivel_acesso;


    profileMenuBtn.addEventListener('click', () => {
        profileDropdown.classList.toggle('hidden');
    });

    // Fecha o menu de perfil se o usuário clicar fora dele
    window.addEventListener('click', (e) => {
        if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Pede confirmação antes de fazer o logout
        const confirmado = await Notificacao.confirmar('Sair do Sistema', 'Você tem certeza que deseja fazer logout?');
        
        if (confirmado) {
            fazerLogout();
        }
    });

    // Função para realizar logout do sistema
    function fazerLogout() {
        // 1. Limpa os dados da sessão de gerência do armazenamento local.
        localStorage.removeItem('authToken');
        localStorage.removeItem('usuario');
        
        // 2. Mostra a notificação de sucesso para o usuário.
        Notificacao.sucesso('Logout realizado com sucesso!');

        // 3. Aguarda um curto período (1.5 segundos) e DEPOIS redireciona.
        setTimeout(() => {
            window.location.href = '/login-gerencia';
        }, 1500); // 1500 milissegundos = 1.5 segundos
    }
    // --- Variáveis de Estado ---
    // Variáveis para armazenar o estado da categoria selecionada e item arrastado
    let estado = { categoriaSelecionada: null };
    let itemArrastado = null;

    // --- FUNÇÃO DE CHAMADA À API (apiCall) ---
    // Função utilitária para chamadas à API autenticadas
    async function apiCall(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/login-gerencia';
            throw new Error('Token de autenticação não encontrado.');
        }
        const options = {
            method,
            headers: { 'Authorization': `Bearer ${token}` }
        };
        if (body) {
            // Se o corpo não for FormData, stringify
            if (!(body instanceof FormData)) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            } else {
                options.body = body;
            }
        }
        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            if (response.status === 401 || response.status === 403) {
                Notificacao.erro('Sessão Expirada!', 'Por favor, faça login novamente.');
                localStorage.removeItem('authToken');
                localStorage.removeItem('usuario');
                window.location.href = '/login-gerencia';
                throw new Error('Sessão inválida');
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message);
            }
            return response.status === 204 ? {} : response.json();
        } catch (error) {
            throw error;
        }
    }

    // --- Funções de Conversão ---
    // Converte arquivo para Base64 para upload de imagens
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // --- Funções de Renderização ---
    // Carrega e renderiza categorias e produtos na interface
    async function carregarCategorias() {
        try {
            const categorias = await apiCall('/categorias');
            listaCategorias.innerHTML = '';
            let categoriaAtivaAindaExiste = false;

            categorias.forEach(cat => {
                const li = document.createElement('li');
                Object.keys(cat).forEach(key => { li.dataset[key] = cat[key]; });
                li.draggable = true;
                li.classList.toggle('inactive', !cat.ativo);

                let happyHourInfo = '';
                if (cat.is_happy_hour && cat.happy_hour_inicio && cat.happy_hour_fim) {
                    happyHourInfo = `<small class="happy-hour-info">Happy Hour: ${cat.happy_hour_inicio.slice(0, 5)} - ${cat.happy_hour_fim.slice(0, 5)}</small>`;
                }

                li.innerHTML = `
                    <div class="item-info">
                        <span>${cat.nome}</span>
                        ${happyHourInfo}
                    </div>
                    <div class="action-buttons">
                        <label class="switch" title="${cat.ativo ? 'Desativar' : 'Ativar'} Categoria">
                            <input type="checkbox" class="toggle-status" data-tipo="categorias" ${cat.ativo ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <button class="edit-btn" data-tipo="categoria" title="Editar Categoria"><i class="fas fa-pencil-alt"></i></button>
                        <button class="delete-btn" data-tipo="categoria" title="Excluir Categoria">X</button>
                    </div>
                `;
                
                if (estado.categoriaSelecionada && cat.id == estado.categoriaSelecionada.id) {
                    li.classList.add('selected');
                    categoriaAtivaAindaExiste = true;
                }
                listaCategorias.appendChild(li);
            });

            if (!categoriaAtivaAindaExiste && estado.categoriaSelecionada) {
                estado.categoriaSelecionada = null;
                nomeCategoriaSelecionada.textContent = 'Nenhuma';
                formProdutoContainer.classList.add('hidden');
                listaProdutos.innerHTML = '';
            }
        } catch (error) {
            Notificacao.erro("Falha ao carregar categorias.", error.message);
        }
    }

    async function carregarProdutos(idCategoria) {
        try {
            const produtos = await apiCall(`/produtos?categoriaId=${idCategoria}`); // <-- ROTA NOVA E CORRETA
            listaProdutos.innerHTML = '';
            produtos.forEach(prod => {
                const li = document.createElement('li');
                Object.keys(prod).forEach(key => { li.dataset[key] = prod[key]; });
                // **NOVO: Adiciona draggable=true para produtos**
                li.draggable = true;
                li.classList.toggle('inactive', !prod.ativo);

                const podeSerSugestao = prod.pode_ser_sugestao === 1 || prod.pode_ser_sugestao === true;

                li.innerHTML = `
                <div class="produto-info">
                    <img src="${prod.imagem_svg || '/img/placeholder.svg'}" alt="${prod.nome}">
                        <div>
                            <strong>${prod.nome}</strong> - R$ ${parseFloat(prod.preco  ).toFixed(2)}
                            <p><strong>Descrição:</strong> ${prod.descricao}</p>
                            <p class="desc-detalhada"><strong>Detalhes:</strong> ${prod.descricao_detalhada || 'N/A'}</p>
                            <small>Serve: ${prod.serve_pessoas} pessoa(s)</small>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <label class="switch suggestion-switch" title="Marcar como sugestão de acompanhamento">
                            <input type="checkbox" class="toggle-suggestion" ${podeSerSugestao ? 'checked' : ''}>
                            <span class="slider suggestion-slider">💡</span>
                        </label>
                        <label class="switch" title="${prod.ativo ? 'Desativar' : 'Ativar'} Produto">
                            <input type="checkbox" class="toggle-status" data-tipo="produtos" ${prod.ativo ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <button class="edit-btn" data-tipo="produto" title="Editar Produto"><i class="fas fa-pencil-alt"></i></button>
                        <button class="delete-btn" data-tipo="produto" title="Excluir Produto">X</button>
                    </div>
                `;
                listaProdutos.appendChild(li);
            });
        } catch (error) {
            listaProdutos.innerHTML = '<li>Não foi possível carregar os produtos.</li>';
            Notificacao.erro("Falha ao carregar produtos.", error.message);
        }
    }

    // --- Lógica do Modal de Edição ---
    // Abre e fecha o modal de edição de categorias e produtos
    function abrirModalDeEdicao(tipo, itemElement) {
        const id = itemElement.dataset.id;
        editItemId.value = id;
        editItemType.value = tipo;
        modalBody.innerHTML = '';

        if (tipo === 'categoria') {
            modalTitle.textContent = 'Editar Categoria';
            const isHappy = itemElement.dataset.is_happy_hour === '1' || itemElement.dataset.is_happy_hour === 'true';
            
            modalBody.innerHTML = `
                <label for="editNome">Nome da Categoria:</label>
                <input type="text" id="editNome" name="nome" value="${itemElement.dataset.nome}" required>
                <div class="happy-hour-toggle">
                    <input type="checkbox" id="editIsHappyHour" name="is_happy_hour" ${isHappy ? 'checked' : ''}>
                    <label for="editIsHappyHour">É Happy Hour?</label>
                </div>
                <div id="editHappyHourFields" class="${isHappy ? '' : 'hidden'}">
                    <label for="editHappyHourInicio">Início:</label>
                    <input type="time" id="editHappyHourInicio" name="happy_hour_inicio" value="${itemElement.dataset.happy_hour_inicio || ''}">
                    <label for="editHappyHourFim">Fim:</label>
                    <input type="time" id="editHappyHourFim" name="happy_hour_fim" value="${itemElement.dataset.happy_hour_fim || ''}">
                </div>
            `;
            modalBody.querySelector('#editIsHappyHour').addEventListener('change', (e) => {
                modalBody.querySelector('#editHappyHourFields').classList.toggle('hidden', !e.target.checked);
            });
        } else if (tipo === 'produto') {
            modalTitle.textContent = 'Editar Produto';
            // **NOVO: Adicionado campo de upload de imagem e preview**
            modalBody.innerHTML = `
                <label for="editNome">Nome do Produto:</label>
                <input type="text" id="editNome" name="nome" value="${itemElement.dataset.nome}" required>
                <label for="editDescricao">Descrição Curta:</label>
                <textarea id="editDescricao" name="descricao" required>${itemElement.dataset.descricao}</textarea>
                <label for="editDescricaoDetalhada">Descrição Detalhada:</label>
                <textarea id="editDescricaoDetalhada" name="descricao_detalhada">${itemElement.dataset.descricao_detalhada || ''}</textarea>
                <label for="editPreco">Preço (R$):</label>
                <input type="number" id="editPreco" name="preco" step="0.01" value="${itemElement.dataset.preco}" required>
                <label for="editServePessoas">Serve Pessoas:</label>
                <input type="number" id="editServePessoas" name="serve_pessoas" value="${itemElement.dataset.serve_pessoas}" required min="1">
                <label for="editImagem">Alterar Imagem (opcional):</label>
                <input type="file" id="editImagem" name="imagem_svg" accept="image/*">
                <img id="editImagePreview" src="${itemElement.dataset.imagem_svg || '/img/placeholder.svg'}" alt="Preview" style="max-width: 100px; margin-top: 10px;">
            `;
            // **NOVO: Lógica para atualizar o preview da imagem**
            modalBody.querySelector('#editImagem' ).addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        modalBody.querySelector('#editImagePreview').src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        editModal.style.display = 'block';
    }

    function fecharModal() {
        editModal.style.display = 'none';
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editItemId.value;
        const tipo = editItemType.value;
        const url = `/${tipo}s/${id}`;
        const formData = new FormData(e.target);
        const body = Object.fromEntries(formData.entries());

        if (tipo === 'categoria') {
            body.is_happy_hour = e.target.querySelector('#editIsHappyHour')?.checked || false;
        } else if (tipo === 'produto') {
            // **NOVO: Lógica para lidar com a nova imagem**
            const imagemFile = e.target.querySelector('#editImagem').files[0];
            if (imagemFile) {
                // Converte para Base64 se uma nova imagem foi selecionada
                body.imagem_svg = await fileToBase64(imagemFile);
            } else {
                // Se não, remove o campo para não enviar um arquivo vazio
                delete body.imagem_svg;
            }
        }

        try {
            await apiCall(url, 'PUT', body);
            Notificacao.sucesso('Salvo com sucesso!');
            fecharModal();
            await carregarCategorias();
            if (estado.categoriaSelecionada) {
                await carregarProdutos(estado.categoriaSelecionada.id);
            }
        } catch (error) {
            Notificacao.erro('Erro ao Salvar', error.message);
        }
    });

    closeModalBtn.addEventListener('click', fecharModal);
    cancelModalBtn.addEventListener('click', fecharModal);
    window.addEventListener('click', (e) => { if (e.target === editModal) fecharModal(); });

    // --- Event Listeners Principais ---
    // Listeners para adicionar categoria, produto, alternar happy hour, etc.
    checkIsHappyHour.addEventListener('change', () => {
        happyHourFields.classList.toggle('hidden', !checkIsHappyHour.checked);
    });

    btnAddCategoria.addEventListener('click', async () => {
        const nome = inputNovaCategoria.value.trim();
        if (!nome) return Notificacao.erro('Campo Obrigatório', 'O nome da categoria não pode ser vazio.');
        const body = {
            nome,
            is_happy_hour: checkIsHappyHour.checked,
            happy_hour_inicio: inputHappyHourInicio.value || null,
            happy_hour_fim: inputHappyHourFim.value || null,
        };
        try {
            await apiCall('/categorias', 'POST', body);
            Notificacao.sucesso(`Categoria "${nome}" adicionada!`);
            inputNovaCategoria.value = '';
            checkIsHappyHour.checked = false;
            happyHourFields.classList.add('hidden');
            inputHappyHourInicio.value = '';
            inputHappyHourFim.value = '';
            await carregarCategorias();
        } catch (error) {
            Notificacao.erro('Falha ao Adicionar', error.message);
        }
    });

    // Lida com cliques em itens das listas de categorias e produtos (editar, excluir, selecionar, alternar status)
    async function handleListClick(event, listType) {
        const li = event.target.closest('li');
        if (!li) return;
        const id = li.dataset.id;
        const tipoEndpoint = listType; // 'categorias' ou 'produtos'

        if (event.target.classList.contains('toggle-status')) {
            const isChecked = event.target.checked;
            apiCall(`/${tipoEndpoint}/${id}`, 'PATCH', { ativo: isChecked })
                .then(() => {
                    li.classList.toggle('inactive', !isChecked);
                    li.dataset.ativo = isChecked;
                    Notificacao.sucesso(`Status atualizado!`);
                })
                .catch(error => {
                    Notificacao.erro(`Erro ao atualizar status`, error.message);
                    event.target.checked = !isChecked;
                });
            return;
        }

        if (event.target.classList.contains('toggle-suggestion')) {
            const isChecked = event.target.checked;
            apiCall(`/produtos/${id}/sugestao`, 'PATCH', { pode_ser_sugestao: isChecked })
                .then(() => {
                    li.dataset.pode_ser_sugestao = isChecked;
                    Notificacao.sucesso('Status de sugestão atualizado!');
                })
                .catch(error => {
                    Notificacao.erro(`Erro ao atualizar`, error.message);
                    event.target.checked = !isChecked;
                });
            return;
        }

        const button = event.target.closest('button');
        if (button) {
            const tipoItem = button.dataset.tipo; // 'categoria' ou 'produto'
            if (button.classList.contains('edit-btn')) {
                abrirModalDeEdicao(tipoItem, li);
            } else if (button.classList.contains('delete-btn')) {
                const confirmado = await Notificacao.confirmar('Tem certeza?', `Você está prestes a excluir "${li.dataset.nome}". Esta ação não pode ser desfeita.`);
                if (confirmado) {
                    apiCall(`/${tipoEndpoint}/${id}`, 'DELETE')
                        .then(() => {
                            li.remove();
                            Notificacao.sucesso('Item excluído com sucesso!');
                        })
                        .catch(error => Notificacao.erro('Falha ao Excluir', error.message));
                }
            }
            return;
        }

        if (listType === 'categorias') {
            estado.categoriaSelecionada = { id: parseInt(id, 10), nome: li.dataset.nome };
            document.querySelectorAll('#lista-categorias li').forEach(item => item.classList.remove('selected'));
            li.classList.add('selected');
            nomeCategoriaSelecionada.textContent = estado.categoriaSelecionada.nome;
            formProdutoContainer.classList.remove('hidden');
            carregarProdutos(estado.categoriaSelecionada.id);
        }
    }

    listaCategorias.addEventListener('click', (e) => handleListClick(e, 'categorias'));
    listaProdutos.addEventListener('click', (e) => handleListClick(e, 'produtos'));

    btnAddProduto.addEventListener('click', async () => {
        if (!estado.categoriaSelecionada?.id) return Notificacao.erro('Atenção', 'Selecione uma categoria antes de adicionar um produto.');
        const nome = inputNomeProduto.value.trim();
        const descricao = inputDescricaoProduto.value.trim();
        const descricao_detalhada = inputDescricaoDetalhada.value.trim();
        const preco = parseFloat(inputPrecoProduto.value.replace(',', '.'));
        const serve_pessoas = parseInt(inputServePessoas.value, 10) || 1;
        const imagemFile = inputImagemProduto.files[0];

        if (!nome || !descricao || isNaN(preco)) return Notificacao.erro('Campos Incompletos', 'Preencha nome, descrição e preço do produto.');
        
        try {
            const imagem_svg = imagemFile ? await fileToBase64(imagemFile) : null;
            const produto = { id_categoria: estado.categoriaSelecionada.id, nome, descricao, descricao_detalhada, preco, imagem_svg, serve_pessoas };
            await apiCall('/produtos', 'POST', produto);
            Notificacao.sucesso(`Produto "${nome}" adicionado!`);
            [inputNomeProduto, inputDescricaoProduto, inputDescricaoDetalhada, inputPrecoProduto, inputImagemProduto, inputServePessoas].forEach(input => input.value = '');
            await carregarProdutos(estado.categoriaSelecionada.id);
        } catch (error) {
            Notificacao.erro('Falha ao Adicionar Produto', error.message);
        }
    });

    // --- Lógica de Drag and Drop ---
    // Permite reordenar categorias e produtos via arrastar e soltar (drag and drop)
    function obterElementoAposArrastar(container, y) {
        const elementosArrastaveis = [...container.querySelectorAll('li:not(.dragging)')];
        return elementosArrastaveis.reduce((maisProximo, filho) => {
            const box = filho.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > maisProximo.offset) {
                return { offset: offset, element: filho };
            } else {
                return maisProximo;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Drag and Drop para CATEGORIAS
    listaCategorias.addEventListener('dragstart', (e) => {
        itemArrastado = e.target.closest('li');
        if(itemArrastado) setTimeout(() => itemArrastado.classList.add('dragging'), 0);
    });

    listaCategorias.addEventListener('dragover', (e) => {
        e.preventDefault();
        if(!itemArrastado) return;
        const itemApos = obterElementoAposArrastar(listaCategorias, e.clientY);
        if (itemApos == null) {
            listaCategorias.appendChild(itemArrastado);
        } else {
            listaCategorias.insertBefore(itemArrastado, itemApos);
        }
    });

    listaCategorias.addEventListener('dragend', async () => {
        if(!itemArrastado) return;
        itemArrastado.classList.remove('dragging');
        const idsOrdenados = [...listaCategorias.querySelectorAll('li')].map(li => li.dataset.id);
        itemArrastado = null;
        try {
            await apiCall('/categorias/ordenar', 'POST', { ordem: idsOrdenados });
            Notificacao.sucesso('Nova ordem de categorias salva!');
        } catch (error) {
            Notificacao.erro('Não foi possível salvar a nova ordem.', 'A página será recarregada.');
            setTimeout(() => carregarCategorias(), 2000);
        }
    });

    // **NOVO: Drag and Drop para PRODUTOS**
    listaProdutos.addEventListener('dragstart', (e) => {
        itemArrastado = e.target.closest('li');
        if(itemArrastado) setTimeout(() => itemArrastado.classList.add('dragging'), 0);
    });

    listaProdutos.addEventListener('dragover', (e) => {
        e.preventDefault();
        if(!itemArrastado) return;
        const itemApos = obterElementoAposArrastar(listaProdutos, e.clientY);
        if (itemApos == null) {
            listaProdutos.appendChild(itemArrastado);
        } else {
            listaProdutos.insertBefore(itemArrastado, itemApos);
        }
    });

    listaProdutos.addEventListener('dragend', async () => {
        if(!itemArrastado) return;
        itemArrastado.classList.remove('dragging');
        const idsOrdenados = [...listaProdutos.querySelectorAll('li')].map(li => li.dataset.id);
        itemArrastado = null;
        try {
            // Chama a nova rota da API para salvar a ordem dos produtos
            await apiCall('/produtos/ordenar', 'POST', { ordem: idsOrdenados });
            Notificacao.sucesso('Nova ordem de produtos salva!');
        } catch (error) {
            Notificacao.erro('Não foi possível salvar a nova ordem.', 'A página será recarregada.');
            setTimeout(() => carregarProdutos(estado.categoriaSelecionada.id), 2000);
        }
    });


    // --- Lógica do WebSocket ---
    // Conecta ao WebSocket para receber atualizações do cardápio em tempo real
    function conectarWebSocketGerencia() {
        const ws = new WebSocket(WS_URL);
        ws.onopen = () => console.log('Gerenciador conectado ao WebSocket!');
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'CARDAPIO_ATUALIZADO') {
                console.log('Recebida atualização do cardápio via WebSocket.');
                Notificacao.sucesso('O cardápio foi atualizado por outro terminal!');
                carregarCategorias();
                if (estado.categoriaSelecionada) {
                    carregarProdutos(estado.categoriaSelecionada.id);
                }
            }
        };
        ws.onclose = () => setTimeout(conectarWebSocketGerencia, 3000);
        ws.onerror = (error) => { console.error('Erro no WebSocket do Gerenciador:', error); ws.close(); };
    }

     // ==================================================================
    // --- NOVA SEÇÃO: CONEXÃO WEBSOCKET PARA NOTIFICAÇÕES EM TEMPO REAL ---
    // ==================================================================
    // Conecta ao WebSocket para receber notificações de chamados em tempo real
    function conectarWebSocket() {
        // Constrói a URL do WebSocket de forma segura (ws:// ou wss://)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        const ws = new WebSocket(wsUrl  );

        ws.onopen = () => {
            console.log('Conexão WebSocket estabelecida para a gerência.');
        };

        ws.onmessage = (event) => {
            try {
                const mensagem = JSON.parse(event.data);

                // Filtra e trata apenas as mensagens do tipo 'CHAMADO_GARCOM'
                if (mensagem.type === 'CHAMADO_GARCOM') {
                    // Usa o SweetAlert2 para uma notificação mais impactante
                   Swal.fire({
                            title: '<strong>Chamado!</strong>',
                            html: `<h2>A <strong>${mensagem.nomeMesa}</strong> está solicitando atendimento.</h2>`,
                            icon: 'warning', // Ícone mais chamativo (aviso)
                            confirmButtonText: 'OK, Entendido!', // Texto do botão de confirmação
                            allowOutsideClick: false, // Impede que o alerta seja fechado ao clicar fora dele
                            allowEscapeKey: false, // Impede que o alerta seja fechado com a tecla 'Esc'
                            // Removemos as opções 'toast', 'position', 'timer' e 'timerProgressBar'
                        });
                  
                }
            } catch (error) {
                console.error('Erro ao processar mensagem WebSocket:', error);
            }
        };

        ws.onclose = () => {
            console.log('Conexão WebSocket fechada. Tentando reconectar em 5 segundos...');
            // Tenta reconectar automaticamente em caso de queda
            setTimeout(conectarWebSocket, 5000);
        };

        ws.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            ws.close(); // Fecha a conexão para acionar o 'onclose' e a tentativa de reconexão
        };
    }

    // --- INICIALIZAÇÃO ---
    // Inicializa WebSocket, carrega categorias e conecta WebSocket do gerenciador
    conectarWebSocket();
    carregarCategorias();
    conectarWebSocketGerencia();
});
