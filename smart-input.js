/**
 * SMART-INPUT.JS — Smart Date + Smart Input (classificação automática)
 * ================================================
 * Objetivo: reduzir ao máximo o esforço do cliente ao lançar uma
 * transação. Duas frentes:
 *
 *   1) SMART DATE — o campo de data é preenchido sozinho com a data de
 *      hoje assim que o formulário aparece, mas o cliente pode alterar
 *      livremente (lançamento retroativo ou futuro).
 *
 *   2) SMART INPUT — o cliente descreve a transação em texto livre
 *      (ex: "Posto Shell", "Gasolina", "Uber pro trabalho") e o sistema
 *      tenta classificar tipo + categoria sozinho, preenchendo o
 *      dropdown de categoria — sempre deixando o cliente livre para
 *      corrigir, nunca travando o formulário.
 *
 * Padrão: script global (sem import/export), igual ao resto do projeto.
 * Depende de: DatabaseModule (database.js), UIModule (ui.js) — ambos
 * devem ser carregados ANTES deste ficheiro no HTML.
 *
 * ⚠️ HISTÓRICO DE UM BUG JÁ CORRIGIDO NESTA VERSÃO — LEIA ANTES DE MEXER:
 * A versão anterior usava, como fallback quando `/api/classify` falhava
 * (o que acontece SEMPRE hoje, porque o endpoint ainda é um placeholder
 * — ver nota abaixo), uma categoria fixa chamada "outros". Só que essa
 * categoria NUNCA existiu na tabela `categorias` (confirmado ao vivo via
 * Supabase MCP: as 18 categorias reais são Alimentação, Contas e
 * Utilidades, Educação, Moradia, Saúde, Transporte, Compras, Delivery,
 * Lazer, Streaming e Assinaturas, Viagens, Aporte em Investimentos,
 * Previdência Privada, Reserva de Emergência, Dividendos, Freelance,
 * Renda Extra, Salário — nenhuma delas se chama "Outros"). Resultado:
 * TODA descrição digitada caía no mesmo beco sem saída ("Não identifiquei
 * a categoria — selecione manualmente"), porque o fallback procurava uma
 * categoria fantasma.
 *
 * A CORREÇÃO: em vez de um fallback fixo e genérico, agora existe um
 * CLASSIFICADOR LOCAL POR PALAVRAS-CHAVE (`classificarLocalmente`,
 * mesmo princípio do classificador simulado em categoria-personalizada.js)
 * que já mapeia direto para as 18 categorias REAIS acima. Isso roda
 * INSTANTANEAMENTE (sem rede) sempre que `/api/classify` não responder —
 * e é por isso que, com este arquivo, "Gasolina" já cai certinho em
 * "Transporte" mesmo sem nenhum back-end de IA existir ainda.
 *
 * ⚠️ SOBRE O ENDPOINT `/api/classify`:
 * Continua sendo um PLACEHOLDER — nenhuma mudança nisso. Quando o back-end
 * existir de verdade (idealmente uma Supabase Edge Function, pela mesma
 * razão de segurança já documentada em categoria-personalizada.js: nunca
 * embutir chave de API de LLM no JS do navegador), ele é tentado PRIMEIRO;
 * o classificador local só entra em ação se a chamada falhar ou vier
 * incompleta. Contrato esperado da resposta:
 *
 *   REQUEST  (POST, JSON): { "description": "texto digitado pelo cliente" }
 *   RESPONSE (200, JSON):  {
 *       "type":       "receita" | "despesa",
 *       "category":   "nome da categoria sugerida (string)",
 *       "group":      "essencial" | "estilo_de_vida" | "investimento" | "renda",
 *       "confidence": 0.0 a 1.0   // opcional
 *   }
 *
 * IMPORTANTE — POR QUE NÃO INVENTAMOS UM categoria_id:
 * `transacoes.categoria_id` é uma foreign key para `categorias.id`. Nem a
 * IA (futura) nem o classificador local devolvem um UUID — devolvem um
 * NOME de categoria. Este módulo SEMPRE cruza esse nome com as categorias
 * REAIS já cadastradas no banco antes de preencher o campo oculto
 * `transCategory`. Se não achar uma correspondência confiável, ele NÃO
 * grava um id qualquer — apenas avisa o cliente para escolher manualmente.
 * Isso evita erro 23503 (FK violation) na hora de salvar a transação.
 *
 * ⚠️ SOBRE "SELECT DE TIPO":
 * O formulário de transação (client.html/index.html) NÃO tem um <select>
 * de tipo separado — o campo `transCategory` é um dropdown customizado
 * (botão + painel), e o `tipo` (receita/despesa) é derivado da categoria
 * escolhida (ver `handleAddTransaction` em app.js: `tipo: cat.tipo`).
 */

