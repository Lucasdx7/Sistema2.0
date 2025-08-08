const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, registrarLog } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

/**
 * Middleware para garantir que as informações do usuário estão presentes
 * antes de registrar um log.
 */
const checarUsuarioParaLog = (req, res, next) => {
    if (req.usuario && req.usuario.nome) {
        return next();
    }
    // Para rotas de cliente (mesa), o nome de usuário da mesa é usado.
    if (req.usuario && req.usuario.nome_usuario) {
        return next();
    }
    console.error("Tentativa de ação de log sem um usuário autenticado ou com dados incompletos.");
    return res.status(500).json({ message: "Erro interno: informações do usuário ausentes para registro de log." });
};

// ==================================================================
// --- ROTAS DE MESAS (GERENCIAMENTO) ---
// O prefixo '/api/mesas' será definido no arquivo principal (server.js)
// ==================================================================

/**
 * ROTA: GET /
 * DESCRIÇÃO: Lista todas as mesas cadastradas.
 * ACESSO: Restrito (requer login de funcionário).
 * URL FINAL: GET /api/mesas
 */
router.get('/', checarUsuarioParaLog, async (req, res) => {
    try {
        const mesas = await query('SELECT id, nome_usuario, criado_em FROM mesas ORDER BY nome_usuario');
        res.json(mesas);
    } catch (error) {
        console.error("Erro ao buscar mesas:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar mesas.' });
    }
});

/**
 * ROTA: POST /
 * DESCRIÇÃO: Cria uma nova mesa (login de cliente).
 * ACESSO: Restrito (requer login de funcionário).
 * URL FINAL: POST /api/mesas
 */
router.post('/', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { nome_usuario, senha } = req.body;
    if (!nome_usuario || !senha) {
        return res.status(400).json({ message: 'Nome de usuário e senha são obrigatórios.' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        
        const result = await query('INSERT INTO mesas (nome_usuario, senha) VALUES (?, ?)', [nome_usuario, senhaHash]);
        
        await registrarLog(req.usuario.id, req.usuario.nome, 'CRIOU_MESA', `Criou a mesa '${nome_usuario}'.`);
        res.status(201).json({ id: result.insertId, nome_usuario: nome_usuario });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este nome de mesa já está em uso.' });
        }
        console.error("Erro ao criar mesa:", error);
        res.status(500).json({ message: 'Erro no servidor ao criar mesa.' });
    }
});

/**
 * ROTA: DELETE /:id
 * DESCRIÇÃO: Deleta uma mesa.
 * ACESSO: Restrito ('geral').
 * URL FINAL: DELETE /api/mesas/123
 */
router.delete('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const mesa = await query('SELECT nome_usuario FROM mesas WHERE id = ?', [id]);
        const nomeMesa = mesa.length > 0 ? mesa[0].nome_usuario : `ID ${id}`;
        
        const result = await query('DELETE FROM mesas WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Mesa não encontrada.' });
        }

        await registrarLog(req.usuario.id, req.usuario.nome, 'DELETOU_MESA', `Deletou a mesa '${nomeMesa}'.`);
        res.status(200).json({ message: 'Mesa removida com sucesso.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Este nome de mesa já está em uso.' });
        }
        console.error("Erro ao criar mesa:", error);
        res.status(500).json({ message: 'Erro no servidor ao criar mesa.' });
    }
});

/**
 * ROTA: GET /status
 * DESCRIÇÃO: Busca o status de todas as mesas (livre ou ocupada com nome do cliente).
 * ACESSO: Restrito (requer login de funcionário).
 * URL FINAL: GET /api/mesas/status
 */
router.get('/status', checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = `
            SELECT m.id, m.nome_usuario, sc.id AS sessao_id, sc.nome_cliente, sc.data_inicio
            FROM mesas m
            LEFT JOIN sessoes_cliente sc ON m.id = sc.id_mesa AND sc.status = 'ativa'
            ORDER BY m.nome_usuario;
        `;
        const statusMesas = await query(sql);
        res.json(statusMesas);
    } catch (error) {
        console.error("Erro ao buscar status das mesas:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar status das mesas.' });
    }
});

// ==================================================================
// --- ROTAS DE SESSÕES ---
// Estas rotas continuam com o prefixo /api/mesas
// ==================================================================

/**
 * ROTA: GET /:id/sessoes
 * DESCRIÇÃO: Busca o histórico de sessões de uma mesa específica.
 * ACESSO: Restrito ('geral', 'pedidos').
 * URL FINAL: GET /api/mesas/123/sessoes
 */
