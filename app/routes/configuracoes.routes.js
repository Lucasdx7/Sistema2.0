const express = require('express');
const router = express.Router();
const { query, registrarLog } = require('../configurar/db');
const { checarNivelAcesso } = require('../middleware/authMiddleware');

// Middleware específico para este módulo, garantindo que apenas 'geral' acesse.
// Embora checarNivelAcesso(['geral']) já faça isso, ter um middleware nomeado
// pode deixar a intenção mais clara para quem lê o código.
const checarPermissaoConfig = (req, res, next) => {
    if (req.usuario && req.usuario.nivel_acesso === 'geral') {
        return next();
    }
    return res.status(403).json({ message: 'Acesso negado. Apenas a gerência pode acessar esta área.' });
};

// ==================================================================
// --- ROTAS DE CONFIGURAÇÕES E USUÁRIOS ---
// O prefixo '/api/configuracoes' será definido no arquivo principal (server.js)
// ==================================================================

/**
 * ROTA: GET /
 * DESCRIÇÃO: Busca múltiplas configurações de uma vez.
 * ACESSO: Restrito ('geral').
 * URL FINAL: GET /api/configuracoes?chaves=fonte_cliente,permissoes_home
 */
router.get('/', checarPermissaoConfig, async (req, res) => {
    try {
        const { chaves } = req.query;
        if (!chaves) {
            return res.status(400).json({ message: 'É necessário fornecer as chaves das configurações a serem buscadas.' });
        }
        const chavesArray = chaves.split(',');
        const placeholders = chavesArray.map(() => '?').join(',');
        const sql = `SELECT chave, valor FROM configuracoes WHERE chave IN (${placeholders})`;
        
        const resultados = await query(sql, chavesArray);

        // Transforma o array de resultados em um objeto chave-valor
        const configs = resultados.reduce((obj, item) => {
            try {
                // Tenta fazer o parse do valor, se for um JSON válido (como as permissões)
                obj[item.chave] = JSON.parse(item.valor);
            } catch (e) {
                // Se não for JSON, usa o valor como string
                obj[item.chave] = item.valor;
            }
            return obj;
        }, {});

        res.json(configs);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ message: 'Erro no servidor ao buscar configurações.' });
    }
});

/**
 * ROTA: POST /
 * DESCRIÇÃO: Salva uma ou mais configurações.
 * ACESSO: Restrito ('geral').
 * URL FINAL: POST /api/configuracoes
 */
router.post('/', checarPermissaoConfig, async (req, res) => {
    try {
        const configsParaSalvar = req.body;
        const promessas = [];

        for (const chave in configsParaSalvar) {
            if (Object.hasOwnProperty.call(configsParaSalvar, chave)) {
                let valor = configsParaSalvar[chave];
                // Se o valor for um objeto (como a lista de permissões), converte para string JSON
                if (typeof valor === 'object' && valor !== null) {
                    valor = JSON.stringify(valor);
                }
                const sql = 'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?';
                promessas.push(query(sql, [chave, valor, valor]));
            }
        }

        await Promise.all(promessas);
        await registrarLog(req.usuario.id, req.usuario.nome, 'ATUALIZOU_CONFIGS', `Salvou alterações na página de configurações.`);
        
        if (req.broadcast) {
            req.broadcast({ type: 'CONFIG_ATUALIZADA', payload: configsParaSalvar });
        }

        res.status(200).json({ message: 'Configurações salvas com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        res.status(500).json({ message: 'Erro no servidor ao salvar configurações.' });
    }
});

// ROTA CORRIGIDA: Busca a lista de funcionários, EXCLUINDO o nível 'dono'
router.get('/usuarios-para-relatorio', async (req, res) => {
    try {
        // --- A CORREÇÃO ESTÁ AQUI ---
        // Adicionamos a condição WHERE para não incluir o 'dono' na lista.
        const sql = "SELECT id, nome, nivel_acesso FROM usuarios WHERE nivel_acesso != 'dono' ORDER BY nome ASC";
        const usuarios = await query(sql);
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao buscar usuários para relatório:', error);
        res.status(500).json({ message: 'Erro no servidor ao buscar lista de funcionários.' });
    }
});

/**
 * ROTA: GET /usuarios
 * DESCRIÇÃO: Busca uma lista de todos os usuários (funcionários) para gerenciamento.
 * ACESSO: Restrito ('geral').
 * URL FINAL: GET /api/configuracoes/usuarios
 */
router.get('/usuarios', checarPermissaoConfig, async (req, res) => {
    try {
        const sql = "SELECT id, nome, email, nivel_acesso FROM usuarios ORDER BY nome ASC";
        const usuarios = await query(sql);
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ message: 'Erro no servidor ao buscar usuários.' });
    }
});

/**
 * ROTA: DELETE /usuarios/:id
 * DESCRIÇÃO: Deleta um funcionário.
 * ACESSO: Restrito ('geral').
 * URL FINAL: DELETE /api/configuracoes/usuarios/123
 */
router.delete('/usuarios/:id', checarPermissaoConfig, async (req, res) => {
    const { id } = req.params;
    const idGerenteLogado = req.usuario.id;

    if (parseInt(id, 10) === idGerenteLogado) {
        return res.status(400).json({ message: 'Você não pode deletar a si mesmo.' });
    }

    try {
        const [usuario] = await query('SELECT nome FROM usuarios WHERE id = ?', [id]);
        if (!usuario) {
            return res.status(404).json({ message: 'Funcionário não encontrado.' });
        }

        await query('DELETE FROM usuarios WHERE id = ?', [id]);
        await registrarLog(req.usuario.id, req.usuario.nome, 'DELETOU_USUARIO', `Deletou o funcionário '${usuario.nome}' (ID: ${id}).`);
        res.status(200).json({ message: `Funcionário '${usuario.nome}' deletado com sucesso.` });
    } catch (error) {
        console.error(`Erro ao deletar usuário ID ${id}:`, error);
        res.status(500).json({ message: 'Erro no servidor ao deletar funcionário.' });
    }
});





/**
 * ROTA: GET /:chaves
 * DESCRIÇÃO: Busca múltiplas configurações de uma vez, separadas por vírgula.
 * ACESSO: Restrito ('geral').
 * URL FINAL: GET /api/configuracoes/chave1,chave2,chave3
 */
router.get('/:chaves', checarNivelAcesso(['geral']), async (req, res) => {
    try {
        // Pega as chaves da URL e as separa em um array
        const chaves = req.params.chaves.split(',');
        
        // Cria os placeholders (?) para a consulta SQL de forma segura
        const placeholders = chaves.map(() => '?').join(',');
        const sql = `SELECT chave, valor FROM configuracoes WHERE chave IN (${placeholders})`;
        
        const resultados = await query(sql, chaves);

        // Transforma o array de resultados em um objeto chave-valor para fácil uso no frontend
        const configs = resultados.reduce((obj, item) => {
            try {
                // Tenta fazer o parse do valor, se for um JSON válido (como as permissões)
                obj[item.chave] = JSON.parse(item.valor);
            } catch (e) {
                // Se não for JSON, usa o valor como string (como a fonte)
                obj[item.chave] = item.valor;
            }
            return obj;
        }, {});

        res.json(configs);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ message: 'Erro no servidor ao buscar configurações.' });
    }
});



module.exports = router;
