// SDE · EsFO — Leitura de escalas de serviço em PDF
// Lê o texto do PDF no próprio navegador (nada é enviado para fora) e devolve os serviços
// encontrados, com cadete, início e fim. Tipos reconhecidos:
//   • Previsão de Escala de Serviço Interno (mensal, um dia por página)
//   • Boletim Interno (escalas diárias com "HORÁRIO: Das ... às ...")
//   • Escalas especiais e de estágio (tabela com graduação e nome; data/horário no cabeçalho
//     ou por dia, ex.: eleições, "Estágio de acompanhamento de CPU")
// Nenhum dado de CPF é lido, usado ou guardado: só nome, data e horário.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/pdf.worker.min.mjs";
const HORA = 3600000, DIA = 86400000;

// ---------------------------------------------------------------- PDF → linhas
/** Lê o PDF e devolve as linhas: [{ pagina, y, itens: [{ x, x2, str }], texto }] (de cima para baixo). */
export async function linhasDoPdf(arquivo) {
  const pdfjs = await import(PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: dados }).promise;
  const paginas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pag = await pdf.getPage(p);
    const altura = pag.getViewport({ scale: 1 }).height;
    const tc = await pag.getTextContent();
    const itens = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({
      x: i.transform[4], x2: i.transform[4] + (i.width || 0), y: altura - i.transform[5], str: i.str
    }));
    paginas.push({ pagina: p, itens });
  }
  return agruparLinhas(paginas);
}

/** Agrupa itens soltos em linhas (mesma altura), ordenadas por página, y e x. */
export function agruparLinhas(paginas) {
  const linhas = [];
  for (const { pagina, itens } of paginas) {
    const ord = itens.filter((i) => i.str && i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    let atual = null;
    for (const it of ord) {
      if (!atual || Math.abs(it.y - atual.y) > 2.5) { atual = { pagina, y: it.y, itens: [] }; linhas.push(atual); }
      atual.itens.push(it);
    }
  }
  for (const l of linhas) {
    l.itens.sort((a, b) => a.x - b.x);
    let t = "", fim = null;
    for (const it of l.itens) {
      if (fim !== null) t += it.x - fim > 6 ? "   " : (it.x - fim > 0.8 || !/^[,.)]/.test(it.str) ? " " : "");
      t += it.str.trim();
      fim = it.x2;
    }
    l.texto = t.replace(/[ \t]+$/, "");
  }
  return linhas;
}

// ---------------------------------------------------------------- utilidades de data
const MESES = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
const DIAS_SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

