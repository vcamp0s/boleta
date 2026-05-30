/* ====================================================================
   utils.js — helpers de data, semana, moeda e hash
   ==================================================================== */
const U = (() => {
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro'];

  /** chave de mês "YYYY-MM" a partir de ano + índice (0-11) */
  function monthKey(year, month) {
    return year + '-' + String(month + 1).padStart(2, '0');
  }

  /** "2026-05" -> { year:2026, month:4 } (month 0-11) */
  function parseMonthKey(key) {
    const [y, m] = key.split('-').map(Number);
    return { year: y, month: m - 1 };
  }

  /** nome "Maio 2026" */
  function monthLabel(year, month) {
    const nome = MESES[month];
    return nome.charAt(0).toUpperCase() + nome.slice(1) + ' ' + year;
  }

  /** ISO "YYYY-MM-DD" de uma data (local, sem fuso) */
  function iso(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /** "dd/mm" curto */
  function ddmm(d) {
    return String(d.getDate()).padStart(2, '0') + '/' +
      String(d.getMonth() + 1).padStart(2, '0');
  }

  /**
   * Semanas (segunda a domingo) de um mês, recortadas nas bordas do mês.
   * A 1ª e a última semana podem ser parciais — assim todo dia do mês
   * aparece exatamente uma vez, sem sobreposição com o mês vizinho.
   * (Ex: maio/2026 começa numa sexta → Semana 1 = 01/05–03/05.)
   * Chave = data do 1º dia exibido da semana (estável por mês).
   */
  function weeksOfMonth(year, month) {
    const weeks = [];
    const lastDay = new Date(year, month + 1, 0); // último dia do mês
    let cursor = new Date(year, month, 1);
    while (cursor <= lastDay) {
      const start = new Date(cursor);
      // domingo da semana que contém o cursor (getDay: dom=0 .. sáb=6)
      const sunday = new Date(cursor);
      sunday.setDate(sunday.getDate() + ((7 - cursor.getDay()) % 7));
      const end = sunday <= lastDay ? sunday : new Date(lastDay); // recorta no fim do mês
      weeks.push({ start, end, key: iso(start) });
      cursor = new Date(end);
      cursor.setDate(cursor.getDate() + 1); // pula para o dia seguinte
    }
    return weeks;
  }

  function moneyBR(n) {
    return (n || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });
  }

  /** versão compacta sem símbolo, p/ inputs: 1234.5 -> "1.234,50" */
  function numBR(n) {
    return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** "1.234,56" ou "1234.56" -> 1234.56  (aceita o que o usuário digitar) */
  function parseNum(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    let s = String(str).trim().replace(/\s|R\$/g, '');
    if (s.indexOf(',') > -1) {            // formato BR: ponto = milhar, vírgula = decimal
      s = s.replace(/\./g, '').replace(',', '.');
    }
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  /** hash simples (não-criptográfico) p/ não guardar o PIN em texto puro */
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  return { MESES, monthKey, parseMonthKey, monthLabel, iso, ddmm,
    weeksOfMonth, moneyBR, numBR, parseNum, hash };
})();
