/**
 * METAS.JS — Módulo: Metas dos Clientes (admin.html)
 * Padrão: script global. Sem import/export.
 * Depende de: supabaseClient, currentAdmin, allClientes,
 *             loadAllClientes, openModal, closeModal,
 *             showToast, formatCurrency (admin.js)
 *
 * CORREÇÃO DE SCHEMA (erro 400 confirmado no console do navegador):
 * a tabela `metas` NÃO tem as colunas `cliente_id` nem `titulo`.
 * As colunas reais são `client_id` e `nome` — confirmado por
 * database.js/goals.js/app.js, que já leem e gravam metas com
 * sucesso no lado do cliente usando exatamente esses nomes.
 *
 * A ordenação por `criado_em` foi REMOVIDA (não adicionada com outro
 * nome). Não existe, em nenhum outro ficheiro do projeto, uma
 * referência confirmada a uma coluna de data em `metas` — inventar
 * um nome (ex: created_at) sem evidência geraria o mesmo tipo de
 * erro 400. Se a tabela tiver uma coluna de data, diga o nome exato
 * que eu adiciono a ordenação de volta.
 */

function initMetas() {
  document.getElementById('btn-add-meta')
    ?.addEventListener('click', () => abrirModalMeta(null));

  document.getElementById('btn-salvar-meta')
    ?.addEventListener('click', salvarMeta);

  window.addEventListener('section:change', ({ detail }) => {
    if (detail.section === 'metas') renderMetas();
  });

  renderMetas();
}

// ── Renderiza grid ────────────────────────────────────────────
async function renderMetas() {
  const grid = document.getElementById('metas-grid');
  if (!grid) return;
  grid.innerHTML = '<p class="empty-state">Carregando...</p>';

  if (!allClientes.length) await loadAllClientes();

  const clienteIds = allClientes.map(c => c.id);
  if (!clienteIds.length) {
    grid.innerHTML = '<p class="empty-state">Nenhum cliente cadastrado ainda.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('metas')
    .select('id, nome, valor_necessario, valor_economizado, client_id')
    .in('client_id', clienteIds);

  if (error) { showToast('Erro ao carregar metas: ' + error.message, 'error'); return; }

  if (!data?.length) {
    grid.innerHTML = '<p class="empty-state">Nenhuma meta cadastrada.</p>';
    return;
  }

  grid.innerHTML = data.map(meta => {
    const cliente = allClientes.find(c => c.id === meta.client_id);
    const pct     = meta.valor_necessario > 0
      ? Math.min(100, (meta.valor_economizado / meta.valor_necessario) * 100)
      : 0;
    const barColor = pct >= 100 ? '#00f5a0' : pct >= 50 ? '#f5d623' : '#7b96ff';

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <p class="card-name">${meta.nome}</p>
          <span class="meta-cliente-badge">${cliente?.nome || '—'}</span>
        </div>
        <div class="meta-stats">
          <div>
            <span class="meta-stat-label">Economizado</span>
            <span class="meta-stat-value">${formatCurrency(meta.valor_economizado)}</span>
          </div>
          <div>
            <span class="meta-stat-label">Necessário</span>
            <span class="meta-stat-value">${formatCurrency(meta.valor_necessario)}</span>
          </div>
          <div>
            <span class="meta-stat-label">Progresso</span>
            <span class="meta-stat-value">${pct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="meta-progress-bar">
          <div class="meta-progress-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="card-actions">
          <button class="btn-card editar"  data-id="${meta.id}">✏️ Editar</button>
          <button class="btn-card deletar" data-id="${meta.id}" data-nome="${meta.nome}">🗑️ Deletar</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.btn-card.editar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: m } = await supabaseClient.from('metas').select('*').eq('id', btn.dataset.id).single();
      if (m) abrirModalMeta(m);
    });
  });

  grid.querySelectorAll('.btn-card.deletar').forEach(btn => {
    btn.addEventListener('click', () => deletarMeta(btn.dataset.id, btn.dataset.nome));
  });
}

// ── Modal meta ────────────────────────────────────────────────
async function abrirModalMeta(meta) {
  if (!allClientes.length) await loadAllClientes();

  document.getElementById('modal-meta-title').textContent =
    meta ? '✏️ Editar Meta' : '🎯 Adicionar Meta';

  document.getElementById('meta-id').value          = meta?.id                || '';
  document.getElementById('meta-titulo').value      = meta?.nome              || '';
  document.getElementById('meta-valor').value       = meta?.valor_necessario  || '';
  document.getElementById('meta-economizado').value = meta?.valor_economizado || '';

  const select = document.getElementById('meta-cliente-select');
  select.innerHTML = allClientes.map(c =>
    `<option value="${c.id}" ${meta?.client_id === c.id ? 'selected' : ''}>${c.nome}</option>`
  ).join('');

  openModal('modal-meta');
}

async function salvarMeta() {
  const id          = document.getElementById('meta-id').value;
  const nome        = document.getElementById('meta-titulo').value.trim();
  const valor       = parseFloat(document.getElementById('meta-valor').value)       || 0;
  const economizado = parseFloat(document.getElementById('meta-economizado').value) || 0;
  const clienteId   = document.getElementById('meta-cliente-select').value;

  if (!nome)      { showToast('Informe o título da meta.', 'error'); return; }
  if (!clienteId) { showToast('Selecione um cliente.', 'error');    return; }

  const payload = {
    nome,
    valor_necessario:  valor,
    valor_economizado: economizado,
    client_id:         clienteId,
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('metas').update(payload).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('metas').insert(payload));
  }

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  showToast(id ? 'Meta atualizada!' : 'Meta criada!');
  closeModal('modal-meta');
  renderMetas();
}

async function deletarMeta(id, nome) {
  if (!confirm(`Deletar a meta "${nome}"?`)) return;
  const { error } = await supabaseClient.from('metas').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  showToast('Meta removida.');
  renderMetas();
}

console.log('✅ metas.js carregado');