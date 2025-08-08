const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, registrarLog } = require('../configurar/db'); // Funções do seu banco de dados
const { checarNivelAcesso } = require('../middleware/authMiddleware'); // Seu middleware de autenticação
const { performance } = require('perf_hooks'); // Módulo nativo do Node.js para medição de performance

// Middleware de segurança para TODAS as rotas deste arquivo.
router.use(checarNivelAcesso(['dono']));

// ==================================================================
// --- NOVA SEÇÃO: Health Check ---
// ==================================================================

router.get('/health-check', async (req, res) => {
    try {
        // 1. Status do Servidor (se chegou aqui, está online)
        const serverStatus = 'online';

        // 2. Status do Banco de Dados
        let dbStatus = 'online';
        try {
            // Tenta executar uma query simples e rápida para verificar a conexão
            await query('SELECT 1');
        } catch (e) {
            dbStatus = 'offline';
        }

        // 3. Latência da API
        const startTime = performance.now();
        // A própria requisição atual serve como teste de latência
        const endTime = performance.now();
        const apiLatency = Math.round(endTime - startTime);

        res.json({
            server: serverStatus,
            database: dbStatus,
            apiLatency: apiLatency
        });

    } catch (error) {
        console.error('[DEV] Erro no Health Check:', error);
        res.status(500).json({
            server: 'online',
            database: 'error',
            apiLatency: -1
        });
    }
});


// ==================================================================
// --- ROTA PARA GERENCIAMENTO DE USUÁRIOS (Existente) ---
// ==================================================================

// GET /api/dev/usuarios -> Busca todos os usuários (exceto o próprio 'dono')
router.get('/usuarios', async (req, res) => {
    try {
        const sql = "SELECT id, nome, email, nivel_acesso FROM usuarios WHERE nivel_acesso != 'dono' ORDER BY nome ASC";
        const usuarios = await query(sql);
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao buscar usuários para o painel DEV:', error);
        res.status(500).json({ message: 'Erro no servidor ao buscar usuários.' });
    }
});

// PUT /api/dev/alterar-senha -> Altera a senha de um usuário específico
router.put('/alterar-senha', async (req, res) => {
    const { usuarioId, novaSenha } = req.body;

    if (!usuarioId || !novaSenha || novaSenha.length < 4) {
        return res.status(400).json({ message: 'ID do usuário e uma nova senha com no mínimo 4 caracteres são obrigatórios.' });
    }

    try {
        const [usuario] = await query('SELECT nome FROM usuarios WHERE id = ?', [usuarioId]);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(novaSenha, salt);

        await query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, usuarioId]);
        await registrarLog(req.usuario.id, req.usuario.nome, 'ALTEROU_SENHA_DEV', `Alterou a senha do usuário '${usuario.nome}' (ID: ${usuarioId}).`);

        res.json({ message: `Senha do usuário '${usuario.nome}' alterada com sucesso!` });
    } catch (error) {
        console.error('Erro ao alterar senha no painel DEV:', error);
        res.status(500).json({ message: 'Erro no servidor ao alterar a senha.' });
    }
});

// POST /api/dev/disconnect-session -> Desconecta um cliente WebSocket
router.post('/disconnect-session', (req, res) => {
    const { clientId } = req.body;
    if (!clientId) {
        return res.status(400).json({ message: 'O ID da sessão do cliente é obrigatório.' });
    }

    const disconnectClientById = req.app.get('disconnectClientById');
    if (typeof disconnectClientById !== 'function') {
        console.error("[dev_routes] Erro crítico: A função 'disconnectClientById' não foi encontrada no app.");
        return res.status(500).json({ message: 'Erro interno do servidor: Função de desconexão não disponível.' });
    }

    const success = disconnectClientById(Number(clientId));

    if (success) {
        res.json({ message: `Sessão ${clientId} foi desconectada com sucesso.` });
    } else {
        res.status(404).json({ message: 'Sessão não encontrada.' });
    }
});