router.get('/:id/sessoes', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT 
                sc.id, sc.nome_cliente, sc.data_inicio, sc.data_fim, sc.status, sc.forma_pagamento,
                (SELECT SUM(p.quantidade * p.preco_unitario) FROM pedidos p WHERE p.id_sessao = sc.id AND p.status != 'cancelado') AS total_gasto,
                (SELECT l.nome_usuario FROM logs l WHERE l.acao = 'FECHOU_SESSAO' AND l.detalhes LIKE CONCAT('%sessão ID ', sc.id, '%') ORDER BY l.data_hora DESC LIMIT 1) AS finalizado_por
            FROM sessoes_cliente sc
            WHERE sc.id_mesa = ?
            ORDER BY FIELD(sc.status, 'ativa') DESC, sc.data_inicio DESC;
        `;
        const sessoes = await query(sql, [id]);
        const sessoesFormatadas = sessoes.map(s => ({
            ...s,
            total_gasto: parseFloat(s.total_gasto) || 0 
        }));
        res.json(sessoesFormatadas);
    } catch (error) {
        console.error(`Erro ao buscar histórico da mesa ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao buscar o histórico da mesa.' });
    }
});

/**
 * ROTA: POST /sessoes/iniciar
 * DESCRIÇÃO: Inicia uma nova sessão de cliente na mesa logada.
 * ACESSO: Restrito (requer login de mesa/cliente).
 * URL FINAL: POST /api/mesas/sessoes/iniciar
 */
router.post('/sessoes/iniciar', async (req, res) => {
    const id_mesa = req.usuario.id; // O ID da mesa vem do token de autenticação
    const { nome, telefone, cpf } = req.body;
    if (!nome) {
        return res.status(400).json({ message: 'O nome do cliente é obrigatório.' });
    }
    try {
        const result = await query(
            'INSERT INTO sessoes_cliente (id_mesa, nome_cliente, telefone_cliente, cpf_cliente) VALUES (?, ?, ?, ?)',
            [id_mesa, nome, telefone || null, cpf || null]
        );
        res.status(201).json({ message: 'Sessão iniciada com sucesso!', sessaoId: result.insertId, nomeCliente: nome });
    } catch (error) {
        console.error("Erro ao iniciar sessão do cliente:", error);
        res.status(500).json({ message: 'Erro no servidor ao iniciar a sessão do cliente.' });
    }
});

/**
 * ROTA: GET /sessoes/:id/conta
 * DESCRIÇÃO: Busca a conta detalhada de uma sessão (usado pelo cliente).
 * ACESSO: Público/Restrito (requer ID da sessão, que o cliente tem).
 * URL FINAL: GET /api/mesas/sessoes/123/conta
 */
// ...
// ...
router.get('/sessoes/:id/conta', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'O ID da sessão é obrigatório.' });
    try {
        // ADICIONAMOS p.motivo_cancelamento à lista de colunas
        const sql = `
            SELECT 
                p.id, p.quantidade, p.preco_unitario, p.status, p.observacao, p.motivo_cancelamento,
                prod.nome AS nome_produto,
                prod.imagem_svg 
            FROM pedidos p
            JOIN produtos prod ON p.id_produto = prod.id
            WHERE p.id_sessao = ?
            ORDER BY p.data_pedido ASC;
        `;
        const pedidos = await query(sql, [id]);
        
        const total = pedidos
            .filter(item => item.status !== 'cancelado')
            .reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0);

        res.json({ pedidos, total: total.toFixed(2) });
    } catch (error) {
        console.error(`Erro ao buscar conta da sessão ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao buscar a conta.' });
    }
});
// ...

// ...

/**
 * ROTA: POST /sessoes/:id/fechar
 * DESCRIÇÃO: Fecha a conta de uma sessão (ação do funcionário).
 * ACESSO: Restrito (requer login de funcionário).
 * URL FINAL: POST /api/mesas/sessoes/123/fechar
 */
// /app/routes/mesas.routes.js

router.post('/sessoes/:id/fechar', checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { forma_pagamento } = req.body;

    // ... (validação do forma_pagamento) ...

    try {
        const [sessaoInfo] = await query('SELECT id_mesa FROM sessoes_cliente WHERE id = ?', [id]);
        if (!sessaoInfo) {
            return res.status(404).json({ message: 'Sessão não encontrada.' });
        }

        const sql = "UPDATE sessoes_cliente SET status = 'finalizada', data_fim = NOW(), forma_pagamento = ? WHERE id = ? AND status = 'ativa'";
        const result = await query(sql, [forma_pagamento, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Sessão não encontrada ou já está finalizada.' });
        }
        
        await registrarLog(req.usuario.id, req.usuario.nome, 'FECHOU_SESSAO', `Fechou a sessão ID ${id} com pagamento via ${forma_pagamento}.`);

        // --- LOG DE DIAGNÓSTICO ---
        const broadcastMessage = {
            type: 'SESSAO_ATUALIZADA',
            payload: {
                sessaoId: id,
                mesaId: sessaoInfo.id_mesa,
                status: 'finalizada'
            }
        };
        
        console.log('================================================');
        console.log('[BROADCAST] Preparando para enviar a mensagem:');
        console.log(JSON.stringify(broadcastMessage, null, 2)); // Mostra a mensagem formatada
        console.log('================================================');
        
        req.broadcast(broadcastMessage);

        res.json({ message: 'Conta fechada com sucesso!' });

    } catch (error) {
        console.error(`Erro ao fechar sessão ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao fechar a conta.' });
    }
});



