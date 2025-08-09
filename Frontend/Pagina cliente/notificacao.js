
/**
 * ==================================================================
 * MÓDULO DE NOTIFICAÇÕES GLOBAIS (usando SweetAlert2)
 * VERSÃO PARA A PÁGINA DO CLIENTE
 * ==================================================================
 * Centraliza a criação de notificações para o cliente, com estilo visual próprio.
 */

// Objeto global com métodos para exibir diferentes tipos de notificações no frontend do cliente
const Notificacao = {

    /**
     * Exibe uma notificação de SUCESSO no estilo "toast".
     * Ideal para feedbacks rápidos como "Item adicionado ao carrinho".
     * @param {string} titulo - A mensagem de sucesso a ser exibida.
     * Usa SweetAlert2 para mostrar um toast no topo da tela.
     */
    sucesso(titulo) {
        Swal.fire({
            icon: 'success',
            title: titulo,
            toast: true,
            position: 'top', // Posição no topo, mais visível em mobile
            showConfirmButton: false,
            timer: 2500, // Tempo um pouco menor para agilidade
            timerProgressBar: true,
            // Cores que combinam com a interface do cliente
            background: '#491313ff', // Um pop-up escuro para contraste
            color: '#ffffff',      // Texto branco
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
    },

    /**
     * Exibe uma notificação de ERRO em formato de modal.
     * @param {string} titulo - O título principal do erro.
     * @param {string} [texto=''] - Um texto adicional com mais detalhes.
     * Usa SweetAlert2 para mostrar um modal de erro.
     */
    erro(titulo, texto = '') {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: texto,
            // Cores que combinam com a interface do cliente
            confirmButtonColor: '#a13d3d', // Um tom de vermelho mais sóbrio
            background: '#fdfaf6',       // Fundo off-white, como o da página
            color: '#3d3d3d'             // Texto escuro para legibilidade
        });
    },

    /**
     * Exibe uma caixa de diálogo de CONFIRMAÇÃO.
     * @param {string} titulo - A pergunta principal (ex: 'Remover item?').
     * @param {string} texto - Um texto de aviso sobre a ação.
     * @returns {Promise<boolean>} - Retorna true se o usuário confirmar, false caso contrário.
     * Usa SweetAlert2 para mostrar um modal de confirmação.
     */
    async confirmar(titulo, texto) {
        const resultado = await Swal.fire({
            title: titulo,
            text: texto,
            icon: 'question', // Ícone de interrogação, mais amigável
            showCancelButton: true,
            confirmButtonText: 'Sim',
            cancelButtonText: 'Não',
            // Cores que combinam com a interface do cliente
            confirmButtonColor: '#3d7a42', // Verde para confirmar
            cancelButtonColor: '#a13d3d',  // Vermelho para cancelar
            background: '#fdfaf6',        // Fundo off-white
            color: '#3d3d3d'              // Texto escuro
        });
        return resultado.isConfirmed;
    }
};
