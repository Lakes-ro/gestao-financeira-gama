/**
 * AUTH.JS - AUTENTICAÇÃO COM RBAC
 * ================================================
 * Com persistSession: false (config.js), o Supabase não toca
 * em localStorage nem cookies. A sessão vive apenas em memória
 * enquanto a aba estiver aberta.
 *
 * checkSession() — com persistSession:false getSession() retorna
 * sempre null no reload. Mantido por consistência mas sem efeito
 * prático (login é sempre necessário após reload).
 */

const AuthModule = (() => {
    let currentUser     = null;
    let userRole        = null; // 'admin' | 'client'
    let currentClientId = null;

    const notifyChange = () => {
        window.dispatchEvent(new CustomEvent('auth-changed', {
            detail: { user: currentUser, role: userRole, clientId: currentClientId }
        }));
    };

    return {
        async checkSession() {
            // Com persistSession:false nunca há sessão guardada —
            // retorna null directamente sem chamar getSession()
            // que causava SecurityError no Tracking Prevention.
            return null;
        },

        /**
         * Determina role com regras estritas:
         * 1. Se o email for ADMIN_EMAIL → 'admin'
         * 2. Se o user.id existir na tabela clientes → 'client'
         * 3. Qualquer outro caso → acesso negado (null)
         */
        async determineUserRole(userId, email) {
            // Regra 1: email admin hardcoded
            if (email === CONFIG.ADMIN.EMAIL) {
                userRole        = 'admin';
                currentClientId = null;
                console.log('✅ Role: Admin');
                return userRole;
            }

            // Regra 2: verifica se é cliente cadastrado
            try {
                const { data, error } = await supabaseClient
                    .from(CONFIG.TABLES.CLIENTES)
                    .select('id')
                    .eq('id', userId)
                    .maybeSingle();

                if (!error && data) {
                    userRole        = 'client';
                    currentClientId = userId;
                    console.log('✅ Role: Cliente', userId);
                    return userRole;
                }
            } catch (err) {
                console.warn('⚠️ Erro ao consultar clientes:', err.message);
            }

            // Regra 3: utilizador registado mas ainda sem perfil de cliente
            // → passa pelo onboarding e depois é inserido em clientes
            userRole        = 'client';
            currentClientId = userId;
            console.log('✅ Role: Novo cliente (onboarding pendente)', userId);
            return userRole;
        },

        async login(email, password) {
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                if (!data.user) throw new Error('Nenhum utilizador retornado');

                currentUser = data.user;
                const role  = await this.determineUserRole(data.user.id, data.user.email);

                if (!role) {
                    // Faz logout imediato — email não autorizado
                    await supabaseClient.auth.signOut();
                    currentUser = null;
                    throw new Error('Acesso não autorizado. Este email não está registado no sistema.');
                }

                notifyChange();
                console.log('✅ Login:', email, '| Role:', role);

                return { user: data.user, role };
            } catch (error) {
                console.error('❌ Erro login:', error);
                throw error;
            }
        },

        async register(email, password) {
            try {
                const { data, error } = await supabaseClient.auth.signUp({ email, password });

                if (error) throw error;
                if (!data.user) throw new Error('Nenhum utilizador retornado');

                currentUser     = data.user;
                userRole        = 'client';
                currentClientId = data.user.id;

                notifyChange();
                console.log('✅ Registo:', email);

                return data.user;
            } catch (error) {
                console.error('❌ Erro registo:', error);
                throw error;
            }
        },

        async logout() {
            try {
                await supabaseClient.auth.signOut();
            } catch (_) {
                // ignora erro de signOut (sessão já expirada em memória)
            }

            currentUser     = null;
            userRole        = null;
            currentClientId = null;
            notifyChange();

            console.log('✅ Logout');
            return true;
        },

        getUser:     () => currentUser,
        getUserRole: () => userRole,
        getClientId: () => currentClientId,
        isLogged:    () => currentUser !== null,
        isAdmin:     () => userRole === 'admin',
        isClient:    () => userRole === 'client'
    };
})();

console.log('✅ auth.js carregado');