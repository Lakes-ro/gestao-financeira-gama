// config.js
const SUPABASE_URL = 'https://xnakjicfoybdfjwrsaui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYWtqaWNmb3liZGZqd3JzYXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDEwMDMsImV4cCI6MjA4NjA3NzAwM30.yYJ0i8XlV9yEZQFgLk6dKi3RAZwxCJqjW7qgw4KSx1o';

// Inicialização Global
let supabaseClient = null;

if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase conectado');
} else {
    console.error('❌ SDK do Supabase não encontrado.');
}

let supabaseClient = null;
let currentAdmin = null;
let currentClient = null;
let allClients = [];
let allTransactions = [];
let clientRefreshInterval = null;

function setSafeText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

if (clientRefreshInterval) {
    clearInterval(clientRefreshInterval);
    clientRefreshInterval = null;
}

const dataService = {
  async getPlanoDeContas() {
    try {
      const { data, error } = await supabaseClient.from('plano_de_contas').select('*').order('macro_grupo').order('ordem');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro plano de contas:', error);
      return [];
    }
  },

  async getClients(adminId) {
    try {
      const { data, error } = await supabaseClient.from('clientes').select('*').eq('admin_id', adminId).order('nome');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      return [];
    }
  },

  async getClientById(clientId) {
    try {
      const { data, error } = await supabaseClient.from('clientes').select('*').eq('id', clientId).single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      throw error;
    }
  },

  async getTransactionsByClient(clientId) {
    try {
      const { data, error } = await supabaseClient.from('transacoes').select('*, plano_de_contas(id, nome, macro_grupo, tipo, tipo_renda, necessidade, recorrencia)').eq('client_id', clientId).order('data', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro transações:', error);
      return [];
    }
  },

  async getAllTransactions(adminId) {
    try {
      const clients = await this.getClients(adminId);
      allClients = clients;
      if (clients.length === 0) return [];
      const clientIds = clients.map(c => c.id);
      const { data, error } = await supabaseClient.from('transacoes').select('*, clientes(id, nome), plano_de_contas(id, nome, tipo)').in('client_id', clientIds).order('data', { ascending: false });
      if (error) throw error;
      allTransactions = data || [];
      return allTransactions;
    } catch (error) {
      console.error('Erro:', error);
      return [];
    }
  },

  async addTransaction(data) {
    try {
      const { error } = await supabaseClient.from('transacoes').insert([data]);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async addClient(data) {
    try {
      const { error } = await supabaseClient.from('clientes').insert([data]);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async addMeta(data) {
    try {
      const { error } = await supabaseClient.from('metas').insert([data]);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async getMetasByClient(clientId) {
    try {
      const { data, error } = await supabaseClient.from('metas').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro metas:', error);
      return [];
    }
  },

  async getMetasByAdmin(adminId) {
    try {
      const clients = await this.getClients(adminId);
      if (clients.length === 0) return [];
      const clientIds = clients.map(c => c.id);
      const { data, error } = await supabaseClient.from('metas').select('*, clientes(id, nome)').in('client_id', clientIds).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro metas admin:', error);
      return [];
    }
  },

  async updateMeta(id, updateData) {
    try {
      const { error } = await supabaseClient.from('metas').update(updateData).eq('id', id);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async deleteMeta(id) {
    try {
      const { error } = await supabaseClient.from('metas').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async getPlanningsByAdmin(adminId) {
    try {
      const clients = await this.getClients(adminId);
      if (clients.length === 0) return [];
      const clientIds = clients.map(c => c.id);
      const { data, error } = await supabaseClient.from('planejamentos').select('*, clientes(id, nome)').in('client_id', clientIds).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro planejamentos:', error);
      return [];
    }
  },

  async addPlanning(data) {
    try {
      const { error } = await supabaseClient.from('planejamentos').insert([data]);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async updateClient(id, updateData) {
    try {
      const { error } = await supabaseClient.from('clientes').update(updateData).eq('id', id);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  async deleteClient(id) {
    try {
      const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  }
};

const biService = {
  calculateCustoDeSobrevivencia(transactions) {
    return transactions.filter(t => t.plano_de_contas?.necessidade === 'essencial' && t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
  },

  calculateCustoDeLifestyle(transactions) {
    return transactions.filter(t => t.plano_de_contas?.necessidade === 'estilo_de_vida' && t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
  },

  calculateRendaPassivaTotal(transactions) {
    return transactions.filter(t => t.tipo === 'receita' && t.plano_de_contas?.tipo_renda === 'passiva').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
  },

  calculateRendaAtivaTotal(transactions) {
    return transactions.filter(t => t.tipo === 'receita' && t.plano_de_contas?.tipo_renda === 'ativa').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
  },

  calculateCoberturaRendaPassiva(rendaPassiva, custoSobrevivencia) {
    if (custoSobrevivencia === 0) return 0;
    return Math.min((rendaPassiva / custoSobrevivencia) * 100, 100);
  }
};
const uiService = {
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
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
  },

  renderClients(clients) {
    const listDiv = document.getElementById('clientsList');
    if (!clients || clients.length === 0) {
      listDiv.innerHTML = '<p class="empty-state">Nenhum cliente adicionado</p>';
      return;
    }
    const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname.replace('admin.html', 'client.html')}`;
    listDiv.innerHTML = clients.map(client => {
      const clientLink = `${baseUrl}?cliente=${client.id}`;
      return `<div class="client-item"><div class="client-name">${client.nome}</div><div class="client-email">${client.email || 'Sem email'}</div><div class="client-link"><span style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${clientLink}</span><button class="btn-copy" onclick="copyToClipboard('${clientLink}')">Copiar</button></div><div class="client-actions"><button class="btn--secondary" onclick="openEditClientModal('${client.id}')">✏️ Editar</button><button class="btn--secondary" onclick="openMentorCommentsModal('${client.id}')">💬 Comentários</button><button class="btn-delete" onclick="deleteClient('${client.id}')">🗑️ Deletar</button></div></div>`;
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
      return `<div class="transaction-item ${trans.tipo}"><div class="transaction-info"><div class="transaction-description">${trans.descricao || trans.plano_de_contas?.nome || 'Sem descrição'}</div><div class="transaction-category">${trans.plano_de_contas?.nome || 'Categoria'}</div><div class="transaction-date">${new Date(trans.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div><div class="transaction-value ${trans.tipo}">${valor}</div></div>`;
    }).join('');
  },

  renderAdminTransactions(transactions) {
    const listDiv = document.getElementById('adminTransactionsList');
    if (!transactions || transactions.length === 0) {
      listDiv.innerHTML = '<p class="empty-state">Nenhuma transação</p>';
      return;
    }
    listDiv.innerHTML = transactions.map(trans => {
      const isReceita = trans.tipo === 'receita';
      const valor = `${isReceita ? '+' : '-'}R$ ${parseFloat(trans.valor || 0).toFixed(2)}`;
      const clientName = trans.clientes?.nome || 'Desconhecido';
      return `<div class="transaction-item ${trans.tipo}"><div class="transaction-info"><div class="transaction-description" style="color: #6495ff; font-weight: 700;">${clientName}</div><div class="transaction-category">${trans.plano_de_contas?.nome || 'Categoria'}</div><div class="transaction-date">${new Date(trans.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div><div class="transaction-value ${trans.tipo}">${valor}</div></div>`;
    }).join('');
  },

 updateClientResume(transactions) {
    const receitas = transactions.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const despesas = transactions.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const saldo = receitas - despesas;

    const survival = biService.calculateCustoDeSobrevivencia(transactions);
    const lifestyle = biService.calculateCustoDeLifestyle(transactions);
    const passiveIncome = biService.calculateRendaPassivaTotal(transactions);
    const totalExpense = survival + lifestyle;
    const coverage = biService.calculateCoberturaRendaPassiva(passiveIncome, survival);

    // FUNÇÃO DE BLINDAGEM (Safe Update)
    const setSafeText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    // Atualiza apenas o que existir no DOM atual
    setSafeText('totalReceitas', formatarReal(receitas));
    setSafeText('totalDespesas', formatarReal(despesas));
    setSafeText('saldo', formatarReal(saldo));
    setSafeText('biSurvivalCost', formatarReal(survival));
    setSafeText('biLifestyleCost', formatarReal(lifestyle));
    setSafeText('biPassiveIncome', formatarReal(passiveIncome));
    setSafeText('biPassiveCoverage', coverage.toFixed(1) + '%');

    if (totalExpense > 0) {
        setSafeText('biSurvivalPercent', ((survival / totalExpense) * 100).toFixed(1) + '%');
        setSafeText('biLifestylePercent', ((lifestyle / totalExpense) * 100).toFixed(1) + '%');
    }

    setSafeText('clientPlanningBalanceText', formatarReal(saldo));
    setSafeText('clientEmergencyFund', formatarReal(despesas * 3));
},

 async populateTransactionForm() {
    // 1. Verificação de existência (Onde o seu código morre se não houver o select)
    const select = document.getElementById('transCategory');
    if (!select) {
        // Se o elemento não existe na tela atual, saímos silenciosamente
        return; 
    }

    try {
        // 2. Busca de dados
        const planoDeContas = await dataService.getPlanoDeContas();
        
        // 3. Reset do Select com opção padrão
        select.innerHTML = '<option value="">Selecione uma categoria...</option>';

        // 4. Agrupamento inteligente (Business Logic)
        const grupos = planoDeContas.reduce((acc, item) => {
            const grupo = item.macro_grupo || 'Outros';
            if (!acc[grupo]) acc[grupo] = [];
            acc[grupo].push(item);
            return acc;
        }, {});

        // 5. Renderização otimizada
        for (const grupo in grupos) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `--- ${grupo} ---`;

            grupos[grupo].forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.nome;
                
                // Atributos de dados essenciais para o handleAddTransaction
                option.dataset.tipo = item.tipo;
                option.dataset.necessidade = item.necessidade || 'estilo_de_vida';
                option.dataset.recorrencia = item.recorrencia || 'variavel';
                
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        }

    } catch (error) {
        // 6. Log de erro profissional (Não use alert aqui para não travar a UI)
        console.error("Erro ao popular o formulário de transações:", error.message);
    }
},

  async renderClientMetas(metas) {
    const list = document.getElementById('clientMetasList');
    if (!metas || metas.length === 0) {
      list.innerHTML = '<p class="empty-state">Nenhuma meta criada</p>';
      return;
    }
    list.innerHTML = metas.map(m => {
      const p = (m.valor_economizado / m.valor_necessario) * 100;
      return `<div class="meta-card"><div class="meta-header"><div class="meta-nome">${m.nome}</div></div><div class="meta-progress-bar"><div class="meta-progress-fill" style="width: ${Math.min(p, 100)}%"></div></div><div class="meta-info"><div class="meta-info-item"><div class="meta-info-label">Economizado</div><div class="meta-info-value">${formatarReal(m.valor_economizado)}</div></div><div class="meta-info-item"><div class="meta-info-label">Necessário</div><div class="meta-info-value">${formatarReal(m.valor_necessario)}</div></div><div class="meta-info-item"><div class="meta-info-label">Progresso</div><div class="meta-info-value">${p.toFixed(1)}%</div></div></div><div style="display: flex; gap: 8px; margin-top: 15px;"><button onclick="openEditMetaModal('${m.id}', false)" class="btn--secondary" style="flex: 1;">➕ Registrar</button><button onclick="deleteMeta('${m.id}')" class="btn-delete" style="flex: 1;">Deletar</button></div></div>`;
    }).join('');
  }
};async function init() {
  try {
    if (!window.supabase) throw new Error('Supabase não carregou.');
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase conectado');
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('cliente');
    if (clientId) {
      await loadClientPage(clientId);
    } else {
      await checkAdminAuth();
    }
  } catch (error) {
    console.error('Erro na inicialização:', error);
  }
}

async function checkAdminAuth() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session?.user) {
      uiService.showScreen('loginAdminScreen');
      return;
    }
    currentAdmin = session.user;
    await loadAdminPage();
  } catch (error) {
    console.error('Erro checkAdminAuth:', error);
    uiService.showScreen('loginAdminScreen');
  }
}

async function adminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  try {
    if (!email || !password) throw new Error('Email e senha obrigatórios.');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentAdmin = data.user;
    await loadAdminPage();
  } catch (error) {
    uiService.showMessage('adminLoginError', error.message || 'Erro ao fazer login');
  }
}

async function adminRegister(e) {
  e.preventDefault();
  const email = document.getElementById('adminRegEmail').value.trim();
  const password = document.getElementById('adminRegPassword').value;
  try {
    if (!email || !password) throw new Error('Todos os campos obrigatórios.');
    if (password.length < 6) throw new Error('Mínimo 6 caracteres.');
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    alert('Conta criada! Faça login.');
    uiService.showScreen('loginAdminScreen');
  } catch (error) {
    uiService.showMessage('adminRegisterError', error.message);
  }
}

async function logoutAdmin() {
  if (confirm('Sair?')) {
    await supabaseClient.auth.signOut();
    currentAdmin = null;
    if (clientRefreshInterval) clearInterval(clientRefreshInterval);
    window.location.href = window.location.pathname;
  }
}

async function clientLogin(e) {
  e.preventDefault();
  const email = document.getElementById('clientEmail').value.trim();
  const password = document.getElementById('clientPassword').value;
  try {
    if (!email || !password) throw new Error('Email e senha obrigatórios.');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentAdmin = data.user;
    await loadAdminPage();
  } catch (error) {
    uiService.showMessage('clientLoginError', error.message || 'Erro ao fazer login');
  }
}

async function clientRegister(e) {
  e.preventDefault();
  const email = document.getElementById('clientRegEmail').value.trim();
  const password = document.getElementById('clientRegPassword').value;
  try {
    if (!email || !password) throw new Error('Todos os campos obrigatórios.');
    if (password.length < 6) throw new Error('Mínimo 6 caracteres.');
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    alert('Conta criada com sucesso! Faça login.');
    uiService.showScreen('loginClientScreen');
  } catch (error) {
    uiService.showMessage('clientRegisterError', error.message);
  }
}

async function logoutClient() {
  if (clientRefreshInterval) clearInterval(clientRefreshInterval);
  currentClient = null;
  window.location.href = window.location.pathname.replace('client.html', 'admin.html');
}

function navigateAdminTo(sectionId, event) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('#adminScreen .view-section').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('#adminScreen .sidebar__nav-item').forEach(item => item.classList.remove('active'));
  const view = document.getElementById(sectionId);
  if (view) view.classList.add('active');
  if (event.target) event.target.classList.add('active');
}

function navigateClientTo(sectionId, event) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('#clientScreen .view-section').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('#clientScreen .sidebar__nav-item').forEach(item => item.classList.remove('active'));
  const view = document.getElementById(sectionId);
  if (view) view.classList.add('active');
  if (event.target) event.target.classList.add('active');
}async function loadAdminPage() {
  uiService.showScreen('adminScreen');
  try {
    const clients = await dataService.getClients(currentAdmin.id);
    await dataService.getAllTransactions(currentAdmin.id);
    uiService.renderClients(clients);
    document.getElementById('adminGreeting').textContent = `Gerenciando ${clients.length} cliente(s)`;
    const adminClientFilter = document.getElementById('adminClientFilter');
    if (adminClientFilter) {
      adminClientFilter.innerHTML = '<option value="">Todos</option>';
      allClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome;
        adminClientFilter.appendChild(opt);
      });
    }
    await populateAdminMetaClientSelect();
    await loadAdminMetas();
    await loadAdminPlannings();
    await loadAdminDashboards();
    applyAdminFilters();
  } catch (error) {
    console.error('Erro ao carregar admin:', error.message);
  }
}

async function handleAddClient(e) {
  e.preventDefault();
  const name = document.getElementById('clientName').value.trim();
  const email = document.getElementById('adminClientEmail').value.trim();
  try {
    if (!name) throw new Error('Nome obrigatório.');
    const clientId = 'client_' + Date.now();
    await dataService.addClient({
      id: clientId,
      admin_id: currentAdmin.id,
      nome: name,
      email: email || null,
      hide_name: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    uiService.showMessage('clientSuccess', 'Cliente adicionado!', false);
    uiService.toggle('addClientForm');
    const clients = await dataService.getClients(currentAdmin.id);
    uiService.renderClients(clients);
  } catch (error) {
    uiService.showMessage('clientError', error.message);
  }
}

async function deleteClient(clientId) {
  if (!confirm('Tem certeza que deseja deletar este cliente? Esta ação não pode ser desfeita.')) return;
  
  try {
    // Deletar transações do cliente
    const { error: errorTrans } = await supabaseClient.from('transacoes').delete().eq('client_id', clientId);
    if (errorTrans) console.error('Erro ao deletar transações:', errorTrans);

    // Deletar metas do cliente
    const { error: errorMetas } = await supabaseClient.from('metas').delete().eq('client_id', clientId);
    if (errorMetas) console.error('Erro ao deletar metas:', errorMetas);

    // Deletar planejamentos do cliente
    const { error: errorPlanning } = await supabaseClient.from('planejamentos').delete().eq('client_id', clientId);
    if (errorPlanning) console.error('Erro ao deletar planejamentos:', errorPlanning);

    // Deletar cliente
    const { error: errorClient } = await supabaseClient.from('clientes').delete().eq('id', clientId);
    if (errorClient) {
      throw new Error('Erro ao deletar cliente: ' + errorClient.message);
    }

    alert('✅ Cliente deletado com sucesso!');
    await loadAdminPage();
  } catch (error) {
    console.error('Erro completo:', error);
    alert('❌ Erro ao deletar cliente: ' + error.message);
  }
}

function navigateClientView(viewName, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    // O SEGREDO: O botão envia 'dashboard', mas o ID é 'dashboardView'
    const targetId = viewName.endsWith('View') ? viewName : viewName + 'View';
    const targetView = document.getElementById(targetId);

    if (!targetView) {
        console.error("Engenharia: ID não encontrado ->", targetId);
        return;
    }

    // 1. Esconde todas as seções do cliente com força total
    document.querySelectorAll('#clientScreen .view-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    // 2. Remove o destaque dos botões
    document.querySelectorAll('#clientScreen .sidebar__nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Mostra a seção correta
    targetView.style.display = 'block';
    targetView.classList.add('active');

    // 4. Ativa o botão que foi clicado
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
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
    alert('Erro: ' + error.message);
  }
}

async function handleEditClient(e) {
  e.preventDefault();
  const clientId = document.getElementById('editClientForm').dataset.clientId;
  const name = document.getElementById('editClientNameInput').value.trim();
  const email = document.getElementById('editClientEmailInput').value.trim();
  try {
    if (!name) throw new Error('Nome obrigatório.');
    await dataService.updateClient(clientId, {
      nome: name,
      email: email || null,
      updated_at: new Date().toISOString()
    });
    uiService.showMessage('editClientSuccess', 'Atualizado!', false);
    setTimeout(() => {
      uiService.closeModal('editClientModal');
      loadAdminPage();
    }, 1500);
  } catch (error) {
    uiService.showMessage('editClientError', error.message);
  }
}

async function openMentorCommentsModal(clientId) {
  try {
    const client = await dataService.getClientById(clientId);
    document.getElementById('mentorClientName').textContent = client.nome;
    document.getElementById('mentorCommentsText').value = client.mentor_notes || '';
    document.getElementById('mentorCommentsForm').dataset.clientId = clientId;
    uiService.openModal('mentorCommentsModal');
  } catch (error) {
    alert('Erro: ' + error.message);
  }
}

async function handleSaveMentorComments(e) {
  e.preventDefault();
  const clientId = document.getElementById('mentorCommentsForm').dataset.clientId;
  const comments = document.getElementById('mentorCommentsText').value.trim();
  try {
    await dataService.updateClient(clientId, {
      mentor_notes: comments,
      updated_at: new Date().toISOString()
    });
    uiService.showMessage('mentorCommentsSuccess', 'Salvo!', false);
    setTimeout(() => uiService.closeModal('mentorCommentsModal'), 1500);
  } catch (error) {
    uiService.showMessage('mentorCommentsError', error.message);
  }
}async function handleAddAdminMeta(e) {
  e.preventDefault();
  const clientId = document.getElementById('adminMetaClientSelect').value;
  const name = document.getElementById('adminMetaName').value.trim();
  const value = parseFloat(document.getElementById('adminMetaValue').value);
  const prazo = parseInt(document.getElementById('adminMetaPrazo').value);
  try {
    if (!clientId || !name || value <= 0 || prazo <= 0) throw new Error('Preencha todos os campos.');
    const metaId = 'meta_' + Date.now();
    await dataService.addMeta({
      id: metaId,
      client_id: clientId,
      nome: name,
      valor_necessario: value,
      valor_economizado: 0,
      prazo_meses: prazo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    uiService.showMessage('adminMetaSuccess', 'Meta criada!', false);
    uiService.toggle('addAdminMetaForm');
    await loadAdminMetas();
  } catch (error) {
    uiService.showMessage('adminMetaError', error.message);
  }
}

async function loadAdminMetas() {
  try {
    const metas = await dataService.getMetasByAdmin(currentAdmin.id);
    renderAdminMetas(metas);
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
    return `<div class="meta-card"><div class="meta-header"><div class="meta-nome">${meta.nome}</div><div class="meta-client">${clientName}</div></div><div class="meta-progress-bar"><div class="meta-progress-fill" style="width: ${Math.min(progress, 100)}%"></div></div><div class="meta-info"><div class="meta-info-item"><div class="meta-info-label">Economizado</div><div class="meta-info-value">${formatarReal(meta.valor_economizado)}</div></div><div class="meta-info-item"><div class="meta-info-label">Necessário</div><div class="meta-info-value">${formatarReal(meta.valor_necessario)}</div></div><div class="meta-info-item"><div class="meta-info-label">Progresso</div><div class="meta-info-value">${progress.toFixed(1)}%</div></div></div><div style="display: flex; gap: 8px; margin-top: 15px;"><button onclick="openEditMetaModal('${meta.id}', true)" class="btn--secondary" style="flex: 1;">✏️ Editar</button><button onclick="deleteAdminMeta('${meta.id}')" class="btn-delete" style="flex: 1;">Deletar</button></div></div>`;
  }).join('');
}

async function deleteAdminMeta(metaId) {
  if (!confirm('Deletar esta meta?')) return;
  try {
    await dataService.deleteMeta(metaId);
    await loadAdminMetas();
  } catch (error) {
    alert('Erro ao deletar meta: ' + error.message);
  }
}

async function openEditMetaModal(metaId, fromAdmin = false) {
  try {
    const { data: meta, error } = await supabaseClient.from('metas').select('*').eq('id', metaId).single();
    if (error) throw error;
    const progress = (meta.valor_economizado / meta.valor_necessario) * 100;
    document.getElementById('metaEditName').textContent = meta.nome;
    document.getElementById('metaEditGoal').textContent = formatarReal(meta.valor_necessario);
    document.getElementById('metaEditCurrent').textContent = formatarReal(meta.valor_economizado);
    document.getElementById('metaEditProgressBar').style.width = `${Math.min(progress, 100)}%`;
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
  try {
    if (addValue <= 0) throw new Error('Digite um valor válido.');
    const { data: meta } = await supabaseClient.from('metas').select('*').eq('id', metaId).single();
    const newValue = meta.valor_economizado + addValue;
    await dataService.updateMeta(metaId, { valor_economizado: newValue, updated_at: new Date().toISOString() });
    uiService.showMessage('editMetaSuccess', 'Economia registrada com sucesso!', false);
    setTimeout(() => {
      uiService.closeModal('editMetaModal');
      if (fromAdmin) loadAdminMetas();
      else refreshClientMetas();
    }, 1500);
  } catch (error) {
    uiService.showMessage('editMetaError', error.message);
  }
}

async function deleteMeta(metaId) {
  if (!confirm('Deletar esta meta?')) return;
  try {
    await dataService.deleteMeta(metaId);
    if (currentClient) await refreshClientMetas();
    else await loadAdminMetas();
  } catch (error) {
    alert('Erro ao deletar meta: ' + error.message);
  }
}

// Função de Proteção Global
function safeUpdateText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateClientResume(transactions) {
    const survival = biService.calculateCustoDeSobrevivencia(transactions);
    const lifestyle = biService.calculateCustoDeLifestyle(transactions);
    const passiveIncome = biService.calculateRendaPassivaTotal(transactions);
    const expenses = survival + lifestyle;

    // Use a função segura em VEZ de document.getElementById(...).textContent
    safeUpdateText('biSurvivalCost', formatarReal(survival));
    safeUpdateText('biLifestyleCost', formatarReal(lifestyle));
    safeUpdateText('biPassiveIncome', formatarReal(passiveIncome));
    safeUpdateText('totalDespesas', formatarReal(expenses));
    
    // Proteção para cálculos de porcentagem
    if (expenses > 0) {
        safeUpdateText('biSurvivalPercent', ((survival / expenses) * 100).toFixed(1) + '%');
    }
}

async function populateAdminMetaClientSelect() {
  const select = document.getElementById('adminMetaClientSelect');
  select.innerHTML = '<option value="">Selecione um cliente</option>';
  allClients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    select.appendChild(opt);
  });
}async function openPlanningBuilder(clientId = null) {
  if (!clientId) {
    uiService.openModal('planningBuilderModal');
    return;
  }
  try {
    const client = await dataService.getClientById(clientId);
    const transactions = await dataService.getTransactionsByClient(clientId);
    const activeIncome = biService.calculateRendaAtivaTotal(transactions);
    const passiveIncome = biService.calculateRendaPassivaTotal(transactions);
    const totalIncome = activeIncome + passiveIncome;
    const survivalCost = biService.calculateCustoDeSobrevivencia(transactions);
    const lifestyleCost = biService.calculateCustoDeLifestyle(transactions);
    const totalExpense = survivalCost + lifestyleCost;
    const passiveCoverage = biService.calculateCoberturaRendaPassiva(passiveIncome, survivalCost);
    document.getElementById('planningClientName').textContent = client.nome;
    document.getElementById('planningActiveIncome').textContent = formatarReal(activeIncome);
    document.getElementById('planningPassiveIncome').textContent = formatarReal(passiveIncome);
    document.getElementById('planningTotalIncome').textContent = formatarReal(totalIncome);
    document.getElementById('planningTotalExpense').textContent = formatarReal(totalExpense);
    document.getElementById('planningBuilderTitle').value = `Planejamento - ${new Date().toLocaleDateString('pt-BR')}`;
    let recommendations = 'OBJETIVOS RECOMENDADOS:\n\n';
    if (totalIncome - totalExpense > 0) {
      recommendations += `✓ Saldo positivo de R$ ${(totalIncome - totalExpense).toFixed(2)}/mês\n`;
    } else {
      recommendations += `⚠️ SALDO NEGATIVO: R$ ${Math.abs(totalIncome - totalExpense).toFixed(2)}/mês\n`;
    }
    if (passiveCoverage < 30) {
      recommendations += `⚠️ Cobertura Passiva: ${passiveCoverage.toFixed(1)}% (Meta: 50%)\n`;
    }
    document.getElementById('planningRecommendations').value = recommendations;
    document.getElementById('planningBuilderModal').dataset.clientId = clientId;
    uiService.openModal('planningBuilderModal');
  } catch (error) {
    alert('Erro: ' + error.message);
  }
}

async function savePlanningForClient(e) {
  e.preventDefault();
  try {
    const clientId = document.getElementById('planningBuilderModal').dataset.clientId;
    const titulo = document.getElementById('planningBuilderTitle').value.trim();
    const recomendacoes = document.getElementById('planningRecommendations').value.trim();
    const detalhes = document.getElementById('planningDetails').value.trim();
    if (!titulo) throw new Error('Digite o título do planejamento.');
    const planningId = crypto.randomUUID();
    await dataService.addPlanning({
      id: planningId,
      client_id: clientId,
      admin_id: currentAdmin.id,
      titulo: titulo,
      recomendacoes: recomendacoes,
      detalhes: detalhes,
      descricao: recomendacoes + '\n\n' + detalhes,
      status: 'ativo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    alert('Planejamento salvo com sucesso!');
    setTimeout(() => {
      uiService.closeModal('planningBuilderModal');
      loadAdminPlannings();
    }, 1000);
  } catch (error) {
    alert('Erro: ' + error.message);
  }
}

async function deletePlanning(planningId) {
  if (!confirm('Deletar este planejamento?')) return;
  try {
    const { error } = await supabaseClient.from('planejamentos').delete().eq('id', planningId);
    if (error) throw error;
    await loadAdminPlannings();
  } catch (error) {
    alert('Erro ao deletar planejamento: ' + error.message);
  }
}

async function loadAdminPlannings() {
  try {
    const plannings = await dataService.getPlanningsByAdmin(currentAdmin.id);
    renderAdminPlannings(plannings);
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
  listDiv.innerHTML = plannings.map(planning => {
    const clientName = planning.clientes?.nome || 'Desconhecido';
    const createdDate = new Date(planning.created_at).toLocaleDateString('pt-BR');
    return `<div class="planning-request-card"><div class="planning-request-header"><div><div class="planning-request-name">${planning.titulo}</div><div class="meta-client">${clientName}</div></div></div><p style="color: #a0a0b0; font-size: 13px; margin: 12px 0;">Criado em: ${createdDate}</p><div style="display: flex; gap: 8px; margin-top: 15px;"><button onclick="deletePlanning('${planning.id}')" class="btn-delete" style="flex: 1;">Deletar</button></div></div>`;
  }).join('');
}

async function loadAdminDashboards() {
  try {
    const clients = await dataService.getClients(currentAdmin.id);
    renderAdminDashboards(clients);
  } catch (error) {
    console.error('Erro ao carregar dashboards:', error);
  }
}

function renderAdminDashboards(clients) {
  const listDiv = document.getElementById('dashboardsList');
  if (!clients || clients.length === 0) {
    listDiv.innerHTML = '<p class="empty-state">Nenhum cliente disponível</p>';
    return;
  }
  listDiv.innerHTML = clients.map(client => {
    return `<div class="client-item"><div class="client-name">${client.nome}</div><div class="client-email">${client.email || 'Sem email'}</div><div style="margin-top: auto; display: flex; gap: 8px;"><button class="btn--secondary" style="flex: 1;" onclick="openClientDashboard('${client.id}')">📊 Ver Dashboard</button></div></div>`;
  }).join('');
}

async function openClientDashboard(clientId) {
  try {
    const client = await dataService.getClientById(clientId);
    const transactions = await dataService.getTransactionsByClient(clientId);
    const survival = biService.calculateCustoDeSobrevivencia(transactions);
    const lifestyle = biService.calculateCustoDeLifestyle(transactions);
    const passiveIncome = biService.calculateRendaPassivaTotal(transactions);
    const coverage = biService.calculateCoberturaRendaPassiva(passiveIncome, survival);
    document.getElementById('dashboardModalClientName').textContent = client.nome;
    document.getElementById('dashModalSurvival').textContent = formatarReal(survival);
    document.getElementById('dashModalLifestyle').textContent = formatarReal(lifestyle);
    document.getElementById('dashModalPassive').textContent = formatarReal(passiveIncome);
    document.getElementById('dashModalCoverage').textContent = coverage.toFixed(1) + '%';
    drawPieChart(survival, lifestyle);
    drawBarChart(transactions);
    const activeIncome = biService.calculateRendaAtivaTotal(transactions);
    const totalIncome = activeIncome + passiveIncome;
    const fixedExpenses = transactions.filter(t => t.tipo === 'despesa' && t.recorrencia === 'fixo').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const variableExpenses = transactions.filter(t => t.tipo === 'despesa' && t.recorrencia === 'variavel').reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const monthlyBalance = totalIncome - (survival + lifestyle);
    document.getElementById('dashAnalyticActiveIncome').textContent = formatarReal(activeIncome);
    document.getElementById('dashAnalyticPassiveIncome').textContent = formatarReal(passiveIncome);
    document.getElementById('dashAnalyticTotalIncome').textContent = formatarReal(totalIncome);
    document.getElementById('dashAnalyticFixedExpenses').textContent = formatarReal(fixedExpenses);
    document.getElementById('dashAnalyticVariableExpenses').textContent = formatarReal(variableExpenses);
    document.getElementById('dashAnalyticMonthlyBalance').textContent = formatarReal(monthlyBalance);
    const metas = await dataService.getMetasByClient(clientId);
    const totalMetasValue = metas.reduce((sum, m) => sum + parseFloat(m.valor_necessario || 0), 0);
    const totalSaved = metas.reduce((sum, m) => sum + parseFloat(m.valor_economizado || 0), 0);
    const avgProgress = metas.length > 0 ? (totalSaved / totalMetasValue) * 100 : 0;
    document.getElementById('dashMetasTotal').textContent = metas.length;
    document.getElementById('dashMetasSaved').textContent = formatarReal(totalSaved);
    document.getElementById('dashMetasTarget').textContent = formatarReal(totalMetasValue);
    document.getElementById('dashMetasProgress').textContent = avgProgress.toFixed(1);
    generateRecommendations(totalIncome, survival + lifestyle, passiveIncome, metas, avgProgress);
    uiService.openModal('dashboardModal');
  } catch (error) {
    alert('Erro ao carregar dashboard: ' + error.message);
  }
}

function generateRecommendations(totalIncome, totalExpenses, passiveIncome, metas, metasProgress) {
  const recommendations = [];
  const balance = totalIncome - totalExpenses;
  const passiveCoverage = totalExpenses > 0 ? (passiveIncome / totalExpenses) * 100 : 0;
  if (balance > 0) {
    recommendations.push(`✓ Saldo positivo! Mantenha este controle.`);
  } else if (balance < 0) {
    recommendations.push(`⚠️ SALDO NEGATIVO: R$ ${Math.abs(balance).toFixed(2)}/mês - Reduza despesas urgentemente.`);
  } else {
    recommendations.push(`⚠️ Saldo zerado - Procure gerar superávit.`);
  }
  if (passiveCoverage >= 50) {
    recommendations.push(`✓ Cobertura passiva excelente (${passiveCoverage.toFixed(1)}%) - Continue investindo!`);
  } else if (passiveCoverage >= 30) {
    recommendations.push(`✓ Cobertura passiva: ${passiveCoverage.toFixed(1)}% (Meta: 50%) - Aumentar investimentos.`);
  } else if (passiveCoverage > 0) {
    recommendations.push(`⚠️ Cobertura passiva baixa (${passiveCoverage.toFixed(1)}%) - Priorize renda passiva.`);
  } else {
    recommendations.push(`⚠️ Sem renda passiva - Inicie investimentos imediatamente.`);
  }
  const expensePercentage = (totalExpenses / totalIncome) * 100;
  if (expensePercentage > 90) {
    recommendations.push(`⚠️ Despesas muito altas (${expensePercentage.toFixed(1)}% da renda) - Otimize gastos.`);
  } else if (expensePercentage > 75) {
    recommendations.push(`✓ Despesas controladas (${expensePercentage.toFixed(1)}% da renda) - Continue assim.`);
  } else {
    recommendations.push(`✓ Excelente controle de despesas (${expensePercentage.toFixed(1)}% da renda).`);
  }
  if (metas.length === 0) {
    recommendations.push(`💡 Nenhuma meta criada - Estabeleça objetivos financeiros.`);
  } else if (metasProgress >= 50) {
    recommendations.push(`✓ Progresso nas metas em dia (${metasProgress.toFixed(1)}%) - Mantenha o ritmo!`);
  } else if (metasProgress > 0) {
    recommendations.push(`💡 Metas em progresso (${metasProgress.toFixed(1)}%) - Acelere a poupança.`);
  } else {
    recommendations.push(`⚠️ Metas criadas mas sem progresso - Comece a economizar.`);
  }
  const emergencyFundRecommended = totalExpenses * 3;
  recommendations.push(`💰 Fundo de Emergência ideal: R$ ${emergencyFundRecommended.toFixed(2)} (3 meses de despesas).`);
  if (balance > (totalExpenses * 0.1)) {
    recommendations.push(`✓ Sobra mensal significativa - Considere investir parte desse montante.`);
  }
  const recHtml = recommendations.map(r => `<p style="margin-bottom: 10px;">• ${r}</p>`).join('');
  document.getElementById('dashRecommendations').innerHTML = recHtml;
}async function loadClientPage(clientId) {
  try {
    currentClient = await dataService.getClientById(clientId);
    document.getElementById('clientNameDisplay').textContent = currentClient.nome;
    uiService.showScreen('clientScreen');
    document.getElementById('transDate').valueAsDate = new Date();
    const dashboardView = document.getElementById('dashboardView');
    if (dashboardView) dashboardView.classList.add('active');
    await uiService.populateTransactionForm();
    await refreshClientTransactions();
    if (currentClient.mentor_notes) {
      document.getElementById('mentorDiagnosisCard').classList.remove('hidden');
      document.getElementById('mentorDiagnosisText').textContent = currentClient.mentor_notes;
    }
    if (clientRefreshInterval) clearInterval(clientRefreshInterval);
    clientRefreshInterval = setInterval(refreshClientTransactions, 5000);
  } catch (error) {
    alert(error.message);
    window.location.href = window.location.pathname.replace('client.html', 'admin.html');
  }
}

async function refreshClientTransactions() {
  try {
    const transactions = await dataService.getTransactionsByClient(currentClient.id);
    uiService.renderTransactions(transactions);
    uiService.updateClientResume(transactions);
    await refreshClientMetas();
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
      created_at: new Date().toISOString()
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

async function handleAddMeta(e) {
  e.preventDefault();
  const name = document.getElementById('metaName').value.trim();
  const value = parseFloat(document.getElementById('metaValue').value);
  const prazo = parseInt(document.getElementById('metaPrazo').value);
  try {
    if (!name || value <= 0 || prazo <= 0) throw new Error('Preencha todos os campos corretamente.');
    const metaId = 'meta_' + Date.now();
    await dataService.addMeta({
      id: metaId,
      client_id: currentClient.id,
      nome: name,
      valor_necessario: value,
      valor_economizado: 0,
      prazo_meses: prazo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    uiService.showMessage('transSuccess', 'Meta criada com sucesso!', false);
    uiService.toggle('addMetaForm');
    await refreshClientMetas();
  } catch (error) {
    uiService.showMessage('transError', error.message);
  }
}

function toggleCollapse(elementId) {
  const element = document.getElementById(elementId);
  if (element) element.classList.toggle('hidden');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Link copiado!');
  }).catch(() => {
    alert('Erro ao copiar');
  });
}

function formatarReal(valor) {
  return parseFloat(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showAdminProfile() {
  if (currentAdmin) {
    document.getElementById('profileAdminEmail').textContent = currentAdmin.email;
    uiService.openModal('adminProfileModal');
  }
}

function showClientProfile() {
  if (currentClient) {
    document.getElementById('profileClientName').textContent = currentClient.nome;
    document.getElementById('profileClientEmail').textContent = currentClient.email || 'Sem email';
    uiService.openModal('clientProfileModal');
  }
}

function applyAdminFilters() {
  const clientFilter = document.getElementById('adminClientFilter')?.value || '';
  const typeFilter = document.getElementById('adminTypeFilter')?.value || '';
  let filtered = allTransactions;
  if (clientFilter) filtered = filtered.filter(t => t.client_id === clientFilter);
  if (typeFilter) filtered = filtered.filter(t => t.tipo === typeFilter);
  uiService.renderAdminTransactions(filtered);
}

function drawPieChart(survival, lifestyle) {
  const ctx = document.getElementById('dashModalPieChart').getContext('2d');
  if (window.pieChart) window.pieChart.destroy();
  window.pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Essencial', 'Estilo de Vida'],
      datasets: [{
        data: [survival, lifestyle],
        backgroundColor: ['#ff6464', '#ffd700'],
        borderColor: ['#ff4444', '#ffb700'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#a0a0b0', font: { size: 12 } }
        }
      }
    }
  });
}

function drawBarChart(transactions) {
  const categoryTotals = {};
  transactions.forEach(t => {
    if (t.tipo === 'despesa') {
      const category = t.plano_de_contas?.nome || 'Outros';
      categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(t.valor || 0);
    }
  });
  const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const ctx = document.getElementById('dashModalBarChart').getContext('2d');
  if (window.barChart) window.barChart.destroy();
  window.barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([cat]) => cat),
      datasets: [{
        label: 'Valor (R$)',
        data: sorted.map(([_, val]) => val),
        backgroundColor: '#6495ff',
        borderColor: '#4a7dff',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#a0a0b0', font: { size: 12 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#a0a0b0' },
          grid: { color: 'rgba(100, 150, 255, 0.1)' }
        },
        y: {
          ticks: { color: '#a0a0b0' },
          grid: { color: 'rgba(100, 150, 255, 0.1)' }
        }
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


