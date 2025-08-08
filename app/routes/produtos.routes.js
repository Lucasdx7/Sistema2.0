const express = require('express');
const router = express.Router();
const fs = require('fs'); // <-- ADICIONE O FILE SYSTEM
const path = require('path'); // <-- ADICIONE O PATH
const { query, registrarLog } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

/**
 * Middleware para garantir que as informações do usuário estão presentes
 * antes de registrar um log.
 */
const checarUsuarioParaLog = (req, res, next) => {
    // Aceita se tiver 'nome' (funcionário) OU 'nome_usuario' (mesa)
    if (req.usuario && (req.usuario.nome || req.usuario.nome_usuario)) {
        return next();
    }
    console.error("Tentativa de ação de log sem um usuário autenticado ou com dados incompletos.");
    return res.status(500).json({ message: "Erro interno: informações do usuário ausentes para registro de log." });
};
// ==================================================================
// --- ROTAS DE PRODUTOS ---
// O prefixo '/api/produtos' será definido no arquivo principal (server.js)
// ==================================================================


// Em app/routes/produtos.routes.js

/**
 * ROTA: GET /
 * DESCRIÇÃO: Busca produtos. Pode ser filtrado por categoria via query param.
 * ACESSO: Restrito (requer login de funcionário ou cliente).
 * URL FINAL: GET /api/produtos?categoriaId=4
 */
router.get('/', async (req, res) => {
    const { categoriaId } = req.query; // Pega o ID da categoria da query string

    try {
        // Nota: Na gerência, queremos ver até os produtos inativos.
        // Por isso, removemos o "WHERE ativo = TRUE" daqui.
        let sql = 'SELECT * FROM produtos';
        const params = [];

        if (categoriaId) {
            sql += ' WHERE id_categoria = ?';
            params.push(categoriaId);
        }

        sql += ' ORDER BY ordem ASC, id ASC';

        const produtos = await query(sql, params);
        res.json(produtos);
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar produtos', error: error.message });
    }
});

/**
 * ROTA: GET /todos
 * DESCRIÇÃO: Busca todos os produtos de todas as categorias, com o nome da categoria.
 * ACESSO: Público (usado em painéis de gerenciamento).
 * URL FINAL: GET /api/produtos/todos
 */
router.get('/todos', async (req, res) => {
    try {
        const sql = `
            SELECT p.*, c.nome AS nome_categoria 
            FROM produtos p 
            JOIN categorias c ON p.id_categoria = c.id 
            ORDER BY c.ordem, p.ordem, p.id;
        `;
        const produtos = await query(sql);
        res.json(produtos);
    } catch (error) {
        console.error("Erro ao buscar todos os produtos:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar todos os produtos', error: error.message });
    }
});

/**
 * ROTA: GET /sugestao
 * DESCRIÇÃO: Retorna até 5 produtos aleatórios marcados como "pode ser sugestão".
 * ACESSO: Restrito (requer login de mesa/cliente).
 * URL FINAL: GET /api/produtos/sugestao
 */
router.get('/sugestao', checarUsuarioParaLog, async (req, res) => {
    try {
        const sql = `
            SELECT p.*, c.nome AS nome_categoria 
            FROM produtos p
            JOIN categorias c ON p.id_categoria = c.id
            WHERE p.ativo = 1 AND p.pode_ser_sugestao = 1 
            ORDER BY RAND() 
            LIMIT 5;
        `;
        const sugestoes = await query(sql);

        if (sugestoes.length > 0) {
            res.json(sugestoes);
        } else {
            res.status(404).json({ message: 'Nenhuma sugestão de produto disponível no momento.' });
        }
    } catch (error) {
        console.error('Erro ao buscar sugestão de produto:', error);
        res.status(500).json({ message: 'Erro interno ao buscar sugestão.' });
    }
});

/**
 * ROTA: POST /
 * DESCRIÇÃO: Cria um novo produto.
 * ACESSO: Restrito ('geral').
 * URL FINAL: POST /api/produtos
 */
router.post('/', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    try {
        const { id_categoria, nome, descricao, descricao_detalhada, preco, imagem_svg, serve_pessoas, pode_ser_sugestao } = req.body;

        if (!id_categoria || !nome || !descricao || preco === undefined) {
            return res.status(400).json({ message: 'Campos obrigatórios (categoria, nome, descrição, preço) devem ser preenchidos.' });
        }
        
        const sql = 'INSERT INTO produtos (id_categoria, nome, descricao, descricao_detalhada, preco, imagem_svg, serve_pessoas, pode_ser_sugestao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        const params = [id_categoria, nome, descricao, descricao_detalhada || null, preco, imagem_svg || null, serve_pessoas || 1, pode_ser_sugestao || false];
        
        const result = await query(sql, params);

        await registrarLog(req.usuario.id, req.usuario.nome, 'CRIOU_PRODUTO', `Criou o produto '${nome}' (ID: ${result.insertId}).`);
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.status(201).json({ id: result.insertId, ...req.body });

    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        res.status(500).json({ message: 'Erro no servidor ao adicionar produto', error: error.message });
    }
});

