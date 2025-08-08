const express = require('express');
const router = express.Router();
const { query, registrarLog } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

/**
 * Middleware para garantir que as informações do usuário estão presentes
 * antes de registrar um log. Isso evita erros caso o token expire
 * ou não seja enviado corretamente em uma rota protegida.
 */
const checarUsuarioParaLog = (req, res, next) => {
    // Verifica se o objeto 'usuario' e a propriedade 'nome' existem na requisição.
    if (req.usuario && req.usuario.nome) {
        return next(); // Se sim, continua para a próxima função (a rota em si).
    }
    // Se não, loga um erro no console do servidor e envia uma resposta de erro.
    console.error("Tentativa de ação de log sem um usuário autenticado ou com dados incompletos.");
    return res.status(500).json({ message: "Erro interno: informações do usuário ausentes para registro de log." });
};

// ==================================================================
// --- ROTAS DE CATEGORIAS ---
// O prefixo '/api/categorias' será definido no arquivo principal (server.js)
// ==================================================================

/**
 * ROTA: GET /
 * DESCRIÇÃO: Busca todas as categorias do banco de dados.
 * ACESSO: Público (qualquer um pode ver as categorias do cardápio).
 * URL FINAL: GET /api/categorias
 */
router.get('/', async (req, res) => {
    try {
        // A ordenação garante que as categorias apareçam na ordem definida pelo gerente.
        const categorias = await query('SELECT * FROM categorias ORDER BY ordem ASC, nome ASC');
        res.json(categorias);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar categorias', error: error.message });
    }
});

/**
 * ROTA: POST /
 * DESCRIÇÃO: Cria uma nova categoria.
 * ACESSO: Restrito ('geral').
 * URL FINAL: POST /api/categorias
 */
router.post('/', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    try {
        const { nome, is_happy_hour, happy_hour_inicio, happy_hour_fim } = req.body;
        if (!nome) {
            return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
        }
        
        const sql = 'INSERT INTO categorias (nome, is_happy_hour, happy_hour_inicio, happy_hour_fim) VALUES (?, ?, ?, ?)';
        const params = [
            nome, 
            is_happy_hour || false, 
            is_happy_hour ? happy_hour_inicio : null, 
            is_happy_hour ? happy_hour_fim : null
        ];
        
        const result = await query(sql, params);
        
        // Registra a ação no log.
        await registrarLog(req.usuario.id, req.usuario.nome, 'CRIOU_CATEGORIA', `Criou a categoria '${nome}' (ID: ${result.insertId}).`);
        
        // Notifica os clientes via WebSocket que o cardápio mudou.
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error("Erro ao adicionar categoria:", error);
        res.status(500).json({ message: 'Erro no servidor ao adicionar categoria', error: error.message });
    }
});

/**
 * ROTA: PUT /:id
 * DESCRIÇÃO: Atualiza uma categoria existente.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PUT /api/categorias/123
 */