export function semAcento(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function mesDe(txt) { return MESES[semAcento(txt).toLowerCase().slice(0, 3)]; }
function anoDe(txt) { const n = +txt; return n < 100 ? 2000 + n : n; }
/** 00h00 de Brasília (UTC−3) do dia informado, em ms. */
export function diaBrt(ano, mes, dia) { return Date.UTC(ano, mes, dia, 3, 0, 0); }
/** Dia da semana (0 = domingo) de um "diaBrt". */
export function semanaDe(ms) { return new Date(ms - 3 * HORA).getUTCDay(); }
function diaSemanaTexto(txt) { const k = semAcento(txt).toLowerCase().split(/[-\s]/)[0]; return DIAS_SEMANA[k]; }
export function rotuloDia(ms) {
  const d = new Date(ms - 3 * HORA);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Feriados nacionais e do Paraná (dias em que o serviço segue o horário de fim de semana). */
export function feriadosPadrao(anos) {
  const out = new Set();
  for (const a of anos) {
    [[0, 1], [3, 21], [4, 1], [8, 7], [9, 12], [10, 2], [10, 15], [10, 20], [11, 19], [11, 25]]
      .forEach(([m, d]) => out.add(diaBrt(a, m, d)));
    // Páscoa (algoritmo de Meeus) → Sexta-feira Santa, Carnaval e Corpus Christi
    const A = a % 19, B = Math.floor(a / 100), C = a % 100, D = Math.floor(B / 4), E = B % 4,
      F = Math.floor((B + 8) / 25), G = Math.floor((B - F + 1) / 3), H = (19 * A + B - D - G + 15) % 30,
      I = Math.floor(C / 4), K = C % 4, L = (32 + 2 * E + 2 * I - H - K) % 7, M = Math.floor((A + 11 * H + 22 * L) / 451),
      mes = Math.floor((H + L - 7 * M + 114) / 31) - 1, dia = ((H + L - 7 * M + 114) % 31) + 1;
    const pascoa = diaBrt(a, mes, dia);
    [-2, -47, -48, 60].forEach((k) => out.add(pascoa + k * DIA));
  }
  return out;
}

// ---------------------------------------------------------------- reconhecimento
// Graduações de cadetes e alunos-oficiais (só estes podem estar cadastrados no SDE)
const RE_GRAD = /(Cad\.?\s*\d\s*[ºo°]\s*PM|Al\.?\s*Of\.?\s*PM)/i;
const RE_TURNO = /(\d{1,2})h(\d{2})?\s*[-–]\s*(\d{1,2})h(\d{2})?/;

export function identificarTipo(linhas) {
  const tudo = semAcento(linhas.slice(0, 60).map((l) => l.texto).join("\n")).toUpperCase();
  if (/PREVISAO DE ESCALA DE SERVICO INTERNO/.test(tudo)) return "interno";
  if (/BOLETIM INTERNO/.test(tudo)) return "boletim";
  const comGrad = linhas.filter((l) => RE_GRAD.test(l.texto));
  if (comGrad.filter((l) => RE_TURNO.test(l.texto)).length >= 2 || (/EVENTO:/.test(tudo) && comGrad.length)) return "especial";
  // tabela com colunas HORÁRIO · GRAD · NOME COMPLETO (graduação e nome em linhas separadas, horário mesclado)
  if (linhas.some((l) => /HOR[AÁ]RIO/i.test(l.texto) && /NOME/i.test(l.texto))) return "tabela";
  return null;
}

export function lerEscala(linhas, opcoes = {}) {
  const tipo = identificarTipo(linhas);
  if (tipo === "interno") return lerInterno(linhas);
  if (tipo === "boletim") return lerBoletim(linhas);
  if (tipo === "especial") return lerEspecial(linhas);
  if (tipo === "tabela") return lerTabela(linhas);
  return { tipo: null, titulo: "", registros: [], avisos: ["Não reconheci este PDF como escala de serviço. Confira se é uma Previsão de Escala de Serviço Interno, um Boletim Interno ou uma escala especial com graduação, nome e turno. PDFs escaneados (imagem) não podem ser lidos."] };
}

// ---------------------------------------------------------------- Previsão de Escala de Serviço Interno
// Um dia por bloco "Data: 1 out. 26 (quinta-feira)", com três tabelas:
//   1ª Respondente/Sobreaviso · 2ª Guarda (Cmt. da Guarda, Sentinelas, Posto II, Sobreaviso) · 3ª Dia-à-EsFO/Bloco III
// Horários (informados pela coordenação): tudo das 07h15 às 07h15, exceto Sentinelas da Guarda,
// do Posto II e seu sobreaviso em dia útil: 18h50 às 07h15. Sábado, domingo e feriado: 24h.
function lerInterno(linhas) {
  const avisos = [], registros = [];
  let mesRef = "";
  const cab = linhas.find((l) => /de\s+20\d{2}\s*$/i.test(l.texto.trim()) && /janeiro|fevereiro|mar|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(l.texto));
  if (cab) mesRef = cab.texto.trim();
  let dia = null, tabela = -1, linhaTab = 0, rotulo = "", paginaAviso = new Set();

  for (const l of linhas) {
    const t = l.texto;
    const md = t.match(/Data:\s*(\d{1,2})\s+([A-Za-zÀ-ú]{3})[A-Za-zÀ-ú]*\.?\s+(\d{2,4})\s*\(([^)]+)\)/);
    if (md) {
      const dsTxt = diaSemanaTexto(md[4]);
      let cand = diaBrt(anoDe(md[3]), mesDe(md[2]), +md[1]);
      if (dsTxt !== undefined && semanaDe(cand) !== dsTxt) {
        // data inconsistente com o dia da semana: tenta o dia seguinte ao anterior com o mesmo número
        const prox = dia !== null ? dia + DIA : null;
        if (prox !== null && new Date(prox - 3 * HORA).getUTCDate() === +md[1] && semanaDe(prox) === dsTxt) {
          avisos.push(`No PDF está "${md[0].replace(/^Data:\s*/, "")}", mas o dia da semana e a sequência indicam ${rotuloDia(prox)}. Considerei ${rotuloDia(prox)}.`);
          cand = prox;
        } else {
          avisos.push(`A data "${md[0].replace(/^Data:\s*/, "")}" não bate com o dia da semana. Confira os serviços desse dia.`);
        }
      }
      if (dia !== null && cand <= dia) {
        // cabeçalho repetido pelo Word no topo da página (não muda o dia)
        if (!paginaAviso.has(l.pagina)) { paginaAviso.add(l.pagina); }
        continue;
      }
      dia = cand; tabela = -1; linhaTab = 0; rotulo = "";
      continue;
    }
    if (dia === null) continue;
    if (/FUN[ÇC][ÃA]O/i.test(t) && /NOME/i.test(t)) { tabela++; linhaTab = 0; rotulo = ""; continue; }
    const mg = t.match(RE_GRAD);
    if (!mg || tabela < 0) continue;
    const esquerda = t.slice(0, mg.index).trim();
    const nome = t.slice(mg.index + mg[0].length).trim().replace(/\s{2,}.*$/, "");
    if (!nome) continue;
    if (esquerda) rotulo = esquerda;
    let grupo, sentinela = false;
    if (tabela === 0) grupo = "Respondente";
    else if (tabela === 1) { if (linhaTab === 0) grupo = "Cmt. da Guarda"; else { grupo = "Sentinelas da Guarda / Posto II"; sentinela = true; } }
    else grupo = "Dia-à-EsFO / Bloco III";
    registros.push({ nome, dia, sentinela, servico: `Serviço interno · ${grupo}`, origem: "Previsão de Escala de Serviço Interno" + (mesRef ? ` · ${mesRef}` : "") });
    linhaTab++;
  }
  if (paginaAviso.size) avisos.push(`O PDF repete um cabeçalho de data antigo no topo de ${paginaAviso.size} página(s) (págs. ${[...paginaAviso].join(", ")}). Ignorei esses cabeçalhos e mantive o dia correto.`);
  return { tipo: "interno", titulo: "Previsão de Escala de Serviço Interno" + (mesRef ? ` · ${mesRef}` : ""), registros, avisos, horarioInterno: true };
}

/** Início e fim de um registro da previsão de serviço interno. */
export function intervaloInterno(r, feriados) {
  const ds = semanaDe(r.dia);
  const util = ds >= 1 && ds <= 5 && !feriados.has(r.dia);
  const ini = r.sentinela && util ? r.dia + 18 * HORA + 50 * 60000 : r.dia + 7 * HORA + 15 * 60000;
  return [ini, r.dia + DIA + 7 * HORA + 15 * 60000];
}

// ---------------------------------------------------------------- Boletim Interno
function lerBoletim(linhas) {
  const avisos = [], registros = [];
  let secDia = null, ini = null, fim = null, rotulo = "", numero = "";
  const reSec = /ESCALA DE SERVI[ÇC]O PARA (?:O|A) DIA\s+(\d{1,2})\s+DE\s+([A-ZÇa-zç]+)\s+DE\s+(\d{4})/i;
  const reHora = /Das\s+(\d{1,2})h(?:(\d{2})(?:min)?)?\.?\s*(?:do dia\s*(?:(\d{1,2})\s+([A-Za-zÀ-ú]{3})[A-Za-zÀ-ú]*\.?\s+(\d{2,4}))?)?\s*(?:às|as|a)\s+(\d{1,2})h(?:(\d{2})(?:min)?)?\.?\s*(?:do dia\s*(\d{1,2})\s+([A-Za-zÀ-ú]{3})[A-Za-zÀ-ú]*\.?\s+(\d{2,4}))?/i;
  for (const l of linhas) {
    const t = l.texto;
    const mn = t.match(/BOLETIM INTERNO N[ºo°]\s*(\d+)/i);
    if (mn && !numero) numero = mn[1];
    const ms = t.match(reSec);
    if (ms) { secDia = diaBrt(+ms[3], mesDe(ms[2]), +ms[1]); ini = fim = null; rotulo = ""; continue; }
    if (/HOR[ÁA]RIO/i.test(t)) {
      const mh = t.match(reHora);
      if (mh && secDia !== null) {
        const d1 = mh[3] ? diaBrt(anoDe(mh[5]), mesDe(mh[4]), +mh[3]) : null;
        const d2 = mh[8] ? diaBrt(anoDe(mh[10]), mesDe(mh[9]), +mh[8]) : null;
        const base1 = d1 ?? (d2 !== null && !mh[3] ? d2 : secDia);
        ini = base1 + (+mh[1]) * HORA + (+(mh[2] || 0)) * 60000;
        fim = (d2 ?? base1) + (+mh[6]) * HORA + (+(mh[7] || 0)) * 60000;
        if (fim <= ini) fim += DIA;
        rotulo = "";
      } else { ini = fim = null; }
      continue;
    }
    const mg = t.match(RE_GRAD);
    if (!mg || ini === null) continue;
    const esquerda = t.slice(0, mg.index).trim();
    const nome = t.slice(mg.index + mg[0].length).trim().replace(/\s{2,}.*$/, "");
    if (!nome) continue;
    if (esquerda && !/sobreaviso/i.test(esquerda) && !rotulo) rotulo = esquerda;
    registros.push({ nome, inicio: ini, fim, servico: `${rotulo ? rotulo + " e equipe" : "Serviço"} · BI nº ${numero || "?"}`, origem: `Boletim Interno${numero ? " nº " + numero : ""}` });
  }
  if (!registros.length) avisos.push("Não encontrei cadetes escalados neste Boletim.");
  return { tipo: "boletim", titulo: `Boletim Interno${numero ? " nº " + numero : ""}`, registros, avisos };
}

// ---------------------------------------------------------------- Escala especial / de estágio
// Cabeçalho com "Evento:", "Data:" e "Horário:" (às vezes com letras "a) b) c)"). A data pode vir como
// "8 nov. 26", "14/11/2026" ou "14 e 15 de novembro" (sem ano: usa o ano do documento). Se a escala
// separa os cadetes por dia ("Sábado, 14 de Novembro de 2026"), cada cadete fica no dia do seu bloco.
const RE_DIA_TITULO = /^\s*(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:-feira)?\s*,?\s*(\d{1,2})\s+de\s+([A-Za-zÀ-ú]+)(?:\s+de\s+(\d{4}))?/i;
const RE_HORARIO = /(\d{1,2})h(\d{2})?(?:min)?\s*(?:[-–]|às|as|a)\s*(\d{1,2})h(\d{2})?/gi;

/** Dias citados num texto de data ("14 e 15 de novembro", "14 a 16 de nov", "14/11/2026", "8 nov. 26"). */
function diasDoTexto(txt, anoDoc) {
  let m = txt.match(/(\d{1,2})\s+([A-Za-zÀ-ú]{3})[A-Za-zÀ-ú]*\.?\s+(\d{2,4})/);
  if (m && mesDe(m[2]) !== undefined) return [diaBrt(anoDe(m[3]), mesDe(m[2]), +m[1])];
  m = txt.match(/^\s*((?:\d{1,2}\s*(?:,|e|a|-|–)\s*)*\d{1,2})\s*(?:º)?\s+de\s+([A-Za-zÀ-ú]+)(?:\s+de\s+(\d{4}))?/i);
  if (m && mesDe(m[2]) !== undefined && (m[3] || anoDoc)) {
    const nums = m[1].match(/\d{1,2}/g).map(Number), ano = m[3] ? +m[3] : anoDoc, mes = mesDe(m[2]);
    const faixa = nums.length === 2 && /\d\s*(?:a|-|–)\s*\d/.test(m[1]);
    const lista = faixa ? Array.from({ length: Math.max(0, nums[1] - nums[0]) + 1 }, (_, i) => nums[0] + i) : nums;
    return lista.map((d) => diaBrt(ano, mes, d));
  }
  m = txt.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m && (m[3] || anoDoc)) return [diaBrt(m[3] ? anoDe(m[3]) : anoDoc, +m[2] - 1, +m[1])];
  return [];
}

