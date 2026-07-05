/**
 * PLANEJAMENTOS.JS — Módulo: Planejamentos
 * Padrão: script global. Sem import/export.
 * Depende de: supabaseClient, currentAdmin, allClientes,
 *             loadAllClientes, openModal, closeModal,
 *             showToast, formatCurrency, formatDate (admin.js)
 */

function initPlanejamentos() {
  document.getElementById('btn-add-planejamento')
    ?.addEventListener('click', () => abrirModalPlanejamento(null));

  document.getElementById('btn-salvar-planejamento')
    ?.addEventListener('click', salvarPlanejamento);

  document.getElementById('planejamento-cliente-select')
    ?.addEventListener('change', (e) => carregarResumoFinanceiro(e.target.value));

  window.addEventListener('section:change', ({ detail }) => {
    if (detail.section === 'planejamentos') renderPlanejamentos();
  });

  renderPlanejamentos();
}

// ── Renderiza lista ───────────────────────────────────────────
async function renderPlanejamentos() {
  const lista = document.getElementById('planejamentos-list');
  if (!lista) return;
  lista.innerHTML = '<p class="empty-state">Carregando...</p>';

  if (!allClientes.length) await loadAllClientes();

  const { data, error } = await supabaseClient
    .from('planejamentos')
    .select('id, titulo, recomendacoes, detalhes, cliente_id, criado_em')
    .eq('admin_id', currentAdmin.id)
    .order('criado_em', { ascending: false });

  if (error) { showToast('Erro ao carregar: ' + error.message, 'error'); return; }

  if (!data?.length) {
    lista.innerHTML = '<p class="empty-state">Nenhum planejamento criado.</p>';
    return;
  }

  lista.innerHTML = data.map(p => {
    const cliente = allClientes.find(c => c.id === p.cliente_id);
    return `
      <div class="planejamento-card">
        <div class="planejamento-info">
          <h4>${p.titulo}</h4>
          <p>Cliente: ${cliente?.nome || '—'} · Criado em ${formatDate(p.criado_em)}</p>
        </div>
        <div class="planejamento-actions">
          <button class="btn-card editar"  data-id="${p.id}">✏️ Editar</button>
          <button class="btn-card deletar" data-id="${p.id}" data-titulo="${p.titulo}">🗑️ Deletar</button>
        </div>
      </div>
    `;
  }).join('');

  lista.querySelectorAll('.btn-card.editar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: p } = await supabaseClient.from('planejamentos').select('*').eq('id', btn.dataset.id).single();
      if (p) abrirModalPlanejamento(p);
    });
  });

  lista.querySelectorAll('.btn-card.deletar').forEach(btn => {
    btn.addEventListener('click', () => deletarPlanejamento(btn.dataset.id, btn.dataset.titulo));
  });
}

// ── Modal planejamento ────────────────────────────────────────
async function abrirModalPlanejamento(plan) {
  if (!allClientes.length) await loadAllClientes();

  document.getElementById('modal-planejamento-title').textContent =
    plan ? '✏️ Editar Planejamento' : '📋 Criar Planejamento';

  document.getElementById('planejamento-id').value            = plan?.id            || '';
  document.getElementById('planejamento-titulo').value        = plan?.titulo        || 'Planejamento mensal';
  document.getElementById('planejamento-recomendacoes').value = plan?.recomendacoes || '';
  document.getElementById('planejamento-detalhes').value      = plan?.detalhes      || '';

  const select = document.getElementById('planejamento-cliente-select');
  select.innerHTML = allClientes.map(c =>
    `<option value="${c.id}" ${plan?.cliente_id === c.id ? 'selected' : ''}>${c.nome}</option>`
  ).join('');

  resetResumo();
  const clienteId = plan?.cliente_id || allClientes[0]?.id;
  if (clienteId) carregarResumoFinanceiro(clienteId);

  openModal('modal-planejamento');
}

// ── Resumo financeiro do cliente ──────────────────────────────
async function carregarResumoFinanceiro(clienteId) {
  if (!clienteId) { resetResumo(); return; }

  const { data: transacoes } = await supabaseClient
    .from('transacoes')
    .select('valor, tipo, categoria')
    .eq('cliente_id', clienteId);

  if (!transacoes?.length) { resetResumo(); return; }

  const receitas = transacoes.filter(t => t.tipo === 'receita');
  const despesas = transacoes.filter(t => t.tipo === 'despesa');

  const rendaPassiva = receitas
    .filter(t => /passiva|dividend|aluguel|investimento/i.test(t.categoria || ''))
    .reduce((s, t) => s + Math.abs(t.valor), 0);

  const rendaAtiva   = receitas.reduce((s, t) => s + Math.abs(t.valor), 0) - rendaPassiva;
  const totalReceita = receitas.reduce((s, t) => s + Math.abs(t.valor), 0);
  const totalDespesa = despesas.reduce((s, t) => s + Math.abs(t.valor), 0);

  document.getElementById('plan-renda-ativa').textContent   = formatCurrency(rendaAtiva);
  document.getElementById('plan-renda-passiva').textContent = formatCurrency(rendaPassiva);
  document.getElementById('plan-renda-total').textContent   = formatCurrency(totalReceita);
  document.getElementById('plan-despesa-total').textContent = formatCurrency(totalDespesa);
}

function resetResumo() {
  ['plan-renda-ativa','plan-renda-passiva','plan-renda-total','plan-despesa-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatCurrency(0);
  });
}

// ── Salva planejamento ────────────────────────────────────────
async function salvarPlanejamento() {
  const id            = document.getElementById('planejamento-id').value;
  const titulo        = document.getElementById('planejamento-titulo').value.trim();
  const recomendacoes = document.getElementById('planejamento-recomendacoes').value.trim();
  const detalhes      = document.getElementById('planejamento-detalhes').value.trim();
  const clienteId     = document.getElementById('planejamento-cliente-select').value;

  if (!titulo)    { showToast('Informe o título.', 'error');     return; }
  if (!clienteId) { showToast('Selecione um cliente.', 'error'); return; }

  const payload = {
    titulo,
    recomendacoes: recomendacoes || null,
    detalhes:      detalhes      || null,
    cliente_id:    clienteId,
    admin_id:      currentAdmin.id,
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('planejamentos').update(payload).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('planejamentos').insert(payload));
  }

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  showToast(id ? 'Planejamento atualizado!' : 'Planejamento criado!');
  closeModal('modal-planejamento');
  renderPlanejamentos();
}

async function deletarPlanejamento(id, titulo) {
  if (!confirm(`Deletar o planejamento "${titulo}"?`)) return;
  const { error } = await supabaseClient.from('planejamentos').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  showToast('Planejamento removido.');
  renderPlanejamentos();
}

console.log('✅ planejamentos.js carregado');