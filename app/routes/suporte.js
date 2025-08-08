const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
// 1. Importe sua função de consulta ao banco de dados.
//    Ajuste o caminho ('../../db') se a estrutura do seu projeto for diferente.
const { query } = require('../configurar/db');

// --- Função Auxiliar para buscar as configurações do Banco de Dados ---
// Esta função centraliza a lógica de acesso ao DB.
async function getEmailConfig() {
    // Supondo que suas configurações estão na tabela 'configuracoes' na linha com id = 1
    const sql = "SELECT email_remetente, senha_app, email_destino FROM configuracoes WHERE chave = 'config_email_suporte'";

    try {
        const results = await query(sql);
        
        // Se a consulta não retornar nenhuma linha, é um erro crítico.
        if (results.length === 0) {
            throw new Error('Configurações de e-mail não encontradas no banco de dados.');
        }
        
        // A consulta retorna um array de linhas. Pegamos apenas a primeira.
        return results[0]; 
    } catch (error) {
        // Loga o erro no console do servidor para depuração.
        console.error("ERRO GRAVE: Falha ao buscar configurações de e-mail do banco de dados.", error);
        // Propaga o erro para que a rota principal possa lidar com ele.
        throw error;
    }
}

// --- Rota para Enviar o E-mail de Suporte ---
router.post('/enviar', async (req, res) => {
    const { nome, telefone, problema } = req.body;

    if (!nome || !telefone || !problema) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    try {
        // 2. Busca as configurações do banco de dados ANTES de qualquer outra coisa.
        const config = await getEmailConfig();

        // Validação importante: verifica se os dados vieram corretamente do banco.
        if (!config.email_remetente || !config.senha_app || !config.email_destino) {
            console.error("Configurações de e-mail incompletas no banco de dados.");
            return res.status(500).json({ message: 'Erro interno do servidor: Configuração de e-mail inválida.' });
        }

        // 3. Cria o transportador do Nodemailer com as credenciais do banco.
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.email_remetente, // Usa o e-mail do banco
                pass: config.senha_app       // Usa a senha de app do banco
            }
        });

        // 4. Monta o e-mail usando os dados do formulário e as configs do banco.
       // ... dentro da sua rota router.post('/enviar', ...)

const mailOptions = {
    from: `"Sistema Skina 67" <${config.email_remetente}>`,
    to: config.email_destino,
    subject: `Novo Chamado de Suporte: ${nome}`,
    html: `
        <h1>Novo Chamado de Suporte Técnico</h1>
        <p>Um novo chamado foi aberto através do painel de gerenciamento.</p>
        <hr>
        <h2>Detalhes do Solicitante:</h2>
        <ul>
            <li><strong>Nome:</strong> ${nome}</li>
            <li><strong>Telefone para Contato:</strong> ${telefone}</li>
        </ul>
        <h2>Descrição do Problema:</h2>
        <p style="background-color:#f4f4f4; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
            ${problema.replace(/\n/g, '<br>')}
        </p>
        <hr>
        <p><em>E-mail enviado automaticamente pelo sistema.</em></p>
    `
};


        // 5. Envia o e-mail.
        await transporter.sendMail(mailOptions);
        console.log("E-mail de suporte enviado com sucesso!");
        res.status(200).json({ message: 'Chamado enviado com sucesso!' });

    } catch (error) {
        // Captura qualquer erro, seja do banco de dados ou do envio de e-mail.
        console.error('Erro no processo de envio de suporte:', error);
        res.status(500).json({ message: 'Erro interno ao processar a solicitação.' });
    }
});

module.exports = router;
