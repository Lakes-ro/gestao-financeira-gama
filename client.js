/**
 * CLIENT.JS — Módulo: Estado do Cliente Logado
 * ================================================
 * Usado por: index.html e client.html (via app.js)
 * Padrão: script global (IIFE). Sem import/export.
 *
 * NÃO CONFUNDIR com clientes.js (que é o CRUD de clientes feito
 * pelo administrador, usado em admin.html). Este ficheiro trata do
 * cliente que está autenticado na própria sessão — guarda o seu id
 * e expõe helpers que o app.js usa para registar transações e
 * metas em nome desse cliente.
 *
 * Anteriormente este módulo estava embutido dentro de app.js.
 * Foi extraído para cá para eliminar a duplicação de nome/conteúdo
 * que existia entre "client.js" e "clientes.js" e para manter o
 * mesmo padrão de separação de responsabilidades usado no resto
 * do projeto (auth.js, database.js, goals.js, etc.).
 *
 * Depende de: DatabaseModule (definido em database.js — deve ser
 * carregado ANTES deste ficheiro no HTML).
 */

const ClientModule = (() => {
    let clientId = null;

    return {
        setClientId(id) {
            clientId = id;
        },

        getClientId() {
            return clientId;
        },

        async addTransaction(transactionData) {
            return await DatabaseModule.addTransaction(transactionData);
        },

        async addGoal(goalData) {
            return await DatabaseModule.addMeta(goalData);
        }
    };
})();

console.log('✅ client.js carregado');
