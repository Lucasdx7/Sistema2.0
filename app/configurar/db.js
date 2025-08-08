// /Backend/db.js - VERSÃO CORRIGIDA

const mysql = require('mysql2/promise');

// Configuração do Pool de Conexões: mais eficiente e robusto.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,       // Limite máximo de conexões no pool
    queueLimit: 0,
    
    // --- LINHA ADICIONADA PARA CORRIGIR O ERRO ---
    // Envia um "ping" para o banco a cada 10 segundos para manter a conexão ativa.
    // Isso previne o erro 'ER_MALFORMED_PACKET' causado por conexões ociosas.
    keepAliveInitialDelay: 10000 
});

/**
 * Executa uma consulta SQL de forma segura e eficiente usando o pool de conexões.
 * @param {string} sql - A string da consulta SQL com placeholders (?).
 * @param {Array} params - Um array de parâmetros para substituir os placeholders.
 * @returns {Promise<Array>} - Uma promessa que resolve para um array de resultados.
 */
async function query(sql, params) {
    // Usar pool.execute é uma boa prática para prepared statements.
    const [results, ] = await pool.execute(sql, params);
    return results;
}

/**
 * Registra uma ação no log do sistema.
 * @param {number} idUsuario - O ID do usuário que realizou a ação.
 * @param {string} nomeUsuario - O nome do usuário.
 * @param {string} acao - Um código para a ação (ex: 'CRIOU_PRODUTO').
 * @param {string} detalhes - Uma descrição da ação.
 */
async function registrarLog(idUsuario, nomeUsuario, acao, detalhes) {
    const sql = 'INSERT INTO logs (id_usuario, nome_usuario, acao, detalhes) VALUES (?, ?, ?, ?)';
    try {
        // Reutiliza a função query que já criamos.
        await query(sql, [idUsuario, nomeUsuario, acao, detalhes]);
    } catch (error) {
        // Loga o erro no console, mas não impede a aplicação de continuar.
        console.error('Falha ao registrar log:', error);
    }
}

// Exporta as funções para serem usadas em outros arquivos do projeto.
module.exports = { query, registrarLog };
