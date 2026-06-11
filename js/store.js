/* ====================================================================
   store.js — estado + persistência local (localStorage)
   --------------------------------------------------------------------
   Modelo de dados:
   {
     pinHash: "ab12cd34" | null,
     fixedExpenses: [ { id, name, amounts: { "2026": 1200, "2025": 1100 } } ],
     variable: { "2026-05": [ { id, name, amount } ] },
     income:   { "2026-05": { "2026-05-04": { principal, patrocinadores } } }
   }
   ==================================================================== */
const Store = (() => {
  const KEY = 'boleta.v1';

  const empty = () => ({
    pinHash: null,
    unit: '',
    fixedExpenses: [],
    variable: {},
    income: {}
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return Object.assign(empty(), JSON.parse(raw));
    } catch (e) {
      console.warn('Falha ao carregar, iniciando vazio.', e);
      return empty();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('Falha ao salvar', e); }
  }

  const uid = () => 'x' + Math.abs(U.hash(String(performance.now()) + state.fixedExpenses.length)).toString();

  /* ---------------- UNIDADE ---------------- */
  function getUnit() { return state.unit || ''; }
  function setUnit(v) { state.unit = v; save(); }

  /* ---------------- PIN ---------------- */
  function hasPin() { return !!state.pinHash; }
  function setPin(pin) { state.pinHash = U.hash(pin); save(); }
  function checkPin(pin) { return state.pinHash === U.hash(pin); }

  /* ---------------- ENTRADAS (income) ----------------
     Cada semana tem 2 categorias (principal, patrocinadores) e cada uma é
     dividida pela FORMA de recebimento: espécie (dinheiro) e outros (pix/cartão/transf.).
     principal/patrocinadores são mantidos como TOTAL (espécie+outros) p/ compatibilidade. */
  function blankIncome() {
    return {
      principal: 0, patrocinadores: 0,
      principalEspecie: 0, principalOutros: 0,
      patrocinadoresEspecie: 0, patrocinadoresOutros: 0
    };
  }
  /** normaliza: garante as partes, migra dados antigos (só total) p/ "outros" e recalcula totais */
  function normIncome(raw) {
    const o = Object.assign(blankIncome(), raw || {});
    if (!o.principalEspecie && !o.principalOutros && o.principal > 0) o.principalOutros = o.principal;
    if (!o.patrocinadoresEspecie && !o.patrocinadoresOutros && o.patrocinadores > 0) o.patrocinadoresOutros = o.patrocinadores;
    o.principal = (o.principalEspecie || 0) + (o.principalOutros || 0);
    o.patrocinadores = (o.patrocinadoresEspecie || 0) + (o.patrocinadoresOutros || 0);
    return o;
  }
  function getIncome(mKey, weekKey) {
    const m = state.income[mKey];
    return normIncome(m && m[weekKey]);
  }
  /** seta uma parte; category: 'principal'|'patrocinadores', method: 'especie'|'outros' */
  function setIncomePart(mKey, weekKey, category, method, value) {
    if (!state.income[mKey]) state.income[mKey] = {};
    const rec = normIncome(state.income[mKey][weekKey]);
    rec[category + (method === 'especie' ? 'Especie' : 'Outros')] = value;
    rec.principal = (rec.principalEspecie || 0) + (rec.principalOutros || 0);
    rec.patrocinadores = (rec.patrocinadoresEspecie || 0) + (rec.patrocinadoresOutros || 0);
    state.income[mKey][weekKey] = rec;
    save();
  }
  function incomeTotals(mKey) {
    const m = state.income[mKey] || {};
    let principal = 0, patrocinadores = 0;
    let pEsp = 0, pOut = 0, paEsp = 0, paOut = 0;
    Object.keys(m).forEach(wk => {
      const w = normIncome(m[wk]);
      principal += w.principal; patrocinadores += w.patrocinadores;
      pEsp += w.principalEspecie || 0; pOut += w.principalOutros || 0;
      paEsp += w.patrocinadoresEspecie || 0; paOut += w.patrocinadoresOutros || 0;
    });
    return {
      principal, patrocinadores, total: principal + patrocinadores,
      especie: pEsp + paEsp, outros: pOut + paOut,
      principalEspecie: pEsp, principalOutros: pOut,
      patrocinadoresEspecie: paEsp, patrocinadoresOutros: paOut
    };
  }

  /* ---------------- DESPESAS FIXAS ---------------- */
  function fixedAmount(item, year) {
    // pega o valor do ano; se não houver, usa o ano anterior mais recente
    if (item.amounts[year] != null) return item.amounts[year];
    const anos = Object.keys(item.amounts).map(Number).filter(a => a <= year).sort((a, b) => b - a);
    return anos.length ? item.amounts[anos[0]] : 0;
  }
  function addFixed(name, amount, year) {
    state.fixedExpenses.push({ id: uid(), name, amounts: { [year]: amount } });
    save();
  }
  function setFixedAmount(id, year, amount) {
    const it = state.fixedExpenses.find(f => f.id === id);
    if (it) { it.amounts[year] = amount; save(); }
  }
  function renameFixed(id, name) {
    const it = state.fixedExpenses.find(f => f.id === id);
    if (it) { it.name = name; save(); }
  }
  function removeFixed(id) {
    state.fixedExpenses = state.fixedExpenses.filter(f => f.id !== id);
    save();
  }
  /** reajuste anual: cria/atualiza o valor do `targetYear` com base no ano anterior + % */
  function applyAnnualAdjust(targetYear, percent) {
    state.fixedExpenses.forEach(it => {
      const base = fixedAmount(it, targetYear - 1);
      it.amounts[targetYear] = Math.round(base * (1 + percent / 100) * 100) / 100;
    });
    save();
  }
  function fixedTotal(year) {
    return state.fixedExpenses.reduce((s, it) => s + fixedAmount(it, year), 0);
  }

  /* ---------------- DESPESAS VARIÁVEIS ---------------- */
  function getVariable(mKey) { return state.variable[mKey] || []; }
  function addVariable(mKey, name, amount) {
    if (!state.variable[mKey]) state.variable[mKey] = [];
    state.variable[mKey].push({ id: uid(), name, amount });
    save();
  }
  function setVariableAmount(mKey, id, amount) {
    const it = (state.variable[mKey] || []).find(v => v.id === id);
    if (it) { it.amount = amount; save(); }
  }
  function removeVariable(mKey, id) {
    state.variable[mKey] = (state.variable[mKey] || []).filter(v => v.id !== id);
    save();
  }
  function variableTotal(mKey) {
    return getVariable(mKey).reduce((s, v) => s + (v.amount || 0), 0);
  }

  /* ---------------- RESUMO ---------------- */
  function monthSummary(year, month) {
    const mKey = U.monthKey(year, month);
    const inc = incomeTotals(mKey);
    const fixed = fixedTotal(year);
    const variable = variableTotal(mKey);
    const saidas = fixed + variable;
    return {
      entradas: inc.total,
      principal: inc.principal,
      patrocinadores: inc.patrocinadores,
      especie: inc.especie, outros: inc.outros,
      principalEspecie: inc.principalEspecie, principalOutros: inc.principalOutros,
      patrocinadoresEspecie: inc.patrocinadoresEspecie, patrocinadoresOutros: inc.patrocinadoresOutros,
      fixed, variable, saidas,
      saldo: inc.total - saidas
    };
  }

  /** todos os meses (chaves) que têm qualquer dado — p/ histórico */
  function monthsWithData() {
    const set = new Set([...Object.keys(state.income), ...Object.keys(state.variable)]);
    return [...set].sort();
  }

  /** mês "ativo" = usuário lançou entrada ou conta variável (ignora só-fixas) */
  function monthHasActivity(year, month) {
    const mKey = U.monthKey(year, month);
    return incomeTotals(mKey).total > 0 || variableTotal(mKey) > 0;
  }

  /** resumo do ano agregando apenas os meses com movimento */
  function yearSummary(year) {
    let entradas = 0, principal = 0, patrocinadores = 0, fixed = 0, variable = 0, meses = 0;
    let especie = 0, outros = 0, pEsp = 0, pOut = 0, paEsp = 0, paOut = 0;
    let melhor = null, pior = null;
    for (let m = 0; m < 12; m++) {
      if (!monthHasActivity(year, m)) continue;
      const s = monthSummary(year, m);
      entradas += s.entradas; principal += s.principal; patrocinadores += s.patrocinadores;
      especie += s.especie; outros += s.outros;
      pEsp += s.principalEspecie; pOut += s.principalOutros;
      paEsp += s.patrocinadoresEspecie; paOut += s.patrocinadoresOutros;
      fixed += s.fixed; variable += s.variable; meses++;
      if (!melhor || s.saldo > melhor.saldo) melhor = { month: m, saldo: s.saldo };
      if (!pior  || s.saldo < pior.saldo)   pior   = { month: m, saldo: s.saldo };
    }
    const saidas = fixed + variable;
    return {
      entradas, principal, patrocinadores, fixed, variable, saidas,
      especie, outros,
      principalEspecie: pEsp, principalOutros: pOut,
      patrocinadoresEspecie: paEsp, patrocinadoresOutros: paOut,
      saldo: entradas - saidas, meses, melhor, pior,
      media: meses ? (entradas - saidas) / meses : 0
    };
  }

  /* ---------------- BACKUP / RESTAURAÇÃO ---------------- */
  /** monta o pacote de backup (sem o PIN — só dados financeiros) */
  function exportBundle() {
    return {
      app: 'boleta',
      version: 1,
      exportedAt: new Date().toISOString(),
      unit: state.unit,
      fixedExpenses: state.fixedExpenses,
      variable: state.variable,
      income: state.income
    };
  }
  /** restaura dados financeiros de um pacote; mantém o PIN atual do aparelho */
  function importBundle(data) {
    if (!data || typeof data !== 'object') throw new Error('Arquivo inválido.');
    const okFixed = Array.isArray(data.fixedExpenses);
    const okVar = data.variable && typeof data.variable === 'object' && !Array.isArray(data.variable);
    const okInc = data.income && typeof data.income === 'object' && !Array.isArray(data.income);
    if (!okFixed && !okVar && !okInc) throw new Error('Não parece um backup do Boleta.');
    if (typeof data.unit === 'string') state.unit = data.unit;
    if (okFixed) state.fixedExpenses = data.fixedExpenses;
    if (okVar)   state.variable = data.variable;
    if (okInc)   state.income = data.income;
    save();
  }

  return {
    raw: () => state,
    getUnit, setUnit,
    hasPin, setPin, checkPin,
    getIncome, setIncomePart, incomeTotals,
    fixedList: () => state.fixedExpenses, fixedAmount, addFixed, setFixedAmount,
    renameFixed, removeFixed, applyAnnualAdjust, fixedTotal,
    getVariable, addVariable, setVariableAmount, removeVariable, variableTotal,
    monthSummary, monthsWithData, monthHasActivity, yearSummary,
    exportBundle, importBundle
  };
})();
