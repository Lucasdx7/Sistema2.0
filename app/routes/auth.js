const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../configurar/db');
const router = express.Router();

// Rota de Registro de Gerente/Funcionário: POST /auth/register
router.post('/register', async (req, res) => {
    const { nome, email, senha, nivel_acesso, tokenSecreto, usuario } = req.body;
    if (tokenSecreto !== process.env.REGISTER_SECRET_TOKEN) {
        return res.status(403).json({ message: 'Código de registro inválido.' });
    }
    if (!nome || !email || !senha || !nivel_acesso || !usuario) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos.' });
    }
    try {
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
        res.status(201).json({
            id: result.insertId,
            nome: nome,
            email: email,
            usuario: usuario,
            nivel_acesso: nivel_acesso,
        });
    } catch (error) {
        console.error("Erro no registro:", error);
        res.status(500).json({ message: 'Erro no servidor ao tentar registrar.' });
    }
});


// ==================================================================
// --- ROTA DE LOGIN UNIFICADA (ACEITA EMAIL OU NOME DE USUÁRIO) ---
// ==================================================================
router.post('/login', async (req, res) => {
    // Pega ambos os campos do corpo da requisição. Um deles pode ser undefined.
    const { email, nome_usuario, senha } = req.body;

    // Valida que a senha e pelo menos um identificador (email ou nome_usuario) foram enviados.
    if (!senha || (!email && !nome_usuario)) {
        return res.status(400).json({ message: 'Credenciais incompletas. Forneça email ou nome de usuário e a senha.' });
    }

    try {
        let sql;
        let params;

        // Determina se o login é por email ou nome de usuário e prepara a consulta.
        if (email) {
            sql = 'SELECT * FROM usuarios WHERE email = ?';
            params = [email];
        } else { // Se não for email, deve ser nome_usuario.
            sql = 'SELECT * FROM usuarios WHERE usuario = ?';
            params = [nome_usuario];
        }

        const [usuario] = await query(sql, params);

        // Se o usuário não for encontrado ou a senha não bater, retorna um erro 401.
        if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // Se o login for bem-sucedido, cria o payload do token.
        const payload = {
            id: usuario.id,
            nome: usuario.nome,
            nivel_acesso: usuario.nivel_acesso,
            tipo: 'usuario'
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        // Retorna sucesso.
        res.json({
            message: 'Login bem-sucedido!',
            token: token,
            usuario: payload
        });

    } catch (error) {
        console.error("Erro CRÍTICO na autenticação:", error);
        res.status(500).json({ message: 'Erro interno no servidor. Contate o suporte.' });
    }
});



// Rota de Login do CLIENTE (TABLET/MESA): POST /auth/login-cliente
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
        const payload = {
            id: mesa.id,
            nome: mesa.nome_usuario,
            tipo: 'mesa'
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({
            message: 'Login da mesa bem-sucedido!',
            token: token,
            mesa: { id: mesa.id, nome_usuario: mesa.nome_usuario }
        });
    } catch (error) {
        console.error("Erro no login da mesa:", error);
        res.status(500).json({ message: 'Erro no servidor ao tentar fazer login.' });
    }
});

// /app/routes/auth.js

router.post('/dev-login', async (req, res) => {
    // ATUALIZADO: Pega 'usuario' do corpo da requisição, não 'nome_usuario'
    const { usuario, senha } = req.body; 

    if (!usuario || !senha) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    try {
        // ATUALIZADO: A query agora busca na coluna 'usuario'
        const sql = "SELECT * FROM usuarios WHERE usuario = ? AND nivel_acesso = 'dono'";
        const [devUser] = await query(sql, [usuario]);

        // ... (o resto da lógica permanece o mesmo) ...
        if (!devUser) {
            return res.status(401).json({ message: 'Usuário de desenvolvedor não encontrado.' });
        }

        const senhaValida = await bcrypt.compare(senha, devUser.senha);
        if (!senhaValida) {
            return res.status(401).json({ message: 'Senha de desenvolvedor incorreta.' });
        }

        const payload = {
            id: devUser.id,
            nome: devUser.nome,
            nivel_acesso: devUser.nivel_acesso
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        
        console.log(`>>> Login de DESENVOLVEDOR bem-sucedido para o usuário: ${devUser.nome} (ID: ${devUser.id})`);
        res.json({ token, usuario: payload });

    } catch (error) {
        console.error('[Login DEV] Erro ao autenticar desenvolvedor:', error);
        res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
});


// Rota para autenticar um funcionário para ações restritas (sem gerar token)
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
