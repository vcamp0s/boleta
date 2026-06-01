/* ====================================================================
   app.js — interface, navegação e eventos
   ==================================================================== */
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // mês atualmente exibido
  const now = new Date();
  let cur = { year: now.getFullYear(), month: now.getMonth() };
  let activeView = 'resumo';
  let histYear = cur.year;
  let yearSel = null;   // mês selecionado no gráfico anual (índice 0-11)
  let histOpenMonth = null;   // mês expandido na lista do histórico (índice 0-11)

  /* =================================================================
     TELA DE BLOQUEIO / PIN
     ================================================================= */
  const lockEl  = $('#lock-screen');
  const appEl   = $('#app');
  let pinBuffer = '';
  let settingNewPin = false;
  let firstPinTry = '';

  function startLock() {
    if (!Store.hasPin()) {
      settingNewPin = true;
      $('#lock-sub').textContent = 'Crie um PIN de 4 dígitos';
    } else {
      settingNewPin = false;
      $('#lock-sub').textContent = 'Digite seu PIN de 4 dígitos';
    }
    pinBuffer = ''; firstPinTry = '';
    renderDots();
    lockEl.classList.remove('hidden');
    appEl.classList.add('hidden');
  }

  function renderDots() {
    $$('#pin-dots span').forEach((s, i) => s.classList.toggle('filled', i < pinBuffer.length));
  }

  function pinError(msg) {
    $('#pin-error').textContent = msg || '';
    if (msg) { lockEl.classList.add('shake'); setTimeout(() => lockEl.classList.remove('shake'), 420); }
  }

  function onKey(k) {
    pinError('');
    if (k === 'back') { pinBuffer = pinBuffer.slice(0, -1); renderDots(); return; }
    if (k === 'reset') { pinBuffer = ''; renderDots(); return; }
    if (pinBuffer.length >= 4) return;
    pinBuffer += k;
    renderDots();
    if (pinBuffer.length === 4) setTimeout(submitPin, 140);
  }

  function submitPin() {
    if (settingNewPin) {
      if (!firstPinTry) {
        firstPinTry = pinBuffer; pinBuffer = ''; renderDots();
        $('#lock-sub').textContent = 'Confirme o PIN';
        return;
      }
      if (firstPinTry !== pinBuffer) {
        firstPinTry = ''; pinBuffer = ''; renderDots();
        $('#lock-sub').textContent = 'Crie um PIN de 4 dígitos';
        pinError('Os PINs não conferem. Tente de novo.');
        return;
      }
      Store.setPin(pinBuffer);
      unlock();
      openOnboarding();        // primeiro acesso: tour "como usar" + unidade
    } else {
      if (Store.checkPin(pinBuffer)) { unlock(); }
      else { pinBuffer = ''; renderDots(); pinError('PIN incorreto.'); }
    }
  }

  function unlock() {
    lockEl.classList.add('hidden');
    appEl.classList.remove('hidden');
    renderUnit();
    renderAll();
  }

  $('#keypad').addEventListener('click', e => {
    const btn = e.target.closest('.key'); if (!btn) return;
    onKey(btn.dataset.key);
  });
  // suporte a teclado físico (desktop)
  document.addEventListener('keydown', e => {
    if (!pinOv.classList.contains('hidden')) {      // overlay de troca de PIN tem prioridade
      if (e.key >= '0' && e.key <= '9') ovKey(e.key);
      else if (e.key === 'Backspace') ovKey('back');
      else if (e.key === 'Escape') closeOv(null);
      return;
    }
    if (lockEl.classList.contains('hidden')) return;
    if (e.key >= '0' && e.key <= '9') onKey(e.key);
    else if (e.key === 'Backspace') onKey('back');
  });
  $('#lock-now').addEventListener('click', startLock);

  /* =================================================================
     OVERLAY DE PIN (reutilizável) + TROCA DE PIN
     ================================================================= */
  const pinOv = $('#pin-overlay');
  let ovBuffer = '', ovResolve = null;

  /** mostra o teclado e resolve com o PIN de 4 dígitos (ou null se cancelar) */
  function askPin(title, errorMsg) {
    return new Promise(resolve => {
      $('#pin-ov-title').textContent = title;
      $('#pin-ov-error').textContent = errorMsg || '';
      ovBuffer = ''; ovResolve = resolve; renderOvDots();
      pinOv.classList.remove('hidden');
      if (errorMsg) { pinOv.classList.add('shake'); setTimeout(() => pinOv.classList.remove('shake'), 420); }
    });
  }
  function closeOv(result) {
    pinOv.classList.add('hidden');
    const r = ovResolve; ovResolve = null;
    if (r) r(result);
  }
  function renderOvDots() {
    $$('#pin-ov-dots span').forEach((s, i) => s.classList.toggle('filled', i < ovBuffer.length));
  }
  function ovKey(k) {
    $('#pin-ov-error').textContent = '';
    if (k === 'back') { ovBuffer = ovBuffer.slice(0, -1); renderOvDots(); return; }
    if (k === 'reset') { ovBuffer = ''; renderOvDots(); return; }
    if (ovBuffer.length >= 4) return;
    ovBuffer += k; renderOvDots();
    if (ovBuffer.length === 4) { const v = ovBuffer; setTimeout(() => closeOv(v), 140); }
  }
  $('#pin-ov-keypad').addEventListener('click', e => {
    const b = e.target.closest('.key'); if (b) ovKey(b.dataset.key);
  });
  $('#pin-ov-close').addEventListener('click', () => closeOv(null));

  async function changePinFlow() {
    let cur = await askPin('Digite o PIN atual');
    if (cur === null) return;
    while (!Store.checkPin(cur)) {
      cur = await askPin('PIN atual', 'PIN incorreto. Tente de novo.');
      if (cur === null) return;
    }
    let novo = await askPin('Escolha o novo PIN');
    if (novo === null) return;
    let conf = await askPin('Confirme o novo PIN');
    if (conf === null) return;
    while (novo !== conf) {
      novo = await askPin('Escolha o novo PIN', 'Os PINs não conferem.');
      if (novo === null) return;
      conf = await askPin('Confirme o novo PIN');
      if (conf === null) return;
    }
    Store.setPin(novo);
    toast('PIN alterado com sucesso ✓');
  }
  $('#change-pin').addEventListener('click', changePinFlow);
  $('#lock-from-config').addEventListener('click', startLock);

  /* ---------------- UNIDADE ---------------- */
  function renderUnit() { $('#topbar-unit').textContent = Store.getUnit(); }
  /* ---------------- TOUR "COMO USAR" (primeiro acesso) ---------------- */
  const OB_SLIDES = [
    { art: '<img class="onboard__logo" src="icons/company.png" alt="">',
      title: 'Bem-vindo(a) à Boleta',
      text: 'Seu controle financeiro da semana — simples, rápido e guardado só no seu aparelho.' },
    { art: '➕',
      title: 'Lançar a semana',
      text: 'Toque no botão azul <b>Lançar</b>, no centro da barra de baixo, e registre as entradas (Boleta Principal e Patrocinadores) num passo a passo.' },
    { art: '🧾',
      title: 'Gastos',
      text: 'Em <b>Gastos</b>, cadastre as despesas fixas (aluguel, prebenda…) e as contas do mês (luz, água…).' },
    { art: '🏠 📅',
      title: 'Acompanhe o resultado',
      text: 'Em <b>Início</b> você vê o saldo do mês (verde = positivo, vermelho = negativo). Em <b>Histórico</b>, o resultado do ano e o gráfico.' },
    { art: '📲 🔒',
      title: 'Enviar e proteger',
      text: 'Envie o resumo pro WhatsApp num toque. Tudo é protegido por PIN e fica só neste aparelho — lembre de fazer backup em Histórico.<br><br>Encontrou um erro? Avise o desenvolvedor no WhatsApp <b>(11) 93295-5199</b>.' },
    { art: '🏢',
      title: 'Sua unidade',
      text: 'De qual unidade você é responsável agora? Você pode mudar depois em Ajustes.',
      field: true }
  ];
  let obStep = 0;

  function openOnboarding() {
    obStep = 0;
    $('#ob-unit').value = Store.getUnit();
    $('#onboard').classList.remove('hidden');
    obRender();
  }
  function obClose() { $('#onboard').classList.add('hidden'); }
  function obRender() {
    const s = OB_SLIDES[obStep], last = obStep === OB_SLIDES.length - 1;
    $('#ob-art').innerHTML = s.art;
    $('#ob-title').textContent = s.title;
    $('#ob-text').innerHTML = s.text;
    $('#ob-field').classList.toggle('hidden', !s.field);
    if (s.field) setTimeout(() => $('#ob-unit').focus(), 60);
    $('#ob-back').style.visibility = obStep === 0 ? 'hidden' : 'visible';
    $('#ob-next').textContent = last ? '✓ Começar' : 'Próximo';
    $('#ob-dots').innerHTML = OB_SLIDES.map((_, i) =>
      `<span class="ob-dot ${i === obStep ? 'is-on' : ''}"></span>`).join('');
  }
  function obNext() { if (obStep < OB_SLIDES.length - 1) { obStep++; obRender(); } else obFinish(); }
  function obBack() { if (obStep > 0) { obStep--; obRender(); } }
  function obFinish() {
    const v = ($('#ob-unit').value || '').trim();
    if (v) Store.setUnit(v);
    obClose(); renderUnit(); renderConfig();
  }
  $('#ob-next').addEventListener('click', obNext);
  $('#ob-back').addEventListener('click', obBack);
  $('#ob-skip').addEventListener('click', obFinish);
  $('#ob-unit').addEventListener('keydown', e => { if (e.key === 'Enter') obNext(); });
  function renderConfig() { $('#config-unit').textContent = Store.getUnit() || '(sem unidade definida)'; }
  $('#edit-unit').addEventListener('click', () => {
    promptText('Unidade responsável', 'Nome que aparece no topo do app e nos resumos.', Store.getUnit(), v => {
      Store.setUnit(v.trim());
      renderUnit(); renderConfig();
      toast('Unidade atualizada');
    });
  });
  $('#show-welcome').addEventListener('click', openOnboarding);

  /* =================================================================
     NAVEGAÇÃO ENTRE MESES E VIEWS
     ================================================================= */
  $('#prev-month').addEventListener('click', () => shiftMonth(-1));
  $('#next-month').addEventListener('click', () => shiftMonth(1));
  function shiftMonth(delta) {
    let m = cur.month + delta, y = cur.year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    cur = { year: y, month: m };
    renderAll();
  }

  /* tocar no nome do mês abre o seletor de mês/ano (bottom sheet) */
  $('#month-label').addEventListener('click', chooseMonth);
  function chooseMonth() {
    $('#picker-title').textContent = 'Escolha o mês';
    const list = $('#picker-list');
    let py = cur.year;
    function draw() {
      const grid = U.MESES.map((nm, m) => {
        const sel = (m === cur.month && py === cur.year);
        const act = Store.monthHasActivity(py, m);
        const nome = nm.charAt(0).toUpperCase() + nm.slice(1, 3);
        return `<button class="mpick__m ${sel ? 'is-sel' : ''}" data-m="${m}">${nome}${act ? '<i class="mpick__dot"></i>' : ''}</button>`;
      }).join('');
      list.innerHTML = `<div class="mpick">
        <div class="mpick__yr">
          <button class="mpick__yrbtn" data-d="-1" aria-label="Ano anterior">‹</button>
          <span class="mpick__yrlabel">${py}</span>
          <button class="mpick__yrbtn" data-d="1" aria-label="Próximo ano">›</button>
        </div>
        <div class="mpick__grid">${grid}</div>
      </div>`;
      $$('#picker-list .mpick__yrbtn').forEach(b =>
        b.addEventListener('click', () => { py += Number(b.dataset.d); draw(); }));
      $$('#picker-list .mpick__m').forEach(b =>
        b.addEventListener('click', () => {
          cur = { year: py, month: Number(b.dataset.m) };
          closePicker(); renderAll();
        }));
    }
    draw();
    picker.classList.remove('hidden');
  }

  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    activeView = tab.dataset.view;
    $$('.tab').forEach(t => t.classList.toggle('is-active', t === tab));
    $$('.view').forEach(v => v.classList.add('hidden'));
    $('#view-' + activeView).classList.remove('hidden');
    renderActiveView();
  }));

  /* =================================================================
     RENDER GERAL
     ================================================================= */
  function renderAll() {
    $('#month-label').textContent = U.monthLabel(cur.year, cur.month);
    renderActiveView();
  }
  function renderActiveView() {
    if (activeView === 'resumo')    renderResumo();
    if (activeView === 'entradas')  renderEntradas();
    if (activeView === 'despesas')  renderDespesas();
    if (activeView === 'historico') renderHistorico();
    if (activeView === 'config')    renderConfig();
  }

  /* ---------------- RESUMO ---------------- */
  function renderResumo() {
    const s = Store.monthSummary(cur.year, cur.month);
    const card = $('#balance-card');
    $('#balance-value').textContent = U.moneyBR(s.saldo);
    card.classList.toggle('is-pos', s.saldo >= 0);
    card.classList.toggle('is-neg', s.saldo < 0);
    $('#balance-hint').textContent =
      U.moneyBR(s.entradas) + ' entradas − ' + U.moneyBR(s.saidas) + ' saídas';

    $('#stat-entradas').textContent = U.moneyBR(s.entradas);
    $('#stat-saidas').textContent  = U.moneyBR(s.saidas);

    // entradas por categoria
    const be = $('#breakdown-entradas');
    be.innerHTML =
      bdRow('Boleta Principal', s.principal, 'in') +
      bdRow('Patrocinadores', s.patrocinadores, 'in');

    // saídas: fixas (cada uma) + variáveis (cada uma)
    const bs = $('#breakdown-saidas');
    let rows = '';
    Store.fixedList().forEach(it => {
      rows += bdRow(it.name, Store.fixedAmount(it, cur.year), 'out', 'fixa');
    });
    Store.getVariable(U.monthKey(cur.year, cur.month)).forEach(v => {
      rows += bdRow(v.name, v.amount, 'out', 'variável');
    });
    bs.innerHTML = rows || '<div class="bd-empty">Nenhuma saída cadastrada neste mês.</div>';
  }
  function bdRow(name, val, dir, tag) {
    const dot = dir === 'out' ? 'bd-row__dot bd-row__dot--out' : 'bd-row__dot';
    const tg = tag ? `<span class="bd-row__tag">${tag}</span>` : '';
    return `<div class="bd-row">
      <span class="bd-row__name"><span class="${dot}"></span>${esc(name)}${tg}</span>
      <span class="bd-row__val">${U.moneyBR(val)}</span></div>`;
  }

  /* ---------------- ENTRADAS (semanas) ---------------- */
  function renderEntradas() {
    const mKey = U.monthKey(cur.year, cur.month);
    const weeks = U.weeksOfMonth(cur.year, cur.month);
    const wrap = $('#weeks-list');
    wrap.innerHTML = weeks.map((w, i) => {
      const inc = Store.getIncome(mKey, w.key);
      const total = (inc.principal || 0) + (inc.patrocinadores || 0);
      return `<div class="week" data-week="${w.key}">
        <div class="week__head">
          <div>
            <div class="week__title">Semana ${i + 1}</div>
            <div class="week__range">${U.ddmm(w.start)} – ${U.ddmm(w.end)}</div>
          </div>
          <div class="week__total" data-total>${U.moneyBR(total)}</div>
        </div>
        <div class="in-field">
          <span class="in-field__label"><span class="bd-row__dot"></span><b>Boleta Principal</b></span>
          <input class="input input--money" inputmode="decimal" data-field="principal"
            value="${inc.principal ? U.numBR(inc.principal) : ''}" placeholder="0,00" />
        </div>
        <div class="in-field">
          <span class="in-field__label"><span class="bd-row__dot"></span><b>Patrocinadores</b></span>
          <input class="input input--money" inputmode="decimal" data-field="patrocinadores"
            value="${inc.patrocinadores ? U.numBR(inc.patrocinadores) : ''}" placeholder="0,00" />
        </div>
      </div>`;
    }).join('');

    $$('#weeks-list .week').forEach(weekEl => {
      const wKey = weekEl.dataset.week;
      $$('.input--money', weekEl).forEach(inp => {
        inp.addEventListener('change', () => {
          const val = U.parseNum(inp.value);
          inp.value = val ? U.numBR(val) : '';
          Store.setIncome(mKey, wKey, inp.dataset.field, val);
          const inc = Store.getIncome(mKey, wKey);
          $('[data-total]', weekEl).textContent = U.moneyBR((inc.principal || 0) + (inc.patrocinadores || 0));
        });
      });
    });
  }

  /* ---------------- DESPESAS ---------------- */
  function renderDespesas() {
    const mKey = U.monthKey(cur.year, cur.month);

    // fixas
    const fl = $('#fixed-list');
    const fixed = Store.fixedList();
    fl.innerHTML = fixed.length ? fixed.map(it => {
      const val = Store.fixedAmount(it, cur.year);
      return `<div class="list-row is-editable" data-id="${it.id}">
        <span class="list-row__name">${esc(it.name)}
          <span class="list-row__sub">valor de ${cur.year}</span></span>
        <span class="list-row__val" data-edit-fixed>${U.moneyBR(val)}</span>
        <button class="list-row__del" data-del-fixed title="Remover">✕</button>
      </div>`;
    }).join('') : '<div class="bd-empty">Nenhuma despesa fixa ainda.</div>';

    $$('#fixed-list .list-row').forEach(row => {
      const id = row.dataset.id;
      $('[data-edit-fixed]', row).addEventListener('click', () => {
        const it = Store.fixedList().find(f => f.id === id);
        promptMoney(`Editar "${it.name}" (${cur.year})`,
          'Valor para este ano. Anos anteriores ficam preservados.',
          Store.fixedAmount(it, cur.year), v => {
            Store.setFixedAmount(id, cur.year, v); renderDespesas(); toast('Valor atualizado');
          });
      });
      $('[data-del-fixed]', row).addEventListener('click', () => {
        confirmBox('Remover despesa fixa?', 'Ela some de todos os meses.', () => {
          Store.removeFixed(id); renderDespesas(); toast('Removida');
        }, 'Remover');
      });
    });

    // variáveis do mês
    const vl = $('#variable-list');
    const vars = Store.getVariable(mKey);
    vl.innerHTML = vars.length ? vars.map(v =>
      `<div class="list-row is-editable" data-id="${v.id}">
        <span class="list-row__name">${esc(v.name)}</span>
        <span class="list-row__val" data-edit-var>${U.moneyBR(v.amount)}</span>
        <button class="list-row__del" data-del-var title="Remover">✕</button>
      </div>`).join('') : '<div class="bd-empty">Nenhuma conta variável neste mês.</div>';

    $$('#variable-list .list-row').forEach(row => {
      const id = row.dataset.id;
      $('[data-edit-var]', row).addEventListener('click', () => {
        const it = Store.getVariable(mKey).find(v => v.id === id);
        promptMoney(`Editar "${it.name}"`, 'Valor desta conta no mês.', it.amount, v => {
          Store.setVariableAmount(mKey, id, v); renderDespesas(); renderResumoIfActive(); toast('Atualizado');
        });
      });
      $('[data-del-var]', row).addEventListener('click', () => {
        Store.removeVariable(mKey, id); renderDespesas(); toast('Removida');
      });
    });
  }

  $('#add-fixed').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fixed-name').value.trim();
    const amount = U.parseNum($('#fixed-amount').value);
    if (!name) return;
    Store.addFixed(name, amount, cur.year);
    $('#fixed-name').value = ''; $('#fixed-amount').value = '';
    renderDespesas(); toast('Despesa fixa adicionada');
  });

  $('#add-variable').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#variable-name').value.trim();
    const amount = U.parseNum($('#variable-amount').value);
    if (!name) return;
    Store.addVariable(U.monthKey(cur.year, cur.month), name, amount);
    $('#variable-name').value = ''; $('#variable-amount').value = '';
    renderDespesas(); toast('Conta adicionada');
  });

  $('#adjust-year').addEventListener('click', () => {
    if (!Store.fixedList().length) { toast('Cadastre despesas fixas primeiro'); return; }
    promptText('Reajuste anual', `Aplicar reajuste % nas despesas fixas para o ano ${cur.year}, ` +
      `com base nos valores de ${cur.year - 1}. Ex: 5 para +5%.`, '', raw => {
      const pct = U.parseNum(raw);
      Store.applyAnnualAdjust(cur.year, pct);
      renderDespesas(); toast(`Reajuste de ${pct}% aplicado em ${cur.year}`);
    });
  });

  /* ---------------- HISTÓRICO ---------------- */
  function renderHistorico() {
    const keys = Store.monthsWithData();
    const years = [...new Set(keys.map(k => U.parseMonthKey(k).year))].sort((a, b) => b - a);
    if (!years.includes(cur.year)) years.unshift(cur.year);
    if (!years.includes(histYear)) histYear = years[0] || cur.year;

    $('#year-tabs').innerHTML = years.map(y =>
      `<button class="year-tab ${y === histYear ? 'is-active' : ''}" data-year="${y}">${y}</button>`).join('');
    $$('#year-tabs .year-tab').forEach(t => t.addEventListener('click', () => {
      histYear = Number(t.dataset.year); histOpenMonth = null; renderHistorico();
    }));

    renderYearSummary();

    // saldo de cada mês com movimento no ano selecionado
    const rows = [];
    let maxAbs = 1;
    for (let m = 0; m < 12; m++) {
      const has = Store.monthHasActivity(histYear, m);
      const s = Store.monthSummary(histYear, m);
      if (has) maxAbs = Math.max(maxAbs, Math.abs(s.saldo));
      rows.push({ m, s, hasData: has });
    }

    const list = $('#history-list');
    const visible = rows.filter(r => r.hasData);
    if (!visible.length) {
      list.innerHTML = '<div class="bd-empty">Sem lançamentos em ' + histYear + '.</div>';
      return;
    }
    list.innerHTML = visible.map(({ m, s }) => {
      const pos = s.saldo >= 0;
      const w = Math.max(4, Math.round(Math.abs(s.saldo) / maxAbs * 100));
      const open = m === histOpenMonth;
      return `<div class="hist-item ${open ? 'is-open' : ''}">
        <div class="hist-row" data-m="${m}" role="button" tabindex="0" aria-expanded="${open}">
          <div>
            <div class="hist-row__month">${U.MESES[m]}<span class="hist-row__chev">▾</span></div>
            <div class="hist-row__meta">${U.moneyBR(s.entradas)} entradas · ${U.moneyBR(s.saidas)} saídas</div>
            <div class="hist-bar"><div class="hist-bar__fill" style="width:${w}%;background:${pos ? 'var(--pos)' : 'var(--neg)'}"></div></div>
          </div>
          <div class="hist-row__bal ${pos ? 'is-pos' : 'is-neg'}">${U.moneyBR(s.saldo)}</div>
        </div>
        ${open ? renderWeeksDetail(m) : ''}
      </div>`;
    }).join('');
    $$('#history-list .hist-row').forEach(row => row.addEventListener('click', () => {
      const m = Number(row.dataset.m);
      histOpenMonth = histOpenMonth === m ? null : m;
      renderHistorico();
    }));
  }

  /** detalhe expansível: como foram as semanas (seg–dom) do mês */
  function renderWeeksDetail(m) {
    const mKey = U.monthKey(histYear, m);
    const weeks = U.weeksOfMonth(histYear, m);
    const rows = weeks.map((wk, i) => {
      const inc = Store.getIncome(mKey, wk.key);
      const principal = inc.principal || 0;
      const patro = inc.patrocinadores || 0;
      const total = principal + patro;
      return `<div class="wk-row">
        <div class="wk-row__top">
          <span class="wk-row__n">Semana ${i + 1} <small>${U.ddmm(wk.start)}–${U.ddmm(wk.end)}</small></span>
          <b class="wk-row__total ${total > 0 ? 'pos' : 'muted'}">${U.moneyBR(total)}</b>
        </div>
        <div class="wk-row__sub">Principal ${U.moneyBR(principal)} · Patrocinadores ${U.moneyBR(patro)}</div>
      </div>`;
    }).join('');
    return `<div class="wk-detail">${rows}</div>`;
  }

  /* ---------------- RESUMO ANUAL ---------------- */
  function renderYearSummary() {
    const ys = Store.yearSummary(histYear);
    const wrap = $('#year-summary');
    if (!ys.meses) {
      wrap.className = 'ysum';
      wrap.innerHTML = `<span class="ysum__label">Resultado de ${histYear}</span>
        <div class="ysum__empty">Sem meses com movimento ainda. Lance entradas para acompanhar o ano.</div>`;
      return;
    }
    const pos = ys.saldo >= 0;
    wrap.className = 'ysum ' + (pos ? 'is-pos' : 'is-neg');
    const melhor = ys.melhor ? `${U.MESES[ys.melhor.month]} · ${U.moneyBR(ys.melhor.saldo)}` : '—';
    const pior   = ys.pior   ? `${U.MESES[ys.pior.month]} · ${U.moneyBR(ys.pior.saldo)}`   : '—';
    const mesesTxt = ys.meses > 1 ? `${ys.meses} meses ativos` : '1 mês ativo';
    wrap.innerHTML = `
      <span class="ysum__label">Resultado de ${histYear}</span>
      <span class="ysum__saldo">${U.moneyBR(ys.saldo)}</span>
      <span class="ysum__meta">${mesesTxt} · média ${U.moneyBR(ys.media)}/mês</span>
      <div id="ychart-wrap"></div>
      <div class="ysum__grid">
        <div class="ysum__cell"><span>Entradas no ano</span><b class="pos">${U.moneyBR(ys.entradas)}</b></div>
        <div class="ysum__cell"><span>Saídas no ano</span><b class="neg">${U.moneyBR(ys.saidas)}</b></div>
        <div class="ysum__cell"><span>Melhor mês</span><b><small>${melhor}</small></b></div>
        <div class="ysum__cell"><span>Pior mês</span><b><small>${pior}</small></b></div>
      </div>
      <button class="btn btn--neon ysum__export" id="export-year">📲 Resumo do ano</button>`;
    $('#export-year').addEventListener('click', () => copyOrShare(buildYearText(histYear), 'Resumo do ano'));
    yearSel = null;          // reset ao trocar de ano; renderYearChart escolhe o padrão
    renderYearChart();
  }

  const capMes = m => U.MESES[m].charAt(0).toUpperCase() + U.MESES[m].slice(1);

  /** mini-gráfico de barras (12 meses, base no zero) com mês selecionável */
  function renderYearChart() {
    const year = histYear;
    const months = [];
    let maxAbs = 1, lastActive = null;
    for (let m = 0; m < 12; m++) {
      const has = Store.monthHasActivity(year, m);
      const saldo = has ? Store.monthSummary(year, m).saldo : null;
      if (has) { maxAbs = Math.max(maxAbs, Math.abs(saldo)); lastActive = m; }
      months.push({ m, has, saldo });
    }
    if (yearSel === null) yearSel = lastActive;   // padrão: último mês com movimento

    const cols = months.map(({ m, has, saldo }) => {
      const posH = has && saldo >= 0 ? Math.max(6, Math.round(saldo / maxAbs * 100)) : 0;
      const negH = has && saldo < 0 ? Math.max(6, Math.round(-saldo / maxAbs * 100)) : 0;
      const sel = m === yearSel;
      const cls = 'ychart__col' + (has ? '' : ' is-empty') + (sel ? ' is-sel' : '');
      const pill = sel ? `<span class="ychart__pill">${capMes(m)}</span>` : '';
      return `<div class="${cls}" data-m="${m}">
        <div class="ychart__half ychart__half--pos"><i class="ychart__bar is-pos" style="height:${posH}%"></i></div>
        <div class="ychart__half ychart__half--neg"><i class="ychart__bar is-neg" style="height:${negH}%"></i></div>
        <span class="ychart__m">${U.MESES[m].slice(0, 3)}</span>${pill}
      </div>`;
    }).join('');

    let cap = '<div class="ychart__cap ychart__cap--hint">Toque ou arraste o dedo nas barras</div>';
    if (yearSel !== null) {
      const sm = months[yearSel];
      cap = sm.has
        ? `<div class="ychart__cap"><b>${capMes(yearSel)}</b> · <b class="${sm.saldo >= 0 ? 'pos' : 'neg'}">${U.moneyBR(sm.saldo)}</b></div>`
        : `<div class="ychart__cap"><b>${capMes(yearSel)}</b> · <span class="muted">sem movimento</span></div>`;
    }

    const wrap = $('#ychart-wrap');
    wrap.innerHTML = `<div class="ychart">${cols}</div>${cap}`;
    bindChartDrag(wrap);
  }

  /** seleção do mês por toque OU arrasto do dedo sobre as barras.
   *  Liga uma vez por elemento #ychart-wrap (persiste entre re-renders internos). */
  function bindChartDrag(wrap) {
    if (wrap.dataset.dragBound) return;
    wrap.dataset.dragBound = '1';
    let dragging = false;
    const pick = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const col = el && el.closest('.ychart__col');
      if (col) {
        const m = Number(col.dataset.m);
        if (m !== yearSel) { yearSel = m; renderYearChart(); }
      }
    };
    wrap.addEventListener('pointerdown', e => {
      dragging = true;
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      pick(e.clientX, e.clientY);
    });
    wrap.addEventListener('pointermove', e => { if (dragging) pick(e.clientX, e.clientY); });
    const stop = () => { dragging = false; };
    wrap.addEventListener('pointerup', stop);
    wrap.addEventListener('pointercancel', stop);
  }

  /* =================================================================
     EXPORTAR PARA WHATSAPP (semanal, mensal ou anual)
     ================================================================= */
  function buildMonthlyText() {
    const s = Store.monthSummary(cur.year, cur.month);
    const mKey = U.monthKey(cur.year, cur.month);
    const sinal = s.saldo >= 0 ? '🟢' : '🔴';
    const u = Store.getUnit();
    let txt = `*BOLETA · ${U.monthLabel(cur.year, cur.month)}*\n`;
    if (u) txt += `_${u}_\n`;
    txt += `━━━━━━━━━━━━━━\n`;
    txt += `*ENTRADAS:* ${U.moneyBR(s.entradas)}\n`;
    txt += `  • Boleta Principal: ${U.moneyBR(s.principal)}\n`;
    txt += `  • Patrocinadores: ${U.moneyBR(s.patrocinadores)}\n\n`;
    txt += `*POR SEMANA:*\n`;
    U.weeksOfMonth(cur.year, cur.month).forEach((wk, i) => {
      const inc = Store.getIncome(mKey, wk.key);
      txt += `  ${i + 1}. ${U.ddmm(wk.start)}–${U.ddmm(wk.end)}\n`;
      txt += `     Boleta: ${U.moneyBR(inc.principal || 0)} · Patrocinador: ${U.moneyBR(inc.patrocinadores || 0)}\n`;
    });
    txt += `\n*SAÍDAS:* ${U.moneyBR(s.saidas)}\n`;
    Store.fixedList().forEach(it => {
      txt += `  • ${it.name}: ${U.moneyBR(Store.fixedAmount(it, cur.year))}\n`;
    });
    Store.getVariable(mKey).forEach(v => { txt += `  • ${v.name}: ${U.moneyBR(v.amount)}\n`; });
    txt += `━━━━━━━━━━━━━━\n`;
    txt += `${sinal} *SALDO: ${U.moneyBR(s.saldo)}*`;
    return txt;
  }

  function buildWeeklyText(weekKey, index, week) {
    const mKey = U.monthKey(cur.year, cur.month);
    const inc = Store.getIncome(mKey, weekKey);
    const total = (inc.principal || 0) + (inc.patrocinadores || 0);
    const u = Store.getUnit();
    let txt = `*BOLETA · Semana ${index + 1}*\n`;
    if (u) txt += `_${u}_\n`;
    txt += `${U.monthLabel(cur.year, cur.month)} · ${U.ddmm(week.start)}–${U.ddmm(week.end)}\n`;
    txt += `━━━━━━━━━━━━━━\n`;
    txt += `*ENTRADAS DA SEMANA:* ${U.moneyBR(total)}\n`;
    txt += `  • Boleta Principal: ${U.moneyBR(inc.principal || 0)}\n`;
    txt += `  • Patrocinadores: ${U.moneyBR(inc.patrocinadores || 0)}`;
    return txt;
  }

  function buildYearText(year) {
    const ys = Store.yearSummary(year);
    const sinal = ys.saldo >= 0 ? '🟢' : '🔴';
    const mesesTxt = ys.meses > 1 ? `${ys.meses} meses ativos` : `${ys.meses} mês ativo`;
    const u = Store.getUnit();
    let txt = `*BOLETA · Ano ${year}*\n`;
    if (u) txt += `_${u}_\n`;
    txt += `━━━━━━━━━━━━━━\n`;
    txt += `*ENTRADAS:* ${U.moneyBR(ys.entradas)}\n`;
    txt += `  • Boleta Principal: ${U.moneyBR(ys.principal)}\n`;
    txt += `  • Patrocinadores: ${U.moneyBR(ys.patrocinadores)}\n\n`;
    txt += `*SAÍDAS:* ${U.moneyBR(ys.saidas)}\n`;
    txt += `  • Fixas: ${U.moneyBR(ys.fixed)}\n`;
    txt += `  • Variáveis: ${U.moneyBR(ys.variable)}\n`;
    txt += `━━━━━━━━━━━━━━\n`;
    txt += `${sinal} *SALDO DO ANO: ${U.moneyBR(ys.saldo)}*\n`;
    txt += `${mesesTxt} · média ${U.moneyBR(ys.media)}/mês`;
    if (ys.melhor) txt += `\nMelhor: ${U.MESES[ys.melhor.month]} (${U.moneyBR(ys.melhor.saldo)})`;
    if (ys.pior)   txt += ` · Pior: ${U.MESES[ys.pior.month]} (${U.moneyBR(ys.pior.saldo)})`;
    return txt;
  }

  async function copyOrShare(txt, label) {
    try {
      await navigator.clipboard.writeText(txt);
      toast('Resumo copiado! Cole no WhatsApp 📲');
    } catch (e) {
      // fallback: compartilhamento nativo ou modal com o texto p/ copiar manual
      if (navigator.share) { try { await navigator.share({ text: txt }); return; } catch (_) {} }
      showTextModal(label, txt);
    }
  }

  $('#export-month').addEventListener('click', () => copyOrShare(buildMonthlyText(), 'Resumo do mês'));
  $('#export-week').addEventListener('click', () => {
    const weeks = U.weeksOfMonth(cur.year, cur.month);
    chooseWeek(weeks, key => {
      const idx = weeks.findIndex(w => w.key === key);
      copyOrShare(buildWeeklyText(key, idx, weeks[idx]), 'Resumo da semana ' + (idx + 1));
    });
  });

  /* seletor de semana (bottom sheet) */
  const picker = $('#picker');
  function chooseWeek(weeks, cb) {
    $('#picker-title').textContent = 'Escolha a semana';
    const todayIso = U.iso(new Date());
    const list = $('#picker-list');
    list.innerHTML = weeks.map((w, i) => {
      const atual = w.key <= todayIso && todayIso <= U.iso(w.end);
      return `<button class="picker-item" data-key="${w.key}">
        <span class="picker-item__name">Semana ${i + 1}${atual ? ' <span class="picker-item__tag">atual</span>' : ''}</span>
        <span class="picker-item__sub">${U.ddmm(w.start)}–${U.ddmm(w.end)}</span>
      </button>`;
    }).join('');
    picker.classList.remove('hidden');
    $$('#picker-list .picker-item').forEach(btn =>
      btn.addEventListener('click', () => { closePicker(); cb(btn.dataset.key); }));
  }
  function closePicker() { picker.classList.add('hidden'); }
  $('#picker-close').addEventListener('click', closePicker);
  picker.addEventListener('click', e => { if (e.target === picker) closePicker(); });

  /* =================================================================
     BACKUP / RESTAURAÇÃO (.json)
     ================================================================= */
  $('#export-json').addEventListener('click', () => {
    const bundle = Store.exportBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url; a.download = 'boleta-backup-' + stamp + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Backup exportado 📁');
  });

  $('#import-json').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = ''; // permite reimportar o mesmo arquivo depois
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (_) { toast('Arquivo inválido (não é JSON).'); return; }
      confirmRestore(parsed);
    };
    reader.onerror = () => toast('Falha ao ler o arquivo.');
    reader.readAsText(file);
  });

  function confirmRestore(parsed) {
    const nFixed = Array.isArray(parsed.fixedExpenses) ? parsed.fixedExpenses.length : 0;
    const nVar = parsed.variable && typeof parsed.variable === 'object' ? Object.keys(parsed.variable).length : 0;
    const nInc = parsed.income && typeof parsed.income === 'object' ? Object.keys(parsed.income).length : 0;
    confirmBox('Restaurar backup?',
      `Isto substitui TODOS os dados atuais por: ${nFixed} despesa(s) fixa(s) e lançamentos de ` +
      `até ${Math.max(nVar, nInc)} mês(es). Seu PIN é mantido. Esta ação não pode ser desfeita.`,
      () => {
        try { Store.importBundle(parsed); }
        catch (err) { toast(err.message || 'Backup inválido.'); return; }
        renderAll(); toast('Backup restaurado ✓');
      }, 'Restaurar');
  }

  /* =================================================================
     ASSISTENTE DE LANÇAMENTO GUIADO (wizard)
     ================================================================= */
  let wiz = null;   // { weeks, mKey, weekIdx, principal, patrocinadores, step }

  function openWizard() {
    const weeks = U.weeksOfMonth(cur.year, cur.month);
    const mKey = U.monthKey(cur.year, cur.month);
    const todayIso = U.iso(new Date());
    let weekIdx = weeks.findIndex(w => w.key <= todayIso && todayIso <= U.iso(w.end));
    if (weekIdx < 0) weekIdx = 0;
    const inc = Store.getIncome(mKey, weeks[weekIdx].key);
    wiz = { weeks, mKey, weekIdx, principal: inc.principal || 0, patrocinadores: inc.patrocinadores || 0, step: 1 };
    $('#wizard').classList.remove('hidden');
    wizRender();
  }
  function wizClose() { $('#wizard').classList.add('hidden'); wiz = null; }

  function wizLoadWeek() {
    const inc = Store.getIncome(wiz.mKey, wiz.weeks[wiz.weekIdx].key);
    wiz.principal = inc.principal || 0;
    wiz.patrocinadores = inc.patrocinadores || 0;
  }

  function wizRender() {
    const { step, weeks, weekIdx } = wiz;
    const w = weeks[weekIdx];
    const periodo = `Semana ${weekIdx + 1} · ${U.ddmm(w.start)}–${U.ddmm(w.end)}`;
    $('#wiz-steps').innerHTML = [1, 2, 3, 4].map(n =>
      `<span class="wiz-dot ${n === step ? 'is-on' : ''} ${n < step ? 'is-done' : ''}"></span>`).join('');
    $('#wiz-back').style.visibility = step === 1 ? 'hidden' : 'visible';
    const next = $('#wiz-next'), body = $('#wiz-body');

    if (step === 1) {
      $('#wiz-title').textContent = 'Qual semana?';
      $('#wiz-sub').textContent = U.monthLabel(cur.year, cur.month);
      next.textContent = 'Próximo';
      const todayIso = U.iso(new Date());
      body.innerHTML = weeks.map((ww, i) => {
        const atual = ww.key <= todayIso && todayIso <= U.iso(ww.end);
        return `<button class="wiz-week ${i === weekIdx ? 'is-sel' : ''}" data-i="${i}">
          <span class="wiz-week__name">Semana ${i + 1}${atual ? ' <span class="picker-item__tag">atual</span>' : ''}</span>
          <span class="picker-item__sub">${U.ddmm(ww.start)}–${U.ddmm(ww.end)}</span>
        </button>`;
      }).join('');
      $$('#wiz-body .wiz-week').forEach(b => b.addEventListener('click', () => {
        wiz.weekIdx = Number(b.dataset.i); wizLoadWeek(); wizRender();
      }));
    } else if (step === 2 || step === 3) {
      const isPrinc = step === 2;
      $('#wiz-title').textContent = isPrinc ? 'Boleta Principal' : 'Patrocinadores';
      $('#wiz-sub').textContent = periodo;
      next.textContent = 'Próximo';
      const val = isPrinc ? wiz.principal : wiz.patrocinadores;
      body.innerHTML = `<label class="wiz-field">
        <span>Quanto entrou ${isPrinc ? 'na Boleta Principal' : 'de Patrocinadores'} nesta semana?</span>
        <div class="wiz-money"><span>R$</span>
          <input class="input wiz-input" id="wiz-val" inputmode="decimal" placeholder="0,00"
            value="${val ? U.numBR(val) : ''}" /></div>
      </label>`;
      const inp = $('#wiz-val');
      setTimeout(() => { inp.focus(); inp.select(); }, 60);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wizNext(); } });
    } else {
      $('#wiz-title').textContent = 'Confirmar';
      $('#wiz-sub').textContent = periodo;
      next.textContent = '✓ Salvar';
      const total = wiz.principal + wiz.patrocinadores;
      body.innerHTML = `<div class="wiz-summary">
        <div class="wiz-srow"><span>Boleta Principal</span><b>${U.moneyBR(wiz.principal)}</b></div>
        <div class="wiz-srow"><span>Patrocinadores</span><b>${U.moneyBR(wiz.patrocinadores)}</b></div>
        <div class="wiz-srow wiz-srow--total"><span>Total da semana</span><b class="pos">${U.moneyBR(total)}</b></div>
      </div>`;
    }
  }

  function wizCaptureInput() {
    if (wiz.step === 2) wiz.principal = U.parseNum($('#wiz-val').value);
    if (wiz.step === 3) wiz.patrocinadores = U.parseNum($('#wiz-val').value);
  }
  function wizNext() {
    wizCaptureInput();
    if (wiz.step < 4) { wiz.step++; wizRender(); } else wizSave();
  }
  function wizBack() {
    wizCaptureInput();
    if (wiz.step > 1) { wiz.step--; wizRender(); }
  }
  function wizSave() {
    const idx = wiz.weekIdx, w = wiz.weeks[idx];
    Store.setIncome(wiz.mKey, w.key, 'principal', wiz.principal);
    Store.setIncome(wiz.mKey, w.key, 'patrocinadores', wiz.patrocinadores);
    wizClose();
    renderEntradas();
    if (activeView === 'resumo') renderResumo();
    toast(`Semana ${idx + 1} lançada ✓`);
  }
  $('#start-wizard').addEventListener('click', openWizard);
  $('#tab-lancar').addEventListener('click', openWizard);   // botão central abre o guia direto
  $('#wiz-next').addEventListener('click', wizNext);
  $('#wiz-back').addEventListener('click', wizBack);
  $('#wiz-close').addEventListener('click', wizClose);

  /* =================================================================
     MODAL / TOAST / HELPERS
     ================================================================= */
  const modal = $('#modal');
  let modalOk = null;
  function openModal({ title, msg, withField, value, okText, placeholder }) {
    $('#modal-title').textContent = title;
    $('#modal-msg').textContent = msg || '';
    $('#modal-msg').classList.toggle('hidden', !msg);
    $('#modal-field-wrap').classList.toggle('hidden', !withField);
    $('#modal-ok').textContent = okText || 'Confirmar';
    const input = $('#modal-input');
    input.placeholder = placeholder || '';
    if (withField) { input.value = value || ''; setTimeout(() => input.focus(), 50); }
    modal.classList.remove('hidden');
  }
  function closeModal() { modal.classList.add('hidden'); modalOk = null; }
  $('#modal-cancel').addEventListener('click', closeModal);
  $('#modal-ok').addEventListener('click', () => { if (modalOk) modalOk($('#modal-input').value); });
  $('#modal-input').addEventListener('keydown', e => { if (e.key === 'Enter' && modalOk) modalOk($('#modal-input').value); });

  function promptMoney(title, msg, value, cb) {
    openModal({ title, msg, withField: true, value: U.numBR(value) });
    modalOk = raw => { closeModal(); cb(U.parseNum(raw)); };
  }
  function promptText(title, msg, value, cb) {
    openModal({ title, msg, withField: true, value });
    modalOk = raw => { closeModal(); cb(raw); };
  }
  function confirmBox(title, msg, cb, okText) {
    openModal({ title, msg, withField: false, okText: okText || 'Confirmar' });
    modalOk = () => { closeModal(); cb(); };
  }
  function showTextModal(title, text) {
    openModal({ title, msg: '', withField: true, value: text, okText: 'OK' });
    $('#modal-input').setAttribute('readonly', 'readonly');
    $('#modal-input').select();
    modalOk = () => { $('#modal-input').removeAttribute('readonly'); closeModal(); };
  }

  let toastT;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function renderResumoIfActive() { if (activeView === 'resumo') renderResumo(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* =================================================================
     SERVICE WORKER (PWA offline)
     ================================================================= */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ===== start ===== */
  startLock();
})();
