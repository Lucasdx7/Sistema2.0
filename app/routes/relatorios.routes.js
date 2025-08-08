const express = require('express');
const router = express.Router();
const { query } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

// ==================================================================
// --- FUNÇÕES AUXILIARES DE RELATÓRIOS ---
// ==================================================================

/**
 * Converte um objeto Date do JavaScript para uma string no formato 'YYYY-MM-DD HH:MM:SS',
 * que é o formato esperado pelo MySQL para queries com DATETIME.
 * @param {Date} date - O objeto Date a ser formatado.
 * @returns {string} - A data formatada.
 */
function formatarDataParaMySQL(date) {
    const pad = (num) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Calcula as datas de início e fim para uma consulta com base em um período de tempo.
 * @param {string} periodo - 'hoje', 'semana', 'mes', ou 'ano'.
 * @returns {{inicio: Date, fim: Date}} - Um objeto com as datas de início e fim.
 */
function obterIntervaloDeDatas(periodo) {
    const agora = new Date();
    let inicio = new Date();

    inicio.setHours(0, 0, 0, 0); // Zera a hora para o início do dia

    switch (periodo) {
        case 'hoje':
            // O início já é hoje às 00:00
            break;
        case 'semana':
            const diaDaSemana = inicio.getDay(); // 0 (Dom) a 6 (Sáb)
            const diasParaSubtrair = diaDaSemana === 0 ? 6 : diaDaSemana - 1; // Considera a semana começando na Segunda
            inicio.setDate(inicio.getDate() - diasParaSubtrair);
            break;
        case 'mes':
            inicio.setDate(1); // Vai para o primeiro dia do mês atual
            break;
        case 'ano':
            inicio.setMonth(0, 1); // Vai para o primeiro dia de Janeiro do ano atual
            break;
        default:
            throw new Error('Período inválido');
    }
    return { inicio, fim: agora };
}

// ==================================================================
// --- ROTAS DE RELATÓRIOS ---
// O prefixo '/api/relatorios' será definido no arquivo principal (server.js)
// ==================================================================

/**
 * ROTA: GET /avancado
 * DESCRIÇÃO: Gera um relatório completo com KPIs e dados para gráficos.
 * ACESSO: Restrito ('geral').
 * URL FINAL: GET /api/relatorios/avancado?periodo=semana
 */
// Em app/routes/relatorios.routes.js

// ... (funções auxiliares no topo do arquivo) ...

router.get('/avancado', checarNivelAcesso(['geral']), async (req, res) => {
    const { periodo } = req.query;

    try {
        const { inicio, fim } = obterIntervaloDeDatas(periodo);
        const inicioFormatado = formatarDataParaMySQL(inicio);
        const fimFormatado = formatarDataParaMySQL(fim);

        let groupByClause, selectClause, orderByClause;

        switch (periodo) {
            case 'ano':
                selectClause = `MONTH(s.data_fim)`;
                groupByClause = `YEAR(s.data_fim), MONTH(s.data_fim)`;
                orderByClause = `YEAR(s.data_fim), MONTH(s.data_fim)`;
                break;
            case 'mes':
            case 'semana':
                selectClause = `DATE_FORMAT(s.data_fim, '%d/%m')`;
                groupByClause = `DATE_FORMAT(s.data_fim, '%d/%m')`;
                orderByClause = `MIN(s.data_fim)`;
                break;
            case 'hoje':
                selectClause = `DATE_FORMAT(s.data_fim, '%H:00')`;
                groupByClause = `DATE_FORMAT(s.data_fim, '%H:00')`;
                orderByClause = `MIN(s.data_fim)`;
                break;
            default:
                return res.status(400).json({ message: 'Período inválido.' });
        }

        const vendasQuerySQL = `
            SELECT ${selectClause} as label, SUM(p.quantidade * p.preco_unitario) as valor
            FROM sessoes_cliente s
            JOIN pedidos p ON s.id = p.id_sessao
            WHERE s.status = 'finalizada' AND p.status != 'cancelado' AND s.data_fim BETWEEN ? AND ?
            GROUP BY ${groupByClause}
            ORDER BY ${orderByClause};
        `;
        
        const vendasQueryPromise = query(vendasQuerySQL, [inicioFormatado, fimFormatado]);
        const kpisQuery = query(`SELECT COALESCE(SUM(p.quantidade * p.preco_unitario), 0) AS vendasTotais, COUNT(DISTINCT s.id) AS totalPedidos FROM sessoes_cliente s JOIN pedidos p ON s.id = p.id_sessao WHERE s.status = 'finalizada' AND p.status != 'cancelado' AND s.data_fim BETWEEN ? AND ?;`, [inicioFormatado, fimFormatado]);
        const pagamentosQuery = query(`SELECT forma_pagamento, SUM(p.quantidade * p.preco_unitario) as total FROM sessoes_cliente s JOIN pedidos p ON s.id = p.id_sessao WHERE s.status = 'finalizada' AND p.status != 'cancelado' AND s.data_fim BETWEEN ? AND ? GROUP BY forma_pagamento;`, [inicioFormatado, fimFormatado]);
        const produtosQuery = query(`SELECT prod.nome, SUM(p.quantidade) as quantidade_vendida FROM pedidos p JOIN produtos prod ON p.id_produto = prod.id JOIN sessoes_cliente s ON s.id = p.id_sessao WHERE s.status = 'finalizada' AND p.status != 'cancelado' AND s.data_fim BETWEEN ? AND ? GROUP BY prod.nome ORDER BY quantidade_vendida DESC LIMIT 5;`, [inicioFormatado, fimFormatado]);
        const horariosQuery = query(`SELECT EXTRACT(HOUR FROM s.data_fim) as hora, COUNT(DISTINCT s.id) as numero_sessoes FROM sessoes_cliente s WHERE s.status = 'finalizada' AND s.data_fim BETWEEN ? AND ? GROUP BY hora ORDER BY hora ASC;`, [inicioFormatado, fimFormatado]);
        
        const [kpisResult, vendasResult, pagamentosResult, produtosResult, horariosResult] = await Promise.all([
            kpisQuery, vendasQueryPromise, pagamentosQuery, produtosQuery, horariosQuery
        ]);

        const dadosVendasCompletos = {};
        const agora = new Date();

        if (periodo === 'ano') {
            for (let i = 1; i <= agora.getMonth() + 1; i++) {
                dadosVendasCompletos[i] = 0;
            }
        } else if (periodo === 'mes') {
            for (let i = 1; i <= agora.getDate(); i++) {
                const diaFormatado = `${String(i).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}`;
                dadosVendasCompletos[diaFormatado] = 0;
            }
        } else if (periodo === 'semana') {
            const diaDaSemana = agora.getDay();
            const diasParaSubtrair = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
            const inicioSemana = new Date(agora);
            inicioSemana.setDate(agora.getDate() - diasParaSubtrair);
            for (let i = 0; i < 7; i++) {
                const dataDia = new Date(inicioSemana);
                dataDia.setDate(inicioSemana.getDate() + i);
                if (dataDia > agora) break;
                const diaFormatado = `${String(dataDia.getDate()).padStart(2, '0')}/${String(dataDia.getMonth() + 1).padStart(2, '0')}`;
                dadosVendasCompletos[diaFormatado] = 0;
            }
        } else if (periodo === 'hoje') {
            for (let i = 0; i <= agora.getHours(); i++) {
                const horaFormatada = `${String(i).padStart(2, '0')}:00`;
                dadosVendasCompletos[horaFormatada] = 0;
            }
        }

        vendasResult.forEach(r => {
            if (dadosVendasCompletos.hasOwnProperty(r.label)) {
                dadosVendasCompletos[r.label] = parseFloat(r.valor);
            }
        });

        const graficoVendas = {
            labels: Object.keys(dadosVendasCompletos),
            valores: Object.values(dadosVendasCompletos)
        };

        const kpisData = kpisResult[0] || { vendasTotais: 0, totalPedidos: 0 };
        const kpis = {
            vendasTotais: parseFloat(kpisData.vendasTotais),
            totalPedidos: parseInt(kpisData.totalPedidos, 10),
            ticketMedio: kpisData.totalPedidos > 0 ? kpisData.vendasTotais / kpisData.totalPedidos : 0,
            produtoMaisVendido: produtosResult.length > 0 ? produtosResult[0].nome : '-'
        };

        const graficoPagamentos = { cartao: 0, dinheiro: 0, pix: 0 };
        pagamentosResult.forEach(r => { if (graficoPagamentos.hasOwnProperty(r.forma_pagamento)) { graficoPagamentos[r.forma_pagamento] = parseFloat(r.total); } });

        const graficoProdutos = {
            labels: produtosResult.map(r => r.nome),
            valores: produtosResult.map(r => parseInt(r.quantidade_vendida, 10))
        };

        const graficoHorariosPico = {
            labels: horariosResult.map(r => `${r.hora.toString().padStart(2, '0')}:00`),
            valores: horariosResult.map(r => parseInt(r.numero_sessoes, 10))
        };

        res.json({ kpis, graficoVendas, graficoPagamentos, graficoProdutos, graficoHorariosPico });

    } catch (error) {
        console.error('Erro ao buscar relatórios avançados:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao processar relatórios.' });
    }
});


