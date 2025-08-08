// /app/server.js

// --- 1. Módulos Necessários ---
console.log('[SYSTEM] Iniciando o carregamento dos módulos...');
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http' );
const { WebSocketServer } = require('ws');
const url = require('url');
require('dotenv').config(); // Carrega variáveis de ambiente do .env

// --- 2. Configuração do Express e Servidor HTTP ---
const app = express();
const server = http.createServer(app ); // Cria o servidor HTTP usando o app Express
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Permite que o servidor seja acessado de outros dispositivos na mesma rede

// --- 3. Configuração do Servidor WebSocket (WSS) ---
const wss = new WebSocketServer({ server }); // Anexa o WebSocket ao servidor HTTP

const activeClients = new Map();
let nextClientId = 1;

const disconnectClientById = (clientIdToDisconnect) => {
    for (const [client, info] of activeClients.entries()) {
        if (info.id === clientIdToDisconnect) {
            // Prepara uma mensagem específica para o cliente
            const disconnectMessage = JSON.stringify({
                type: 'FORCE_DISCONNECT',
                payload: {
                    reason: 'Sessão encerrada pelo administrador.',
                    clientType: info.clientType // Informa o tipo para o cliente agir de acordo
                }
            });

            // 1. Envia o comando de desconexão para o cliente
            if (client.readyState === client.OPEN) {
                client.send(disconnectMessage);
            }

            // 2. Fecha a conexão do lado do servidor logo em seguida
            // O timeout dá uma pequena chance para a mensagem ser entregue antes do fechamento
            setTimeout(() => {
                client.close(1000, 'Desconectado pelo administrador');
            }, 100);
            
            console.log(`[WSS] Comando de desconexão enviado para a sessão ${clientIdToDisconnect}.`);
            return true;
        }
    }
    return false;
};

// Disponibiliza a nova função para as rotas
app.set('disconnectClientById', disconnectClientById);

const broadcastActiveSessions = () => {
    const sessions = Array.from(activeClients.values());
    const message = JSON.stringify({ type: 'SESSIONS_UPDATE', payload: sessions });
    for (const [client, info] of activeClients.entries()) {
        if (info.clientType === 'dev' && client.readyState === client.OPEN) {
            client.send(message);
        }
    }
};

// Disponibiliza funções importantes para as rotas da API
app.set('disconnectClientById', disconnectClientById);
app.set('broadcast', (data) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) client.send(message);
    });
});

// --- 4. Lógica de Conexão do WebSocket ---
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    const parameters = url.parse(req.url, true).query;
    const clientType = parameters.clientType || 'desconhecido';
    const page = parameters.page || 'desconhecida';
    
    // ATUALIZADO: Captura o ID da sessão do cliente ou o ID do usuário da gerência
    const sessionId = parameters.sessaoId || parameters.userId || null; 
    
    const clientId = nextClientId++;

    console.log(`[WSS] Cliente conectado: ID ${clientId}, Tipo: ${clientType}, Página: ${page}, IP: ${ip}`);

    // Armazena o ID da sessão/usuário
    activeClients.set(ws, {
        id: clientId,
        clientType: clientType,
        userId: sessionId, // Usamos um campo genérico para armazenar o ID
        page: page,
        ip: ip,
        connectedAt: new Date().toISOString()
    });

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

// --- 5. Middlewares Globais do Express ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    req.broadcast = app.get('broadcast');
    next();
});

// --- 6. Servindo Arquivos Estáticos (Frontend) ---
const frontendPath = path.join(__dirname, '..', 'Frontend');
console.log(`[STATIC] Servindo arquivos estáticos da pasta: ${frontendPath}`);

// Mapeamentos eficientes para servir todas as subpastas do Frontend.
// ISTO SUBSTITUI TODAS AS ROTAS MANUAIS PARA ARQUIVOS .JS, .CSS e IMAGENS.
app.use(express.static(frontendPath));
app.use('/cliente', express.static(path.join(frontendPath, 'Pagina cliente')));
app.use('/gerencia', express.static(path.join(frontendPath, 'Pagina gerencia')));
app.use('/dev', express.static(path.join(frontendPath, 'Pagina_dev')));
app.use('/img', express.static(path.join(frontendPath, 'Img')));

// --- 7. Importação e Vinculação das Rotas da API ---
console.log('[ROUTES] Vinculando as rotas da API...');
const { protegerRota } = require('./middleware/authMiddleware');

// Importe TODAS as suas rotas aqui
const authRoutes = require('./routes/auth.js');
const publicRoutes = require('./routes/public.js');
const categoriasRoutes = require('./routes/categorias.routes.js');
const produtosRoutes = require('./routes/produtos.routes.js');
const mesasRoutes = require('./routes/mesas.routes.js');
const pedidosRoutes = require('./routes/pedidos.routes.js');
const relatoriosRoutes = require('./routes/relatorios.routes.js');
const configuracoesRoutes = require('./routes/configuracoes.routes.js');
const chamadosRoutes = require('./routes/chamados.routes.js');
const suporteRoutes = require('./routes/suporte.js');
const devRoutes = require('./routes/dev_routes.js');

// Rotas públicas (não exigem token)
app.use('/auth', authRoutes);
app.use('/api/public', publicRoutes);

// Rotas protegidas (exigem token JWT válido)
app.use('/api/categorias', protegerRota, categoriasRoutes);
app.use('/api/produtos', protegerRota, produtosRoutes);
app.use('/api/mesas', protegerRota, mesasRoutes);
app.use('/api/pedidos', protegerRota, pedidosRoutes);
app.use('/api/relatorios', protegerRota, relatoriosRoutes);
app.use('/api/configuracoes', protegerRota, configuracoesRoutes);
app.use('/api/suporte', protegerRota, suporteRoutes);
app.use('/api/dev', protegerRota, devRoutes);
app.use('/api/chamados', protegerRota, chamadosRoutes);

// --- 8. Rotas para Servir Arquivos HTML Principais ---
console.log('[ROUTES] Configurando rotas para servir páginas HTML...');
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina cliente', 'login_cliente.html')));
app.get('/cardapio', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina cliente', 'Paginausuario.html')));
app.get('/conta', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina cliente', 'conta_cliente.html')));
app.get('/confirmar-pedido', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina cliente', 'confirmar_pedido.html')));
app.get('/dados-cliente', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina cliente', 'dados_cliente.html')));
app.get('/sobre', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina cliente', 'sobre.html')));

app.get('/login-gerencia', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'login.html')));
app.get('/gerencia-home', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'Gerencia-Home.html')));
app.get('/gerencia', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'Gerencia.html')));
app.get('/gerencia-mesas', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'gerencia_mesas.html')));
app.get('/logs', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'logs.html')));
app.get('/chamados', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'chamado.html')));
app.get('/relatorios', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'relatorio.html')));
app.get('/acompanhar', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'pedidos.html')));
app.get('/configuracoes', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'configuracoes.html')));
app.get('/suporte', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina gerencia', 'suporte.html')));

app.get('/dev-login', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina_dev', 'Devlogin.html')));
app.get('/dev-painel', (req, res) => res.sendFile(path.join(frontendPath, 'Pagina_dev', 'dev.html')));




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
// --- 9. Inicialização do Servidor ---
server.listen(PORT, HOST, () => {
    console.log('\n================================================');
    console.log('✅ SERVIDOR INICIADO COM SUCESSO!');
    console.log(`🚀 Ouvindo em http://localhost:${PORT}` );
    console.log(`🔌 Acesso na rede local disponível em http://localhost:${PORT}` );
    console.log('================================================\n');
});