// ══════════════════════════════════════════════════════════════
// ESTADO DO FORMULÁRIO
// ══════════════════════════════════════════════════════════════
// Espelha os 4 campos que importam para a classificação/lançamento.
// NÃO é a fonte de verdade na hora de salvar (handleAddTransaction em
// app.js sempre lê o DOM diretamente, que é mais seguro contra
// dessincronização) — serve para o Smart Input decidir o que já foi
// preenchido, o que ainda falta, e para depuração/telemetria futura.
const TransactionFormState = {
    data:          null, // 'YYYY-MM-DD'
    descricao:     '',
    tipo:          null, // 'receita' | 'despesa'
    categoriaId:   null,
    categoriaNome: null
};

function resetTransactionFormState() {
    TransactionFormState.data          = null;
    TransactionFormState.descricao     = '';
    TransactionFormState.tipo          = null;
    TransactionFormState.categoriaId   = null;
    TransactionFormState.categoriaNome = null;
}

// ── Estado interno do módulo (cache/controle de chamadas) ──────
let smartInputCategoriasCache = null; // cache local das categorias (evita refetch a cada blur)
let smartInputUltimaDescricao = null; // evita reclassificar o mesmo texto repetidamente
let smartInputPromisePendente = null; // permite ao handleAddTransaction esperar uma classificação em andamento

const GRUPOS_VALIDOS = ['essencial', 'estilo_de_vida', 'investimento', 'renda'];

