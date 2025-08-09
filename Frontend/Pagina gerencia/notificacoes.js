
/**
 * ==================================================================
 * MÓDULO DE NOTIFICAÇÕES GLOBAIS (usando SweetAlert2)
 * ==================================================================
 * Este arquivo centraliza a criação de notificações para todo o sistema,
 * garantindo um visual consistente e facilitando a manutenção.
 * Fornece funções utilitárias para exibir mensagens de sucesso, erro, confirmação, carregamento e ações de risco.
 */

// Objeto global com métodos para exibir diferentes tipos de notificações no sistema
const Notificacao = {

    /**
     * Exibe uma notificação de SUCESSO no estilo "toast" (canto da tela).
     * Ideal para feedbacks rápidos que não exigem interação.
     * @param {string} titulo - A mensagem de sucesso a ser exibida.
     * Usa SweetAlert2 para mostrar um toast no topo da tela.
     */
    sucesso(titulo) {
        Swal.fire({
            icon: 'success',
            title: titulo,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#3f4f6bff',
            color: '#ecf0f1',
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
    },

    /**
     * Exibe uma notificação de ERRO em formato de modal (centralizado).
     * Ideal para erros que o usuário precisa ver e confirmar.
     * @param {string} titulo - O título principal do erro (ex: 'Operação Falhou').
     * @param {string} [texto=''] - Um texto adicional com mais detalhes sobre o erro.
     * Usa SweetAlert2 para mostrar um modal de erro.
     */
    erro(titulo, texto = '') {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: texto,
            confirmButtonColor: '#e74c3c',
            background: '#2f3452ff',
            color: '#ecf0f1'
        });
    },

    /**
     * Exibe uma caixa de diálogo de CONFIRMAÇÃO.
     * Pausa a execução do código até que o usuário clique em "Sim" ou "Cancelar".
     * @param {string} titulo - A pergunta principal (ex: 'Tem certeza?').
     * @param {string} texto - Um texto de aviso sobre as consequências da ação.
     * @returns {Promise<boolean>} - Retorna uma promessa que resolve para `true` se o usuário confirmar, e `false` caso contrário.
     * Usa SweetAlert2 para mostrar um modal de confirmação.
     */
    async confirmar(titulo, texto) {
        const resultado = await Swal.fire({
            title: titulo,
            text: texto,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, continuar!',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#30d646ff',
            cancelButtonColor: '#d33',
            background: '#36506dff',
            color: '#ecf0f1'
        });
        return resultado.isConfirmed;
    },
    
    /**
     * Mostra um pop-up de carregamento sem botões.
     * Ideal para aguardar respostas do servidor.
     * @param {string} titulo - O título a ser exibido no pop-up (ex: 'Carregando...').
     * Usa SweetAlert2 para mostrar um modal de carregamento.
     */
    mostrarCarregando(titulo) {
        Swal.fire({
            title: titulo,
            text: 'Por favor, aguarde.',
            allowOutsideClick: false,
            background: '#2f3452ff',
            color: '#ecf0f1',
            didOpen: () => {
                Swal.showLoading();
            }
        });
    },
    
    /**
     * Exibe uma notificação de SUCESSO em formato de MODAL que fecha sozinha.
     * Perfeita para o login, pois garante que o usuário veja a mensagem antes de ser redirecionado.
     * @param {string} titulo - O título da mensagem (ex: 'Login bem-sucedido!').
     * @param {string} texto - O texto de apoio (ex: 'Você será redirecionado...').
     * @param {number} [timer=2000] - Tempo em milissegundos para a notificação ficar visível.
     * Usa SweetAlert2 para mostrar um modal de sucesso temporizado.
     */
    sucessoComTimer(titulo, texto, timer = 2000) {
        return Swal.fire({
            icon: 'success',
            title: titulo,
            text: texto,
            timer: timer,
            timerProgressBar: true,
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            background: '#2f3452ff',
            color: '#ecf0f1'
        });
    },

    // ==================================================================
    // --- NOVAS FUNÇÕES INTEGRADAS COM O ESTILO DO SEU SISTEMA ---
    // ==================================================================

    /**
     * Abre um modal para o usuário digitar uma senha.
     * @param {string} titulo - O título do modal.
     * @returns {Promise<string|null>} - Retorna a senha digitada ou `null` se o usuário cancelar.
     * Usa SweetAlert2 para mostrar um modal de input de senha.
     */
    async pedirSenha(titulo) {
        const { value: senha } = await Swal.fire({
            title: titulo,
            input: 'password',
            inputLabel: 'Senha',
            inputPlaceholder: 'Digite a senha',
            inputAttributes: { minlength: 4, autocapitalize: 'off', autocorrect: 'off' },
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar',
            background: '#36506dff',
            color: '#ecf0f1',
            confirmButtonColor: '#30d646ff',
            cancelButtonColor: '#d33',
            inputValidator: (value) => {
                if (!value || value.length < 4) {
                    return 'A senha precisa ter no mínimo 4 caracteres!';
                }
            }
        });
        return senha || null;
    },

    /**
     * Mostra um pop-up de confirmação para ações perigosas, exigindo que o usuário
     * digite um texto específico para habilitar o botão de confirmação.
     * @param {string} titulo - O título do alerta.
     * @param {string} html - O conteúdo HTML do alerta.
     * @param {string} textoParaConfirmar - O texto que o usuário deve digitar.
     * @returns {Promise<boolean>} - Retorna `true` se confirmado, `false` se cancelado.
     * Usa SweetAlert2 para mostrar um modal de confirmação de ação de risco.
     */
    async confirmarAcaoDeRisco(titulo, html, textoParaConfirmar) {
        const { value: confirmado } = await Swal.fire({
            title: titulo,
            html: `
                ${html}
                  
  

                <p>Para confirmar, digite "<strong>${textoParaConfirmar}</strong>" no campo abaixo:</p>
                <input id="swal-input-confirm" class="swal2-input" placeholder="${textoParaConfirmar}" 
                       style="background-color: #ecf0f1; color: #2c3e50;">
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c', // Cor vermelha para perigo
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Confirmar Ação',
            cancelButtonText: 'Cancelar',
            background: '#36506dff',
            color: '#ecf0f1',
            focusConfirm: false,
            preConfirm: () => {
                const input = document.getElementById('swal-input-confirm').value;
                if (input !== textoParaConfirmar) {
                    Swal.showValidationMessage(`Você precisa digitar "${textoParaConfirmar}" para confirmar.`);
                    return false;
                }
                return true;
            }
        });
        return !!confirmado;
    }
};
