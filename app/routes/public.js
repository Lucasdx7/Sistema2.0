// /Backend/routes/public.js

const express = require('express');
const router = express.Router();
const { query } = require('../configurar/db');

// ==================================================================
// --- ROTA PÚBLICA PARA FONTE DO CLIENTE ---
// ==================================================================
// GET /public/config/fonte
// Rota aberta para que as páginas do cliente possam buscar a fonte definida.
router.get('/config/fonte', async (req, res) => {
    try {
        const [config] = await query("SELECT valor FROM configuracoes WHERE chave = 'fonte_cliente'");
        const fonte = config ? config.valor : "'Roboto', sans-serif";
        res.json({ fonte_cliente: fonte });
    } catch (error) {
        console.error("Erro ao buscar configuração pública de fonte:", error);
        res.status(500).json({ fonte_cliente: "'Roboto', sans-serif" });
    }
});


// ==================================================================
// --- ROTA PÚBLICA PARA PERMISSÕES DA HOME ---
// ==================================================================
// GET /public/config/permissoes-home
// Rota aberta para a tela de login da gerência saber quais cards mostrar.
router.get('/config/permissoes-home', async (req, res) => {
    try {
        const [config] = await query("SELECT valor FROM configuracoes WHERE chave = 'permissoes_home'");
        // Se não houver configuração, retorna um array vazio por padrão
        const permissoes = config ? JSON.parse(config.valor) : [];
        res.json({ permissoes });
    } catch (error) {
        console.error("Erro ao buscar configuração pública de permissões:", error);
        // Em caso de erro, retorna um array vazio para segurança
        res.status(500).json({ permissoes: [] });
    }
});


module.exports = router;