// ── Utilitários de texto (comparação tolerante a acento/caixa) ─
function normalizarTexto(txt) {
    return (txt || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// ══════════════════════════════════════════════════════════════
// CLASSIFICADOR LOCAL POR PALAVRAS-CHAVE
// ══════════════════════════════════════════════════════════════
// Mesmo princípio do classificador simulado em categoria-personalizada.js
// (heurística, não é uma chamada real a um LLM), mas aqui o alvo já é o
// NOME EXATO de uma categoria real da tabela `categorias` — não apenas o
// `grupo`. Isso garante que, mesmo sem back-end de IA, descrições comuns
// já caiam na categoria certa imediatamente.
//
// Cada entrada: [regex sobre a descrição, tipo esperado, nome EXATO da
// categoria em `categorias.nome`]. A primeira regra que bater vence.
//
// Se um dia as categorias do banco mudarem de nome, esta lista precisa
// ser atualizada junto — o match final ainda protege contra isso (ver
// encontrarCategoriaCorrespondente: se o nome não existir mais no banco,
// cai em correspondência parcial e, na pior hipótese, pede seleção
// manual — nunca grava um id inventado).
const REGRAS_CLASSIFICACAO_LOCAL = [
    // ── Receitas (renda) ──
    [/sal[aá]rio|holerite|pr[oó]-labore/i,                          'receita', 'Salário'],
    [/freelance|freela|bico|consultoria/i,                          'receita', 'Freelance'],
    [/dividendo|jcp|rendimento/i,                                   'receita', 'Dividendos'],
    [/renda extra|extra\b/i,                                        'receita', 'Renda Extra'],

    // ── Investimento ──
    [/previd[eê]ncia/i,                                             'despesa', 'Previdência Privada'],
    [/reserva|poupan[çc]a|emerg[eê]ncia/i,                          'despesa', 'Reserva de Emergência'],
    [/investimento|aporte/i,                                        'despesa', 'Aporte em Investimentos'],

    // ── Essencial ──
    [/luz|energia|[aá]gua|g[aá]s\b|internet|telefone|celular/i,     'despesa', 'Contas e Utilidades'],
    [/aluguel|condom[ií]nio|financiamento|iptu/i,                   'despesa', 'Moradia'],
    [/mercado|supermercado|feira|a[çc]ougue|padaria|hortifruti|hortifruti|quitanda/i, 'despesa', 'Alimentação'],
    [/biscoito|bolacha|arroz|feij[aã]o|macarr[aã]o|massa\b|carne|frango|peixe|leite|p[aã]o\b|queijo|presunto|manteiga|margarina|caf[eé]\b|a[çc][uú]car|[oó]leo|tempero|fruta|verdura|legume|ovo\b|iogurte/i, 'despesa', 'Alimentação'],
    [/farm[aá]cia|m[eé]dico|consulta|plano de sa[uú]de|hospital|dentista|rem[eé]dio/i, 'despesa', 'Saúde'],
    [/escola|faculdade|curso|mensalidade|material escolar|livro did[aá]tico/i, 'despesa', 'Educação'],
    [/[oô]nibus|uber|99\b|combust[ií]vel|gasolina|posto|estacionamento|pedagio|pedágio|metr[oô]|passagem de [oô]nibus/i, 'despesa', 'Transporte'],

    // ── Estilo de vida ──
    [/restaurante|ifood|delivery|lanche|lanchonete|pizza|hamb[uú]rguer|bar\b/i, 'despesa', 'Delivery'],
    [/streaming|netflix|spotify|assinatura/i,                       'despesa', 'Streaming e Assinaturas'],
    [/viagem|hotel|passagem|airbnb/i,                                'despesa', 'Viagens'],
    [/shopping|roupa|cal[çc]ado|compra/i,                            'despesa', 'Compras'],
    [/cinema|show|festa|balada|lazer/i,                              'despesa', 'Lazer'],
];

/**
 * Roda a heurística local sobre a descrição digitada. Retorna o mesmo
 * formato que o endpoint de IA retornaria (para que o resto do fluxo
 * trate os dois casos de forma idêntica), com `fallback: true` e
 * `local: true` para indicar a origem.
 */
function classificarLocalmente(descricao) {
    const regra = REGRAS_CLASSIFICACAO_LOCAL.find(([regex]) => regex.test(descricao));

    if (!regra) return null;

    const [, tipo, nomeCategoria] = regra;
    return {
        tipo,
        categoriaNome: nomeCategoria,
        fallback: true,
        local:    true
    };
}

// ══════════════════════════════════════════════════════════════
// SMART DATE
// ══════════════════════════════════════════════════════════════

/**
 * Retorna a data de HOJE no fuso horário local, já no formato exigido
 * pelo <input type="date">: 'YYYY-MM-DD'. Usar toISOString() puro é
 * um erro comum aqui — ele converte para UTC e pode "voltar" um dia
 * dependendo da hora e do fuso do utilizador. Por isso montamos a
 * string manualmente a partir de getFullYear/getMonth/getDate (todos
 * em hora LOCAL).
 */
function getDataDeHojeFormatoInput() {
    const agora = new Date();
    const ano   = agora.getFullYear();
    const mes   = String(agora.getMonth() + 1).padStart(2, '0');
    const dia   = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

/**
 * Preenche o campo de data com a data de hoje — mas SÓ se o campo
 * estiver vazio. Isso permite chamar setSmartDate() várias vezes (ex:
 * toda vez que a aba "Transações" é aberta) sem apagar uma data que o
 * cliente já tenha alterado manualmente para um lançamento retroativo
 * ou futuro que ainda não foi enviado.
 *
 * @param {boolean} forcar - se true, sobrescreve mesmo se já tiver valor
 *                            (usado depois de um Registar bem-sucedido,
 *                            quando o formulário é resetado e precisa
 *                            voltar a ter a data de hoje pronta).
 */
function setSmartDate(forcar = false) {
    const campoData = document.getElementById('transDate');
    if (!campoData) return;

    if (forcar || !campoData.value) {
        campoData.value = getDataDeHojeFormatoInput();
    }

    TransactionFormState.data = campoData.value;
}

// ══════════════════════════════════════════════════════════════
// CATEGORIAS: BUSCA COM CACHE + MATCHING SEGURO
// ══════════════════════════════════════════════════════════════

async function getCategoriasParaClassificacao(forcarRecarga = false) {
    if (!forcarRecarga && smartInputCategoriasCache && smartInputCategoriasCache.length) {
        return smartInputCategoriasCache;
    }
    try {
        smartInputCategoriasCache = await DatabaseModule.getCategorias();
    } catch (err) {
        console.error('❌ getCategoriasParaClassificacao:', err.message);
        smartInputCategoriasCache = smartInputCategoriasCache || [];
    }
    return smartInputCategoriasCache;
}

/**
 * Tenta encontrar, dentre as categorias REAIS já cadastradas no banco,
 * a que melhor corresponde ao nome sugerido + o tipo esperado. NUNCA
 * retorna algo que não exista de fato em `categorias` — se não achar
 * nada confiável, retorna null (e quem chama trata isso como "precisa
 * de seleção manual").
 */
function encontrarCategoriaCorrespondente(categorias, nomeSugerido, tipoSugerido) {
    if (!categorias || !categorias.length) return null;
    const nomeAlvo = normalizarTexto(nomeSugerido);

    // 1) Match exato de nome + tipo
    let match = categorias.find(c =>
        c.tipo === tipoSugerido && normalizarTexto(c.nome) === nomeAlvo
    );
    if (match) return match;

    // 2) Match parcial (nome sugerido contém ou está contido no nome da categoria) + tipo bate
    match = categorias.find(c => {
        if (c.tipo !== tipoSugerido) return false;
        const nomeCat = normalizarTexto(c.nome);
        return nomeCat.includes(nomeAlvo) || nomeAlvo.includes(nomeCat);
    });
    if (match) return match;

    // 3) Nenhuma correspondência confiável — não inventa nada
    return null;
}

// ══════════════════════════════════════════════════════════════
// FEEDBACK VISUAL NO DROPDOWN DE CATEGORIA
// ══════════════════════════════════════════════════════════════

function setSmartInputEstadoVisual(estado, texto) {
    const trigger     = document.getElementById('transCategoryTrigger');
    const triggerText = document.getElementById('transCategoryTriggerText');
    if (!trigger || !triggerText) return;

    if (estado === 'carregando') {
        triggerText.textContent = '🤖 Analisando descrição...';
        trigger.disabled = true;
    } else if (estado === 'sugestao') {
        triggerText.textContent = `🤖 ${texto}`;
        trigger.disabled = false;
    } else if (estado === 'sem-match') {
        triggerText.textContent = texto || 'Não identifiquei a categoria — selecione manualmente';
        trigger.disabled = false;
    } else {
        trigger.disabled = false;
    }
}

function marcarOpcaoSelecionadaNoPainel(categoriaId) {
    const panel = document.getElementById('transCategoryPanel');
    if (!panel) return;
    panel.querySelectorAll('.custom-select__option.selected')
        .forEach(el => el.classList.remove('selected'));
    panel.querySelector(`.custom-select__option[data-id="${categoriaId}"]`)
        ?.classList.add('selected');
}

/**
 * Aplica o resultado da classificação (via IA real ou via classificador
 * local) nos campos do formulário. Preenche mas NÃO bloqueia edição
 * manual — o cliente sempre pode reabrir o dropdown e trocar a
 * categoria sugerida. É esse comportamento que evita o problema de "IA
 * que erra e trava o usuário": o sistema sugere, nunca impõe.
 */
async function preencherFormularioComClassificacao(resultado) {
    const hiddenInput = document.getElementById('transCategory');
    if (!hiddenInput) return;

    const categorias = await getCategoriasParaClassificacao();
    const match = encontrarCategoriaCorrespondente(categorias, resultado.categoriaNome, resultado.tipo);

    if (match) {
        hiddenInput.value = match.id;
        marcarOpcaoSelecionadaNoPainel(match.id);
        setSmartInputEstadoVisual('sugestao', match.nome);

        TransactionFormState.tipo          = match.tipo;
        TransactionFormState.categoriaId   = match.id;
        TransactionFormState.categoriaNome = match.nome;

        if (resultado.local) {
            // Classificador local (heurística por palavra-chave) — não é
            // IA de verdade, mas já resolve os casos comuns hoje.
            UIModule.showMessage(`🤖 Categoria sugerida: ${match.nome}`, 'success', 2500);
        } else if (resultado.fallback) {
            UIModule.showMessage(
                'Não consegui identificar a categoria com certeza. Confira antes de salvar.',
                'info',
                4000
            );
        } else {
            UIModule.showMessage(`🤖 Categoria sugerida: ${match.nome}`, 'success', 2500);
        }

        // Vínculo com Meta/Caixinha (app.js): reavalia se a categoria
        // preenchida automaticamente é do grupo 'investimento' e, se
        // for, mostra o seletor de meta. Guarda por typeof porque
        // smart-input.js não depende de app.js estar carregado.
        if (typeof atualizarSeletorDeMeta === 'function') {
            atualizarSeletorDeMeta('transCategory', 'transMetaWrapper', 'transMeta');
        }
    } else {
        // Nenhuma categoria real corresponde ao que foi sugerido — NÃO
        // grava um id inválido. Limpa o campo e pede seleção manual.
        hiddenInput.value = '';
        setSmartInputEstadoVisual('sem-match');

        TransactionFormState.tipo          = null;
        TransactionFormState.categoriaId   = null;
        TransactionFormState.categoriaNome = null;

        UIModule.showError('Não consegui sugerir uma categoria para essa descrição. Selecione manualmente.');
    }
}

// ══════════════════════════════════════════════════════════════
// AUTOCLASSIFY — núcleo do Smart Input
// ══════════════════════════════════════════════════════════════

/**
 * Recebe a descrição digitada pelo cliente e tenta classificar tipo +
 * categoria automaticamente. Ordem de tentativa:
 *   1. Endpoint /api/classify (IA real — hoje é placeholder, então
 *      falha sempre, e isso é esperado até existir um back-end).
 *   2. Classificador local por palavras-chave (instantâneo, mapeado às
 *      categorias reais do banco — ver REGRAS_CLASSIFICACAO_LOCAL).
 *   3. Se nem isso reconhecer a descrição, o formulário pede seleção
 *      manual honestamente (nunca inventa uma categoria).
 *
 * Assíncrona, tolerante a falhas de rede/endpoint — nunca trava o
 * botão Registar.
 *
 * @param {string} description
 * @returns {Promise<{tipo, categoriaNome, fallback, local}|null>}
 */
async function autoClassify(description) {
    const descricao = (description || '').trim();
    TransactionFormState.descricao = descricao;

    // Guarda: descrição vazia ou curta demais — nem vale a pena classificar
    if (descricao.length < 3) {
        return null;
    }

    // Evita reclassificar o mesmo texto duas vezes seguidas
    if (descricao === smartInputUltimaDescricao) {
        return null;
    }

    const execucao = (async () => {
        setSmartInputEstadoVisual('carregando');

        let resultado = null;

        // 1) Tenta o endpoint de IA real (placeholder por enquanto)
        try {
            const response = await fetch('/api/classify', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ description: descricao })
            });

            if (!response.ok) {
                throw new Error(`Endpoint /api/classify retornou HTTP ${response.status}`);
            }

            const data = await response.json();

            const tipoValido     = data?.type === 'receita' || data?.type === 'despesa';
            const grupoValido    = GRUPOS_VALIDOS.includes(data?.group);
            const categoriaOk    = typeof data?.category === 'string' && data.category.trim().length > 0;
            const confiancaBaixa = typeof data?.confidence === 'number' && data.confidence < 0.4;

            if (!tipoValido || !grupoValido || !categoriaOk || confiancaBaixa) {
                throw new Error('Resposta da IA incompleta ou de baixa confiança.');
            }

            resultado = {
                tipo:          data.type,
                categoriaNome: data.category.trim(),
                fallback:      false,
                local:         false
            };
        } catch (err) {
            console.warn('⚠️ /api/classify indisponível, tentando classificador local:', err.message);
        }

        // 2) Endpoint falhou (ou ainda não existe) — tenta o classificador local
        if (!resultado) {
            resultado = classificarLocalmente(descricao);
        }

        // 3) Nada reconheceu a descrição — não inventa nada, formulário
        //    honestamente pede seleção manual.
        if (!resultado) {
            setSmartInputEstadoVisual('sem-match');
            TransactionFormState.tipo          = null;
            TransactionFormState.categoriaId   = null;
            TransactionFormState.categoriaNome = null;
            smartInputUltimaDescricao = descricao;
            return null;
        }

        smartInputUltimaDescricao = descricao;
        await preencherFormularioComClassificacao(resultado);
        return resultado;
    })();

    smartInputPromisePendente = execucao;
    const resultadoFinal = await execucao;
    if (smartInputPromisePendente === execucao) smartInputPromisePendente = null;
    return resultadoFinal;
}

