// Em app/routes/chamados.routes.js

const express = require('express');
const router = express.Router();
const { query, registrarLog } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

const checarUsuarioParaLog = (req, res, next) => {
    if (req.usuario && req.usuario.nome) {
        return next();
    }
    console.error("Tentativa de ação de log sem um usuário autenticado.");
    return res.status(500).json({ message: "Erro interno: informações do usuário ausentes." });
};

// ==================================================================
// --- ROTAS DE CHAMADOS ---
// O prefixo '/api/chamados' será definido no server.js
// ==================================================================

/**
 * ROTA: GET /
 * DESCRIÇÃO: Busca todos os chamados pendentes do dia.
 * URL FINAL: GET /api/chamados
 */
router.get('/', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = "SELECT * FROM chamados WHERE DATE(data_hora) = CURDATE() AND status = 'pendente' ORDER BY data_hora ASC";
        const chamados = await query(sql);
        res.json(chamados);
    } catch (error) {
        console.error("Erro ao buscar chamados:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar chamados.' });
    }
});

/**
 * ROTA: GET /pendentes/count
 * DESCRIÇÃO: Retorna a contagem de chamados pendentes.
 * URL FINAL: GET /api/chamados/pendentes/count
 */
router.get('/pendentes/count', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = "SELECT COUNT(id) AS count FROM chamados WHERE status = 'pendente' AND DATE(data_hora) = CURDATE()";
        const [result] = await query(sql);
        res.json(result);
    } catch (error) {
        console.error("Erro ao contar chamados pendentes:", error);
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

/**
 * ROTA: PATCH /:id/atender
 * DESCRIÇÃO: Marca um chamado como atendido.
 * URL FINAL: PATCH /api/chamados/123/atender
 */
router.patch('/:id/atender', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const sql = "UPDATE chamados SET status = 'atendido' WHERE id = ? AND status = 'pendente'";
        const result = await query(sql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Chamado não encontrado ou já atendido.' });
        }
        
        // Notifica via WebSocket que a lista de chamados foi atualizada
        if (req.broadcast) {
            req.broadcast({ type: 'CHAMADOS_ATUALIZADOS' });
        }

        res.json({ message: 'Chamado marcado como atendido com sucesso!' });
    } catch (error) {
        console.error(`Erro ao atender chamado ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atender chamado.' });
    }
});


// Em app/routes/chamados.routes.js

// ... (outras rotas de chamados existentes) ...

/**
 * ROTA: DELETE /limpar-atendidos
 * DESCRIÇÃO: Deleta todos os chamados com status 'atendido' do banco de dados.
 * URL FINAL: DELETE /api/chamados/limpar-atendidos
 */
router.delete('/limpar-atendidos', checarNivelAcesso(['geral', 'pedidos']), checarUsuarioParaLog, async (req, res) => {
    try {
        // Primeiro, contamos quantos chamados serão deletados para o log
        const [resultadoContagem] = await query("SELECT COUNT(*) as total FROM chamados WHERE status = 'atendido'");
        const totalDeletado = resultadoContagem.total;

        if (totalDeletado === 0) {
            return res.status(200).json({ message: 'Nenhum chamado atendido para limpar.' });
        }

        // Executa a query para deletar os chamados
        await query("DELETE FROM chamados WHERE status = 'atendido'");

        // Registra a ação no log
        await registrarLog(
            req.usuario.id, 
            req.usuario.nome, 
            'LIMPOU_CHAMADOS', 
            `Limpou o histórico de ${totalDeletado} chamados de garçom que já haviam sido atendidos.`
        );

        // Notifica via WebSocket que a lista de chamados foi atualizada
        if (req.broadcast) {
            req.broadcast({ type: 'CHAMADOS_ATUALIZADOS' });
        }

        res.status(200).json({ message: `Histórico de ${totalDeletado} chamados atendidos foi limpo com sucesso.` });

    } catch (error) {
        console.error('Erro ao limpar chamados atendidos:', error);
        res.status(500).json({ message: 'Erro no servidor ao limpar chamados atendidos', error: error.message });
    }
});





module.exports = router;