function lerEspecial(linhas) {
  const avisos = [], registros = [];
  let evento = "", dias = [], turnos = [];
  const cab = linhas.slice(0, 80);
  const ma = cab.map((l) => l.texto).join("\n").match(/\b(20\d{2})\b/);
  const anoDoc = ma ? +ma[1] : null;
  for (const [ci, l] of cab.entries()) {
    let t = l.texto;
    // "a) Evento: ... Rede Feminina de" + "Combate ao Câncer." → junta as linhas de continuação
    if (/Evento:/i.test(t) && !/[.;]\s*$/.test(t)) {
      for (let k = ci + 1; k < Math.min(cab.length, ci + 3); k++) {
        const n = cab[k].texto.trim();
        if (/^[a-z]\)/i.test(n) || /^[A-Za-zÀ-ú ]{2,20}:/.test(n)) break;
        t += " " + n;
        if (/[.;]\s*$/.test(n)) break;
      }
    }
    const me = t.match(/Evento:\s*(.+?);?\s*$/i); if (me && !evento) evento = me[1].replace(/;$/, "").trim();
    const md = t.match(/Data:\s*(.+?);?\s*$/i);
    if (md && !dias.length) dias = diasDoTexto(md[1], anoDoc);
    if (/Hor[áa]rio:/i.test(t) && !turnos.length) {
      for (const m of t.matchAll(RE_HORARIO)) turnos.push(intervalo(m));
    }
  }
  const titulos = linhas.filter((l) => RE_DIA_TITULO.test(l.texto));
  if (!dias.length && titulos.length) dias = titulos.map((l) => diaDoTitulo(l.texto)).filter((d) => d !== null);
  if (!dias.length) { avisos.push("Não encontrei a data do evento (linha \"Data:\" ou títulos como \"Sábado, 14 de Novembro de 2026\")."); return { tipo: "especial", titulo: evento, registros, avisos }; }
  if (!evento) evento = "Escala especial";
  function intervalo(m) { return [(+m[1]) * 60 + (+(m[2] || 0)), (+m[3]) * 60 + (+(m[4] || 0))]; }
  function diaDoTitulo(t) {
    const m = t.match(RE_DIA_TITULO);
    const ano = m[4] ? +m[4] : anoDoc, mes = mesDe(m[3]);
    return ano && mes !== undefined ? diaBrt(ano, mes, +m[2]) : null;
  }
  const geral = turnos.length ? [Math.min(...turnos.map((x) => x[0])), Math.max(...turnos.map((x) => x[1]))] : [0, 24 * 60];
  // sem títulos por dia e com mais de um dia na data: o cadete fica em todos os dias (confira)
  if (!titulos.length && dias.length > 1) avisos.push(`A escala cita ${dias.length} dias (${dias.map(rotuloDia).join(", ")}) sem separar os cadetes por dia: considerei cada cadete escalado em todos eles. Desmarque o que não for o caso.`);

  let sobreaviso = false, atual = null, diaBloco = null;
  for (const l of linhas) {
    const t = l.texto;
    if (RE_DIA_TITULO.test(t)) { const d = diaDoTitulo(t); if (d !== null) { diaBloco = d; sobreaviso = false; } atual = null; continue; }
    if (/^\s*SOBREAVISO\s*$/i.test(t)) { sobreaviso = true; atual = null; continue; }
    const mg = t.match(RE_GRAD);
    if (mg) {
      // nome = a coluna logo depois da graduação (as demais colunas são ignoradas)
      const nome = t.slice(mg.index + mg[0].length).trim().split(/\s{3,}/)[0].trim();
      if (!nome || /\d/.test(nome)) { atual = null; continue; }
      const esquerda = t.slice(0, mg.index).trim();          // ex.: "12° BPM" ou "SOBREAVISO 1"
      const sobLinha = /sobreaviso/i.test(esquerda);
      const local = esquerda && !sobLinha && esquerda.length <= 40 && /[A-Za-zÀ-ú]/.test(esquerda) ? esquerda : "";   // não usa o nº da linha
      const mt = [...t.matchAll(new RegExp(RE_TURNO, "g"))].pop();
      const [a, b] = mt && !sobreaviso && !sobLinha ? intervalo(mt) : geral;
      // limites da coluna do nome (para juntar nomes que quebram em duas linhas)
      let iG = l.itens.findIndex((i) => RE_GRAD.test(i.str));
      if (iG < 0) {   // graduação em vários itens ("Cad." "1º" "PM"): último item que completa a graduação
        let acc = "";
        iG = l.itens.findIndex((i) => { acc += " " + i.str; return RE_GRAD.test(acc); });
      }
      let k = iG + 1;
      while (k + 1 < l.itens.length && l.itens[k + 1].x - l.itens[k].x2 <= 6) k++;
      const x1 = iG >= 0 ? l.itens[iG].x2 + 1 : 0, x2 = l.itens[k + 1] ? l.itens[k + 1].x - 1 : Infinity;
      const servico = `${evento}${local ? " · " + local : ""}${sobreaviso || sobLinha ? " (sobreaviso)" : ""}`;
      const diasRow = diaBloco !== null ? [diaBloco] : dias;
      atual = null;
      diasRow.forEach((dia, i) => {
        const r = { nome, inicio: dia + a * 60000, fim: dia + (b <= a ? b + 1440 : b) * 60000, servico, origem: evento };
        if (i === 0) Object.assign(r, { _x1: x1, _x2: x2, _pag: l.pagina, _y: l.y });
        registros.push(r);
        if (i === 0) atual = r;
      });
      continue;
    }
    if (atual && (l.pagina !== atual._pag || l.y - atual._y > 16)) atual = null;
    if (atual) {
      atual._y = l.y;
      const frag = l.itens.filter((i) => i.x >= atual._x1 - 8 && i.x2 <= atual._x2 + 2 && !/\d/.test(i.str)).map((i) => i.str.trim()).join(" ").trim();
      if (frag && !/\d/.test(frag)) atual.nome = /-$/.test(atual.nome) ? atual.nome.slice(0, -1) + frag : atual.nome + " " + frag;
    }
  }
  registros.forEach((r) => { delete r._x1; delete r._x2; delete r._pag; delete r._y; });
  const diasUsados = [...new Set(registros.map((r) => r.inicio - ((r.inicio - 3 * HORA) % DIA + DIA) % DIA))].sort((a, b) => a - b);
  return { tipo: "especial", titulo: `${evento} · ${(diasUsados.length ? diasUsados : dias).map(rotuloDia).join(", ")}`, registros, avisos };
}

