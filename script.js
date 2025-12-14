const SUPABASE_URL = 'https://xruefbhltwivvkgsnlng.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydWVmYmhsdHdpdnZrZ3NubG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjUyMjIsImV4cCI6MjA4MDcwMTIyMn0.nIrm2iHEiYvopEHCT6h0P_zMOY62y9JCZRJyi7jse4w';

let supabaseClient = null;
let currentAdmin = null;
let currentClient = null;
let activeCharts = {};
let hideClientNamesFlag = false;
let allClients = [];
let allTransactions = [];
let clientRefreshInterval = null;

// ===== DATA SERVICE =====
const dataService = {
    async getPlanoDeContas() {
        const { data, error } = await supabaseClient
            .from('plano_de_contas')
            .select('*')
            .order('macro_grupo')
            .order('nome');
        if (error) throw new Error('Falha ao carregar plano de contas.');
        return data;
    },

    async getClients(adminId) {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('admin_id', adminId)
            .order('nome');
        if (error) throw new Error('Falha ao carregar clientes.');
        return data || [];
    },

    async getClientById(clientId) {
        const { data, error } = await supabaseClient
            .from('clientes')
            .select('*')
            .eq('id', clientId)
            .single();
        if (error) throw new Error('Cliente não encontrado.');
        return data;
    },

    async getTransactionsByClient(clientId) {
        const { data, error } = await supabaseClient
            .from('transacoes')
            .select('*, plano_de_contas(id, nome, macro_grupo, tipo, tipo_renda, necessidade, recorrencia)')
            .eq('client_id', clientId)
            .order('data', { ascending: false });
        if (error) throw new Error('Falha ao buscar transações.');
        return data || [];
    },

    async getAllTransactions(adminId) {
        try {
            const clients = await this.getClients(adminId);
            allClients = clients;
            if (clients.length === 0) return [];
            
            const clientIds = clients.map(c => c.id);
            const { data, error } = await supabaseClient
                .from('transacoes')
                .select('*, clientes(id, nome), plano_de_contas(id, nome, tipo)')
                .in('client_id', clientIds)
                .order('data', { ascending: false });
            
            if (error) throw new Error('Falha ao buscar transações.');
            allTransactions = data || [];
            return allTransactions;
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async addTransaction(transactionData) {
        const { error } = await supabaseClient
            .from('transacoes')
            .insert([transactionData]);
        if (error) throw error;
    },

    async addClient(clientData) {
        const { error } = await supabaseClient
            .from('clientes')
            .insert([clientData]);
        if (error) throw error;
    },

    async addMeta(metaData) {
    const { error } = await supabaseClient
        .from('metas')
        .insert([metaData]);
    if (error) throw error;
},

async getMetasByClient(clientId) {
    const { data, error } = await supabaseClient
        .from('metas')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
},

async getMetasByAdmin(adminId) {
    try {
        const clients = await this.getClients(adminId);
        if (clients.length === 0) return [];
        
        const clientIds = clients.map(c => c.id);
        const { data, error } = await supabaseClient
            .from('metas')
            .select('*, clientes(id, nome)')
            .in('client_id', clientIds)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(error);
        return [];
    }
},

async deleteMeta(metaId) {
    const { error } = await supabaseClient
        .from('metas')
        .delete()
        .eq('id', metaId);
    if (error) throw error;
},

    async deleteClient(clientId) {
        const { error } = await supabaseClient
            .from('clientes')
            .delete()
            .eq('id', clientId);
        if (error) throw error;
    }
};

// ===== BI SERVICE =====
const biService = {
    calculateCustoDeSobrevivencia(transactions) {
        return transactions
            .filter(t => t.tipo === 'despesa' && t.plano_de_contas?.necessidade === 'essencial')
            .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    },

    calculateCustoDeLifestyle(transactions) {
        return transactions
            .filter(t => t.tipo === 'despesa' && t.plano_de_contas?.necessidade === 'estilo_de_vida')
            .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    },

    calculateRendaPassivaTotal(transactions) {
        return transactions
            .filter(t => t.tipo === 'receita' && t.plano_de_contas?.tipo_renda === 'passiva')
            .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    },

    calculateRendaAtivaTotal(transactions) {
        return transactions
            .filter(t => t.tipo === 'receita' && t.plano_de_contas?.tipo_renda === 'ativa')
            .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    },

    calculateCoberturaRendaPassiva(rendaPassiva, custoSobrevivencia) {
        if (custoSobrevivencia === 0) return 100;
        return Math.min((rendaPassiva / custoSobrevivencia) * 100, 100);
    },

    getExpenseDistribution(transactions) {
        const distribution = {};
        transactions
            .filter(t => t.tipo === 'despesa')
            .forEach(t => {
                const categoryName = t.plano_de_contas?.nome || 'Outros';
                distribution[categoryName] = (distribution[categoryName] || 0) + parseFloat(t.valor || 0);
            });
        return distribution;
    }
};

// ===== UI SERVICE =====
const uiService = {
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) screen.classList.add('active');
        this.clearAllForms();
    },

    toggle(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.toggle('hidden');
    },

    showMessage(elementId, message, isError = true) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message;
        el.className = `message ${isError ? 'message--error' : 'message--success'} show`;
        setTimeout(() => el.classList.remove('show'), 3000);
    },

    clearAllForms() {
        document.querySelectorAll('form').forEach(form => form.reset());
        document.querySelectorAll('.message').forEach(el => el.classList.remove('show'));
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
        Object.values(activeCharts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        activeCharts = {};
    },

    renderClients(clients) {
        const listDiv = document.getElementById('clientsList');
        if (!clients || clients.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">Nenhum cliente adicionado</p>';
            return;
        }

        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        listDiv.innerHTML = clients.map(client => {
            const clientLink = `${baseUrl}?cliente=${client.id}`;
            const nameClass = hideClientNamesFlag ? 'hidden' : '';
            return `
                <div class="client-item">
                    <div class="client-name ${nameClass}">${client.nome}</div>
                    <div class="client-email">${client.email || 'Sem email'}</div>
                    <div class="client-link">
                        <span style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${clientLink}</span>
                        <button class="btn-copy" onclick="copyToClipboard('${clientLink}')">Copiar</button>
                    </div>
                    <div class="client-actions">
                        <button class="btn--secondary" onclick="openClientDashboard('${client.id}')">📊 Dashboard</button>
                        <button class="btn-delete" onclick="deleteClient('${client.id}')">🗑️ Deletar</button>
                    </div>
                </div>`;
        }).join('');
    },

    renderTransactions(transactions) {
        const listDiv = document.getElementById('transactionHistoryList');
        if (!transactions || transactions.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">Nenhuma transação registrada</p>';
            return;
        }

        listDiv.innerHTML = transactions.map(trans => {
            const isReceita = trans.tipo === 'receita';
            const valor = `${isReceita ? '+' : '-'}R$ ${parseFloat(trans.valor || 0).toFixed(2)}`;
            return `
                <div class="transaction-item ${trans.tipo}">
                    <div class="transaction-info">
                        <div class="transaction-description">${trans.descricao || trans.plano_de_contas?.nome || 'Sem descrição'}</div>
                        <div class="transaction-category">${trans.plano_de_contas?.nome || 'Categoria'}</div>
                        <div class="transaction-date">${new Date(trans.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div class="transaction-value ${trans.tipo}">${valor}</div>
                </div>`;
        }).join('');
    },

    renderAdminTransactions(transactions) {
        const listDiv = document.getElementById('adminTransactionsList');
        if (!transactions || transactions.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">Nenhuma transação encontrada.</p>';
            return;
        }

        listDiv.innerHTML = transactions.map(trans => {
            const isReceita = trans.tipo === 'receita';
            const valor = `${isReceita ? '+' : '-'}R$ ${parseFloat(trans.valor || 0).toFixed(2)}`;
            const clientName = trans.clientes?.nome || 'Desconhecido';
            return `
                <div class="transaction-item ${trans.tipo}">
                    <div class="transaction-info">
                        <div class="transaction-description" style="color: #6495ff; font-weight: 700;">${clientName}</div>
                        <div class="transaction-category">${trans.plano_de_contas?.nome || 'Categoria'}</div>
                        <div class="transaction-date">${new Date(trans.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div class="transaction-value ${trans.tipo}">${valor}</div>
                </div>`;
        }).join('');
    },

    updateClientResume(transactions) {
    const receitas = transactions
        .filter(t => t.tipo === 'receita')
        .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const despesas = transactions
        .filter(t => t.tipo === 'despesa')
        .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    
    document.getElementById('totalReceitas').textContent = formatarReal(receitas);
    document.getElementById('totalDespesas').textContent = formatarReal(despesas);
    document.getElementById('saldo').textContent = formatarReal(receitas - despesas);
},

    async populateTransactionForm() {
        try {
            const planoDeContas = await dataService.getPlanoDeContas();
            const select = document.getElementById('transCategory');
            select.innerHTML = '<option value="">Selecione uma categoria...</option>';
            
            const grupos = planoDeContas.reduce((acc, item) => {
                const grupo = item.macro_grupo;
                if (!acc[grupo]) acc[grupo] = [];
                acc[grupo].push(item);
                return acc;
            }, {});

            for (const grupo in grupos) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = `--- ${grupo} ---`;
                grupos[grupo].forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.nome;
                    option.dataset.tipo = item.tipo;
                    option.dataset.necessidade = item.necessidade || 'estilo_de_vida';
                    option.dataset.recorrencia = item.recorrencia || 'variavel';
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            }
        } catch (error) {
            console.error(error.message);
            uiService.showMessage('transError', error.message);
        }
    },

    async populateAdminFilters() {
        try {
            const select = document.getElementById('adminClientFilter');
            select.innerHTML = '<option value="">Todos os clientes</option>';
            allClients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.nome;
                select.appendChild(option);
            });
        } catch (error) {
            console.error(error);
        }
    },

    renderChart(canvasId, type, labels, data, backgroundColors) {
        if (activeCharts[canvasId]) {
            activeCharts[canvasId].destroy();
        }
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        activeCharts[canvasId] = new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Valor (R$)',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#e0e0e0' }
                        
                    }
                }
            }
        });
    },

