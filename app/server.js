// ===================================================================
// --- 1. IMPORTAÇÃO DE MÓDULOS ---
// ===================================================================
console.log('[SYSTEM] Iniciando o carregamento dos módulos...');
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http' );
const { WebSocketServer, WebSocket } = require('ws'); // Importa WebSocket para verificação de estado
const url = require('url');
const { performance } = require('perf_hooks'); // Para medição de performance da API
require('dotenv').config(); // Carrega variáveis de ambiente do .env

// ===================================================================
// --- 2. CONFIGURAÇÃO DO SERVIDOR E EXPRESS ---
// ===================================================================
const app = express();
const server = http.createServer(app );
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Permite acesso na rede local

// /app/server.js

// ===================================================================
// --- 3. CONFIGURAÇÃO DO WEBSOCKET SERVER (WSS) ---
// ===================================================================
const wss = new WebSocketServer({ server });
const activeClients = new Map();
let nextClientId = 1;

// Função para enviar a lista atualizada de sessões para os painéis DEV e Gerência.
const broadcastActiveSessions = () => {
    const sessions = Array.from(activeClients.values());
    const message = JSON.stringify({ type: 'SESSIONS_UPDATE', payload: sessions });

    for (const [client, info] of activeClients.entries()) {
        if ((info.clientType === 'dev' || info.clientType === 'gerencia') && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
};

// ****** AQUI ESTÁ A SEGUNDA FUNÇÃO QUE FALTAVA ******
// Função para enviar uma mensagem para TODOS os clientes conectados.
const broadcast = (data) => {
    const message = JSON.stringify(data);
    // Itera sobre todos os clientes do WebSocketServer e envia a mensagem.
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};
// ... o resto do seu código, como app.set('broadcast', ...), etc., continua aqui.


// Função para transmitir dados apenas para clientes do tipo 'dev'
const broadcastToDevClients = (data) => {
    const message = JSON.stringify(data);
    // Itera sobre o nosso Map de clientes ativos
    for (const [client, info] of activeClients.entries()) {
        // Verifica se o cliente é do tipo 'dev' e se a conexão está aberta
        if (info.clientType === 'dev' && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
};

const disconnectClientById = (clientIdToDisconnect) => {
    for (const [client, info] of activeClients.entries()) {
        // Converte para número para garantir a comparação correta
        if (info.id === Number(clientIdToDisconnect)) {
            const disconnectMessage = JSON.stringify({
                type: 'FORCE_DISCONNECT',
                payload: { reason: 'Sua sessão foi encerrada por um administrador.' }
            });

            if (client.readyState === WebSocket.OPEN) {
                client.send(disconnectMessage);
            }

            setTimeout(() => {
                client.close(1000, 'Desconectado pelo administrador');
            }, 100);
            
            console.log(`[WSS] Comando de desconexão enviado para a sessão ${clientIdToDisconnect}.`);
            return true;
        }
    }
    console.log(`[WSS] Tentativa de desconectar a sessão ${clientIdToDisconnect}, mas não foi encontrada.`);
    return false;
};

// Disponibiliza funções globais para as rotas da API
app.set('broadcast', broadcast);
app.set('broadcastToDevClients', broadcastToDevClients);
app.set('disconnectClientById', disconnectClientById);

// ===================================================================
// --- 4. CAPTURA DE LOGS E ANÁLISE DE PERFORMANCE (NOVAS FEATURES) ---
// ===================================================================

// Intercepta console.log/warn/error para enviar ao painel DEV
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
    originalLog.apply(console, args);
    broadcastToDevClients({ type: 'SERVER_LOG', level: 'INFO', message: args.join(' ') });
};
console.warn = (...args) => {
    originalWarn.apply(console, args);
    broadcastToDevClients({ type: 'SERVER_LOG', level: 'WARN', message: args.join(' ') });
};
console.error = (...args) => {
    originalError.apply(console, args);
    broadcastToDevClients({ type: 'SERVER_LOG', level: 'ERROR', message: args.join(' ') });
};

// Middleware de Análise de Performance (deve vir ANTES das rotas)
app.use((req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
        // Não monitorar as próprias rotas do painel DEV para evitar ruído
        if (req.originalUrl.startsWith('/api/dev')) return;

        const duration = performance.now() - start;
        broadcastToDevClients({
            type: 'API_PERFORMANCE',
            payload: {
                method: req.method,
                endpoint: req.originalUrl.split('?')[0], // Remove query params
                statusCode: res.statusCode,
                duration: parseFloat(duration.toFixed(2))
            }
        });
    });
    next();
});

// ===================================================================
// --- 5. MIDDLEWARES GLOBAIS DO EXPRESS ---
// ===================================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logar requisições HTTP e injetar a função de broadcast
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    req.broadcast = app.get('broadcast');
    next();
});