/**
 * ROTA: PUT /:id
 * DESCRIÇÃO: Atualiza um produto existente.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PUT /api/produtos/123
 */
// ...
// Em app/routes/produtos.routes.js

router.put('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    // Pegamos todos os dados do corpo da requisição
    const { nome, descricao, preco, serve_pessoas, descricao_detalhada, pode_ser_sugestao, imagem_svg } = req.body;

    // Validação básica dos campos
    if (!nome || !descricao || preco === undefined) {
        return res.status(400).json({ message: 'Campos obrigatórios (nome, descrição, preço) não podem ser vazios.' });
    }

    try {
        // 1. Busca o produto atual para obter o nome (para o log) e a imagem existente.
        const [produtoAtual] = await query('SELECT nome, imagem_svg FROM produtos WHERE id = ?', [id]);

        if (!produtoAtual) {
            return res.status(404).json({ message: 'Produto não encontrado para edição.' });
        }

        // --- INÍCIO DA LÓGICA CORRIGIDA ---

        // 2. Define o caminho da imagem. Por padrão, é o que já está no banco.
        let caminhoFinalDaImagem = produtoAtual.imagem_svg;

        // 3. Verifica se uma NOVA imagem foi enviada (em formato Base64).
        if (imagem_svg && imagem_svg.startsWith('data:image')) {
            // Se sim, processa a nova imagem e atualiza o caminho.
            // (Esta é a lógica de salvar o arquivo que implementamos antes)
            const base64Data = imagem_svg.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const nomeArquivo = `${Date.now()}-${nome.replace(/\s+/g, '-')}.png`;
            const caminhoCompleto = path.join(__dirname, '..', '..', 'uploads', nomeArquivo);
            
            fs.writeFileSync(caminhoCompleto, buffer);
            caminhoFinalDaImagem = `/uploads/${nomeArquivo}`; // A variável agora tem o novo caminho.
        }
        // Se nenhuma nova imagem for enviada, `caminhoFinalDaImagem` mantém o valor antigo.

        // --- FIM DA LÓGICA CORRIGIDA ---

        // 4. Monta e executa a query de UPDATE com o caminho da imagem correto.
        const sql = `
            UPDATE produtos SET 
                nome = ?, descricao = ?, preco = ?, serve_pessoas = ?, 
                descricao_detalhada = ?, pode_ser_sugestao = ?, imagem_svg = ?
            WHERE id = ?
        `;
        const params = [
            nome, 
            descricao, 
            parseFloat(preco), 
            parseInt(serve_pessoas || 1), 
            descricao_detalhada, 
            pode_ser_sugestao ? 1 : 0, 
            caminhoFinalDaImagem, // Usa a variável que sempre terá um valor.
            id
        ];
        
        await query(sql, params);

        // 5. Registra o log com o nome antigo do produto.
        await registrarLog(req.usuario.id, req.usuario.nome, 'EDITOU_PRODUTO', `Editou o produto '${produtoAtual.nome}' (ID: ${id}).`);
        
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.json({ message: 'Produto atualizado com sucesso!' });

    } catch (error) {
        console.error(`Erro ao atualizar produto ID ${id}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar o produto.', error: error.message });
    }
});



/**
 * ROTA: DELETE /:id
 * DESCRIÇÃO: Deleta um produto.
 * ACESSO: Restrito ('geral').
 * URL FINAL: DELETE /api/produtos/123
 */
router.delete('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    try {
        const produto = await query('SELECT nome FROM produtos WHERE id = ?', [id]);
        const nomeProduto = produto.length > 0 ? produto[0].nome : `ID ${id}`;
        
        await query('DELETE FROM produtos WHERE id = ?', [id]);
        
        await registrarLog(req.usuario.id, req.usuario.nome, 'DELETOU_PRODUTO', `Deletou o produto '${nomeProduto}'.`);
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.status(200).json({ message: 'Produto deletado com sucesso.' });
    } catch (error) {
        console.error(`Erro ao deletar produto ID ${id}:`, error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Não é possível deletar este produto, pois ele está associado a pedidos existentes.' });
        }
        res.status(500).json({ message: 'Erro no servidor ao deletar produto', error: error.message });
    }
});

/**
 * ROTA: POST /ordenar
 * DESCRIÇÃO: Salva a nova ordem dos produtos dentro de uma categoria.
 * ACESSO: Restrito ('geral').
 * URL FINAL: POST /api/produtos/ordenar
 */
router.post('/ordenar', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    try {
        const { ordem } = req.body;
        if (!Array.isArray(ordem)) {
            return res.status(400).json({ message: 'O corpo da requisição deve ser um array de IDs.' });
        }
        
        const queries = ordem.map((id, index) => 
            query('UPDATE produtos SET ordem = ? WHERE id = ?', [index, id])
        );
        await Promise.all(queries);

        await registrarLog(req.usuario.id, req.usuario.nome, 'ORDENOU_PRODUTOS', `O usuário reordenou os produtos.`);
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.status(200).json({ message: 'Ordem dos produtos atualizada com sucesso.' });
    } catch (error) {
        console.error("Erro ao salvar a nova ordem dos produtos:", error);
        res.status(500).json({ message: 'Erro no servidor ao salvar a nova ordem dos produtos', error: error.message });
    }
});

/**
 * ROTA: PATCH /:id/status
 * DESCRIÇÃO: Ativa ou inativa um produto.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PATCH /api/produtos/123/status
 */
router.patch('/:id/status', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    if (ativo === undefined) {
        return res.status(400).json({ message: "O status 'ativo' é obrigatório." });
    }

    try {
        const sql = `UPDATE produtos SET ativo = ? WHERE id = ?`;
        const result = await query(sql, [ativo, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const acao = ativo ? `ATIVOU_PRODUTO` : `DESATIVOU_PRODUTO`;
        await registrarLog(req.usuario.id, req.usuario.nome, acao, `Alterou o status do produto ID ${id} para '${ativo ? 'ativo' : 'inativo'}'.`);
        
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        res.json({ message: 'Status do produto atualizado com sucesso.' });
    } catch (error) {
        console.error(`Erro ao atualizar status do produto ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status.', error: error.message });
    }
});

