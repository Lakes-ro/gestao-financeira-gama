/**
 * DATABASE.JS - CAMADA DE DADOS COM ANOTAÇÕES
 * ================================================
 */

const DatabaseModule = (() => {
    const executeQuery = async (fn, errorMsg) => {
        try {
            const result = await fn();
            return result;
        } catch (error) {
            console.error(`❌ ${errorMsg}:`, error);
            throw error;
        }
    };

    return {
        async getPlanoDeContas() {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.PLANO_DE_CONTAS)
                .select('*')
                .order('macro_grupo');
            if (error) throw error;
            return data || [];
        },

        async getClients(adminId) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .select('*')
                .eq('admin_id', adminId)
                .order('nome');
            if (error) throw error;
            return data || [];
        },

        async getClientById(clientId) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .select('*')
                .eq('id', clientId)
                .single();
            if (error) throw error;
            return data;
        },

        async addClient(clientData) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .insert([clientData])
                .select();
            if (error) throw error;
            return data?.[0];
        },

        async updateClient(clientId, updates) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .update(updates)
                .eq('id', clientId)
                .select();
            if (error) throw error;
            return data?.[0];
        },

        async deleteClient(clientId) {
            const { error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .delete()
                .eq('id', clientId);
            if (error) throw error;
            return true;
        },

        async getClientComments(clientId) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .select('comentarios')
                .eq('id', clientId)
                .single();
            if (error) throw error;
            return data?.comentarios || '';
        },

        async saveClientComments(clientId, comments) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.CLIENTES)
                .update({ comentarios: comments })
                .eq('id', clientId)
                .select();
            if (error) throw error;
            return data?.[0];
        },

        async getTransactionsByClient(clientId) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.TRANSACOES)
                .select(`
                    *,
                    plano_de_contas(id, nome, macro_grupo, tipo, tipo_renda, necessidade)
                `)
                .eq('client_id', clientId)
                .order('data_competencia', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getAllTransactions(adminId) {
            const clients = await this.getClients(adminId);
            if (clients.length === 0) return [];

            const clientIds = clients.map(c => c.id);
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.TRANSACOES)
                .select(`
                    *,
                    clientes(id, nome),
                    plano_de_contas(id, nome, tipo)
                `)
                .in('client_id', clientIds)
                .order('data_competencia', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async addTransaction(transactionData) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.TRANSACOES)
                .insert([transactionData])
                .select();
            if (error) throw error;
            return data?.[0];
        },

        async getMetasByClient(clientId) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.METAS)
                .select('*')
                .eq('client_id', clientId);
            if (error) throw error;
            return data || [];
        },

        async getMetasByAdmin(adminId) {
            const clients = await this.getClients(adminId);
            if (clients.length === 0) return [];

            const clientIds = clients.map(c => c.id);
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.METAS)
                .select('*, clientes(id, nome)')
                .in('client_id', clientIds);
            if (error) throw error;
            return data || [];
        },

        async addMeta(metaData) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.METAS)
                .insert([metaData])
                .select();
            if (error) throw error;
            return data?.[0];
        },

        async updateMeta(metaId, updates) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.METAS)
                .update(updates)
                .eq('id', metaId)
                .select();
            if (error) throw error;
            return data?.[0];
        },

        async deleteMeta(metaId) {
            const { error } = await supabaseClient
                .from(CONFIG.TABLES.METAS)
                .delete()
                .eq('id', metaId);
            if (error) throw error;
            return true;
        },

        async getPlanningsByAdmin(adminId) {
            const clients = await this.getClients(adminId);
            if (clients.length === 0) return [];

            const clientIds = clients.map(c => c.id);
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.PLANEJAMENTOS)
                .select('*, clientes(id, nome)')
                .in('client_id', clientIds)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getPlanningsByClient(clientId) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.PLANEJAMENTOS)
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async addPlanning(planningData) {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.PLANEJAMENTOS)
                .insert([planningData])
                .select();
            if (error) throw error;
            return data?.[0];
        }
    };
})();

console.log('✅ database.js carregado');