router.put('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { nome, is_happy_hour, happy_hour_inicio, happy_hour_fim } = req.body;
    if (!nome) {
        return res.status(400).json({ message: 'O nome é obrigatório.' });
    }

    try {
        const sql = `UPDATE categorias SET nome = ?, is_happy_hour = ?, happy_hour_inicio = ?, happy_hour_fim = ? WHERE id = ?`;
        const params = [
            nome, 
            is_happy_hour || false, 
            is_happy_hour ? happy_hour_inicio : null, 
            is_happy_hour ? happy_hour_fim : null,
            id
        ];
        const result = await query(sql, params);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Categoria não encontrada.' });
        }
        
        await registrarLog(req.usuario.id, req.usuario.nome, 'EDITOU_CATEGORIA', `Editou a categoria ID ${id}.`);
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.json({ message: 'Categoria atualizada com sucesso!' });
    } catch (error) {
        console.error(`Erro ao atualizar categoria ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar categoria.', error: error.message });
    }
});

/**
 * ROTA: DELETE /:id
 * DESCRIÇÃO: Deleta uma categoria.
 * ACESSO: Restrito ('geral').
 * URL FINAL: DELETE /api/categorias/123
 */
router.delete('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        // Busca o nome da categoria antes de deletar, para um log mais descritivo.
        const categoria = await query('SELECT nome FROM categorias WHERE id = ?', [id]);
        const nomeCategoria = categoria.length > 0 ? categoria[0].nome : `ID ${id}`;
        
        await query('DELETE FROM categorias WHERE id = ?', [id]);
        
        await registrarLog(req.usuario.id, req.usuario.nome, 'DELETOU_CATEGORIA', `Deletou a categoria '${nomeCategoria}'.`);
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.status(200).json({ message: 'Categoria deletada com sucesso.' });
    } catch (error) {
        console.error(`Erro ao deletar categoria ID ${id}:`, error);
        // Verifica se o erro é de chave estrangeira (tentativa de deletar categoria com produtos)
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Não é possível deletar esta categoria, pois existem produtos associados a ela.' });
        }
        res.status(500).json({ message: 'Erro no servidor ao deletar categoria', error: error.message });
    }
});

/**
 * ROTA: POST /ordenar
 * DESCRIÇÃO: Salva a nova ordem das categorias.
 * ACESSO: Restrito ('geral').
 * URL FINAL: POST /api/categorias/ordenar
 */
router.post('/ordenar', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    try {
        const { ordem } = req.body; // Espera um array de IDs na ordem desejada.
        if (!Array.isArray(ordem)) {
            return res.status(400).json({ message: 'O corpo da requisição deve ser um array de IDs.' });
        }
        
        // Cria uma lista de promessas, uma para cada atualização de ordem.
        const queries = ordem.map((id, index) => 
            query('UPDATE categorias SET ordem = ? WHERE id = ?', [index, id])
        );
        
        // Executa todas as atualizações em paralelo para maior eficiência.
        await Promise.all(queries);
        
        await registrarLog(req.usuario.id, req.usuario.nome, 'ORDENOU_CATEGORIAS', `O usuário reordenou as categorias.`);
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.status(200).json({ message: 'Ordem das categorias atualizada com sucesso.' });
    } catch (error) {
        console.error("Erro ao salvar a nova ordem das categorias:", error);
        res.status(500).json({ message: 'Erro no servidor ao salvar a nova ordem', error: error.message });
    }
});

router.patch('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    if (ativo === undefined) {
        return res.status(400).json({ message: "O status 'ativo' é obrigatório." });
    }

    try {
        const sql = `UPDATE categorias SET ativo = ? WHERE id = ?`;
        const result = await query(sql, [ativo, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Categoria não encontrada.' });
        }

        const acao = ativo ? `ATIVOU_CATEGORIA` : `DESATIVOU_CATEGORIA`;
        await registrarLog(req.usuario.id, req.usuario.nome, acao, `Alterou o status da categoria ID ${id}.`);
        
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.json({ message: 'Status da categoria atualizado com sucesso.' });
    } catch (error) {
        console.error(`Erro ao atualizar status da categoria ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status.', error: error.message });
    }
});

/**
 * ROTA: PATCH /:id/status
 * DESCRIÇÃO: Ativa ou inativa uma categoria.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PATCH /api/categorias/123/status
 */
router.patch('/:id/status', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body; // Espera um body como { "ativo": true } ou { "ativo": false }

    if (ativo === undefined) {
        return res.status(400).json({ message: "O status 'ativo' é obrigatório." });
    }

    try {
        const sql = `UPDATE categorias SET ativo = ? WHERE id = ?`;
        const result = await query(sql, [ativo, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Categoria não encontrada.` });
        }

        const acao = ativo ? `ATIVOU_CATEGORIA` : `DESATIVOU_CATEGORIA`;
        await registrarLog(req.usuario.id, req.usuario.nome, acao, `Alterou o status da categoria ID ${id} para '${ativo ? 'ativo' : 'inativo'}'.`);
        
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        res.json({ message: 'Status da categoria atualizado com sucesso.' });
    } catch (error) {
        console.error(`Erro ao atualizar status da categoria ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status.', error: error.message });
    }
});


// Exporta o router para que ele possa ser usado no arquivo principal do servidor.
module.exports = router;