// ---------------------------------------------------------------- escala em tabela (ex.: Estágio COPOM)
// Cabeçalho "HORÁRIO | GRAD | NOME COMPLETO | CPF | TELEFONE", um título por dia ("Sexta, 13 de Novembro de 2026").
// Cada cadete ocupa 3 linhas ("Cad. 1º" / nome / "PM"); o horário é uma célula mesclada (rowspan) e o
// sobreaviso aparece na coluna do horário, na linha do nome. A tabela pode continuar na página seguinte.
function lerTabela(linhas) {
  const avisos = [], registros = [];
  const cab = linhas.slice(0, 80);
  const ma = cab.map((l) => l.texto).join("\n").match(/\b(20\d{2})\b/);
  const anoDoc = ma ? +ma[1] : null;
  let evento = "", local = "", diasData = [];
  for (const l of cab) {
    const me = l.texto.match(/Evento:\s*(.+?);?\s*$/i); if (me && !evento) evento = me[1].replace(/;$/, "").trim();
    const ml = l.texto.match(/Local:\s*(.+?)[.;]?\s*$/i); if (ml && !local) local = ml[1].trim();
    const md = l.texto.match(/Data:\s*(.+?);?\s*$/i); if (md && !diasData.length) diasData = diasDoTexto(md[1], anoDoc);
  }
  if (!evento) {
    const t = cab.find((l) => /ESCALA/i.test(l.texto) && !/^\s*[a-g]\)/i.test(l.texto));
    evento = t ? t.texto.trim() : "Escala";
  }
  const servicoBase = evento + (local && !semAcento(evento).toUpperCase().includes(semAcento(local).toUpperCase()) ? " · " + local : "");
  const diaDoTitulo = (t) => {
    const m = t.match(RE_DIA_TITULO);
    const ano = m[4] ? +m[4] : anoDoc, mes = mesDe(m[3]);
    return ano && mes !== undefined ? diaBrt(ano, mes, +m[2]) : null;
  };
  const turnoDe = (txt) => { const m = [...txt.matchAll(RE_HORARIO)][0]; return m ? [(+m[1]) * 60 + (+(m[2] || 0)), (+m[3]) * 60 + (+(m[4] || 0))] : null; };

  // percorre as linhas: colunas pelo cabeçalho mais recente
  let col = null, dia = diasData.length === 1 ? diasData[0] : null, ordem = 0;
  const blocos = new Map();   // dia -> { rotulos: [{turno, ordem}], pessoas: [{nome, sob, ordem}] }
  const bloco = (d) => { if (!blocos.has(d)) blocos.set(d, { rotulos: [], pessoas: [] }); return blocos.get(d); };
  for (const l of linhas) {
    ordem++;
    if (RE_DIA_TITULO.test(l.texto)) { const d = diaDoTitulo(l.texto); if (d !== null) dia = d; continue; }
    if (/HOR[AÁ]RIO/i.test(l.texto) && /NOME/i.test(l.texto)) {
      const pos = (re) => { const i = l.itens.find((x) => re.test(x.str)); return i ? i : null; };
      const g = pos(/^GRAD/i), n = pos(/^NOME/i), c = pos(/^CPF/i);
      col = { hor: g ? g.x - 5 : (n ? n.x - 100 : 120), nomeIni: g ? g.x + 42 : (n ? n.x - 60 : 0), nomeFim: c ? c.x - 15 : Infinity };
      continue;
    }
    if (!col || dia === null) continue;
    const hor = l.itens.filter((i) => i.x2 <= col.hor).map((i) => i.str).join(" ");
    const nomeIt = l.itens.filter((i) => i.x >= col.nomeIni && i.x2 <= col.nomeFim);
    const nome = nomeIt.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    const turno = turnoDe(hor);
    if (turno) bloco(dia).rotulos.push({ turno, ordem });
    if (nome && /[A-Za-zÀ-ú]{2}/.test(nome) && !/\d/.test(nome) && !/^(Cad\.?|PM|Al\.?|Of\.?)(\s|$)/i.test(nome)) {
      bloco(dia).pessoas.push({ nome, sob: /SOBREAVISO/i.test(hor), ordem });
    }
  }
  if (!blocos.size) {
    avisos.push("Não encontrei os dias da escala (títulos como \"Sábado, 14 de Novembro de 2026\").");
    return { tipo: "tabela", titulo: evento, registros, avisos };
  }
  let semTurno = 0;
  for (const [d, { rotulos, pessoas }] of [...blocos.entries()].sort((a, b) => a[0] - b[0])) {
    if (!pessoas.length) continue;
    // grupos de cada horário: separados pelo sobreaviso (que fecha o grupo); se não bater, usa o horário mais próximo na página
    const grupos = [];
    let g = [];
    pessoas.forEach((p) => { g.push(p); if (p.sob) { grupos.push(g); g = []; } });
    if (g.length) grupos.push(g);
    const turnoDaPessoa = new Map();
    if (rotulos.length && grupos.length === rotulos.length) grupos.forEach((gr, i) => gr.forEach((p) => turnoDaPessoa.set(p, rotulos[i].turno)));
    else if (rotulos.length) {
      pessoas.forEach((p) => {
        let melhor = rotulos[0];
        rotulos.forEach((r) => { if (Math.abs(r.ordem - p.ordem) < Math.abs(melhor.ordem - p.ordem)) melhor = r; });
        turnoDaPessoa.set(p, melhor.turno);
      });
      avisos.push(`${rotuloDia(d)}: não consegui separar com certeza quem está em cada horário. Confira os horários desse dia.`);
    }
    for (const p of pessoas) {
      const t = turnoDaPessoa.get(p);
      const [a, b] = t || [0, 24 * 60];
      if (!t) semTurno++;
      registros.push({ nome: p.nome, inicio: d + a * 60000, fim: d + (b <= a ? b + 1440 : b) * 60000,
        servico: servicoBase + (p.sob ? " (sobreaviso)" : ""), origem: evento });
    }
  }
  if (semTurno) avisos.push(`${semTurno} escalação(ões) sem horário identificado: considerei o dia inteiro.`);
  const diasUsados = [...blocos.keys()].filter((d) => blocos.get(d).pessoas.length).sort((a, b) => a - b);
  return { tipo: "tabela", titulo: `${evento} · ${diasUsados.map(rotuloDia).join(", ")}`, registros, avisos };
}

