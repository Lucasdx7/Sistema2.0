const jwt = require('jsonwebtoken');
// Carrega o módulo de banco de dados inteiro para verificação
const dbModule = require('../configurar/db');

// Verifica se a função 'query' foi exportada corretamente.
// Se não foi, isso vai gerar um erro claro e imediato no terminal ao iniciar o servidor.
if (typeof dbModule.query !== 'function') {
    throw new Error("Falha crítica em authMiddleware.js: A função 'query' não foi exportada corretamente pelo módulo 'db.js'.");
}
const { query } = dbModule;


const protegerRota = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Não autorizado, nenhum token fornecido ou formato inválido.' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Caminho rápido para o desenvolvedor (nível 'dono')
        if (decoded.nivel_acesso === 'dono') {
            req.usuario = decoded;
            return next();
        }

        // Lógica para usuários e mesas normais
        let usuarioEncontrado;
        if (decoded.tipo === 'mesa') {
            [usuarioEncontrado] = await query('SELECT id, nome_usuario FROM mesas WHERE id = ?', [decoded.id]);
            if (usuarioEncontrado) usuarioEncontrado.tipo = 'mesa';
        } else if (decoded.tipo === 'usuario') {
            [usuarioEncontrado] = await query('SELECT id, nome, email, nivel_acesso FROM usuarios WHERE id = ?', [decoded.id]);
            if (usuarioEncontrado) usuarioEncontrado.tipo = 'usuario';
        } else {
            // Se o token não tiver um 'tipo' válido, ele é considerado inválido.
            return res.status(403).json({ message: 'Token com formato desconhecido.' });
        }

        if (!usuarioEncontrado) {
            return res.status(401).json({ message: 'Não autorizado, usuário do token não encontrado no banco de dados.' });
        }

        req.usuario = usuarioEncontrado;
        next();

    } catch (error) {
        console.error('Erro de autenticação no middleware:', error.message);
        return res.status(401).json({ message: 'Não autorizado, token inválido ou expirado.' });
    }
};

const checarNivelAcesso = (niveisRequeridos) => {
    return (req, res, next) => {
        const nivelUsuario = req.usuario?.nivel_acesso;

        if (nivelUsuario === 'dono') {
            return next(); // Dono tem acesso a tudo
        }

        if (!nivelUsuario || !niveisRequeridos.includes(nivelUsuario)) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para esta ação.' });
        }

        next();
    };
};

module.exports = { protegerRota, checarNivelAcesso };