renderPlanningSheet(transactions) {
    const incomeByCategory = {};
    const expenseByCategory = {};

    transactions.forEach(t => {
        const categoryName = t.plano_de_contas?.nome || 'Outros';
        const value = parseFloat(t.valor || 0);

        if (t.tipo === 'receita') {
            incomeByCategory[categoryName] = (incomeByCategory[categoryName] || 0) + value;
        } else {
            expenseByCategory[categoryName] = (expenseByCategory[categoryName] || 0) + value;
        }
    });

    const incomesHtml = Object.entries(incomeByCategory)
            .map(([name, value]) => `
                <div class="planning-row">
                    <div class="planning-col">${name}</div>
                    <div class="planning-col">R$ ${value.toFixed(2)}</div>
                </div>
            `).join('');

        const expensesHtml = Object.entries(expenseByCategory)
            .map(([name, value]) => {
                const necessidade = transactions.find(t => t.plano_de_contas?.nome === name)?.plano_de_contas?.necessidade;
                return `
                    <div class="planning-row" style="background-color: ${necessidade === 'essencial' ? 'rgba(255, 100, 100, 0.05)' : 'rgba(255, 215, 0, 0.05)'};">
                        <div class="planning-col">${name}</div>
                        <div class="planning-col">R$ ${value.toFixed(2)}</div>
                    </div>
                `;
            }).join('');

        const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
        const essentialExpenses = Object.entries(expenseByCategory)
            .filter(([name]) => transactions.find(t => t.plano_de_contas?.nome === name)?.plano_de_contas?.necessidade === 'essencial')
            .reduce((sum, [, value]) => sum + value, 0);
        const nonEssentialExpenses = Object.values(expenseByCategory).reduce((a, b) => a + b, 0) - essentialExpenses;
        const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);
        const balance = totalIncome - totalExpense;
        const emergencyFund = totalExpense * 3;

        document.getElementById('clientIncomesTable').innerHTML = incomesHtml;
        document.getElementById('clientExpensesTable').innerHTML = expensesHtml;
        document.getElementById('totalIncomePlanning').textContent = `R$ ${totalIncome.toFixed(2)}`;
        document.getElementById('totalEssentialPlanning').textContent = `R$ ${essentialExpenses.toFixed(2)}`;
        document.getElementById('totalNonEssentialPlanning').textContent = `R$ ${nonEssentialExpenses.toFixed(2)}`;
        document.getElementById('totalExpensePlanning').textContent = `R$ ${totalExpense.toFixed(2)}`;
        document.getElementById('clientPlanningBalanceText').textContent = `R$ ${balance.toFixed(2)}`;
        document.getElementById('clientEmergencyFund').textContent = `R$ ${emergencyFund.toFixed(2)}`;
    }
};


// ===== FUNÇÕES PRINCIPAIS =====

async function init() {
    try {
        if (!window.supabase) throw new Error('Supabase não carregou.');
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const urlParams = new URLSearchParams(window.location.search);
        const clientId = urlParams.get('cliente');

        // SE HÁ CLIENTE NA URL, CARREGA DIRETO (SEM LOGIN)
        if (clientId) {
            await loadClientPage(clientId);
        } else {
            // CASO CONTRÁRIO, VERIFICA AUTENTICAÇÃO DO ADMIN
            await checkAdminAuth();
        }
        
        addEventListeners();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        // SÓ MOSTRA LOGIN SE NÃO FOR CLIENTE
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.get('cliente')) {
            uiService.showScreen('loginAdminScreen');

            
        }
    }
}

async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        currentAdmin = session.user;
        await loadAdminPage();
    } else {
        uiService.showScreen('loginAdminScreen');
    }
}

async function adminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    try {
        if (!email || !password) throw new Error('Email e senha são obrigatórios.');
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        currentAdmin = data.user;
        await loadAdminPage();
    } catch (error) {
        uiService.showMessage('adminLoginError', error.message);
    }
}

async function adminRegister(e) {
    e.preventDefault();
    const name = document.getElementById('adminName').value.trim();
    const email = document.getElementById('adminRegEmail').value.trim();
    const password = document.getElementById('adminRegPassword').value;
    
    try {
        if (!name || !email || !password) throw new Error('Todos os campos são obrigatórios.');
        if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres.');
        
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        
        alert('Conta criada! Faça o login.');
        uiService.showScreen('loginAdminScreen');
    } catch (error) {
        uiService.showMessage('adminRegisterError', error.message);
    }
}

async function logoutAdmin() {
    if (confirm('Tem certeza que deseja sair?')) {
        await supabaseClient.auth.signOut();
        currentAdmin = null;
        currentClient = null;
        if (clientRefreshInterval) clearInterval(clientRefreshInterval);
        window.location.href = window.location.pathname;
    }
}

async function loadAdminPlannings() {
    try {
        const clients = await dataService.getClients(currentAdmin.id);
        if (clients.length === 0) {
            document.getElementById('adminPlanningsList').innerHTML = '<p class="empty-state">Nenhum planejamento criado</p>';
            return;
        }
        
        const clientIds = clients.map(c => c.id);
        const { data: plannings, error } = await supabaseClient
            .from('planejamentos')
            .select('*, clientes(id, nome)')
            .in('client_id', clientIds)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        renderAdminPlannings(plannings || []);
    } catch (error) {
        console.error(error);
    }
}

