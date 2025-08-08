
# Sistema de Gestão de Cardápio e Pedidos

![Status do Projeto](https://img.shields.io/badge/status-estável-brightgreen) ![Progresso](https://img.shields.io/badge/progresso-95%25-blue) ![Tecnologia](https://img.shields.io/badge/backend-Node.js%20%26%20Express-green) ![Tecnologia](https://img.shields.io/badge/frontend-HTML,%20CSS,%20JS-blue) ![Banco de Dados](https://img.shields.io/badge/database-MySQL-blueviolet)

Sistema de gerenciamento completo para restaurantes, com foco em segurança, usabilidade e atualizações em tempo real. A plataforma permite que a gerência administre o cardápio e mesas, enquanto os clientes realizam seus pedidos diretamente por um tablet. Inclui um painel de desenvolvedor para monitoramento e administração avançada do sistema.

## 📋 Visão Geral do Projeto

O objetivo deste sistema é modernizar a experiência do cliente e otimizar a gestão do restaurante. Ele é dividido em três interfaces principais:

1.  **Painel de Gerenciamento:** Uma área administrativa segura onde a equipe gerencial pode administrar o cardápio, mesas, chamados de garçom, acompanhar o histórico de sessões e gerar relatórios de vendas.
2.  **Interface do Cliente (Tablet):** Um sistema completo que guia o cliente desde o login da mesa, passando pela visualização do cardápio, montagem do pedido, até o fechamento da conta com a assistência de um funcionário.
3.  **Painel do Desenvolvedor:** Uma interface de superusuário para monitoramento em tempo real de todas as sessões ativas, gerenciamento de usuários e controle administrativo de baixo nível sobre o sistema.

O sistema utiliza WebSockets para garantir que qualquer alteração feita pela gerência ou evento no sistema seja refletida **em tempo real** em todas as telas conectadas, sem a necessidade de recarregar a página.

---

## 🚀 Status Atual (Progresso: 95%)

O projeto está em uma fase madura e estável, com o fluxo completo de interação do cliente e as principais funcionalidades de gerenciamento e desenvolvimento implementadas, testadas e refatoradas para máxima organização e manutenibilidade.

### Funcionalidades Concluídas:
-   [x] **Backend Modular e Escalável:**
    -   [x] Estrutura do servidor com Node.js e Express.
    -   [x] **API Refatorada:** A API foi completamente reestruturada, saindo de um modelo monolítico para uma arquitetura modular baseada em rotas (`categorias`, `produtos`, `mesas`, `pedidos`, etc.).
-   [x] **Banco de Dados:** Schema robusto com tabelas para `usuarios`, `mesas`, `sessoes_cliente`, `pedidos`, `categorias`, `produtos`, `chamados`, `logs` e `configuracoes`.
-   [x] **API Segura e Middleware Inteligente:**
    -   [x] Endpoints protegidos que exigem autenticação JWT.
    -   [x] Middleware de autenticação (`authMiddleware`) capaz de diferenciar tokens de **Gerência**, **Mesa** e **Desenvolvedor**.
    -   [x] Middleware de permissão (`checarNivelAcesso`) para controle granular de acesso.
-   [x] **Sistema de Autenticação Robusto:**
    -   [x] Telas de login separadas e seguras para **Gerência**, **Mesas** e **Desenvolvedor**.
    -   [x] **Login do Desenvolvedor via Banco de Dados:** O acesso do superusuário foi migrado do `.env` para o banco de dados, com senha criptografada (`bcryptjs`), aumentando drasticamente a segurança.
-   [x] **Painel de Gerenciamento (CRUD Completo):**
    -   [x] **Gestão de Cardápio:** Adicionar, editar, remover e controlar status de categorias e produtos.
    -   [x] **Gestão de Mesas:**
        -   [x] Cadastrar e remover mesas.
        -   [x] Painel interativo para visualizar o histórico de sessões de cada mesa.
        -   [x] **Finalização de Sessão Direta:** Gerentes podem finalizar sessões ativas diretamente do painel, selecionando a forma de pagamento.
-   [x] **Painel do Desenvolvedor (Superusuário):**
    -   [x] **Monitoramento de Sessões Ativas:** Visualização em tempo real de todas as conexões WebSocket (clientes, gerentes, dev), incluindo IP, página atual e tempo de conexão.
    -   [x] **Gerenciamento de Conexões:**
        -   [x] Desconectar remotamente qualquer cliente do WebSocket.
        -   [x] **Forçar Fechamento de Conta:** Finalizar qualquer sessão de cliente diretamente do painel, com registro de log e atualização em tempo real para todas as interfaces.
    -   [x] **Gerenciamento de Usuários:** Visualizar todos os usuários do sistema e alterar suas senhas.
-   [x] **Dashboard de Relatórios Avançados:**
    -   [x] **Visualização por Período:** Filtros dinâmicos para analisar vendas.
    -   [x] **KPIs Abrangentes:** Métricas chave como Vendas Totais, Ticket Médio e Produto Mais Vendido.
    -   [x] **Gráficos Inteligentes** com Chart.js.
-   [x] **Interface do Cliente (Ciclo Completo e Inteligente):**
    -   [x] Login da Mesa e Coleta de Dados do Cliente.
    -   [x] Teclado Virtual Customizado integrado.
    -   [x] Cardápio Dinâmico com regras de negócio.
    -   [x] **Identificação de Conexão:** O cliente agora se identifica corretamente no WebSocket, eliminando conexões "desconhecidas".
-   [x] **Comunicação em Tempo Real (WebSockets):**
    -   [x] Sistema de broadcast aprimorado para notificar diferentes tipos de clientes sobre eventos específicos (`SESSAO_ATUALIZADA`, `FORCE_DISCONNECT`, etc.).

---

## 🛠️ Tecnologias Utilizadas

*   **Backend:** Node.js, Express.js, MySQL2, jsonwebtoken, bcryptjs, ws, dotenv, nodemailer.
*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla), Chart.js, Font Awesome, SweetAlert2.
*   **Banco de Dados:** MySQL.