// Em app/routes/mesas.routes.js

/**
 * ROTA: POST /chamar-garcom
 * DESCRIÇÃO: Registra um chamado de garçom para a mesa logada.
 * ACESSO: Restrito (requer login de mesa/cliente).
 * URL FINAL: POST /api/mesas/chamar-garcom
 */
router.post('/chamar-garcom', checarUsuarioParaLog, async (req, res) => {
    // Verifica se a função de broadcast (WebSocket) está disponível
    if (!req.broadcast) {
        return res.status(500).json({ message: 'Erro de comunicação interna do servidor.' });
    }

    try {
        // O ID e o nome da mesa vêm do token JWT que já foi validado
        const idMesa = req.usuario.id;
        const nomeMesa = req.usuario.nome_usuario;

        if (!idMesa || !nomeMesa) {
            return res.status(400).json({ message: 'Não foi possível identificar a mesa para o chamado.' });
        }

        // Insere o chamado na tabela 'chamados' do banco de dados
        const sql = 'INSERT INTO chamados (id_mesa, nome_mesa) VALUES (?, ?)';
        const result = await query(sql, [idMesa, nomeMesa]);
        const novoChamadoId = result.insertId;

        // Prepara a mensagem para enviar via WebSocket para a gerência
        const mensagem = {
            type: 'CHAMADO_GARCOM',
            id: novoChamadoId, // Envia o ID do novo chamado
            nomeMesa: nomeMesa,
            timestamp: new Date().toISOString()
        };

        // Envia a notificação para todos os painéis de gerência conectados
        req.broadcast(mensagem);

        res.status(200).json({ message: 'Chamado enviado com sucesso!' });

    } catch (error) {
        console.error(`Erro ao processar chamado da mesa ${req.usuario.id}:`, error);
        res.status(500).json({ message: 'Ocorreu um erro no servidor ao processar sua chamada.' });
    }
});



// Em app/routes/mesas.routes.js

// ... (outras rotas existentes) ...

/**
 * ROTA: GET /sessoes/:id/pedidos
 * DESCRIÇÃO: Busca todos os pedidos de uma sessão específica (para o modal de edição).
 * ACESSO: Restrito ('geral', 'pedidos').
 * URL FINAL: GET /api/mesas/sessoes/123/pedidos
 */
router.get('/sessoes/:id/pedidos', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT p.id, p.quantidade, p.preco_unitario, p.status, p.motivo_cancelamento, prod.nome AS nome_produto
            FROM pedidos AS p JOIN produtos AS prod ON p.id_produto = prod.id
            WHERE p.id_sessao = ? ORDER BY p.data_pedido ASC;
        `;
        const pedidos = await query(sql, [id]);
        res.json(pedidos);
    } catch (error) {
        console.error(`Erro ao buscar pedidos da sessão ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao buscar os pedidos da sessão.' });
    }
});

/**
 * ROTA: GET /sessoes/:id/info
 * DESCRIÇÃO: Busca informações do cliente e da mesa de uma sessão (para o recibo).
 * ACESSO: Restrito (requer login de funcionário).
 * URL FINAL: GET /api/mesas/sessoes/123/info
 */
router.get('/sessoes/:id/info', checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT sc.nome_cliente, sc.telefone_cliente, sc.cpf_cliente, m.nome_usuario 
            FROM sessoes_cliente sc 
            JOIN mesas m ON sc.id_mesa = m.id 
            WHERE sc.id = ?;
        `;
        const [sessaoInfo] = await query(sql, [id]);
        if (!sessaoInfo) {
            return res.status(404).json({ message: 'Informações da sessão não encontradas.' });
        }
        res.json(sessaoInfo);
    } catch (error) {
        console.error(`Erro ao buscar informações da sessão ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao buscar informações da sessão.' });
    }
});








module.exports = router;
