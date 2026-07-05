/**
 * DASHBOARD.JS - LÓGICA DO DASHBOARD
 * ================================================
 */

const DashboardModule = (() => {
    let cachedData = null;

    const calculateMetrics = (transactions) => {
        const metrics = {
            custoDeSobrevivencia: 0,
            custoDeVida: 0,
            rendaPassiva: 0,
            rendaAtiva: 0,
            totalReceitas: 0,
            totalDespesas: 0,
            saldo: 0,
            cobertura: 0
        };

        transactions.forEach(t => {
            const valor = parseFloat(t.valor || 0);

            if (t.tipo === 'receita') {
                metrics.totalReceitas += valor;
                if (t.plano_de_contas?.tipo_renda === 'passiva') {
                    metrics.rendaPassiva += valor;
                } else {
                    metrics.rendaAtiva += valor;
                }
            } else {
                metrics.totalDespesas += valor;
                if (t.plano_de_contas?.necessidade === 'essencial') {
                    metrics.custoDeSobrevivencia += valor;
                } else {
                    metrics.custoDeVida += valor;
                }
            }
        });

        metrics.saldo = metrics.totalReceitas - metrics.totalDespesas;

        if (metrics.custoDeSobrevivencia > 0) {
            metrics.cobertura = (metrics.rendaPassiva / metrics.custoDeSobrevivencia) * 100;
        }

        return metrics;
    };

    const getCategoryBreakdown = (transactions) => {
        const breakdown = {};

        transactions
            .filter(t => t.tipo === 'despesa')
            .forEach(t => {
                const category = t.plano_de_contas?.nome || 'Sem Categoria';
                breakdown[category] = (breakdown[category] || 0) + parseFloat(t.valor || 0);
            });

        return Object.entries(breakdown)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    return {
        async load(clientId) {
            try {
                const transactions = await DatabaseModule.getTransactionsByClient(clientId);
                cachedData = {
                    metrics: calculateMetrics(transactions),
                    categories: getCategoryBreakdown(transactions),
                    transactions
                };
                return cachedData;
            } catch (error) {
                console.error('❌ Erro ao carregar dashboard:', error);
                throw error;
            }
        },

        async renderClientDashboard(clientId) {
            try {
                const data = await this.load(clientId);
                const m = data.metrics;

                UIModule.setText('totalReceitas', `R$ ${m.totalReceitas.toFixed(2)}`);
                UIModule.setText('totalDespesas', `R$ ${m.totalDespesas.toFixed(2)}`);
                UIModule.setText('saldo', `R$ ${m.saldo.toFixed(2)}`);

                UIModule.setText('biSurvivalCost', `R$ ${m.custoDeSobrevivencia.toFixed(2)}`);
                UIModule.setText('biLifestyleCost', `R$ ${m.custoDeVida.toFixed(2)}`);
                UIModule.setText('biPassiveIncome', `R$ ${m.rendaPassiva.toFixed(2)}`);
                UIModule.setText('biCoverage', `${m.cobertura.toFixed(1)}%`);

                return data;
            } catch (error) {
                UIModule.showError('Erro ao carregar dashboard');
                throw error;
            }
        },

        getData: () => cachedData
    };
})();

console.log('✅ dashboard.js carregado');
