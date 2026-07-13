/**
 * RAZONETE.JS — Módulo: Razonete Consolidado (admin.html)
 * Padrão: script global. Sem import/export.
 * Depende de: supabaseClient, allClientes, loadAllClientes,
 *             showToast, formatCurrency, formatDate (admin.js)
 *
 * CORREÇÃO DE SCHEMA (erro 400 confirmado no console do navegador):
 * `transacoes` não tem as colunas `cliente_id`, `data` nem
 * `categoria` (texto livre). As colunas reais são `client_id` e
 * `data_competencia`.
 *
 * MIGRAÇÃO (auditoria via Supabase MCP): a categoria vem da tabela
 * `categorias` (via `categoria_id`), não de `plano_de_contas` — essa
 * última tem RLS que nunca libera leitura fora do admin dono do
 * client_id, e nunca foi populada. `categorias` já vem com RLS
 * correto e 18 categorias reais cadastradas.
 */

function initRazonete() {
  document.getElementById('razonete-filter-cliente')
    ?.addEventListener('change', renderRazonete);
  document.getElementById('razonete-filter-tipo')
    ?.addEventListener('change', renderRazonete);

  window.addEventListener('section:change', ({ detail }) => {
    if (detail.section === 'razonete') {
      popularFiltroClientes();
      renderRazonete();
    }
  });
}

async function popularFiltroClientes() {
  if (!allClientes.length) await loadAllClientes();

  const select = document.getElementById('razonete-filter-cliente');
  if (!select) return;
  const valorAtual = select.value;

  select.innerHTML = '<option value="">Todos</option>' +
    allClientes.map(c =>
      `<option value="${c.id}" ${valorAtual === c.id ? 'selected' : ''}>${c.nome}</option>`
    ).join('');
}

async function renderRazonete() {
  const lista         = document.getElementById('razonete-list');
  if (!lista) return;
  const filtroCliente = document.getElementById('razonete-filter-cliente')?.value || '';
  const filtroTipo    = document.getElementById('razonete-filter-tipo')?.value    || '';

  lista.innerHTML = '<p class="empty-state">Carregando...</p>';

  if (!allClientes.length) await loadAllClientes();

  const clienteIds = filtroCliente ? [filtroCliente] : allClientes.map(c => c.id);

  if (!clienteIds.length) {
    lista.innerHTML = '<p class="empty-state">Nenhum cliente cadastrado.</p>';
    return;
  }

  let query = supabaseClient
    .from('transacoes')
    .select('id, valor, tipo, descricao, data_competencia, client_id, categorias(nome, grupo)')
    .in('client_id', clienteIds)
    .order('data_competencia', { ascending: false })
    .limit(200);

  if (filtroTipo) query = query.eq('tipo', filtroTipo);

  const { data, error } = await query;

  if (error) { showToast('Erro ao carregar razonete: ' + error.message, 'error'); return; }

  if (!data?.length) {
    lista.innerHTML = '<p class="empty-state">Nenhuma transação encontrada.</p>';
    return;
  }

  lista.innerHTML = data.map(t => {
    const cliente        = allClientes.find(c => c.id === t.client_id);
    const isReceita       = t.tipo === 'receita';
    const valor           = Math.abs(t.valor);
    const categoriaLabel  = t.categorias?.nome || t.descricao || '—';

    return `
      <div class="razonete-item ${t.tipo}">
        <div class="razonete-item-info">
          <span class="razonete-cliente-nome ${isReceita ? '' : 'despesa'}">${cliente?.nome || '—'}</span>
          <span class="razonete-descricao">${categoriaLabel}</span>
          <span class="razonete-data">${formatDate(t.data_competencia)}</span>
        </div>
        <span class="razonete-valor ${isReceita ? 'positivo' : 'negativo'}">
          ${isReceita ? '+' : '-'}${formatCurrency(valor)}
        </span>
      </div>
    `;
  }).join('');
}

console.log('✅ razonete.js carregado');