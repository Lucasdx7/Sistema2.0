// /backend/routes/suporte.js - VERSÃO FINAL COM APP SENHA

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// --- 1. Configuração do Transportador do Nodemailer ---
// Usa o método de login simples com a senha de aplicativo do .env
const transporter = nodemailer.createTransport({
    service: 'gmail', // Usa as configurações padrão do Gmail
    auth: {
        user: process.env.GMAIL_SENDER_EMAIL, // O e-mail que envia
        pass: process.env.GMAIL_APP_PASSWORD  // A senha de 16 letras
    }
});

// --- 2. Rota para Enviar o E-mail de Suporte ---
router.post('/enviar', async (req, res) => {
    const { nome, telefone, problema } = req.body;

    if (!nome || !telefone || !problema) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    // Define os detalhes do e-mail a ser enviado
    const mailOptions = {
        from: `"Sistema Skina 67" <${process.env.GMAIL_SENDER_EMAIL}>`,
        to: process.env.SUPPORT_RECEIVER_EMAIL, // O e-mail que recebe
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

    try {
        // Envia o e-mail
        await transporter.sendMail(mailOptions);
        console.log("E-mail de suporte enviado com sucesso!");
        res.status(200).json({ message: 'Chamado enviado com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar e-mail com SMTP:', error);
        res.status(500).json({ message: 'Erro interno ao tentar enviar o e-mail.' });
    }
});

module.exports = router;