---

## 📂 Estrutura de Pastas

A estrutura do projeto foi organizada para separar claramente as responsabilidades do Backend e do Frontend.

```
.
├── Backend/
│   ├── configurar/
│   │   └── db.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── node_modules/
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── ... (outras rotas modulares)
│   │   └── dev.routes.js
│   ├── .env
│   ├── package.json
│   └── server.js
└── Frontend/
    ├── Img/
    ├── Pagina cliente/
    │   ├── cliente-comum.js  # Script de WebSocket compartilhado
    │   ├── ... (HTML, CSS, JS das páginas do cliente)
    ├── Pagina gerencia/
    │   └── ... (HTML, CSS, JS das páginas de gerência)
    └── Pagina_dev/
        ├── dev.html
        ├── dev.css
        └── Devlogin.html
```

---

## ⚙️ Como Executar o Projeto Localmente

### Pré-requisitos:
*   [Node.js](https://nodejs.org/) instalado.
*   Servidor [MySQL](https://www.mysql.com/) rodando.

### 1. Clonar o Repositório
```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd <nome_da_pasta_do_seu_projeto>
```

### 2. Configuração do Banco de Dados
-   Crie um banco de dados no seu MySQL com o nome `cardapio_db`.
-   Execute o script SQL abaixo para criar todas as tabelas e o usuário "dono" inicial.

```sql
-- Criação do Banco de Dados
CREATE DATABASE IF NOT EXISTS cardapio_db;
USE cardapio_db;

-- Tabela de Usuários (Gerência e Desenvolvedor)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    usuario VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    nivel_acesso ENUM('geral', 'pedidos', 'dono') NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Mesas
CREATE TABLE IF NOT EXISTS mesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_usuario VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Sessões de Cliente
CREATE TABLE IF NOT EXISTS sessoes_cliente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_mesa INT NOT NULL,
    nome_cliente VARCHAR(255) NOT NULL,
    status ENUM('ativa', 'finalizada', 'cancelada') DEFAULT 'ativa',
    forma_pagamento VARCHAR(50) NULL,
    data_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_fim TIMESTAMP NULL,
    finalizado_por_id INT NULL,
    FOREIGN KEY (id_mesa) REFERENCES mesas(id) ON DELETE CASCADE,
    FOREIGN KEY (finalizado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Inserção do usuário DONO (senha: 'admin')
INSERT INTO usuarios (nome, usuario, email, senha, nivel_acesso)
VALUES ('Admin Dono', 'dono', 'dono@exemplo.com', '$2a$10$G.R3grgSgYm1N2j1b.e15.Kj50a/Z5v5QeB5z2O2b.e15.Kj50a/Z', 'dono');
```

### 3. Variáveis de Ambiente
-   Crie um arquivo `.env` na pasta `Backend`.
-   Defina as seguintes variáveis:

    ```env
    # Configurações do Banco de Dados
    DB_HOST=localhost
    DB_USER=seu_usuario_mysql
    DB_PASSWORD=sua_senha_mysql
    DB_NAME=cardapio_db

    # Chave de Segurança do Sistema
    JWT_SECRET=sua_chave_secreta_para_jwt_aqui
    ```

### 4. Instalação e Execução
-   Navegue até a pasta `Backend`: `cd Backend`
-   Instale as dependências: `npm install`
-   Inicie o servidor: `node server.js`

### 5. Acessando o Sistema
-   **Painel de Gerenciamento:** `http://localhost:3000/login-gerencia`
-   **Painel do Desenvolvedor:** `http://localhost:3000/dev-login`
    -   **Usuário:** `dono`
    -   **Senha:** `admin`
-   **Interface do Cliente:** `http://localhost:3000/login`

---

## 👨‍💻 Autor

Feito com ❤️ por **Lucas Felipe**.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white )](https://www.linkedin.com/in/lucas-felipe-pereira-amorim-2773092a7/ )
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white )](https://github.com/Lucasdx7 )
