const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../configurar/db'); // Verifique se o caminho para seu db.js está correto
const router = express.Router();

// ==================================================================
// --- FUNÇÃO AUXILIAR PARA BUSCAR O TOKEN DE REGISTRO DO BANCO ---
// ==================================================================
// Esta função centraliza a lógica de busca, mantendo o código da rota limpo.
async function getRegisterToken() {
    // Busca o valor da configuração onde a chave é 'token_secreto_registro'
    const sql = "SELECT valor FROM configuracoes WHERE chave = 'token_secreto_registro'";
    try {
        const results = await query(sql);
        
        // Se a chave não for encontrada, é um erro crítico de configuração do sistema.
        if (results.length === 0) {
            throw new Error("Token de registro ('token_secreto_registro') não foi encontrado no banco de dados.");
        }
        
        // Retorna apenas o valor do token.
        return results[0].valor; 
    } catch (error) {
        // Loga o erro para depuração e o propaga para a rota principal.
        console.error("ERRO GRAVE: Falha ao buscar token de registro do banco.", error);
        throw error;
    }
}


// ==================================================================
// --- ROTA DE REGISTRO (MODIFICADA PARA USAR O BANCO DE DADOS) ---
// ==================================================================
router.post('/register', async (req, res) => {
    const { nome, email, senha, nivel_acesso, tokenSecreto, usuario } = req.body;

    // Validação dos campos continua a mesma.
    if (!nome || !email || !senha || !nivel_acesso || !usuario || !tokenSecreto) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos, incluindo o código de registro.' });
    }

    try {
        // 1. Busca o token correto do banco de dados PRIMEIRO.
        const tokenCorretoDoBanco = await getRegisterToken();

        // 2. Compara o token enviado pelo usuário com o token do banco.
        //    A linha antiga 'if (tokenSecreto !== process.env.REGISTER_SECRET_TOKEN)' foi substituída.
        if (tokenSecreto !== tokenCorretoDoBanco) {
            return res.status(403).json({ message: 'Código de registro inválido.' });
        }

        // 3. O resto da lógica de registro permanece exatamente a mesma.
        const [userExists] = await query('SELECT * FROM usuarios WHERE email = ? OR usuario = ?', [email, usuario]);
        if (userExists) {
            return res.status(400).json({ message: 'Este email ou nome de usuário já está em uso.' });
        }

        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        const result = await query(
            'INSERT INTO usuarios (nome, email, senha, nivel_acesso, usuario) VALUES (?, ?, ?, ?, ?)',
            [nome, email, senhaHash, nivel_acesso, usuario]
        );

        // Busca o usuário recém-criado para retornar dados completos (incluindo 'criado_em', se existir).
        const [novoUsuario] = await query('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);

        res.status(201).json({
            id: novoUsuario.id,
            nome: novoUsuario.nome,
            email: novoUsuario.email,
            usuario: novoUsuario.usuario,
            nivel_acesso: novoUsuario.nivel_acesso,
            criado_em: novoUsuario.criado_em // Retorna a data de criação.
        });

    } catch (error) {
        // Este bloco agora captura erros tanto da busca do token quanto do registro do usuário.
        console.error("Erro no processo de registro:", error);
        res.status(500).json({ message: 'Erro no servidor ao tentar registrar.' });
    }
});


// ==================================================================
// --- OUTRAS ROTAS (PERMANECEM INALTERADAS) ---
// ==================================================================

// ROTA DE LOGIN UNIFICADA
router.post('/login', async (req, res) => {
    const { email, nome_usuario, senha } = req.body;
    if (!senha || (!email && !nome_usuario)) {
        return res.status(400).json({ message: 'Credenciais incompletas. Forneça email ou nome de usuário e a senha.' });
    }
    try {
        let sql;
        let params;
        if (email) {
            sql = 'SELECT * FROM usuarios WHERE email = ?';
            params = [email];
        } else {
            sql = 'SELECT * FROM usuarios WHERE usuario = ?';
            params = [nome_usuario];
        }
        const [usuario] = await query(sql, params);
        if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const payload = { id: usuario.id, nome: usuario.nome, nivel_acesso: usuario.nivel_acesso, tipo: 'usuario' };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login bem-sucedido!', token: token, usuario: payload });
    } catch (error) {
        console.error("Erro CRÍTICO na autenticação:", error);
        res.status(500).json({ message: 'Erro interno no servidor. Contate o suporte.' });
    }
});

// ROTA DE LOGIN DO CLIENTE (TABLET/MESA)
router.post('/login-cliente', async (req, res) => {
    const { nome_usuario, senha } = req.body;
    if (!nome_usuario || !senha) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }
    try {
        const [mesa] = await query('SELECT * FROM mesas WHERE nome_usuario = ?', [nome_usuario]);
        if (!mesa || !(await bcrypt.compare(senha, mesa.senha))) {
            return res.status(401).json({ message: 'Usuário da mesa ou senha inválida.' });
        }
        const payload = { id: mesa.id, nome: mesa.nome_usuario, tipo: 'mesa' };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ message: 'Login da mesa bem-sucedido!', token: token, mesa: { id: mesa.id, nome_usuario: mesa.nome_usuario } });
    } catch (error) {
        console.error("Erro no login da mesa:", error);
        res.status(500).json({ message: 'Erro no servidor ao tentar fazer login.' });
    }
});

// ROTA DE LOGIN DE DESENVOLVEDOR
router.post('/dev-login', async (req, res) => {
    const { usuario, senha } = req.body; 
    if (!usuario || !senha) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }
    try {
        const sql = "SELECT * FROM usuarios WHERE usuario = ? AND nivel_acesso = 'dono'";
        const [devUser] = await query(sql, [usuario]);
        if (!devUser || !(await bcrypt.compare(senha, devUser.senha))) {
            return res.status(401).json({ message: 'Credenciais de desenvolvedor inválidas.' });
        }
        const payload = { id: devUser.id, nome: devUser.nome, nivel_acesso: devUser.nivel_acesso };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        console.log(`>>> Login de DESENVOLVEDOR bem-sucedido para o usuário: ${devUser.nome} (ID: ${devUser.id})`);
        res.json({ token, usuario: payload });
    } catch (error) {
        console.error('[Login DEV] Erro ao autenticar desenvolvedor:', error);
        res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
});

// ROTA PARA AUTENTICAR FUNCIONÁRIO (SEM GERAR TOKEN)
router.post('/login-funcionario', async (req, res) => {
    const { nome_usuario, senha } = req.body;
    if (!nome_usuario || !senha) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }
    try {
        const [user] = await query('SELECT * FROM usuarios WHERE usuario = ?', [nome_usuario]);
        if (!user || !(await bcrypt.compare(senha, user.senha))) {
            return res.status(401).json({ message: 'Credenciais de funcionário inválidas.' });
        }
        res.status(200).json({ message: 'Funcionário autenticado com sucesso.' });
    } catch (error) {
        console.error('Erro na autenticação do funcionário:', error);
        res.status(500).json({ message: 'Erro no servidor durante a autenticação.' });
    }
});

module.exports = router;