// ---------------------------------------------------------------- correspondência com o cadastro
const LIGA = new Set(["de", "da", "do", "das", "dos", "e"]);
export function normNome(s) { return semAcento(s).toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim(); }
function tokens(s) { return normNome(s).split(" ").filter((t) => t && !LIGA.has(t)); }

/**
 * Liga cada registro a um cadete do cadastro.
 * Liga só pelo nome (nome completo igual; senão, nome bem parecido, marcado para conferir).
 * cadetes: [{ id, nome, guerra }]. Devolve { ligados: [{...registro, cadete, aproximado}], soltos: [nomes] }.
 */
export function ligarCadetes(registros, cadetes) {
  const porNome = new Map();
  cadetes.forEach((c) => { const k = normNome(c.nome); if (!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(c); });
  const tk = cadetes.map((c) => ({ c, t: new Set(tokens(c.nome)) }));
  const ligados = [], soltos = [];
  for (const r of registros) {
    let cad = null, aprox = false;
    const exatos = porNome.get(normNome(r.nome)) || [];
    if (exatos.length === 1) cad = exatos[0];
    const cands = exatos.length > 1 ? exatos : null;      // homônimos: não liga sozinho
    if (!cad && !cands) {
      const a = new Set(tokens(r.nome));
      let melhor = null, nota = 0, empate = false;
      for (const { c, t } of tk) {
        let comum = 0; a.forEach((x) => { if (t.has(x)) comum++; });
        const n = comum / Math.max(a.size, t.size);
        if (n > nota) { melhor = c; nota = n; empate = false; } else if (n === nota && n > 0) empate = true;
      }
      if (melhor && nota >= 0.75 && !empate) { cad = melhor; aprox = true; }
      if (!cad) {
        // todos os nomes do mais curto aparecem no outro (ex.: cadastro sem um sobrenome), com pelo menos 3 nomes
        const cont = tk.filter(({ t }) => {
          let comum = 0; a.forEach((x) => { if (t.has(x)) comum++; });
          const menor = Math.min(a.size, t.size);
          return menor >= 3 && comum === menor;
        });
        if (cont.length === 1) { cad = cont[0].c; aprox = true; }
      }
    }
    if (cad) ligados.push({ ...r, cadete: cad, aproximado: aprox });
    else soltos.push(r.nome);
  }
  return { ligados, soltos: [...new Set(soltos)] };
}

/** O intervalo encosta em algum período de cumprimento de MCE (sexta 14h → segunda 07h)? */
export function tocaFimDeSemana(ini, fim) {
  for (let d = ini - 4 * DIA; d <= fim; d += DIA) {
    const dia0 = d - ((d - 3 * HORA) % DIA + DIA) % DIA;   // 00h00 de Brasília
    if (semanaDe(dia0) !== 5) continue;
    const a = dia0 + 14 * HORA, b = dia0 + 3 * DIA + 7 * HORA;
    if (ini < b && a < fim) return true;
  }
  return false;
}
