/**
 * ==================================================================
 * SCRIPT DA PÁGINA SOBRE (sobre.html)
 * ==================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const profileIcon = document.getElementById('profile-icon');
    const cartIcon = document.getElementById('cart-icon');
    const cartBadge = document.querySelector('.cart-icon .badge');
    const voltarBtn = document.getElementById('voltar-cardapio-btn');

    // --- Lógica Inicial ---
    const carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

    /**
     * Atualiza o número exibido no ícone do carrinho.
     */
    function atualizarBadgeCarrinho() {
        cartBadge.textContent = carrinho.length;
        cartBadge.style.display = carrinho.length > 0 ? 'flex' : 'none';
    }

    // --- Event Listeners para Navegação ---

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
    atualizarBadgeCarrinho();
});
