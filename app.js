/**
 * APP.JS - ORQUESTRADOR UNIFICADO (RBAC) — ADAPTADO
 * ================================================
 * ✅ MUDANÇAS MÍNIMAS:
 *    - perfis → usuarios (nome_completo, apelido)
 *    - usuarios_perfis para RBAC (perfil: 'admin' | 'client')
 *    - registo/onboarding insere em usuarios + usuarios_perfis
 *    - Resto mantém-se igual (639 linhas originais)
 */

// ================================================
// UTILITÁRIOS GLOBAIS
// ================================================

function toggleScreen(screenId) {
    UIModule.showScreen(screenId);
}

function closeModal(modalId) {
    UIModule.closeModal(modalId);
}

function toggleAddClientForm() {
    document.getElementById('addClientForm')?.classList.toggle('hidden');
}

function toggleAddMetaForm() {
    document.getElementById('addMetaForm')?.classList.toggle('hidden');
}

function switchAdminView(sectionId, event) {
    event.preventDefault();
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
    document.querySelectorAll('.sidebar__nav-item').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function switchClientView(sectionId, event) {
    event.preventDefault();
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
    document.querySelectorAll('.sidebar__nav-item').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// ================================================
// ROTEAMENTO PÓS-LOGIN (RBAC)
// ================================================

async function routeByRole(user, role) {
    if (role === 'client') {
        // ── VERIFICA ONBOARDING ──
        const needsOnboarding = await checkOnboarding(user, role);
        if (needsOnboarding) {
            UIModule.showScreen('onboardingScreen');
            return;
        }

        // ── FLUXO CLIENTE ──
        // Carrega apelido da tabela usuarios para exibir no dashboard
        try {
            const { data: usuario } = await supabaseClient
                .from(CONFIG.TABLES.USUARIOS)
                .select('apelido')
                .eq('id', user.id)
                .maybeSingle();
            if (usuario?.apelido) {
                UIModule.setText('clientNameDisplay', usuario.apelido);
            }
        } catch (_) {}

        ClientModule.setClientId(user.id);
        UIModule.showScreen('clientScreen');
        await loadClientDashboard();
    } else {
        // ── FLUXO ADMIN ──
        AdminModule.setAdminId(user.id);
        UIModule.showScreen('adminScreen');
        await loadAdminDashboard();
    }
}

// ================================================
// LOGIN UNIFICADO
// ================================================

async function handleLogin(event) {
    event.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl  = document.getElementById('loginError');

    // Limpa erro anterior
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }

    if (!email || !password) {
        showLoginError('Preenche o email e a senha.');
        return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

    try {
        const { user, role } = await AuthModule.login(email, password);
        await routeByRole(user, role);
    } catch (error) {
        const msg = error.message || '';

        if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
            // Verifica se o email existe tentando distinguir os casos
            showLoginError(
                'Email não encontrado ou senha incorreta.',
                `Não tens conta? <a href="#" onclick="toggleScreen('registerScreen'); return false;" style="color:#6495ff; font-weight:700;">Criar conta grátis</a>`
            );
        } else if (msg.includes('Email not confirmed')) {
            showLoginError('Email ainda não confirmado. Verifica a tua caixa de entrada.');
        } else {
            showLoginError(msg || 'Erro ao entrar. Tenta novamente.');
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
    }
}

function showLoginError(msg, extra = '') {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.innerHTML = '⚠️ ' + msg + (extra ? '<br><span style="font-size:12px; margin-top:6px; display:block;">' + extra + '</span>' : '');
        errorEl.classList.remove('hidden');
    }
}

// ================================================
// CADASTRO — ADAPTADO PARA USUARIOS + USUARIOS_PERFIS
// ================================================

async function handleRegister(event) {
    event.preventDefault();

    const nome       = document.getElementById('registerNome')?.value.trim() || '';
    const apelido    = document.getElementById('registerApelido')?.value.trim() || '';
    const email      = document.getElementById('registerEmail').value.trim();
    const password   = document.getElementById('registerPassword').value;
    const confirm    = document.getElementById('registerPasswordConfirm')?.value || '';
    const errorEl    = document.getElementById('registerError');

    const showErr = (msg) => {
        if (errorEl) { errorEl.textContent = '⚠️ ' + msg; errorEl.classList.remove('hidden'); }
        else UIModule.showError(msg);
    };

    if (errorEl) errorEl.classList.add('hidden');

    if (!nome || !apelido || !email || !password) {
        showErr('Preenche todos os campos.'); return;
    }
    if (password.length < 6) { showErr('Senha mínima de 6 caracteres.'); return; }
    if (password !== confirm) { showErr('As senhas não coincidem.'); return; }

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Criando conta...'; }

    try {
        // 1. Cria no Supabase Auth
        const user = await AuthModule.register(email, password);

        // 2. Insere em usuarios (novo padrão)
        await supabaseClient.from(CONFIG.TABLES.USUARIOS).insert([{
            id:              user.id,
            nome_completo:   nome,
            apelido:         apelido,
            created_at:      new Date().toISOString()
        }]);

        // 3. Insere em usuarios_perfis com role 'client'
        await supabaseClient.from(CONFIG.TABLES.USUARIOS_PERFIS).insert([{
            usuario_id: user.id,
            perfil:     'client',
            created_at: new Date().toISOString()
        }]);

        // 4. Insere na tabela clientes vinculado ao admin
        const { data: jaExiste } = await supabaseClient
            .from(CONFIG.TABLES.CLIENTES).select('id').eq('id', user.id).maybeSingle();

        if (!jaExiste) {
            await supabaseClient.from(CONFIG.TABLES.CLIENTES).insert([{
                id:       user.id,
                nome:     nome,
                email:    email,
                admin_id: CONFIG.ADMIN.ID
            }]);
        }

        UIModule.showSuccess(`Conta criada! Bem-vindo, ${apelido}! Faz login agora.`);
        setTimeout(() => UIModule.showScreen('loginScreen'), 2000);

    } catch (error) {
        const msg = error.message || '';
        if (msg.includes('already registered') || msg.includes('already been registered')) {
            showErr('Este email já tem uma conta. Faz login.');
        } else {
            showErr(msg || 'Erro ao criar conta.');
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta'; }
    }
}

// ================================================
// ONBOARDING — ADAPTADO PARA USUARIOS + USUARIOS_PERFIS
// ================================================

async function checkOnboarding(user, role) {
    // Admin não passa pelo onboarding
    if (role === 'admin') return false;

    try {
        const { data } = await supabaseClient
            .from(CONFIG.TABLES.USUARIOS)
            .select('nome_completo, apelido')
            .eq('id', user.id)
            .maybeSingle();

        // Se não tem perfil ou falta nome/apelido → precisa de onboarding
        if (!data || !data.nome_completo || !data.apelido) return true;
        return false;
    } catch (_) {
        return true;
    }
}

async function handleOnboarding(event) {
    event.preventDefault();
    const nome       = document.getElementById('onboardingNome').value.trim();
    const apelido    = document.getElementById('onboardingApelido').value.trim();
    const user       = AuthModule.getUser();

    console.log('🔵 handleOnboarding iniciado:', { userId: user.id, nome, apelido });

    if (!nome || !apelido) { UIModule.showError('Preenche todos os campos'); return; }

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        // 1. Upsert em usuarios (novo padrão)
        console.log('📝 1. Upserting em usuarios...');
        const { error: usuarioError, data: usuarioData } = await supabaseClient
            .from(CONFIG.TABLES.USUARIOS)
            .upsert({
                id:              user.id,
                nome_completo:   nome,
                apelido:         apelido,
                created_at:      new Date().toISOString()
            });

        if (usuarioError) {
            console.error('❌ Erro ao upsert usuarios:', usuarioError);
            throw usuarioError;
        }
        console.log('✅ Usuarios upsert OK:', usuarioData);

        // 2. Garante registo em usuarios_perfis
        console.log('📝 2. Verificando usuarios_perfis...');
        const { data: jaTemPerfil, error: selectError } = await supabaseClient
            .from(CONFIG.TABLES.USUARIOS_PERFIS)
            .select('id')
            .eq('usuario_id', user.id)
            .maybeSingle();

        if (selectError) {
            console.error('❌ Erro ao SELECT usuarios_perfis:', selectError);
            throw selectError;
        }

        if (!jaTemPerfil) {
            console.log('📝 2a. Inserindo novo perfil em usuarios_perfis...');
            const { error: insertError, data: insertData } = await supabaseClient
                .from(CONFIG.TABLES.USUARIOS_PERFIS)
                .insert([{
                    usuario_id: user.id,
                    perfil:     'client',
                    created_at: new Date().toISOString()
                }]);

            if (insertError) {
                console.error('❌ Erro ao INSERT usuarios_perfis:', insertError);
                throw insertError;
            }
            console.log('✅ usuarios_perfis INSERT OK:', insertData);
        } else {
            console.log('✅ usuarios_perfis já existe');
        }

        // 3. Garante registo na tabela clientes vinculado ao único admin do sistema
        console.log('📝 3. Verificando clientes...');
        const { data: jaExisteCliente, error: selectClientError } = await supabaseClient
            .from(CONFIG.TABLES.CLIENTES)
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (selectClientError) {
            console.error('❌ Erro ao SELECT clientes:', selectClientError);
            throw selectClientError;
        }

        if (!jaExisteCliente) {
            console.log('📝 3a. Inserindo novo cliente...');
            const { error: insertClientError, data: insertClientData } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .insert([{
                    id:       user.id,
                    nome:     nome,
                    email:    user.email,
                    admin_id: CONFIG.ADMIN.ID
                }]);

            if (insertClientError) {
                console.error('❌ Erro ao INSERT clientes:', insertClientError);
                throw insertClientError;
            }
            console.log('✅ clientes INSERT OK:', insertClientData);
        } else {
            console.log('✅ clientes já existe');
        }

        console.log('✅ Onboarding completo! Redirecionando...');
        UIModule.showSuccess(`Bem-vindo, ${apelido}! 🎉`);

        // 4. Segue para o painel do cliente
        ClientModule.setClientId(user.id);
        UIModule.setText('clientNameDisplay', apelido);
        UIModule.showScreen('clientScreen');
        await loadClientDashboard();
    } catch (error) {
        console.error('❌ Erro crítico em handleOnboarding:', error);
        UIModule.showError(error.message || 'Erro ao salvar perfil');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Continuar →'; }
    }
}

// ================================================
// LOGOUT
// ================================================

async function handleLogout() {
    if (!confirm('Tens a certeza que queres sair?')) return;

    try {
        await AuthModule.logout();
        window.location.reload();
    } catch (error) {
        UIModule.showError('Erro ao fazer logout');
    }
}

// ================================================
// PAINEL ADMIN — DASHBOARD
// ================================================

async function loadAdminDashboard() {
    try {
        await AdminModule.loadClients();
        AdminModule.renderClients('clientsList');
        AdminModule.updateAdminHeader();

        const adminId = AuthModule.getUser().id;

        const metas = await GoalsModule.loadAllGoals(adminId);
        GoalsModule.renderGoals('adminMetasList', metas);

        await TransactionsModule.loadAllTransactions(adminId);
        TransactionsModule.renderTransactions('transactionsList');

        populateClientSelects();
    } catch (error) {
        console.error('Erro admin dashboard:', error);
        UIModule.showError('Erro ao carregar painel admin');
    }
}

function populateClientSelects() {
    const clients = AdminModule.getClients();
    const opts    = clients.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    const selPlanning = document.getElementById('planningSelectClient');
    const selMeta     = document.getElementById('adminMetaClientSelect');
    const selFilter   = document.getElementById('razoneteClientFilter');

    if (selPlanning) selPlanning.innerHTML = `<option value="">Escolha um cliente</option>${opts}`;
    if (selMeta)     selMeta.innerHTML     = `<option value="">Selecione um cliente</option>${opts}`;
    if (selFilter)   selFilter.innerHTML   = `<option value="">Todos os clientes</option>${opts}`;
}

// ── ADICIONAR CLIENTE ──

async function handleAddClient(event) {
    event.preventDefault();
    const nome    = document.getElementById('clientName').value.trim();
    const email   = document.getElementById('adminClientEmail').value.trim();
    const adminId = AuthModule.getUser().id;

    if (!nome || !email) { UIModule.showError('Nome e email são obrigatórios'); return; }

    try {
        await AdminModule.addClient({ nome, email, admin_id: adminId });
        event.target.reset();
        document.getElementById('addClientForm')?.classList.add('hidden');
        await loadAdminDashboard();
    } catch (_) { /* erro já tratado em AdminModule */ }
}

// ── EDITAR CLIENTE ──

async function handleEditClientSubmit(event) {
    event.preventDefault();
    const form     = event.target;
    const clientId = form.querySelector('input[name="clientId"]').value;
    const nome     = form.querySelector('input[name="nome"]').value.trim();
    const email    = form.querySelector('input[name="email"]').value.trim();

    try {
        await AdminModule.updateClient(clientId, { nome, email });
        closeModal('editClientModal');
        await loadAdminDashboard();
    } catch (_) { UIModule.showError('Erro ao actualizar cliente'); }
}

// ── ANOTAÇÕES ──

async function handleSaveComments(event) {
    event.preventDefault();
    const clientId = document.getElementById('commentsClientId').value;
    const comments = document.getElementById('clientComments').value;

    try {
        await AdminModule.saveComments(clientId, comments);
        closeModal('commentsModal');
    } catch (_) { UIModule.showError('Erro ao guardar anotações'); }
}

// ── METAS (ADMIN) ──

async function handleAddAdminMeta(event) {
    event.preventDefault();
    const clientId = document.getElementById('adminMetaClientSelect').value;
    const nome     = document.getElementById('adminMetaName').value.trim();
    const valor    = parseFloat(document.getElementById('adminMetaValue').value);

    if (!clientId) { UIModule.showError('Seleciona um cliente'); return; }

    try {
        await GoalsModule.addGoal({ client_id: clientId, nome, valor_necessario: valor, valor_economizado: 0 });
        event.target.reset();
        UIModule.showSuccess('Meta criada!');
        await loadAdminDashboard();
    } catch (_) { UIModule.showError('Erro ao criar meta'); }
}

// ── PLANEJAMENTO ──

async function handleAddPlanning(event) {
    event.preventDefault();
    const clientId      = document.getElementById('planningClientId').value;
    const titulo        = document.getElementById('planningBuilderTitle').value.trim();
    const recomendacoes = document.getElementById('planningRecommendations').value;
    const detalhes      = document.getElementById('planningDetails').value;

    if (!clientId) { UIModule.showError('Seleciona um cliente'); return; }

    try {
        await PlanningModule.addPlanning({ client_id: clientId, titulo, recomendacoes, detalhes });
        event.target.reset();
        document.getElementById('planningForm')?.classList.add('hidden');
    } catch (_) { UIModule.showError('Erro ao salvar planejamento'); }
}

async function loadPlanningForClient() {
    const clientId = document.getElementById('planningSelectClient').value;
    if (!clientId) { UIModule.showError('Seleciona um cliente'); return; }
    document.getElementById('planningClientId').value = clientId;
    document.getElementById('planningForm')?.classList.remove('hidden');
}

// ── RAZONETE ──

async function loadAdminTransactions() {
    const adminId  = AuthModule.getUser().id;
    const clientId = document.getElementById('razoneteClientFilter')?.value || '';
    const tipo     = document.getElementById('razoneteTypeFilter')?.value   || '';

    await TransactionsModule.loadAllTransactions(adminId);
    TransactionsModule.renderTransactions('transactionsList', {
        clientId: clientId || undefined,
        type:     tipo     || undefined
    });
}

// ── PERFIL ADMIN ──

function showAdminProfile() {
    const user = AuthModule.getUser();
    UIModule.setText('profileAdminEmail', user?.email || 'Admin');
    UIModule.openModal('adminProfileModal');
}

// ================================================
// PAINEL CLIENTE — DASHBOARD
// ================================================

async function loadClientDashboard() {
    try {
        const clientId = ClientModule.getClientId();
        const user     = AuthModule.getUser();

        // Tenta buscar apelido da tabela usuarios
        try {
            const { data: usuario } = await supabaseClient
                .from(CONFIG.TABLES.USUARIOS).select('apelido').eq('id', user.id).maybeSingle();
            UIModule.setText('clientNameDisplay', usuario?.apelido || user?.email?.split('@')[0] || 'Cliente');
        } catch (_) {
            UIModule.setText('clientNameDisplay', user?.email?.split('@')[0] || 'Cliente');
        }

        await DashboardModule.renderClientDashboard(clientId);

        const goals = await GoalsModule.loadClientGoals(clientId);
        GoalsModule.renderGoals('clientMetasList', goals);

        await loadClientTransactions();
        await loadClientPlanning();

    } catch (error) {
        console.error('Erro dashboard cliente:', error);
        UIModule.showError('Erro ao carregar dashboard');
    }
}

async function loadClientTransactions() {
    try {
        const clientId    = ClientModule.getClientId();
        const transactions = await DatabaseModule.getTransactionsByClient(clientId);
        TransactionsModule.renderTransactions('transactionHistoryList', {}, transactions);
    } catch (error) {
        console.error('Erro transações cliente:', error);
    }
}

async function loadClientPlanning() {
    try {
        const clientId = ClientModule.getClientId();
        const plannings = await PlanningModule.loadClientPlannings(clientId);

        const container = document.getElementById('clientPlanningList');
        if (!container) return;

        if (!plannings || plannings.length === 0) {
            container.innerHTML = '<p class="empty-state">Aguardando planejamento do administrador...</p>';
            return;
        }

        container.innerHTML = plannings.map(p => `
            <div class="card" style="margin-bottom: 15px;">
                <h3>${p.titulo}</h3>
                ${p.recomendacoes ? `<p style="color:#a0a0b0; margin-top:10px;">${p.recomendacoes}</p>` : ''}
                ${p.detalhes      ? `<p style="color:#6b7c8f; margin-top:8px; font-size:13px;">${p.detalhes}</p>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro planning cliente:', error);
    }
}

// ── ADICIONAR TRANSAÇÃO (CLIENTE) ──

async function handleAddTransaction(event) {
    event.preventDefault();
    const clientId  = ClientModule.getClientId();
    const planoId   = document.getElementById('transCategory').value;
    const valor     = parseFloat(document.getElementById('transValue').value);
    const data      = document.getElementById('transDate').value;
    const descricao = document.getElementById('transDescription').value;

    if (!planoId) { UIModule.showError('Seleciona uma categoria'); return; }
    if (!data)    { UIModule.showError('Data é obrigatória'); return; }

    try {
        const plano = await DatabaseModule.getPlanoDeContas();
        const cat   = plano.find(p => p.id === planoId);
        if (!cat) throw new Error('Categoria inválida');

        await ClientModule.addTransaction({
            client_id:          clientId,
            plano_de_contas_id: planoId,
            valor,
            data_competencia:   data,
            descricao,
            tipo: cat.tipo
        });

        event.target.reset();
        UIModule.showSuccess('Transação registada!');
        await loadClientDashboard();
    } catch (error) {
        UIModule.showError(error.message || 'Erro ao registar transação');
    }
}

// ── ADICIONAR META (CLIENTE) ──

async function handleAddMeta(event) {
    event.preventDefault();
    const clientId = ClientModule.getClientId();
    const nome     = document.getElementById('metaName').value.trim();
    const valor    = parseFloat(document.getElementById('metaValue').value);

    try {
        await ClientModule.addGoal({ client_id: clientId, nome, valor_necessario: valor, valor_economizado: 0 });
        event.target.reset();
        UIModule.showSuccess('Meta criada!');
        await loadClientDashboard();
    } catch (_) { UIModule.showError('Erro ao criar meta'); }
}

// ── PERFIL CLIENTE ──

function showClientProfile() {
    const user = AuthModule.getUser();
    UIModule.setText('profileClientName', user?.user_metadata?.name || user?.email || 'Cliente');
    UIModule.setText('profileClientEmail', user?.email || '');
    UIModule.openModal('clientProfileModal');
}

// ================================================
// INICIALIZAÇÃO
// ================================================

async function waitForSupabase(maxAttempts = 20) {
    // config.js declara 'supabaseClient' como variável global (não window.supabaseClient)
    for (let i = 0; i < maxAttempts; i++) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) return true;
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
}

async function populateCategorySelect() {
    try {
        const plano = await DatabaseModule.getPlanoDeContas();
        const select = document.getElementById('transCategory');
        if (!select || !plano.length) return;

        select.innerHTML = plano.map(p =>
            `<option value="${p.id}">${p.nome} (${p.tipo})</option>`
        ).join('');
    } catch (err) {
        console.warn('Não foi possível carregar categorias:', err.message);
    }
}

async function initializeApp() {
    try {
        const ok = await waitForSupabase();
        if (!ok) throw new Error('Supabase não inicializou');

        // Verifica sessão activa
        const user = await AuthModule.checkSession();
        if (user) {
            const role = AuthModule.getUserRole();
            // Pré-carrega categorias independentemente do role
            await populateCategorySelect();
            await routeByRole(user, role);
        } else {
            // Sem sessão → tela de login
            UIModule.showScreen('loginScreen');
        }

        console.log('✅ App inicializado');
    } catch (error) {
        console.error('❌ Erro ao inicializar:', error);
        UIModule.showError('Erro ao inicializar a aplicação');
        UIModule.showScreen('loginScreen');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Carrega categorias ao entrar em transações
setTimeout(() => {
    const observer = new MutationObserver(() => {
        const select = document.getElementById('transCategory');
        if (select && select.innerHTML.includes('Carregando')) {
            populateCategorySelect();
        }
    });
    observer.observe(document.body, { subtree: true, childList: true });
}, 1000);

console.log('✅ app.js (unificado RBAC) — ADAPTADO carregado');