function renderAdminPlannings(plannings) {
    const listDiv = document.getElementById('adminPlanningsList');
    if (!plannings || plannings.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">Nenhum planejamento criado</p>';
        return;
    }

    const statusColors = {
        'ativo': { bg: 'rgba(100, 150, 255, 0.2)', color: '#6495ff', text: '✏️ Em Andamento' },
        'em_analise': { bg: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', text: '📋 Em Análise' },
        'concluido': { bg: 'rgba(100, 255, 122, 0.2)', color: '#64ff7a', text: '✅ Concluído' },
        'arquivado': { bg: 'rgba(150, 150, 150, 0.2)', color: '#999', text: '📦 Arquivado' }
    };

    listDiv.innerHTML = plannings.map(planning => {
        const clientName = planning.clientes?.nome || 'Desconhecido';
        const createdDate = new Date(planning.created_at).toLocaleDateString('pt-BR');
        const statusInfo = statusColors[planning.status] || statusColors['ativo'];
        
        return `
            <div class="planning-request-card">
                <div class="planning-request-header">
                    <div>
                        <div class="planning-request-name">${planning.titulo}</div>
                        <div class="meta-client">${clientName}</div>
                    </div>
                    <div class="planning-request-status" style="background: ${statusInfo.bg}; color: ${statusInfo.color};">
                        ${statusInfo.text}
                    </div>
                </div>
                <div class="planning-request-info">
                    <div>
                        <div class="planning-request-info-item">Criado em:</div>
                        <div class="planning-request-info-value">${createdDate}</div>
                    </div>
                </div>
                <p style="color: #a0a0b0; font-size: 13px; margin: 12px 0;">${planning.descricao ? planning.descricao.substring(0, 100) + '...' : 'Sem descrição'}</p>
                <div class="planning-request-actions">
                    <button onclick="openEditPlanningStatusModal('${planning.id}', '${planning.titulo.replace(/'/g, "\\'")}', '${planning.status}')" class="btn--secondary">📝 Status</button>
                    <button onclick="deletePlanning('${planning.id}')" class="btn-delete">Deletar</button>
                </div>
            </div>
        `;
    }).join('');
}

async function deletePlanning(planningId) {
    if (!confirm('Deletar este planejamento?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('planejamentos')
            .delete()
            .eq('id', planningId);
        
        if (error) throw error;
        await loadAdminPlannings();
    } catch (error) {
        alert('Erro ao deletar planejamento: ' + error.message);
    }
}


async function populateAdminMetaClientSelect() {
    try {
        const select = document.getElementById('adminMetaClientSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um cliente</option>';
        allClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadAdminPage() {
    uiService.showScreen('adminScreen');
    try {
        const clients = await dataService.getClients(currentAdmin.id);
        await dataService.getAllTransactions(currentAdmin.id);
        
        uiService.renderClients(clients);
        uiService.populateAdminFilters();
        
        // ADICIONE TODAS ESSAS LINHAS
        if (typeof populatePlanningClientSelect === 'function') {
            await populatePlanningClientSelect();
        }
        if (typeof populateAdminMetaClientSelect === 'function') {
            await populateAdminMetaClientSelect();
        }
        if (typeof loadAdminMetas === 'function') {
            await loadAdminMetas();
        }
        if (typeof loadAdminPlannings === 'function') {
            await loadAdminPlannings();
        }
        if (typeof loadPlanningRequests === 'function') {
            await loadPlanningRequests();
        }
        
        applyAdminFilters();
    } catch (error) {
        console.error(error.message);
    }
}

async function loadAdminMetas() {
    try {
        const metas = await dataService.getMetasByAdmin(currentAdmin.id);
        await uiService.renderAdminMetas(metas);
    } catch (error) {
        console.error(error);
    }
}

async function deleteMeta(metaId) {
    if (!confirm('Deletar esta meta?')) return;
    try {
        await dataService.deleteMeta(metaId);
        
        if (currentClient) {
            await refreshClientMetas();
        } else {
            await loadAdminMetas();
        }
    } catch (error) {
        alert('Erro ao deletar meta: ' + error.message);
    }
}

async function handleAddAdminMeta(e) {
    e.preventDefault();
    const clientId = document.getElementById('adminMetaClientSelect').value;
    const name = document.getElementById('adminMetaName').value.trim();
    const value = parseFloat(document.getElementById('adminMetaValue').value);
    const prazo = parseInt(document.getElementById('adminMetaPrazo').value);
    
    try {
        if (!clientId || !name || value <= 0 || prazo <= 0) throw new Error('Preencha todos os campos corretamente.');
        
        const metaId = 'meta_' + Date.now();
        const metaData = {
            id: metaId,
            client_id: clientId,
            nome: name,
            valor_necessario: value,
            valor_economizado: 0,
            prazo_meses: prazo,
            created_at: new Date().toISOString()
        };
        
        await dataService.addMeta(metaData);
        uiService.showMessage('adminMetaSuccess', 'Meta criada com sucesso!', false);
        uiService.toggle('addAdminMetaForm');
        document.getElementById('adminMetaForm').reset();
        await loadAdminMetas();
    } catch (error) {
        uiService.showMessage('adminMetaError', error.message);
    }
}

async function populateAdminMetaClientSelect() {
    const select = document.getElementById('adminMetaClientSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    allClients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.nome;
        select.appendChild(option);
    });
}

async function populatePlanningClientSelect() {
    try {
        const select = document.getElementById('planningClientSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um cliente</option>';
        allClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

uiService.renderClients = function(clients) {
    const listDiv = document.getElementById('clientsList');
    if (!clients || clients.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">Nenhum cliente adicionado</p>';
        return;
    }

    const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    listDiv.innerHTML = clients.map(client => {
        const clientLink = `${baseUrl}?cliente=${client.id}`;
        const nameClass = hideClientNamesFlag ? 'hidden' : '';
        return `
            <div class="client-item">
                <div class="client-name ${nameClass}">${client.nome}</div>
                <div class="client-email">${client.email || 'Sem email'}</div>
                <div class="client-link">
                    <span style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${clientLink}</span>
                    <button class="btn-copy" onclick="copyToClipboard('${clientLink}')">Copiar</button>
                </div>
                <div class="client-actions">
                    <button class="btn--secondary" onclick="openClientDashboard('${client.id}')">📊 Dashboard</button>
                    <button class="btn--secondary" onclick="openEditClientModal('${client.id}')">✏️ Editar</button>
                    <button class="btn-delete btn-delete-small" onclick="deleteClient('${client.id}')" title="Deletar cliente">🗑️</button>
                </div>
            </div>`;
    }).join('');
};

async function loadClientPage(clientId) {
    try {
        currentClient = await dataService.getClientById(clientId);
        document.getElementById('clientNameDisplay').textContent = currentClient.nome;
        uiService.showScreen('clientScreen');
        document.getElementById('transDate').valueAsDate = new Date();
        await uiService.populateTransactionForm();
        await refreshClientTransactions();
        await checkPlanningStatus(); // ADICIONE ESTA LINHA

        if (clientRefreshInterval) clearInterval(clientRefreshInterval);
        clientRefreshInterval = setInterval(refreshClientTransactions, 5000);
    } catch (error) {
        alert(error.message);
        window.location.href = window.location.pathname;
    }
}

async function loadClientPage(clientId) {
    try {
        currentClient = await dataService.getClientById(clientId);
        document.getElementById('clientNameDisplay').textContent = currentClient.nome;
        uiService.showScreen('clientScreen');
        document.getElementById('transDate').valueAsDate = new Date();
        await uiService.populateTransactionForm();
        await refreshClientTransactions();
        await checkPlanningStatus();
        await loadClientPlannings(); // ADICIONE ESTA LINHA

        if (clientRefreshInterval) clearInterval(clientRefreshInterval);
        clientRefreshInterval = setInterval(refreshClientTransactions, 5000);
    } catch (error) {
        alert(error.message);
        window.location.href = window.location.pathname;
    }
}

async function refreshClientTransactions() {
    try {
        const transactions = await dataService.getTransactionsByClient(currentClient.id);
        uiService.renderTransactions(transactions);
        uiService.updateClientResume(transactions);
        uiService.renderPlanningSheet(transactions);
        await loadClientPlannings(); // ADICIONE ESTA LINHA
    } catch (error) {
        console.error(error.message);
    }
}

function updatePlanningSheet(transactions) {
    const receitas = transactions.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const despesas = transactions.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const balance = receitas - despesas;
    const emergencyFund = despesas * 3;
    const el1 = document.getElementById('clientPlanningBalanceText');
    const el2 = document.getElementById('clientEmergencyFund');
    if (el1) el1.textContent = formatarReal(balance);
    if (el2) el2.textContent = formatarReal(emergencyFund);
}

async function loadPlanningRequests() {
    try {
        console.log('Carregando solicitações de planejamento...');
        
        const clients = await dataService.getClients(currentAdmin.id);
        console.log('Clientes encontrados:', clients.length);
        
        if (clients.length === 0) {
            const elem = document.getElementById('adminPlanningRequestsList');
            if (elem) elem.innerHTML = '<p class="empty-state">Nenhum cliente</p>';
            return;
        }

        const clientIds = clients.map(c => c.id);
        console.log('IDs dos clientes:', clientIds);

        const { data: requests, error } = await supabaseClient
            .from('planning_requests')
            .select('*, clientes(id, nome)')
            .in('client_id', clientIds)
            .order('created_at', { ascending: false });

        console.log('Solicitações encontradas:', requests);
        console.log('Erro (se houver):', error);

        if (error) throw error;

        renderPlanningRequests(requests || []);
    } catch (error) {
        console.error('Erro ao carregar solicitações:', error);
    }
}

function renderPlanningRequests(requests) {
    const listDiv = document.getElementById('adminPlanningRequestsList');
    if (!requests || requests.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">Nenhuma solicitação de planejamento</p>';
        return;
    }

    listDiv.innerHTML = requests.map(req => {
        const clientName = req.clientes?.nome || 'Desconhecido';
        const createdDate = new Date(req.created_at).toLocaleDateString('pt-BR');
        const statusColor = {
            'pendente': '#ffd700',
            'em_progresso': '#6495ff',
            'concluido': '#64ff7a'
        };
        const statusText = {
            'pendente': 'Pendente',
            'em_progresso': 'Em Progresso',
            'concluido': 'Concluído'
        };

        return `
            <div class="planning-request-card">
                <div class="planning-request-header">
                    <div class="planning-request-name">${clientName}</div>
                    <div class="planning-request-status" style="background: rgba(${statusColor[req.status]}, 0.2); color: ${statusColor[req.status]};">${statusText[req.status]}</div>
                </div>
                <div class="planning-request-info">
                    <div>
                        <div class="planning-request-info-item">Solicitado em:</div>
                        <div class="planning-request-info-value">${createdDate}</div>
                    </div>
                </div>
                <div class="planning-request-actions">
                    <button onclick="updatePlanningStatus('${req.id}', 'em_progresso')" class="btn--secondary" style="flex: 1;">Iniciar</button>
                    <button onclick="updatePlanningStatus('${req.id}', 'concluido')" class="btn--secondary" style="flex: 1;">Concluir</button>
                    <button onclick="deletePlanningRequest('${req.id}')" class="btn-delete">Deletar</button>
                </div>
            </div>
        `;
    }).join('');
}

async function updatePlanningStatus(requestId, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('planning_requests')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', requestId);

        if (error) throw error;
        alert(`Status atualizado para: ${newStatus}`);
        await loadPlanningRequests();
    } catch (error) {
        alert('Erro ao atualizar status: ' + error.message);
    }
}

async function deletePlanningRequest(requestId) {
    if (!confirm('Deletar esta solicitação?')) return;

    try {
        const { error } = await supabaseClient
            .from('planning_requests')
            .delete()
            .eq('id', requestId);

        if (error) throw error;
        await loadPlanningRequests();
    } catch (error) {
        alert('Erro ao deletar: ' + error.message);
    }
}


async function handleAddClient(e) {
    e.preventDefault();
    const name = document.getElementById('clientName').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    
    try {
        if (!name) throw new Error('O nome do cliente é obrigatório.');
        
        const clientId = 'client_' + Date.now();
        await dataService.addClient({ 
            id: clientId, 
            admin_id: currentAdmin.id, 
            nome: name, 
            email: email || null 
        });
        
        uiService.showMessage('clientSuccess', 'Cliente adicionado com sucesso!', false);
        uiService.toggle('addClientForm');
        
        const clients = await dataService.getClients(currentAdmin.id);
        uiService.renderClients(clients);
        document.getElementById('clientForm').reset();
    } catch (error) {
        uiService.showMessage('clientError', error.message);
    }
}

async function deleteClient(clientId) {
    if (!confirm('Tem certeza que deseja deletar este cliente? Esta ação é irreversível.')) return;
    
    try {
        await dataService.deleteClient(clientId);
        alert('Cliente deletado com sucesso.');
        await loadAdminPage();
    } catch (error) {
        alert('Erro ao deletar cliente: ' + error.message);
    }
}

async function openEditClientModal(clientId) {
    try {
        const client = await dataService.getClientById(clientId);
        document.getElementById('editClientNameInput').value = client.nome;
        document.getElementById('editClientEmailInput').value = client.email || '';
        document.getElementById('editClientForm').dataset.clientId = clientId;
        uiService.openModal('editClientModal');
    } catch (error) {
        alert('Erro ao carregar cliente: ' + error.message);
    }
}

async function openEditMetaModal(metaId, fromAdmin = false) {
    try {
        const { data: meta, error } = await supabaseClient
            .from('metas')
            .select('*')
            .eq('id', metaId)
            .single();

        if (error) throw error;

        const progress = (meta.valor_economizado / meta.valor_necessario) * 100;
        const remaining = meta.valor_necessario - meta.valor_economizado;

        document.getElementById('metaEditName').textContent = meta.nome;
        document.getElementById('metaEditGoal').textContent = `R$ ${meta.valor_necessario.toFixed(2)}`;
        document.getElementById('metaEditCurrent').textContent = `R$ ${meta.valor_economizado.toFixed(2)}`;
        document.getElementById('metaEditRemaining').textContent = `R$ ${remaining.toFixed(2)}`;
        document.getElementById('metaEditProgress').textContent = `${progress.toFixed(1)}%`;
        document.getElementById('metaEditProgressBar').style.width = `${Math.min(progress, 100)}%`;
        document.getElementById('editMetaDate').valueAsDate = new Date();
        document.getElementById('editMetaForm').dataset.metaId = metaId;
        document.getElementById('editMetaForm').dataset.fromAdmin = fromAdmin;

        uiService.openModal('editMetaModal');
    } catch (error) {
        alert('Erro ao carregar meta: ' + error.message);
    }
}

async function handleEditMeta(e) {
    e.preventDefault();
    const metaId = document.getElementById('editMetaForm').dataset.metaId;
    const fromAdmin = document.getElementById('editMetaForm').dataset.fromAdmin === 'true';
    const addValue = parseFloat(document.getElementById('editMetaAddValue').value);
    const date = document.getElementById('editMetaDate').value;
    const description = document.getElementById('editMetaDescription').value.trim();

    try {
        if (addValue <= 0) throw new Error('Digite um valor válido.');

        // Buscar meta atual
        const { data: meta } = await supabaseClient
            .from('metas')
            .select('*')
            .eq('id', metaId)
            .single();

        const newValue = meta.valor_economizado + addValue;

        // Atualizar meta
        const { error } = await supabaseClient
            .from('metas')
            .update({ valor_economizado: newValue })
            .eq('id', metaId);

        if (error) throw error;

        // Registrar histórico (tabela opcional)
        if (description) {
            await supabaseClient
                .from('meta_historicos')
                .insert([{
                    meta_id: metaId,
                    valor: addValue,
                    descricao: description,
                    data: date,
                    created_at: new Date().toISOString()
                }]).catch(() => {}); // Ignora se tabela não existe
        }

        uiService.showMessage('editMetaSuccess', 'Economia registrada com sucesso!', false);
        setTimeout(() => {
            uiService.closeModal('editMetaModal');
            if (fromAdmin) {
                loadAdminMetas();
            } else {
                refreshClientMetas();
            }
        }, 1500);
    } catch (error) {
        uiService.showMessage('editMetaError', error.message);
    }
}

async function openPlanningBuilder(clientId) {
    try {
        const client = await dataService.getClientById(clientId);
        const transactions = await dataService.getTransactionsByClient(clientId);

        // Calcular dados financeiros
        const ativeIncome = biService.calculateRendaAtivaTotal(transactions);
        const passiveIncome = biService.calculateRendaPassivaTotal(transactions);
        const totalIncome = ativeIncome + passiveIncome;
        const survivalCost = biService.calculateCustoDeSobrevivencia(transactions);
        const lifestyleCost = biService.calculateCustoDeLifestyle(transactions);
        const totalExpense = survivalCost + lifestyleCost;
        const monthlyBalance = totalIncome - totalExpense;
        const passiveCoverage = biService.calculateCoberturaRendaPassiva(passiveIncome, survivalCost);

        // Preencher formulário
        document.getElementById('planningClientName').textContent = client.nome;
        document.getElementById('planningActiveIncome').textContent = `R$ ${ativeIncome.toFixed(2)}`;
        document.getElementById('planningPassiveIncome').textContent = `R$ ${passiveIncome.toFixed(2)}`;
        document.getElementById('planningTotalIncome').textContent = `R$ ${totalIncome.toFixed(2)}`;
        document.getElementById('planningTotalExpense').textContent = `R$ ${totalExpense.toFixed(2)}`;
        document.getElementById('planningMonthlyBalance').textContent = `R$ ${monthlyBalance.toFixed(2)}`;
        document.getElementById('planningPassiveCoverage').textContent = `${passiveCoverage.toFixed(1)}%`;

        // Gerar recomendações automáticas
        let recommendations = '📌 OBJETIVOS RECOMENDADOS:\n\n';
        
        if (monthlyBalance > 0) {
            recommendations += `✓ Saldo positivo de R$ ${monthlyBalance.toFixed(2)}/mês\n`;
            recommendations += `  → Investir ou poupar este valor\n\n`;
        } else {
            recommendations += `⚠️ Saldo NEGATIVO de R$ ${Math.abs(monthlyBalance).toFixed(2)}/mês\n`;
            recommendations += `  → URGENTE: Reduzir despesas de estilo de vida\n\n`;
        }

        if (passiveCoverage < 30) {
            recommendations += `⚠️ Cobertura Passiva baixa (${passiveCoverage.toFixed(1)}%)\n`;
            recommendations += `  → Aumentar investimentos em renda passiva\n`;
            recommendations += `  → Meta: Atingir 50% de cobertura em 12 meses\n\n`;
        } else if (passiveCoverage >= 50) {
            recommendations += `✓ Excelente cobertura passiva (${passiveCoverage.toFixed(1)}%)\n`;
            recommendations += `  → Continuar replicando este modelo\n\n`;
        }

        recommendations += `💡 OUTRAS AÇÕES:\n`;
        recommendations += `• Revisar despesas mensalmente\n`;
        recommendations += `• Aumentar renda ativa em 10-15%\n`;
        recommendations += `• Criar fundo de emergência de 3-6 meses`;

        document.getElementById('planningRecommendations').value = recommendations;
        document.getElementById('planningBuilderTitle').value = `Planejamento - ${new Date().toLocaleDateString('pt-BR')}`;
        document.getElementById('planningBuilderPeriod').value = 3;
        document.getElementById('planningDetails').value = '';

        document.getElementById('planningBuilderModal').dataset.clientId = clientId;
        uiService.openModal('planningBuilderModal');
    } catch (error) {
        alert('Erro ao abrir construtor: ' + error.message);
    }
}

async function savePlanningForClient() {
    try {
        const clientId = document.getElementById('planningBuilderModal').dataset.clientId;
        const title = document.getElementById('planningBuilderTitle').value.trim();
        const period = parseInt(document.getElementById('planningBuilderPeriod').value);
        const recommendations = document.getElementById('planningRecommendations').value.trim();
        const details = document.getElementById('planningDetails').value.trim();

        if (!title || !recommendations) throw new Error('Preencha os campos obrigatórios.');

        const planningData = {
            client_id: clientId,
            admin_id: currentAdmin.id,
            titulo: title,
            descricao: `PERÍODO: ${period} meses\n\n${recommendations}\n\n${details}`,
            status: 'ativo',
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('planejamentos')
            .insert([planningData]);

        if (error) throw error;

        alert('✓ Planejamento criado e enviado para o cliente!');
        uiService.closeModal('planningBuilderModal');
        await loadAdminPlannings();
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    }
}

async function handleEditClient(e) {
    e.preventDefault();
    const clientId = document.getElementById('editClientForm').dataset.clientId;
    const name = document.getElementById('editClientNameInput').value.trim();
    const email = document.getElementById('editClientEmailInput').value.trim();
    
    try {
        if (!name) throw new Error('O nome é obrigatório.');
        
        const { error } = await supabaseClient
            .from('clientes')
            .update({ nome: name, email: email || null })
            .eq('id', clientId);
        
        if (error) throw error;
        
        uiService.showMessage('editClientSuccess', 'Cliente atualizado com sucesso!', false);
        setTimeout(() => {
            uiService.closeModal('editClientModal');
            loadAdminPage();
        }, 1500);
    } catch (error) {
        uiService.showMessage('editClientError', error.message);
    }
}

async function populateAdminMetaClientSelect() {
    const select = document.getElementById('adminMetaClientSelect');
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    allClients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.nome;
        select.appendChild(option);
    });
}

async function handleAddAdminMeta(e) {
    e.preventDefault();
    const clientId = document.getElementById('adminMetaClientSelect').value;
    const name = document.getElementById('adminMetaName').value.trim();
    const value = parseFloat(document.getElementById('adminMetaValue').value);
    const prazo = parseInt(document.getElementById('adminMetaPrazo').value);
    
    try {
        if (!clientId || !name || value <= 0 || prazo <= 0) throw new Error('Preencha todos os campos corretamente.');
        
        const metaId = 'meta_' + Date.now();
        const metaData = {
            id: metaId,
            client_id: clientId,
            nome: name,
            valor_necessario: value,
            valor_economizado: 0,
            prazo_meses: prazo,
            created_at: new Date().toISOString()
        };
        
        const { error } = await supabaseClient
            .from('metas')
            .insert([metaData]);
        
        if (error) throw error;
        
        uiService.showMessage('adminMetaSuccess', 'Meta criada com sucesso!', false);
        uiService.toggle('addAdminMetaForm');
        document.getElementById('adminMetaForm').reset();
        await loadAdminMetas();
    } catch (error) {
        uiService.showMessage('adminMetaError', error.message);
    }
}

async function handleCreatePlanning(e) {
    e.preventDefault();
    const clientId = document.getElementById('planningClientSelect').value;
    const title = document.getElementById('planningTitle').value.trim();
    const description = document.getElementById('planningDescription').value.trim();
    
    try {
        if (!clientId || !title) throw new Error('Cliente e título são obrigatórios.');
        
        const planningData = {
            client_id: clientId,
            admin_id: currentAdmin.id,
            titulo: title,
            descricao: description,
            created_at: new Date().toISOString(),
            status: 'ativo'
        };
        
        const { error } = await supabaseClient
            .from('planejamentos')
            .insert([planningData]);
        
        if (error) throw error;
        
        uiService.showMessage('planningSuccess', 'Planejamento criado com sucesso!', false);
        document.getElementById('planningForm').reset();
        uiService.toggle('addPlanningForm');
        await loadAdminPlannings();
    } catch (error) {
        uiService.showMessage('planningError', error.message);
    }
}

async function loadAdminMetas() {
    try {
        const clients = await dataService.getClients(currentAdmin.id);
        if (clients.length === 0) {
            document.getElementById('adminMetasList').innerHTML = '<p class="empty-state">Nenhuma meta criada</p>';
            return;
        }
        
        const clientIds = clients.map(c => c.id);
        const { data: metas, error } = await supabaseClient
            .from('metas')
            .select('*, clientes(id, nome)')
            .in('client_id', clientIds)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // RENDERIZAR DIRETAMENTE AQUI
        renderAdminMetas(metas || []);
    } catch (error) {
        console.error(error);
    }
}

function renderAdminMetas(metas) {
    const listDiv = document.getElementById('adminMetasList');
    if (!metas || metas.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">Nenhuma meta criada</p>';
        return;
    }

    listDiv.innerHTML = metas.map(meta => {
        const progress = (meta.valor_economizado / meta.valor_necessario) * 100;
        const clientName = meta.clientes?.nome || 'Desconhecido';

        return `
            <div class="meta-card">
                <div class="meta-header">
                    <div>
                        <div class="meta-nome">${meta.nome}</div>
                        <div class="meta-client">${clientName}</div>
                    </div>
                </div>
                <div class="meta-progress-bar">
                    <div class="meta-progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                <div class="meta-info">
                    <div class="meta-info-item">
                        <div class="meta-info-label">Economizado</div>
                        <div class="meta-info-value">R$ ${meta.valor_economizado.toFixed(2)}</div>
                    </div>
                    <div class="meta-info-item">
                        <div class="meta-info-label">Necessário</div>
                        <div class="meta-info-value">R$ ${meta.valor_necessario.toFixed(2)}</div>
                    </div>
                    <div class="meta-info-item">
                        <div class="meta-info-label">Progresso</div>
                        <div class="meta-info-value">${progress.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="planning-request-actions">
                    <button onclick="openEditMetaModal('${meta.id}', true)" class="btn--secondary">✏️ Editar</button>
                    <button onclick="deleteAdminMeta('${meta.id}')" class="btn-delete">Deletar</button>
                </div>
            </div>
        `;
    }).join('');
}
async function deleteAdminMeta(metaId) {
    if (!confirm('Deletar esta meta?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('metas')
            .delete()
            .eq('id', metaId);
        
        if (error) throw error;
        await loadAdminMetas();
    } catch (error) {
        alert('Erro ao deletar meta: ' + error.message);
    }
}

async function deleteAdminMeta(metaId) {
    if (!confirm('Deletar esta meta?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('metas')
            .delete()
            .eq('id', metaId);
        
        if (error) throw error;
        await loadAdminMetas();
    } catch (error) {
        alert('Erro ao deletar meta: ' + error.message);
    }
}

async function handleAddMeta(e) {
    e.preventDefault();
    const name = document.getElementById('metaName').value.trim();
    const value = parseFloat(document.getElementById('metaValue').value);
    const prazo = parseInt(document.getElementById('metaPrazo').value);
    
    try {
        if (!name || value <= 0 || prazo <= 0) throw new Error('Preencha todos os campos corretamente.');
        
        const metaId = 'meta_' + Date.now();
        const metaData = {
            id: metaId,
            client_id: currentClient.id,
            nome: name,
            valor_necessario: value,
            valor_economizado: 0,
            prazo_meses: prazo,
            created_at: new Date().toISOString()
        };
        
        await dataService.addMeta(metaData);
        uiService.showMessage('metaError', 'Meta criada com sucesso!', false);
        uiService.toggle('addMetaForm');
        document.getElementById('metaForm').reset();
        await refreshClientMetas();
    } catch (error) {
        uiService.showMessage('metaError', error.message);
    }
}

async function handleAddTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const selectedOption = form.transCategory.options[form.transCategory.selectedIndex];
    
    try {
        if (!selectedOption.value) throw new Error('Selecione uma categoria.');
        
        const valor = parseFloat(form.transValue.value);
        if (valor <= 0) throw new Error('O valor deve ser positivo.');
        
        const transactionData = {
            client_id: currentClient.id,
            plano_de_contas_id: parseInt(selectedOption.value),
            valor: valor,
            data: form.transDate.value,
            descricao: form.transDescription.value || null,
            tipo: selectedOption.dataset.tipo,
            necessidade: selectedOption.dataset.necessidade,
            recorrencia: selectedOption.dataset.recorrencia,
        };
        
        await dataService.addTransaction(transactionData);
        uiService.showMessage('transSuccess', 'Transação registrada!', false);
        form.reset();
        document.getElementById('transDate').valueAsDate = new Date();
        await refreshClientTransactions();
    } catch (error) {
        uiService.showMessage('transError', error.message);
    }
}

async function refreshClientTransactions() {
    try {
        const transactions = await dataService.getTransactionsByClient(currentClient.id);
        uiService.renderTransactions(transactions);
        uiService.updateClientResume(transactions);
        updatePlanningSheet(transactions);
        await loadClientPlannings();
    } catch (error) {
        console.error(error.message);
    }
}

async function refreshClientMetas() {
    try {
        const metas = await dataService.getMetasByClient(currentClient.id);
        await uiService.renderClientMetas(metas);
    } catch (error) {
        console.error(error.message);
    }
}

uiService.renderClientMetas = async function(metas) {
    const listDiv = document.getElementById('clientMetasList');
    if (!metas || metas.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">Nenhuma meta criada</p>';
        return;
    }

    listDiv.innerHTML = metas.map(meta => {
        const progress = (meta.valor_economizado / meta.valor_necessario) * 100;
        return `
            <div class="meta-card">
                <div class="meta-header">
                    <div class="meta-nome">${meta.nome}</div>
                </div>
                <div class="meta-progress-bar">
                    <div class="meta-progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                <div class="meta-info">
                    <div class="meta-info-item">
                        <div class="meta-info-label">Economizado</div>
                        <div class="meta-info-value">${formatarReal(meta.valor_economizado)}</div>
                    </div>
                    <div class="meta-info-item">
                        <div class="meta-info-label">Necessário</div>
                        <div class="meta-info-value">${formatarReal(meta.valor_necessario)}</div>
                    </div>
                    <div class="meta-info-item">
                        <div class="meta-info-label">Progresso</div>
                        <div class="meta-info-value">${progress.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="planning-request-actions">
                    <button onclick="openEditMetaModal('${meta.id}', false)" class="btn--secondary" style="flex: 1;">➕ Registrar</button>
                    <button onclick="deleteMeta('${meta.id}')" class="btn-delete" style="flex: 1;">Deletar</button>
                </div>
            </div>
        `;
    }).join('');
};

async function openClientDashboard(clientId) {
    try {
        const client = await dataService.getClientById(clientId);
        const transactions = await dataService.getTransactionsByClient(clientId);
        const { data: metas } = await supabaseClient.from('metas').select('*').eq('client_id', clientId);
        
        document.getElementById('dashClientName').textContent = `Dashboard: ${client.nome}`;
        document.getElementById('dashClientEmail').textContent = client.email || 'Sem email';

        // CÁLCULOS PRINCIPAIS
        const survivalCost = biService.calculateCustoDeSobrevivencia(transactions);
        const lifestyleCost = biService.calculateCustoDeLifestyle(transactions);
        const passiveIncome = biService.calculateRendaPassivaTotal(transactions);
        const ativeIncome = biService.calculateRendaAtivaTotal(transactions);
        const passiveCoverage = biService.calculateCoberturaRendaPassiva(passiveIncome, survivalCost);
        const totalIncome = ativeIncome + passiveIncome;
        const totalExpense = survivalCost + lifestyleCost;
        const balance = totalIncome - totalExpense;
        const fixedExpenses = transactions.filter(t => t.tipo === 'despesa' && t.recorrencia === 'fixo').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
        const variableExpenses = transactions.filter(t => t.tipo === 'despesa' && t.recorrencia === 'variavel').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);

        // ATUALIZAR CARDS PRINCIPAIS
        document.getElementById('biSurvivalCost').textContent = formatarReal(survivalCost);
        document.getElementById('biLifestyleCost').textContent = formatarReal(lifestyleCost);
        document.getElementById('biPassiveIncome').textContent = formatarReal(passiveIncome);
        document.getElementById('biPassiveCoverage').textContent = `${passiveCoverage.toFixed(2)}%`;

        // ANÁLISES EXTRAS - VOCÊ PODE ADICIONAR MAIS INFORMAÇÕES AQUI
        const modalBody = document.querySelector('.modal__body');
        const existingAnalysis = modalBody.querySelector('[data-analysis-id="extra"]');
        if (existingAnalysis) existingAnalysis.remove();

        const extraAnalysis = document.createElement('div');
extraAnalysis.setAttribute('data-analysis-id', 'extra');
extraAnalysis.innerHTML = `
    <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(100, 150, 255, 0.2);">
        <h4 style="color: #fff; margin-bottom: 15px;">📊 ANÁLISE DETALHADA</h4>
        <div class="insights-grid">
            <div class="dashboard-card">
                <div class="insight-label">💰 Renda Ativa</div>
                <div class="insight-value" style="color: #64ff7a;">${formatarReal(ativeIncome)}</div>
            </div>
            <div class="dashboard-card">
                <div class="insight-label">🌱 Renda Passiva</div>
                <div class="insight-value" style="color: #6495ff;">${formatarReal(passiveIncome)}</div>
            </div>
            <div class="dashboard-card">
                <div class="insight-label">💵 Total de Renda</div>
                <div class="insight-value" style="color: #ffd700;">${formatarReal(totalIncome)}</div>
            </div>
            <div class="dashboard-card">
                <div class="insight-label">📌 Despesas Fixas</div>
                <div class="insight-value" style="color: #ff8c00;">${formatarReal(fixedExpenses)}</div>
            </div>
            <div class="dashboard-card">
                <div class="insight-label">📊 Despesas Variáveis</div>
                <div class="insight-value" style="color: #ff6464;">${formatarReal(variableExpenses)}</div>
            </div>
            <div class="dashboard-card">
                <div class="insight-label">💵 Saldo Mensal</div>
                <div class="insight-value" style="color: ${balance >= 0 ? '#64ff7a' : '#ff6464'};">${formatarReal(balance)}</div>
            </div>
        </div>

        <h4 style="color: #fff; margin-top: 25px; margin-bottom: 15px;">🎯 STATUS DAS METAS</h4>
        ${metas && metas.length > 0 ? `
            <div style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 8px;">
                <p style="color: #6495ff; margin: 5px 0;"><strong>Total de Metas:</strong> ${metas.length}</p>
                <p style="color: #64ff7a; margin: 5px 0;"><strong>Valor Total Economizado:</strong> ${formatarReal(metas.reduce((sum, m) => sum + parseFloat(m.valor_economizado || 0), 0))}</p>
                <p style="color: #ffd700; margin: 5px 0;"><strong>Valor Total em Metas:</strong> ${formatarReal(metas.reduce((sum, m) => sum + parseFloat(m.valor_necessario || 0), 0))}</p>
                <p style="color: #6495ff; margin: 5px 0;"><strong>Progresso Médio:</strong> ${(metas.reduce((sum, m) => sum + (m.valor_economizado / m.valor_necessario) * 100, 0) / metas.length).toFixed(1)}%</p>
            </div>
        ` : `<p style="color: #a0a0b0;">Nenhuma meta criada ainda.</p>`}

        <h4 style="color: #fff; margin-top: 25px; margin-bottom: 15px;">✅ RECOMENDAÇÕES</h4>
        <div style="background: rgba(100, 255, 122, 0.1); border: 1px solid rgba(100, 255, 122, 0.3); border-radius: 8px; padding: 15px;">
            <ul style="color: #e0e0e0; font-size: 13px; line-height: 1.8; list-style: none; padding: 0; margin: 0;">
                ${balance >= 0 ? `<li>✓ Saldo positivo! Mantenha este controle.</li>` : `<li>⚠️ Saldo negativo! URGENTE: Reduza despesas.</li>`}
                ${passiveCoverage >= 30 ? `<li>✓ Ótima cobertura passiva (${passiveCoverage.toFixed(1)}%).</li>` : `<li>⚠️ Aumente renda passiva (atual: ${passiveCoverage.toFixed(1)}%).</li>`}
                ${fixedExpenses > (totalIncome * 0.5) ? `<li>⚠️ Despesas fixas altas: ${((fixedExpenses/totalIncome)*100).toFixed(1)}% da renda.</li>` : `<li>✓ Despesas fixas controladas: ${((fixedExpenses/totalIncome)*100).toFixed(1)}%.</li>`}
                ${metas && metas.length > 0 ? `<li>✓ ${metas.length} meta(s) ativa(s) - Continue investindo!</li>` : `<li>💡 Crie metas para melhor planejamento.</li>`}
                <li>💡 Revise suas despesas mensalmente para otimizar.</li>
            </ul>
        </div>
    </div>
`;

        modalBody.appendChild(extraAnalysis);

        // GRÁFICOS
        const expenseDistribution = biService.getExpenseDistribution(transactions);
        const sortedExpenses = Object.entries(expenseDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const categoryLabels = sortedExpenses.map(([name]) => name);
        const categoryValues = sortedExpenses.map(([, value]) => value);
        
        uiService.renderChart('dashChartCategories', 'bar', categoryLabels, categoryValues, [
            '#ff6464', '#ffd700', '#6495ff', '#64ff7a', '#ff8c00', '#ba55d3', '#20c997', '#00d4ff'
        ]);
        
        const totalExpenses = survivalCost + lifestyleCost;
        if (totalExpenses > 0) {
            uiService.renderChart('dashChartNecessity', 'pie', ['Essencial', 'Estilo de Vida'], [survivalCost, lifestyleCost], ['#ff6464', '#ffd700']);
        }

        uiService.openModal('clientDashboardModal');
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        alert('Erro ao carregar dashboard: ' + error.message);
    }
}

async function openEditPlanningStatusModal(planningId, title, status) {
    document.getElementById('editPlanningTitle').textContent = title;
    document.getElementById('editPlanningDate').textContent = new Date().toLocaleDateString('pt-BR');
    document.getElementById('planningStatusSelect').value = status || 'ativo';
    document.getElementById('editPlanningStatusForm').dataset.planningId = planningId;
    uiService.openModal('editPlanningStatusModal');
}

async function handleEditPlanningStatus(e) {
    e.preventDefault();
    const planningId = document.getElementById('editPlanningStatusForm').dataset.planningId;
    const newStatus = document.getElementById('planningStatusSelect').value;
    const comment = document.getElementById('planningStatusComment').value.trim();

    try {
        if (!newStatus) throw new Error('Selecione um status.');

        const { error } = await supabaseClient
            .from('planejamentos')
            .update({ 
                status: newStatus,
                descricao: (comment ? `[${new Date().toLocaleDateString('pt-BR')}] ${comment}\n\n` : '') + 
                           (document.getElementById('editPlanningStatusForm').dataset.originalDesc || '')
            })
            .eq('id', planningId);

        if (error) throw error;

        uiService.showMessage('editPlanningStatusSuccess', 'Status atualizado com sucesso!', false);
        setTimeout(() => {
            uiService.closeModal('editPlanningStatusModal');
            loadAdminPlannings();
        }, 1500);
    } catch (error) {
        uiService.showMessage('editPlanningStatusError', error.message);
    }
}

function applyAdminFilters() {
    const clientFilter = document.getElementById('adminClientFilter')?.value || '';
    const typeFilter = document.getElementById('adminTypeFilter')?.value || '';
    
    let filtered = allTransactions;
    
    if (clientFilter) {
        filtered = filtered.filter(t => t.client_id === clientFilter);
    }
    
    if (typeFilter) {
        filtered = filtered.filter(t => t.tipo === typeFilter);
    }
    
    uiService.renderAdminTransactions(filtered);
}

function toggleClientNamesVisibility() {
    hideClientNamesFlag = document.getElementById('hideClientNames').checked;
    const names = document.querySelectorAll('.client-name');
    names.forEach(name => {
        if (hideClientNamesFlag) {
            name.classList.add('hidden');
        } else {
            name.classList.remove('hidden');
        }
    });
}

function toggleCollapse(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle('hidden');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link copiado!');
    }).catch(() => {
        alert('Erro ao copiar');
    });
}

async function requestPersonalPlanning() {
    try {
        // Verificar se já existe uma solicitação pendente
        const { data: existingRequest, error: checkError } = await supabaseClient
            .from('planning_requests')
            .select('*')
            .eq('client_id', currentClient.id)
            .eq('status', 'pendente')
            .single();

        if (existingRequest) {
            alert('Você já tem uma solicitação pendente! O administrador entrará em contato em breve.');
            return;
        }

        // Criar nova solicitação
        const { error } = await supabaseClient
            .from('planning_requests')
            .insert([{
                client_id: currentClient.id,
                status: 'pendente',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        alert('✓ Solicitação enviada com sucesso! O administrador entrará em contato em breve.');
        await checkPlanningStatus();
    } catch (error) {
        console.error(error);
        alert('Erro ao solicitar planejamento: ' + error.message);
    }
}

async function loadClientPlannings() {
    try {
        const { data: plannings, error } = await supabaseClient
            .from('planejamentos')
            .select('*')
            .eq('client_id', currentClient.id)
            .eq('status', 'ativo')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!plannings || plannings.length === 0) {
            document.getElementById('clientPlanningStatus').innerHTML = `
                <p>Nenhum planejamento personalizado recebido ainda.</p>
                <button onclick="requestPersonalPlanning()" class="btn btn--secondary" style="margin-top: 15px;">🤝 Solicitar Planejamento</button>
            `;
            return;
        }

        // Se houver planejamentos, mostrar o mais recente
        const latestPlanning = plannings[0];
        const createdDate = new Date(latestPlanning.created_at).toLocaleDateString('pt-BR');

        document.getElementById('clientPlanningStatus').innerHTML = `
            <div style="text-align: left; background: rgba(100, 150, 255, 0.1); padding: 20px; border-radius: 8px; border: 1px solid rgba(100, 150, 255, 0.3);">
                <h4 style="color: #6495ff; margin-bottom: 15px;">📊 ${latestPlanning.titulo}</h4>
                <p style="color: #a0a0b0; font-size: 13px; margin-bottom: 10px;">Criado em: ${createdDate}</p>
                <div style="background: rgba(100, 150, 255, 0.05); padding: 15px; border-radius: 6px; margin-top: 15px; white-space: pre-wrap; color: #e0e0e0; font-size: 13px; line-height: 1.6;">
                    ${latestPlanning.descricao}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button onclick="downloadPlanning('${latestPlanning.id}', '${latestPlanning.titulo}')" class="btn--secondary">⬇️ Baixar PDF</button>
                    ${plannings.length > 1 ? `<button onclick="viewOlderPlannings()" class="btn--secondary">📋 Ver Anteriores</button>` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error(error);
    }
}

async function downloadPlanning(planningId, title) {
    try {
        const result = await supabaseClient.from('planejamentos').select('*').eq('id', planningId).single();
        const planning = result.data;
        const client = currentClient;
        const dataAtual = new Date().toLocaleDateString('pt-BR');

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <style>
        * { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; background: white; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; border-bottom: 3px solid #6495ff; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #6495ff; margin: 0 0 10px 0; font-size: 22px; }
        .header p { color: #999; margin: 5px 0; font-size: 12px; }
        .info-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #6495ff; }
        .info-box h2 { color: #6495ff; font-size: 16px; margin-bottom: 12px; }
        .info-box p { margin: 8px 0; font-size: 13px; }
        .info-box strong { color: #333; }
        .content-box { background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #ddd; }
        .content-box h3 { color: #6495ff; font-size: 14px; border-left: 4px solid #6495ff; padding-left: 10px; margin-bottom: 15px; }
        .content-text { white-space: pre-wrap; font-family: 'Courier New'; font-size: 12px; line-height: 1.8; color: #333; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 11px; }
        </style>
        </head>
        <body>
        <div class="container">
        
        <div class="header">
        <h1>PLANEJAMENTO FINANCEIRO PERSONALIZADO</h1>
        <p>Gestor Financeiro Pro</p>
        </div>

        <div class="info-box">
        <h2>Informações do Cliente</h2>
        <p><strong>Nome:</strong> ${client.nome}</p>
        <p><strong>Email:</strong> ${client.email || 'Não informado'}</p>
        <p><strong>Data do Planejamento:</strong> ${dataAtual}</p>
        <p><strong>Título:</strong> ${planning.titulo}</p>
        </div>

        <div class="content-box">
        <h3>Detalhes e Recomendações</h3>
        <div class="content-text">${planning.descricao}</div>
        </div>

        <div class="footer">
        <p>Este planejamento foi preparado especialmente para ${client.nome}.</p>
        <p>Para dúvidas ou esclarecimentos, entre em contato com seu gestor financeiro.</p>
        <p style="margin-top: 10px; font-size: 10px;">Documento gerado em ${dataAtual}</p>
        </div>

        </div>
        </body>
        </html>
        `;

        const elemento = document.createElement('div');
        elemento.innerHTML = htmlContent;

        const opcoes = {
            margin: 8,
            filename: `Planejamento_${client.nome.replace(/ /g, '_')}_${dataAtual.replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
        };

        html2pdf().set(opcoes).from(elemento).save();
    } catch (error) {
        console.error(error);
        alert('Erro ao gerar PDF: ' + error.message);
    }
}

async function checkPlanningStatus() {
    try {
        // Verificar solicitações pendentes
        const { data: requests } = await supabaseClient
            .from('planning_requests')
            .select('*')
            .eq('client_id', currentClient.id)
            .order('created_at', { ascending: false });

        const statusDiv = document.getElementById('clientPlanningStatus');
        
        if (!requests || requests.length === 0) {
            statusDiv.innerHTML = `
                <p>Nenhum planejamento personalizado solicitado ainda.</p>
                <button onclick="requestPersonalPlanning()" class="btn btn--secondary" style="margin-top: 15px;">🤝 Solicitar Planejamento</button>
            `;
            return;
        }

        const latestRequest = requests[0];
        const createdDate = new Date(latestRequest.created_at).toLocaleDateString('pt-BR');
        const statusText = {
            'pendente': '⏳ Sua solicitação está sendo analisada',
            'em_progresso': '📊 Seu planejamento está sendo preparado',
            'concluido': '✓ Planejamento pronto!'
        };

        statusDiv.innerHTML = `
            <p style="color: #6495ff; font-weight: 600;">${statusText[latestRequest.status]}</p>
            <p style="font-size: 12px; color: #a0a0b0; margin-top: 8px;">Solicitado em: ${createdDate}</p>
        `;
    } catch (error) {
        console.error(error);
    }
}

function addEventListeners() {
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) adminLoginForm.addEventListener('submit', adminLogin);
    
    const adminRegisterForm = document.getElementById('adminRegisterForm');
    if (adminRegisterForm) adminRegisterForm.addEventListener('submit', adminRegister);
    
    const clientForm = document.getElementById('clientForm');
    if (clientForm) clientForm.addEventListener('submit', handleAddClient);
    
    const editClientForm = document.getElementById('editClientForm');
    if (editClientForm) editClientForm.addEventListener('submit', handleEditClient);
    
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) transactionForm.addEventListener('submit', handleAddTransaction);
    
    const metaForm = document.getElementById('metaForm');
    if (metaForm) metaForm.addEventListener('submit', handleAddMeta);
    
    const adminMetaForm = document.getElementById('adminMetaForm');
    if (adminMetaForm) adminMetaForm.addEventListener('submit', handleAddAdminMeta);
    
    const planningForm = document.getElementById('planningForm');
    if (planningForm) planningForm.addEventListener('submit', handleCreatePlanning);
    
    const adminClientFilter = document.getElementById('adminClientFilter');
    if (adminClientFilter) adminClientFilter.addEventListener('change', applyAdminFilters);
    
    const adminTypeFilter = document.getElementById('adminTypeFilter');
    if (adminTypeFilter) adminTypeFilter.addEventListener('change', applyAdminFilters);

    const editPlanningStatusForm = document.getElementById('editPlanningStatusForm');
    if (editPlanningStatusForm) editPlanningStatusForm.addEventListener('submit', handleEditPlanningStatus);
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// FUNÇÃO PARA FORMATAR VALORES EM REAIS COM PONTUAÇÃO CORRETA
function formatarReal(valor) {
    return parseFloat(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}