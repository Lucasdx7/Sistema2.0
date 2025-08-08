/**
 * ==================================================================
 * SCRIPT DA PÁGINA DE RELATÓRIOS (relatorios.html) - VERSÃO APRIMORADA
 * ==================================================================
 * Controla a exibição de gráficos e KPIs de vendas, incluindo
 * produtos mais vendidos e horários de pico.
 */


document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserRole = document.getElementById('dropdown-user-role');
    const filtroPeriodo = document.getElementById('periodo-filtro');
    const btnCriarPdf = document.getElementById('btn-criar-pdf');

    // --- Elementos dos KPIs ---
    const kpiVendasTotais = document.getElementById('kpi-vendas-totais');
    const kpiTotalPedidos = document.getElementById('kpi-total-pedidos');
    const kpiTicketMedio = document.getElementById('kpi-ticket-medio');
    const kpiProdutoMaisVendido = document.getElementById('kpi-produto-mais-vendido'); // Novo KPI

    // --- Contextos dos Gráficos ---
    const ctxVendas = document.getElementById('grafico-vendas-ano').getContext('2d');
    const ctxPagamentos = document.getElementById('grafico-metodos-pagamento').getContext('2d');
    const ctxProdutos = document.getElementById('grafico-produtos-vendidos').getContext('2d'); // Novo Gráfico
    const ctxHorarios = document.getElementById('grafico-horarios-pico').getContext('2d'); // Novo Gráfico

    let graficoVendas, graficoPagamentos, graficoProdutos, graficoHorarios; // Variáveis para instâncias dos gráficos

    // --- Verificação de Autenticação ---
    const token = localStorage.getItem('authToken');
    const usuarioString = localStorage.getItem('usuario');

    if (!token || !usuarioString) {
        Notificacao.erro('Acesso Negado', 'Você precisa estar logado para acessar esta página.')
            .then(() => window.location.href = '/login-gerencia');
        return;
    }
    const usuario = JSON.parse(usuarioString);

    // --- Funções ---

    function fazerLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('usuario');
        Notificacao.sucesso('Logout realizado com sucesso!');
        setTimeout(() => window.location.href = '/login-gerencia', 1500);
    }

    const formatarMoeda = (valor) => (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    function atualizarKPIs(dados) {
        kpiVendasTotais.textContent = formatarMoeda(dados.vendasTotais);
        kpiTotalPedidos.textContent = (dados.totalPedidos || 0).toString();
        kpiTicketMedio.textContent = formatarMoeda(dados.ticketMedio);
        // Atualiza o novo KPI
        kpiProdutoMaisVendido.textContent = dados.produtoMaisVendido || '-';
    }

    // Em relatorios.js

function renderizarGraficoVendas(dados) {
    if (graficoVendas) graficoVendas.destroy();

    const periodo = filtroPeriodo.value;
    let labelsFinais = dados.labels || [];

    // --- INÍCIO DA LÓGICA QUE ESTÁ FALTANDO ---
    // Se o período selecionado for 'ano', esta lógica converte os números dos meses em nomes.
    if (periodo === 'ano') {
        const nomesDosMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        // O .map() cria um novo array de labels com os nomes correspondentes.
        // Ex: se dados.labels for [1, 8], labelsFinais se tornará ['Jan', 'Ago'].
        labelsFinais = (dados.labels || []).map(numMes => nomesDosMeses[numMes - 1]);
    }
    // --- FIM DA LÓGICA QUE ESTÁ FALTANDO ---

    graficoVendas = new Chart(ctxVendas, {
        type: 'bar',
        data: {
            labels: labelsFinais, // Usa os labels corretos (já traduzidos se for 'ano')
            datasets: [{
                label: 'Vendas (R$)',
                data: dados.valores || [],
                backgroundColor: 'rgba(40, 167, 69, 0.7)',
                borderColor: 'rgba(40, 167, 69, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: { y: { beginAtZero: true, ticks: { callback: (value) => formatarMoeda(value) } } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Vendas: ${formatarMoeda(context.raw)}` } } }
        }
    });
}


    function renderizarGraficoPagamentos(dados) {
        if (graficoPagamentos) graficoPagamentos.destroy();
        graficoPagamentos = new Chart(ctxPagamentos, {
            type: 'doughnut',
            data: {
                labels: ['Cartão', 'Dinheiro', 'PIX'],
                datasets: [{
                    label: 'Métodos de Pagamento',
                    data: [dados.cartao || 0, dados.dinheiro || 0, dados.pix || 0],
                    backgroundColor: ['#007bff', '#28a745', '#ffc107'],
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { tooltip: { callbacks: { label: (context) => `${context.label}: ${formatarMoeda(context.raw)}` } } }
            }
        });
    }

    // --- NOVAS FUNÇÕES DE GRÁFICO ---

    function renderizarGraficoProdutos(dados) {
        if (graficoProdutos) graficoProdutos.destroy();
        graficoProdutos = new Chart(ctxProdutos, {
            type: 'bar', // Gráfico de barras horizontais para melhor visualização
            data: {
                labels: dados.labels || [],
                datasets: [{
                    label: 'Quantidade Vendida',
                    data: dados.valores || [],
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Torna o gráfico de barras horizontal
                responsive: true, maintainAspectRatio: false, animation: false,
                scales: { x: { beginAtZero: true } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Vendido: ${context.raw} un.` } } }
            }
        });
    }

    function renderizarGraficoHorarios(dados) {
        if (graficoHorarios) graficoHorarios.destroy();
        graficoHorarios = new Chart(ctxHorarios, {
            type: 'line', // Gráfico de linha é ideal para visualizar tendências ao longo do tempo
            data: {
                labels: dados.labels || [],
                datasets: [{
                    label: 'Nº de Pedidos',
                    data: dados.valores || [],
                    backgroundColor: 'rgba(23, 162, 184, 0.5)',
                    borderColor: 'rgba(23, 162, 184, 1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.raw} pedidos` } } }
            }
        });
    }

   // ...
async function carregarRelatorios() {
    const periodo = filtroPeriodo.value;
    try {
        const response = await fetch(`/api/relatorios/avancado?periodo=${periodo}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro ao buscar dados do servidor.' }));
            throw new Error(errorData.message);
        }

        const dados = await response.json();
        
        // VERIFICAÇÃO: Garante que 'dados' não é nulo ou indefinido antes de prosseguir
        if (!dados) {
            throw new Error("A resposta da API está vazia ou malformada.");
        }

        // Agora podemos acessar as propriedades com segurança
        atualizarKPIs(dados.kpis || {});
        renderizarGraficoVendas(dados.graficoVendas || {});
        renderizarGraficoPagamentos(dados.graficoPagamentos || {});
        renderizarGraficoProdutos(dados.graficoProdutos || {});
        renderizarGraficoHorarios(dados.graficoHorariosPico || {});

    } catch (error) {
        Notificacao.erro('Falha ao Carregar Relatórios', error.message);
        
        // --- LÓGICA DE LIMPEZA CORRIGIDA ---
        // Em caso de erro, limpa todos os gráficos e KPIs com objetos vazios
        atualizarKPIs({});
        renderizarGraficoVendas({});
        renderizarGraficoPagamentos({});
        renderizarGraficoProdutos({});
        renderizarGraficoHorarios({});
    }
}
// ...


    async function gerarPDF() {
        const { jsPDF } = window.jspdf;
        const elementoParaCapturar = document.getElementById('relatorio-para-pdf');
        
        btnCriarPdf.style.display = 'none';

        try {
            const canvas = await html2canvas(elementoParaCapturar, {
                scale: 2, useCORS: true, backgroundColor: '#f4f7fa'
            });

            btnCriarPdf.style.display = 'inline-flex';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            pdf.save(`Relatorio-Vendas-Avancado-${hoje}.pdf`);

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            Notificacao.erro('Erro ao Gerar PDF', 'Ocorreu um problema ao tentar criar o arquivo PDF.');
            btnCriarPdf.style.display = 'inline-flex';
        }
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

    // --- Event Listeners ---
    if (dropdownUserName) dropdownUserName.textContent = usuario.nome;
    if (dropdownUserRole) dropdownUserRole.textContent = usuario.nivel_acesso;

    profileMenuBtn.addEventListener('click', () => profileDropdown.classList.toggle('hidden'));
    window.addEventListener('click', (e) => {
        if (!profileMenuBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (await Notificacao.confirmar('Sair do Sistema', 'Você tem certeza que deseja fazer logout?')) {
            fazerLogout();
        }
    });

    filtroPeriodo.addEventListener('change', carregarRelatorios);
    btnCriarPdf.addEventListener('click', gerarPDF);

    // --- Inicialização ---
    carregarRelatorios();
    conectarWebSocket();
});