/**
 * ROTA: PATCH /:id/sugestao
 * DESCRIÇÃO: Marca ou desmarca um produto como sugestão.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PATCH /api/produtos/123/sugestao
 */
// Em app/routes/produtos.routes.js

/**
 * ROTA: PATCH /:id/sugestao
 * DESCRIÇÃO: Marca ou desmarca um produto como sugestão.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PATCH /api/produtos/123/sugestao
 */
router.patch('/:id/sugestao', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { pode_ser_sugestao } = req.body;

    if (pode_ser_sugestao === undefined) {
        return res.status(400).json({ message: "O status 'pode_ser_sugestao' é obrigatório." });
    }

    try {
        // --- INÍCIO DA CORREÇÃO ---
        // 1. Busca o nome do produto para usar no log.
        const [produto] = await query('SELECT nome FROM produtos WHERE id = ?', [id]);

        // Se o produto não for encontrado, retorna um erro 404.
        if (!produto) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        // --- FIM DA CORREÇÃO ---

        // 2. Executa a atualização no banco de dados.
        const sql = `UPDATE produtos SET pode_ser_sugestao = ? WHERE id = ?`;
        const result = await query(sql, [pode_ser_sugestao ? 1 : 0, id]);

        // Esta verificação é uma segurança extra, mas a de cima já deve pegar o caso.
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado ou o status já era o mesmo.' });
        }

        // 3. Cria o log descritivo usando o nome do produto.
        const acao = pode_ser_sugestao ? 'MARCOU_COMO_SUGESTAO' : 'DESMARCOU_COMO_SUGESTAO';
        const detalheLog = `Alterou o status de sugestão do produto '${produto.nome}' (ID: ${id}).`;
        
        await registrarLog(req.usuario.id, req.usuario.nome, acao, detalheLog);
        
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.json({ message: 'Status de sugestão atualizado com sucesso.' });

    } catch (error) {
        console.error(`Erro ao atualizar status de sugestão do produto ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status de sugestão.', error: error.message });
    }
});

// Em app/routes/produtos.routes.js

// ... (outras rotas de produtos existentes) ...

/**
 * ROTA: PATCH /:id
 * DESCRIÇÃO: Altera o status (ativo/inativo) de um produto.
 * ACESSO: Restrito ('geral').
 * URL FINAL: PATCH /api/produtos/123
 */
router.patch('/:id', checarNivelAcesso(['geral']), checarUsuarioParaLog, async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;

    if (ativo === undefined) {
        return res.status(400).json({ message: "O status 'ativo' é obrigatório." });
    }

    try {
        const sql = `UPDATE produtos SET ativo = ? WHERE id = ?`;
        const result = await query(sql, [ativo, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const acao = ativo ? `ATIVOU_PRODUTO` : `DESATIVOU_PRODUTO`;
        await registrarLog(req.usuario.id, req.usuario.nome, acao, `Alterou o status do produto ID ${id}.`);
        
        if (req.broadcast) req.broadcast({ type: 'CARDAPIO_ATUALIZADO' });
        
        res.json({ message: 'Status do produto atualizado com sucesso.' });
    } catch (error) {
        console.error(`Erro ao atualizar status do produto ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao atualizar status.', error: error.message });
    }
});


// A linha abaixo deve ser a última do arquivo
module.exports = router;