// Alias retrocompatível — nome usado anteriormente em app.js. Mantido
// para não exigir mudanças em outras partes do código; ambos os nomes
// apontam para a mesma função.
async function autoClassifyTransaction(description) {
    return autoClassify(description);
}

/**
 * Usado por handleAddTransaction (app.js) para garantir que, se o
 * cliente clicar em "Registar" enquanto uma classificação ainda está
 * em andamento (ex: clicou muito rápido após sair do campo descrição),
 * o formulário espera o resultado antes de validar a categoria.
 */
async function aguardarClassificacaoSmartInputPendente() {
    if (smartInputPromisePendente) {
        try { await smartInputPromisePendente; } catch (_) { /* já tratado internamente */ }
    }
}

// ══════════════════════════════════════════════════════════════
// SINCRONIZAÇÃO DO ESTADO COM O DOM (data, descrição, categoria)
// ══════════════════════════════════════════════════════════════
// Mantém TransactionFormState atualizado conforme o cliente digita ou
// escolhe algo manualmente — não só quando a classificação automática
// roda. Isso é só para leitura/depuração; handleAddTransaction (app.js)
// continua lendo o DOM diretamente na hora de salvar, que é a fonte
// de verdade.

let smartInputSincronizacaoLigada = false;

function ligarSincronizacaoDeEstado() {
    if (smartInputSincronizacaoLigada) return; // evita listeners duplicados
    smartInputSincronizacaoLigada = true;

    const campoData = document.getElementById('transDate');
    campoData?.addEventListener('change', () => {
        TransactionFormState.data = campoData.value;
    });

    const campoDescricao = document.getElementById('transDescription');
    campoDescricao?.addEventListener('input', () => {
        TransactionFormState.descricao = campoDescricao.value;
    });

    // Delegação: qualquer clique numa opção do painel de categoria
    // (seja a classificação automática que preencheu, seja o próprio
    // cliente escolhendo manualmente em app.js/ligarCliquesDoPainel)
    // atualiza o estado.
    const panel = document.getElementById('transCategoryPanel');
    panel?.addEventListener('click', async (e) => {
        const opcao = e.target.closest('.custom-select__option');
        if (!opcao) return;

        TransactionFormState.categoriaId   = opcao.dataset.id;
        TransactionFormState.categoriaNome = opcao.dataset.nome;

        const categorias = await getCategoriasParaClassificacao();
        const cat = categorias.find(c => c.id === opcao.dataset.id);
        TransactionFormState.tipo = cat?.tipo || null;
    });
}

