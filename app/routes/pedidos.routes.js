const express = require('express');
const router = express.Router();
const { query, registrarLog } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

/**
 * Middleware para garantir que as informações do usuário estão presentes
 * antes de registrar um log.
 */
// Em app/routes/pedidos.routes.js

const checarUsuarioParaLog = (req, res, next) => {
    // Aceita se tiver 'nome' (funcionário) OU 'nome_usuario' (mesa)
    if (req.usuario && (req.usuario.nome || req.usuario.nome_usuario)) {
        return next();
    }
    console.error("Tentativa de ação de log sem um usuário autenticado ou com dados incompletos.");
    return res.status(500).json({ message: "Erro interno: informações do usuário ausentes para registro de log." });
};


// ==================================================================
// --- ROTAS DE PEDIDOS ---
// O prefixo '/api/pedidos' será definido no arquivo principal (server.js)
// ==================================================================

/**
 * ROTA: GET /ativos
 * DESCRIÇÃO: Busca todas as sessões ativas com seus respectivos pedidos pendentes e entregues.
 *            Ideal para a tela de acompanhamento da cozinha/balcão.
 * ACESSO: Restrito ('geral', 'pedidos').
 * URL FINAL: GET /api/pedidos/ativos
 */
router.get('/ativos', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = `
            SELECT 
                sc.id AS sessao_id, sc.nome_cliente, m.nome_usuario AS nome_mesa,
                (SELECT SUM(p.quantidade * p.preco_unitario) FROM pedidos p WHERE p.id_sessao = sc.id AND p.status != 'cancelado') AS total,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'pedido_item_id', p.id, 'nome_produto', prod.nome, 'quantidade', p.quantidade,
                            'observacao', p.observacao, 'categoria', cat.nome, 'status', p.status
                        )
                    )
                    FROM pedidos p
                    JOIN produtos prod ON p.id_produto = prod.id
                    JOIN categorias cat ON prod.id_categoria = cat.id
                    WHERE p.id_sessao = sc.id AND p.status != 'cancelado'
                ) AS itens
            FROM sessoes_cliente sc
            JOIN mesas m ON sc.id_mesa = m.id
            WHERE sc.status = 'ativa'
            ORDER BY sc.data_inicio ASC;
        `;
        const sessoesAtivas = await query(sql);
        const sessoesFormatadas = sessoesAtivas.map(sessao => ({
            ...sessao,
            total: parseFloat(sessao.total) || 0,
            itens: sessao.itens || [] 
        }));
        res.status(200).json(sessoesFormatadas);
    } catch (error) {
        console.error('Erro ao buscar pedidos ativos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao consultar os pedidos.' });
    }
});

/**
 * ROTA: GET /pendentes/count
 * DESCRIÇÃO: Retorna a contagem de itens de pedidos com status 'pendente'.
 * ACESSO: Restrito ('geral', 'pedidos').
 * URL FINAL: GET /api/pedidos/pendentes/count
 */
router.get('/pendentes/count', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = `
            SELECT COUNT(p.id) AS count 
            FROM pedidos p
            JOIN sessoes_cliente sc ON p.id_sessao = sc.id
            WHERE p.status = 'pendente' AND sc.status = 'ativa';
        `;
        const [result] = await query(sql);
        res.json(result);
    } catch (error) {
        console.error("Erro ao contar pedidos pendentes:", error);
        res.status(500).json({ message: 'Erro no servidor ao contar pedidos.' });
    }
});

/**
 * ROTA: POST /
 * DESCRIÇÃO: Cria um ou mais itens de pedido em lote.
 * ACESSO: Restrito (requer login de mesa/cliente).
 * URL FINAL: POST /api/pedidos
 */
router.post('/', checarUsuarioParaLog, async (req, res) => {
    const { pedidos } = req.body;
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        return res.status(400).json({ message: 'O corpo da requisição deve conter um array de pedidos.' });
    }

    try {
        for (const pedido of pedidos) {
            if (!pedido.id_sessao || !pedido.id_produto || pedido.quantidade === undefined) {
                throw new Error(`Dados do pedido incompletos. id_sessao, id_produto e quantidade são obrigatórios.`);
            }
            const [produtoInfo] = await query('SELECT preco FROM produtos WHERE id = ?', [pedido.id_produto]);
            if (!produtoInfo) {
                throw new Error(`Produto com ID ${pedido.id_produto} não encontrado.`);
            }
            const sql = `INSERT INTO pedidos (id_sessao, id_produto, quantidade, preco_unitario, observacao, status) VALUES (?, ?, ?, ?, ?, ?)`;
            const params = [pedido.id_sessao, pedido.id_produto, pedido.quantidade, produtoInfo.preco, pedido.observacao || null, 'pendente'];
            await query(sql, params);
        }

        if (req.broadcast) req.broadcast({ type: 'NOVO_PEDIDO' });
        res.status(201).json({ message: 'Pedido recebido e enviado para a cozinha com sucesso!' });
    } catch (error) {
        console.error('Falha crítica ao inserir pedidos em lote:', error);
        res.status(400).json({ message: error.message });
    }
});

/**
 * ROTA: PATCH /:id/entregar
 * DESCRIÇÃO: Marca um item de pedido como 'entregue'.
 * ACESSO: Restrito (requer login de funcionário).
 * URL FINAL: PATCH /api/pedidos/999/entregar
 */
