// gerar-senha.js
const bcrypt = require('bcryptjs');

// ===================================================
// CONFIGURE AQUI A SENHA QUE VOCÊ QUER USAR
const senhaEmTextoPlano = ''; 
// ===================================================

// Gera o "salt" e o "hash" da senha
bcrypt.genSalt(10, (err, salt) => {
    if (err) {
        console.error('Erro ao gerar o salt:', err);
        return;
    }
    bcrypt.hash(senhaEmTextoPlano, salt, (err, hash) => {
        if (err) {
            console.error('Erro ao gerar o hash:', err);
            return;
        }
        console.log('================================================================');
        console.log('SUA SENHA CRIPTOGRAFADA (HASH):');
        console.log('Copie e cole esta linha inteira no seu comando SQL.');
        console.log('================================================================');
        console.log(hash);
        console.log('================================================================');
    });
});