// ══════════════════════════════════════════════════════════════
// INITFORM — ponto de entrada do módulo
// ══════════════════════════════════════════════════════════════

/**
 * Prepara o formulário de transação:
 *   - injeta a data de hoje no campo de data (Smart Date), sem
 *     sobrescrever se o cliente já tiver alterado manualmente;
 *   - liga o gatilho do Smart Input (classifica ao sair do campo
 *     Descrição);
 *   - liga a sincronização de estado (data/descricao/tipo/categoria).
 *
 * Pode ser chamada mais de uma vez com segurança (idempotente): ao
 * carregar a página, ao abrir a aba "Transações", e depois de um
 * Registar bem-sucedido (nesse caso com forcarData=true, porque o
 * formulário acabou de ser resetado e a data precisa voltar a ser
 * preenchida para o próximo lançamento).
 *
 * @param {boolean} forcarData - true para sobrescrever mesmo se já
 *                                houver valor (usado após reset()).
 */
function initForm(forcarData = false) {
    setSmartDate(forcarData);

    const campoDescricao = document.getElementById('transDescription');
    if (campoDescricao && !campoDescricao.dataset.smartInputListenerLigado) {
        campoDescricao.addEventListener('blur', () => {
            const valor = campoDescricao.value.trim();
            if (!valor) return;

            // Aprendizado de Categorias (regras-aprendidas.js): se o
            // módulo estiver carregado, ele consulta primeiro se já existe
            // uma regra aprendida para este termo + cliente, e só recorre
            // à classificação (IA/heurística local) se não encontrar
            // nada. Guarda por `typeof` para que o formulário continue
            // funcionando (100% via IA/heurística, sem memória) mesmo que
            // regras-aprendidas.js não esteja presente na página.
            if (typeof registerTransaction === 'function' && typeof ClientModule !== 'undefined') {
                registerTransaction({ clienteId: ClientModule.getClientId(), descricao: valor });
            } else {
                autoClassify(valor);
            }
        });
        campoDescricao.dataset.smartInputListenerLigado = 'true';
    }

    ligarSincronizacaoDeEstado();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initForm(false));
} else {
    initForm(false);
}

console.log('✅ smart-input.js carregado (Smart Date + Smart Input + classificador local)');