// POST /api/dev/force-close-session -> Força o fechamento de uma sessão de cliente
router.post('/force-close-session', async (req, res) => {
    const { sessaoId } = req.body;
    const motivoFechamento = 'Fechado pelo painel de desenvolvimento';

    if (!sessaoId) {
        return res.status(400).json({ message: 'O ID da sessão é obrigatório.' });
    }

    try {
        console.log('[DIAGNÓSTICO /force-close-session] Tentando fechar a sessão ID:', sessaoId, 'Usuário:', req.usuario);

        const [sessaoInfo] = await query('SELECT id_mesa, status FROM sessoes_cliente WHERE id = ?', [sessaoId]);

        if (!sessaoInfo) {
            return res.status(404).json({ message: 'Sessão não encontrada.' });
        }
        if (sessaoInfo.status !== 'ativa') {
            return res.status(400).json({ message: 'Esta sessão não está mais ativa.' });
        }

        const sql = "UPDATE sessoes_cliente SET status = 'finalizada', data_fim = NOW(), forma_pagamento = ?, finalizado_por_id = ? WHERE id = ?";
        await query(sql, [motivoFechamento, req.usuario.id, sessaoId]);

        await registrarLog(req.usuario.id, req.usuario.nome, 'FORCOU_FECHAMENTO_SESSAO', `Forçou o fechamento da sessão ID ${sessaoId}.`);

        req.broadcast({
            type: 'SESSAO_ATUALIZADA',
            payload: { sessaoId: sessaoId, mesaId: sessaoInfo.id_mesa, status: 'finalizada' }
        });
        
        const disconnectClientById = req.app.get('disconnectClientById');
        disconnectClientById(Number(sessaoId));

        res.json({ message: `Sessão ${sessaoId} foi forçada a fechar com sucesso!` });

    } catch (error) {
        console.error(`[DEV] Erro ao forçar fechamento da sessão ${sessaoId}:`, error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(500).json({ message: `Erro de integridade: O ID do usuário logado (${req.usuario.id}) não foi encontrado. Verifique o token.` });
        }
        res.status(500).json({ message: 'Erro no servidor ao forçar o fechamento da sessão.' });
    }
});

// Adicione esta rota logo após a rota PUT /api/dev/alterar-senha

// ==================================================================
// --- ROTA PARA ATUALIZAÇÃO COMPLETA DE USUÁRIO ---
// ==================================================================
// PUT /api/dev/usuarios/:id -> Atualiza nome, email e nível de acesso de um usuário
router.put('/usuarios/:id', async (req, res) => {
    const { id } = req.params; // Pega o ID do usuário da URL
    const { nome, email, nivel_acesso } = req.body; // Pega os novos dados do corpo da requisição

    // Validação básica dos dados recebidos
    if (!nome || !email || !nivel_acesso) {
        return res.status(400).json({ message: 'Todos os campos (nome, email, nível de acesso) são obrigatórios.' });
    }

    try {
        // Busca o nome antigo do usuário para o log de auditoria
        const [usuarioAntigo] = await query('SELECT nome FROM usuarios WHERE id = ?', [id]);
        if (!usuarioAntigo) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Monta a query de atualização no banco de dados
        const sql = 'UPDATE usuarios SET nome = ?, email = ?, nivel_acesso = ? WHERE id = ?';
        await query(sql, [nome, email, nivel_acesso, id]);

        // Registra a ação no log para auditoria
        const logMessage = `Atualizou o usuário '${usuarioAntigo.nome}' (ID: ${id}). Novos dados: Nome=${nome}, Email=${email}, Nível=${nivel_acesso}.`;
        await registrarLog(req.usuario.id, req.usuario.nome, 'ATUALIZOU_USUARIO_DEV', logMessage);

        res.json({ message: `Usuário '${nome}' atualizado com sucesso!` });

    } catch (error) {
        console.error(`[DEV] Erro ao atualizar usuário ${id}:`, error);
        // Trata erro de email duplicado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `O email '${email}' já está em uso por outro usuário.` });
        }
        res.status(500).json({ message: 'Erro no servidor ao atualizar o usuário.' });
    }
});


module.exports = router;