router.patch('/:id/entregar', checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const sqlSelect = `SELECT prod.nome FROM pedidos p JOIN produtos prod ON p.id_produto = prod.id WHERE p.id = ?`;
        const [pedidoInfo] = await query(sqlSelect, [id]);
        if (!pedidoInfo) {
            return res.status(404).json({ message: 'Item do pedido não encontrado.' });
        }

        const sqlUpdate = "UPDATE pedidos SET status = 'entregue' WHERE id = ? AND status = 'pendente'";
        const result = await query(sqlUpdate, [id]);
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'Item do pedido não encontrado ou já foi entregue.' });
        }

        await registrarLog(req.usuario.id, req.usuario.nome, 'ENTREGOU_PEDIDO', `Entregou o item "${pedidoInfo.nome}" (Pedido Item ID: ${id}).`);
        if (req.broadcast) req.broadcast({ type: 'PEDIDO_ATUALIZADO' });
        res.json({ message: 'Item marcado como entregue!' });
    } catch (error) {
        console.error(`Erro ao marcar item ${id} como entregue:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar o item.' });
    }
});

/**
 * ROTA: POST /:id/cancelar
 * DESCRIÇÃO: Cancela um item de pedido (total ou parcialmente).
 * ACESSO: Restrito ('geral', 'pedidos').
 * URL FINAL: POST /api/pedidos/999/cancelar
 */
router.post('/:id/cancelar', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { motivo, quantidade } = req.body;

    if (!motivo || motivo.trim() === '') return res.status(400).json({ message: 'O motivo do cancelamento é obrigatório.' });
    if (!quantidade || typeof quantidade !== 'number' || quantidade <= 0) return res.status(400).json({ message: 'A quantidade a ser cancelada é inválida.' });

    try {
        const sqlSelect = `SELECT p.*, prod.nome AS nome_produto FROM pedidos p JOIN produtos prod ON p.id_produto = prod.id WHERE p.id = ?`;
        const [pedidoOriginal] = await query(sqlSelect, [id]);

        if (!pedidoOriginal) return res.status(404).json({ message: 'Item do pedido não encontrado.' });
        if (pedidoOriginal.status === 'cancelado') return res.status(400).json({ message: 'Este item já foi totalmente cancelado.' });
        if (quantidade > pedidoOriginal.quantidade) return res.status(400).json({ message: `Não é possível cancelar ${quantidade} itens, pois o pedido só tem ${pedidoOriginal.quantidade}.` });

        const nomeGerente = req.usuario.nome;
        const idUsuario = req.usuario.id;

        // Cancelamento total
        if (quantidade === pedidoOriginal.quantidade) {
            await query("UPDATE pedidos SET status = 'cancelado', motivo_cancelamento = ? WHERE id = ?", [motivo.trim(), id]);
            await registrarLog(idUsuario, nomeGerente, 'CANCELOU_PEDIDO_TOTAL', `Cancelou totalmente o item ID ${id} (${pedidoOriginal.nome_produto}) pelo motivo: "${motivo.trim()}".`);
        } 
        // Cancelamento parcial
        else {
            const novaQuantidade = pedidoOriginal.quantidade - quantidade;
            await query("UPDATE pedidos SET quantidade = ? WHERE id = ?", [novaQuantidade, id]);

            const sqlInsert = `INSERT INTO pedidos (id_sessao, id_produto, quantidade, preco_unitario, observacao, status, motivo_cancelamento) VALUES (?, ?, ?, ?, ?, 'cancelado', ?)`;
            const paramsInsert = [pedidoOriginal.id_sessao, pedidoOriginal.id_produto, quantidade, pedidoOriginal.preco_unitario, pedidoOriginal.observacao, motivo.trim()];
            await query(sqlInsert, paramsInsert);
            
            await registrarLog(idUsuario, nomeGerente, 'CANCELOU_PEDIDO_PARCIAL', `Cancelou ${quantidade} de ${pedidoOriginal.quantidade} do item ID ${id} (${pedidoOriginal.nome_produto}) pelo motivo: "${motivo.trim()}".`);
        }
        
        if (req.broadcast) req.broadcast({ type: 'PEDIDO_ATUALIZADO' });
        res.json({ message: 'Item(s) do pedido cancelado(s) com sucesso!' });

    } catch (error) {
        console.error('Erro ao cancelar item do pedido:', error);
        res.status(500).json({ message: 'Erro interno no servidor ao tentar cancelar o pedido.' });
    }
});


router.get('/ativos', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = `
            SELECT 
                sc.id AS sessao_id,
                sc.nome_cliente,
                m.nome_usuario AS nome_mesa,
                (
                    SELECT SUM(p.quantidade * p.preco_unitario) 
                    FROM pedidos p 
                    WHERE p.id_sessao = sc.id AND p.status != 'cancelado'
                ) AS total,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'pedido_item_id', p.id,
                            'nome_produto', prod.nome, 
                            'quantidade', p.quantidade,
                            'observacao', p.observacao,
                            'categoria', cat.nome,
                            'status', p.status
                        )
                    )
                    FROM pedidos p
                    JOIN produtos prod ON p.id_produto = prod.id
                    JOIN categorias cat ON prod.id_categoria = cat.id
                    WHERE p.id_sessao = sc.id
                ) AS itens
            FROM sessoes_cliente sc
            JOIN mesas m ON sc.id_mesa = m.id
            WHERE sc.status = 'ativa'
            ORDER BY sc.data_inicio ASC;
        `;

        const sessoesAtivas = await query(sql);

        const sessoesFormatadas = sessoesAtivas.map(sessao => ({
            ...sessao,
            total: parseFloat(sessao.total) || 0,
            itens: sessao.itens || [] 
        }));

        res.status(200).json(sessoesFormatadas);

    } catch (error) {
        console.error('Erro ao buscar pedidos ativos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao consultar os pedidos.' });
    }
});

module.exports = router;
