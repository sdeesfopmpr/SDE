// SDE · EsFO — Leitura de escalas de serviço em PDF
// Lê o texto do PDF no próprio navegador (nada é enviado para fora) e devolve os serviços
// encontrados, com cadete, início e fim. Tipos reconhecidos:
//   • Previsão de Escala de Serviço Interno (mensal, um dia por página)
//   • Boletim Interno (escalas diárias com "HORÁRIO: Das ... às ...")
//   • Escalas especiais (tabela com graduação, nome e turno, ex.: eleições)
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
  return null;
}

export function lerEscala(linhas, opcoes = {}) {
  const tipo = identificarTipo(linhas);
  if (tipo === "interno") return lerInterno(linhas);
  if (tipo === "boletim") return lerBoletim(linhas);
  if (tipo === "especial") return lerEspecial(linhas);
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

// ---------------------------------------------------------------- Escala especial (graduação, nome e turno)
function lerEspecial(linhas) {
  const avisos = [], registros = [];
  let evento = "", dia = null, turnos = [];
  for (const l of linhas.slice(0, 80)) {
    const t = l.texto;
    const me = t.match(/Evento:\s*(.+?);?\s*$/i); if (me && !evento) evento = me[1].replace(/;$/, "").trim();
    const md = t.match(/Data:\s*(\d{1,2})\s+([A-Za-zÀ-ú]{3})[A-Za-zÀ-ú]*\.?\s+(\d{2,4})/i);
    if (md && dia === null) dia = diaBrt(anoDe(md[3]), mesDe(md[2]), +md[1]);
    if (/Hor[áa]rio:/i.test(t) && !turnos.length) {
      for (const m of t.matchAll(new RegExp(RE_TURNO, "g"))) turnos.push(intervalo(m));
    }
  }
  if (dia === null) { avisos.push("Não encontrei a data do evento (linha \"Data:\")."); return { tipo: "especial", titulo: evento, registros, avisos }; }
  if (!evento) evento = "Escala especial";
  function intervalo(m) { return [(+m[1]) * 60 + (+(m[2] || 0)), (+m[3]) * 60 + (+(m[4] || 0))]; }
  const geral = turnos.length ? [Math.min(...turnos.map((x) => x[0])), Math.max(...turnos.map((x) => x[1]))] : [0, 24 * 60];

  let sobreaviso = false, atual = null;
  for (const l of linhas) {
    const t = l.texto;
    if (/^\s*SOBREAVISO\s*$/i.test(t)) { sobreaviso = true; atual = null; continue; }
    const mg = t.match(RE_GRAD);
    if (mg) {
      // nome = a coluna logo depois da graduação (as demais colunas são ignoradas)
      const nome = t.slice(mg.index + mg[0].length).trim().split(/\s{3,}/)[0].trim();
      if (!nome || /\d/.test(nome)) { atual = null; continue; }
      const mt = [...t.matchAll(new RegExp(RE_TURNO, "g"))].pop();
      const [a, b] = mt && !sobreaviso ? intervalo(mt) : geral;
      // limites da coluna do nome (para juntar nomes que quebram em duas linhas)
      const iG = l.itens.findIndex((i) => RE_GRAD.test(i.str));
      let k = iG + 1;
      while (k + 1 < l.itens.length && l.itens[k + 1].x - l.itens[k].x2 <= 6) k++;
      const x1 = iG >= 0 ? l.itens[iG].x2 + 1 : 0, x2 = l.itens[k + 1] ? l.itens[k + 1].x - 1 : Infinity;
      atual = {
        nome, inicio: dia + a * 60000, fim: dia + (b <= a ? b + 1440 : b) * 60000,
        servico: `${evento}${sobreaviso ? " (sobreaviso)" : ""}`, origem: evento,
        _x1: x1, _x2: x2, _pag: l.pagina, _y: l.y
      };
      registros.push(atual);
      continue;
    }
    if (atual && (l.pagina !== atual._pag || l.y - atual._y > 16)) atual = null;
    if (atual) {
      atual._y = l.y;
      const frag = l.itens.filter((i) => i.x >= atual._x1 - 8 && i.x2 <= atual._x2 + 2).map((i) => i.str.trim()).join(" ").trim();
      if (frag && !/\d/.test(frag)) atual.nome = /-$/.test(atual.nome) ? atual.nome.slice(0, -1) + frag : atual.nome + " " + frag;
    }
  }
  registros.forEach((r) => { delete r._x1; delete r._x2; delete r._pag; delete r._y; });
  return { tipo: "especial", titulo: `${evento} · ${rotuloDia(dia)}`, registros, avisos };
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