/**
 * ROTA: GET /atividade
 * DESCRIÇÃO: Gera um relatório de atividades para um funcionário específico em um período.
 * ACESSO: Restrito ('geral').
 * URL FINAL: GET /api/relatorios/atividade?usuarioId=1&periodo=hoje
 */
router.get('/atividade', checarNivelAcesso(['geral']), async (req, res) => {
    const { usuarioId, periodo } = req.query;
    if (!usuarioId || !periodo) {
        return res.status(400).json({ message: 'ID do usuário e período são obrigatórios.' });
    }

    try {
        const { inicio, fim } = obterIntervaloDeDatas(periodo);
        const inicioFormatado = formatarDataParaMySQL(inicio);
        const fimFormatado = formatarDataParaMySQL(fim);

        const sqlLogs = `
            SELECT acao, COUNT(id) as total
            FROM logs
            WHERE id_usuario = ? AND data_hora BETWEEN ? AND ?
            GROUP BY acao
            ORDER BY total DESC;
        `;
        const atividades = await query(sqlLogs, [usuarioId, inicioFormatado, fimFormatado]);

        // Formata os nomes das ações para serem mais amigáveis no frontend
        const atividadesFormatadas = atividades.map(ativ => {
            let nomeAcao = ativ.acao.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            return { acao: nomeAcao, total: ativ.total };
        });

        res.json(atividadesFormatadas);

    } catch (error) {
        console.error('Erro ao gerar relatório de atividade:', error);
        res.status(500).json({ message: 'Erro no servidor ao gerar relatório.' });
    }
});



router.get('/logs', checarNivelAcesso(['geral']), async (req, res) => {
    try {
        const { data, termo } = req.query;

        let sql = 'SELECT * FROM logs';
        const params = [];
        const conditions = [];

        // Adiciona filtro de data, se fornecido
        if (data) {
            conditions.push('DATE(data_hora) = ?');
            params.push(data);
        }
        // Adiciona filtro de termo, se fornecido
        if (termo) {
            conditions.push('detalhes LIKE ?');
            params.push(`%${termo}%`);
        }

        // Monta a cláusula WHERE se houver condições
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Adiciona a ordenação e um limite para evitar sobrecarga
        sql += ' ORDER BY data_hora DESC LIMIT 200';

        const logs = await query(sql, params);
        res.json(logs);

    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ message: 'Erro ao buscar logs', error: error.message });
    }
});

module.exports = router;
