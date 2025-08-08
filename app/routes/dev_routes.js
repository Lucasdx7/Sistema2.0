// Em app/routes/dev_routes.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, registrarLog } = require('../configurar/db'); // Funções do seu banco de dados
const { checarNivelAcesso } = require('../middleware/authMiddleware'); // Seu middleware de autenticação

// Middleware de segurança para TODAS as rotas deste arquivo.
// Garante que apenas o usuário com nível 'dono' (ou o nome que você definir para si) possa acessar.
router.use(checarNivelAcesso(['dono']));

// ==================================================================
// --- ROTA PARA GERENCIAMENTO DE USUÁRIOS ---
// ==================================================================

// GET /api/dev/usuarios -> Busca todos os usuários (exceto o próprio 'dono')
router.get('/usuarios', async (req, res) => {
    try {
        // Busca todos os usuários, menos o seu próprio, para evitar auto-alterações acidentais.
        // O 'req.usuario.id' vem do seu token de autenticação.
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
        // Busca o nome do usuário para registrar no log
        const [usuario] = await query('SELECT nome FROM usuarios WHERE id = ?', [usuarioId]);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Criptografa a nova senha antes de salvar (essencial para segurança)
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(novaSenha, salt);

        // Atualiza a senha no banco de dados
        await query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaHash, usuarioId]);

        // Registra a ação no log para auditoria
        await registrarLog(req.usuario.id, req.usuario.nome, 'ALTEROU_SENHA_DEV', `Alterou a senha do usuário '${usuario.nome}' (ID: ${usuarioId}).`);

        res.json({ message: `Senha do usuário '${usuario.nome}' alterada com sucesso!` });
    } catch (error) {
        console.error('Erro ao alterar senha no painel DEV:', error);
        res.status(500).json({ message: 'Erro no servidor ao alterar a senha.' });
    }
});

router.post('/disconnect-session', (req, res) => {
    const { clientId } = req.body;
    if (!clientId) {
        return res.status(400).json({ message: 'O ID da sessão do cliente é obrigatório.' });
    }

    // CORREÇÃO AQUI: Pegamos a função do objeto 'app' que foi configurado no server.js
    const disconnectClientById = req.app.get('disconnectClientById');
    
    // Verificação para garantir que a função foi encontrada
    if (typeof disconnectClientById !== 'function') {
        console.error("[dev_routes] Erro crítico: A função 'disconnectClientById' não foi encontrada no app.");
        return res.status(500).json({ message: 'Erro interno do servidor: Função de desconexão não disponível.' });
    }

    const success = disconnectClientById(Number(clientId));

    if (success) {
        res.json({ message: `Sessão ${clientId} foi desconectada com sucesso.` });
    } else {
        res.status(404).json({ message: 'Sessão não encontrada. O cliente pode já ter se desconectado.' });
    }
});

// /app/routes/dev_routes.js

// ... (suas outras rotas) ...

// ROTA CORRIGIDA: Força o fechamento de uma sessão ativa de qualquer mesa.
// POST /api/dev/force-close-session
router.post('/force-close-session', async (req, res) => {
    // Pega o ID da sessão do corpo da requisição
    const { sessaoId } = req.body;
    
    // Define um motivo padrão para o fechamento forçado
    const motivoFechamento = 'Fechado pelo painel de desenvolvimento';

    if (!sessaoId) {
        return res.status(400).json({ message: 'O ID da sessão é obrigatório.' });
    }

    try {
        // --- PASSO 1 (NOVO E CRUCIAL): Log de Diagnóstico ---
        // Antes de qualquer ação, vamos verificar qual ID de usuário o sistema está tentando usar.
        // Isso nos permite confirmar se o token JWT está fornecendo os dados corretos.
        console.log('================================================');
        console.log('[DIAGNÓSTICO /force-close-session]');
        console.log('Tentando fechar a sessão ID:', sessaoId);
        console.log('Informações do usuário logado (do token):', req.usuario);
        console.log(`ID do usuário que será registrado como finalizador: ${req.usuario.id}`);
        console.log('================================================');
        // --- FIM DO LOG ---

        // 2. Busca informações da sessão para o log e para o broadcast
        const [sessaoInfo] = await query(
            'SELECT id_mesa, status FROM sessoes_cliente WHERE id = ?',
            [sessaoId]
        );

        if (!sessaoInfo) {
            return res.status(404).json({ message: 'Sessão não encontrada.' });
        }
        if (sessaoInfo.status !== 'ativa') {
            return res.status(400).json({ message: 'Esta sessão não está mais ativa e não pode ser fechada.' });
        }

        // 3. Atualiza a sessão no banco de dados, marcando como 'finalizada'
        // A query agora usa o ID de usuário que verificamos no log.
        const sql = "UPDATE sessoes_cliente SET status = 'finalizada', data_fim = NOW(), forma_pagamento = ?, finalizado_por_id = ? WHERE id = ?";
        await query(sql, [motivoFechamento, req.usuario.id, sessaoId]);

        // 4. Registra o log da ação
        await registrarLog(req.usuario.id, req.usuario.nome, 'FORCOU_FECHAMENTO_SESSAO', `Forçou o fechamento da sessão ID ${sessaoId}.`);

        // 5. Notifica todos os clientes em tempo real que a sessão foi atualizada
        req.broadcast({
            type: 'SESSAO_ATUALIZADA',
            payload: {
                sessaoId: sessaoId,
                mesaId: sessaoInfo.id_mesa,
                status: 'finalizada'
            }
        });
        
        // 6. Envia uma mensagem de desconexão para o cliente específico (se ele ainda estiver conectado)
        const disconnectClientById = req.app.get('disconnectClientById');
        disconnectClientById(Number(sessaoId));

        res.json({ message: `Sessão ${sessaoId} foi forçada a fechar com sucesso!` });

    } catch (error) {
        // O erro de 'foreign key constraint' será capturado aqui.
        console.error(`[DEV] Erro ao forçar fechamento da sessão ${sessaoId}:`, error);
        
        // Adiciona uma mensagem de erro mais amigável para o frontend
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(500).json({ message: `Erro de integridade: O ID do usuário logado (${req.usuario.id}) não foi encontrado no banco de dados. Verifique o token de login.` });
        }
        
        res.status(500).json({ message: 'Erro no servidor ao forçar o fechamento da sessão.' });
    }
});

module.exports = router; // Não se esqueça de exportar o router


