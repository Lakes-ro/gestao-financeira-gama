/**
 * TRANSACTIONS.JS - LÓGICA DE TRANSAÇÕES
 * ================================================
 * CORRECÇÃO:
 * - renderTransactions agora aceita um array opcional como 2º argumento.
 *   Quando não fornecido, usa allTransactions (comportamento anterior).
 *   Isto resolve o bug no contexto admin onde o filtro por cliente
 *   não era aplicado na renderização.
 */

const TransactionsModule = (() => {
    let allTransactions = [];

    const formatTransaction = (t) => {
        const data = t.data_competencia
            ? new Date(t.data_competencia + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';

        const clienteNome   = t.clientes?.nome       || '';
        const categoriaNome = t.plano_de_contas?.nome || 'Sem categoria';
        const macroGrupo    = t.plano_de_contas?.macro_grupo || '';
        const descricao     = t.descricao ? ` · ${t.descricao}` : '';

        const linhaDesc = clienteNome
            ? `${clienteNome} — ${categoriaNome}${descricao}`
            : `${categoriaNome}${descricao}`;

        return `
            <div class="transaction-item ${t.tipo}">
                <div class="transaction-info">
                    <div class="transaction-description">${linhaDesc}</div>
                    <div class="transaction-category">${macroGrupo}</div>
                    <div class="transaction-date">${data}</div>
                </div>
                <div class="transaction-value ${t.tipo}">
                    ${t.tipo === 'receita' ? '+' : '−'} R$ ${parseFloat(t.valor || 0).toFixed(2)}
                </div>
            </div>
        `;
    };

    return {
        async loadAllTransactions(adminId) {
            try {
                allTransactions = await DatabaseModule.getAllTransactions(adminId);
                return allTransactions;
            } catch (error) {
                console.error('❌ Erro ao carregar transações:', error);
                throw error;
            }
        },

        async addTransaction(transactionData) {
            try {
                const result = await DatabaseModule.addTransaction(transactionData);
                allTransactions.unshift(result);
                return result;
            } catch (error) {
                console.error('❌ Erro ao adicionar transação:', error);
                throw error;
            }
        },

        /**
         * @param {string} containerId  - ID do elemento onde renderizar
         * @param {Object} [filter={}]  - Filtros opcionais { clientId, type }
         * @param {Array}  [list=null]  - Lista explícita (sobrescreve allTransactions)
         */
        renderTransactions(containerId, filter = {}, list = null) {
            const container = document.getElementById(containerId);
            if (!container) return;

            let source = list || allTransactions;

            if (filter.clientId) {
                source = source.filter(t => t.client_id === filter.clientId);
            }

            if (filter.type && filter.type !== 'all') {
                source = source.filter(t => t.tipo === filter.type);
            }

            const html = source.map(t => formatTransaction(t)).join('');
            UIModule.setHTML(containerId, html || '<p class="empty-state">Nenhuma transação registada</p>');
        },

        getTransactions:  () => allTransactions,
        filterByClient:   (clientId) => allTransactions.filter(t => t.client_id === clientId),
        filterByType:     (type)     => allTransactions.filter(t => t.tipo === type)
    };
})();

console.log('✅ transactions.js carregado');