
/**
 * ==================================================================
 * SCRIPT DA PÁGINA SOBRE (sobre.html)
 * ==================================================================
 * Controla a navegação e exibição do badge do carrinho na página Sobre do cliente.
 */

// Aguarda o carregamento completo do DOM para iniciar o script
document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    // Seleciona todos os elementos necessários da página para manipulação posterior
    const profileIcon = document.getElementById('profile-icon');
    const cartIcon = document.getElementById('cart-icon');
    const cartBadge = document.querySelector('.cart-icon .badge');
    const voltarBtn = document.getElementById('voltar-cardapio-btn');

    // --- Lógica Inicial ---
    // Inicializa o carrinho a partir do localStorage
    const carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

    /**
     * Atualiza o número exibido no ícone do carrinho.
     * Mostra ou esconde o badge conforme a quantidade de itens.
     */
    function atualizarBadgeCarrinho() {
        cartBadge.textContent = carrinho.length;
        cartBadge.style.display = carrinho.length > 0 ? 'flex' : 'none';
    }

    // --- Event Listeners para Navegação ---
    // Adiciona listeners para navegação entre páginas do cliente

    // Navega para a página da conta/perfil
    profileIcon.addEventListener('click', () => {
        window.location.href = '/conta';
    });

    // Navega para a página de confirmação do pedido
    cartIcon.addEventListener('click', () => {
        window.location.href = '/confirmar-pedido';
    });

    // Navega de volta para o cardápio principal
    voltarBtn.addEventListener('click', () => {
        window.location.href = '/cardapio';
    });

    // --- Inicialização ---
    // Atualiza o badge do carrinho ao carregar a página
    atualizarBadgeCarrinho();
});