// ===================================================================
// --- 6. SERVINDO ARQUIVOS ESTÁTICOS (FRONTEND) ---
// ===================================================================
const frontendPath = path.join(__dirname, '..', 'Frontend');
console.log(`[STATIC] Servindo arquivos estáticos da pasta: ${frontendPath}`);
// Esta única linha substitui TODAS as rotas manuais para .js, .css, .svg, etc.
app.use(express.static(frontendPath));

// ===================================================================
// --- 7. VINCULAÇÃO DAS ROTAS DA API ---
// ===================================================================
console.log('[ROUTES] Vinculando as rotas da API...');
const { protegerRota } = require('./middleware/authMiddleware');

// Importação das rotas
const authRoutes = require('./routes/auth.js');
const publicRoutes = require('./routes/public.js');
const devRoutes = require('./routes/dev_routes.js');
// ... (demais rotas)
const categoriasRoutes = require('./routes/categorias.routes.js');
const produtosRoutes = require('./routes/produtos.routes.js');
const mesasRoutes = require('./routes/mesas.routes.js');
const pedidosRoutes = require('./routes/pedidos.routes.js');
const relatoriosRoutes = require('./routes/relatorios.routes.js');
const configuracoesRoutes = require('./routes/configuracoes.routes.js');
const chamadosRoutes = require('./routes/chamados.routes.js');
const suporteRoutes = require('./routes/suporte.js');

// Vinculação das rotas
app.use('/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dev', protegerRota, devRoutes);
// ... (demais rotas protegidas)
app.use('/api/categorias', protegerRota, categoriasRoutes);
app.use('/api/produtos', protegerRota, produtosRoutes);
app.use('/api/mesas', protegerRota, mesasRoutes);
app.use('/api/pedidos', protegerRota, pedidosRoutes);
app.use('/api/relatorios', protegerRota, relatoriosRoutes);
app.use('/api/configuracoes', protegerRota, configuracoesRoutes);
app.use('/api/suporte', protegerRota, suporteRoutes);
app.use('/api/chamados', protegerRota, chamadosRoutes);

// ===================================================================
// --- 8. ROTAS PARA SERVIR PÁGINAS HTML ---
// ===================================================================
console.log('[ROUTES] Configurando rotas para servir páginas HTML...');

// Função auxiliar para simplificar o envio de arquivos HTML
const sendHtml = (res, ...paths) => {
    // A variável 'frontendPath' deve ser definida na seção 6 do seu server.js
    // Ex: const frontendPath = path.join(__dirname, '..', 'Frontend');
    return res.sendFile(path.join(frontendPath, ...paths));
};

// --- Rota Principal e de Redirecionamento ---
app.get('/', (req, res) => res.redirect('/login'));

// --- Páginas da Área do Cliente ---
app.get('/login', (req, res) => sendHtml(res, 'Pagina cliente', 'login_cliente.html'));
app.get('/cardapio', (req, res) => sendHtml(res, 'Pagina cliente', 'Paginausuario.html'));
app.get('/conta', (req, res) => sendHtml(res, 'Pagina cliente', 'conta_cliente.html'));
app.get('/confirmar-pedido', (req, res) => sendHtml(res, 'Pagina cliente', 'confirmar_pedido.html'));
app.get('/dados-cliente', (req, res) => sendHtml(res, 'Pagina cliente', 'dados_cliente.html'));
app.get('/sobre', (req, res) => sendHtml(res, 'Pagina cliente', 'sobre.html'));

// --- Páginas da Área de Gerência ---
app.get('/login-gerencia', (req, res) => sendHtml(res, 'Pagina gerencia', 'login.html'));
app.get('/gerencia-home', (req, res) => sendHtml(res, 'Pagina gerencia', 'Gerencia-Home.html'));
app.get('/gerencia', (req, res) => sendHtml(res, 'Pagina gerencia', 'Gerencia.html'));
app.get('/gerencia-mesas', (req, res) => sendHtml(res, 'Pagina gerencia', 'gerencia_mesas.html'));
app.get('/acompanhar', (req, res) => sendHtml(res, 'Pagina gerencia', 'pedidos.html'));
app.get('/chamados', (req, res) => sendHtml(res, 'Pagina gerencia', 'chamado.html'));
app.get('/relatorios', (req, res) => sendHtml(res, 'Pagina gerencia', 'relatorio.html'));
app.get('/configuracoes', (req, res) => sendHtml(res, 'Pagina gerencia', 'configuracoes.html'));
app.get('/logs', (req, res) => sendHtml(res, 'Pagina gerencia', 'logs.html'));
app.get('/suporte', (req, res) => sendHtml(res, 'Pagina gerencia', 'suporte.html'));

// --- Páginas da Área do Desenvolvedor ---
app.get('/dev-login', (req, res) => sendHtml(res, 'Pagina_dev', 'Devlogin.html'));
app.get('/dev-painel', (req, res) => sendHtml(res, 'Pagina_dev', 'dev.html'));



// ===================================================================
//  ROTAS MANUAIS PARA ARQUIVOS CSS E JS DA PASTA "Pagina cliente"
// ===================================================================

// --- Arquivo CSS ---

app.get('/Usuario.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'Usuario.css'));
});


// --- Arquivos JavaScript ---

app.get('/confirmar_pedido.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'confirmar_pedido.js'));
});

app.get('/conta_cliente.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'conta_cliente.js'));
});

app.get('/dados_cliente.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'dados_cliente.js'));
});

app.get('/login_cliente.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'login_cliente.js'));
});

app.get('/notificacao.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'notificacao.js'));
});

app.get('/sobre.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'sobre.js'));
});

app.get('/Usuario.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'Usuario.js'));
});




// ===================================================================
//  ROTAS MANUAIS PARA ARQUIVOS CSS E JS DA PASTA "Pagina gerencia"
// ===================================================================

// --- Arquivos CSS ---

app.get('/adm.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'adm.css'));
});

app.get('/login.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'login.css'));
});

app.get('/pedidos.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'pedidos.css'));
});


// --- Arquivos JavaScript ---

app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'app.js'));
});

app.get('/chamados.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'chamados.js'));
});

app.get('/configuracoes.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'configuracoes.js'));
});

app.get('/gerencia_mesas.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'gerencia_mesas.js'));
});

app.get('/gerencia-home.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'gerencia-home.js'));
});

app.get('/login.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'login.js'));
});

app.get('/logs.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'logs.js'));
});

app.get('/cliente-comum.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina cliente', 'cliente-comum.js'));
});

app.get('/notificacoes.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'notificacoes.js'));
});

app.get('/pedidos.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'pedidos.js'));
});

app.get('/relatorios.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'relatorios.js'));
});

app.get('/suporte.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'suporte.js'));
});

app.get('/images1.svg', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Img', 'images1.svg'));
});

app.get('/Dono.svg', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Img', 'Dono.svg'));
});

app.get('/Chefe.svg', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Img', 'Chefe.svg'));
});

app.get('/dev.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina_dev', 'dev.css'));
});

app.get('/dev.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina_dev', 'dev.js'));
});

app.get('/gerencia-core.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Frontend', 'Pagina gerencia', 'gerencia-core.js'));
});

// ===================================================================
// --- 9. LÓGICA DE CONEXÃO WEBSOCKET (VERSÃO COM BLOQUEIO DE DUPLICADOS) ---
// ===================================================================
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    const parameters = url.parse(req.url, true).query;

    const clientType = parameters.clientType || 'desconhecido';
    const page = parameters.page || 'desconhecida';
    const userId = parameters.sessaoId || parameters.userId || null;

    // --- INÍCIO DO BLOCO DE PREVENÇÃO DE DUPLICIDADE ---
    // Se o cliente está tentando se conectar com um ID de sessão/usuário...
    if (userId) {
        // Procura na lista de clientes ativos se algum já tem este ID.
        for (const [client, info] of activeClients.entries()) {
            if (info.userId === userId) {
                console.warn(`[WSS] Conexão duplicada detectada para o ID: ${userId}. Fechando a conexão ANTIGA.`);
                
                // Envia um comando para a conexão antiga se desconectar e fecha ela.
                
                
                // Remove a conexão antiga do Map para dar lugar à nova.
                activeClients.delete(client);
                break; // Para o loop assim que encontrar a duplicata.
            }
        }
    }
    // --- FIM DO BLOCO DE PREVENÇÃO DE DUPLICIDADE ---

    const clientId = nextClientId++;

    console.log(`[WSS] Cliente conectado: ID ${clientId}, Tipo: ${clientType}, Página: ${page}, ID Sessão/Usuário: ${userId}, IP: ${ip}`);

    const clientInfo = {
        id: clientId,
        clientType: clientType,
        page: page,
        userId: userId,
        ip: ip,
        connectedAt: new Date().toISOString()
    };
    activeClients.set(ws, clientInfo);

    broadcastActiveSessions();

    ws.on('close', () => {
        console.log(`[WSS] Cliente desconectado: ID ${clientId}`);
        activeClients.delete(ws);
        broadcastActiveSessions();
    });

    ws.on('error', (error) => {
        console.error(`[WSS] Erro na conexão do cliente ${clientId}:`, error);
        activeClients.delete(ws);
        broadcastActiveSessions();
    });
});

// ===================================================================
// --- 10. INICIALIZAÇÃO DO SERVIDOR ---
// ===================================================================
server.listen(PORT, HOST, () => {
    console.log('\n================================================');
    console.log('✅ SERVIDOR INICIADO COM SUCESSO!');
    console.log(`🚀 Ouvindo em http://localhost:${PORT}` );
    console.log(`🔌 Acesso na rede local disponível em http://${HOST}:${PORT}` );
    console.log('================================================\n');
});
