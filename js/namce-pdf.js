// SDE · EsFO — Geração do PDF da NAMCE (layout da Nota de Aplicação de Medida Corretiva Escolar)
// Usa jsPDF + jspdf-autotable (carregados do cdnjs só quando necessário).

const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js";
const AUTOTABLE = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/5.0.9/jspdf.plugin.autotable.min.js";

export const PADRAO = {
  assinante: "Maj. QOEM PM Rafael de Souza",
  cargo: "Comandante da Escola de Formação de Oficiais",
  local: "São José dos Pinhais"
};

const TABELA_MCE = [
  ["Sexta-feira", [["EEsp 1", "14h às 18h"], ["EEsp 2", "18h às 22h"], ["LC 1", "19h às 07h"]]],
  ["Sábado", [["EEsp 3", "07h15 às 11h15"], ["EEsp 4", "14h às 18h"], ["EEsp 5", "18h às 22h"], ["LC 2", "07h às 19h"], ["LC 3", "19h às 07h"]]],
  ["Domingo", [["EEsp 6", "07h15 às 11h15"], ["EEsp 7", "14h às 18h"], ["EEsp 8", "18h às 22h"], ["LC 4", "07h às 19h"], ["LC 5", "19h às 07h"]]]
];

const ORIENTACOES = [
  "a) Os militares designados para o cumprimento de Escala Especial (EEsp) ou Licença Cassada (LC) serão empregados pelo Dia-à-EsFO em missões circunscritas às áreas de responsabilidade da EsFO e dependências da APMG, em estrita observância às orientações pelo Oficial Supervisor;",
  "b) Todos os militares relacionados nesta Nota deverão participar obrigatoriamente dos atos de hasteamento e arriamento da Bandeira Nacional, durante os períodos em que estiverem na APMG, trajando o fardamento definido pelo Dia-à-EsFO;",
  "c) O militar no exercício da função de Dia-à-EsFO, poderá realizar ajustes nos horários das MCEs, mediante a prévia anuência da Coordenação EsFO, devendo qualquer alteração ser formalmente registrada em relatório;",
  "d) Os militares submetidos à medida de Trabalho Didático (TD) deverão, impreterivelmente, verificar junto ao respectivo Oficial Coordenador a definição da atividade especificada, até o término do expediente administrativo de sexta-feira;",
  "e) Por fim, o Dia-à-EsFO deverá elaborar o relatório e anexá-lo ao presente eProtocolo ao término de seu turno, tramitando-o ao seu sucessor. O militar que assumir o serviço no domingo ficará incumbido de restituir o protocolado à Missão SDE, para o competente encaminhamento final ao Oficial Coordenador."
];

function carregarScript(src) {
  return new Promise((ok, erro) => {
    if ([...document.scripts].some((s) => s.src === src)) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => erro(new Error("Falha ao carregar " + src));
    document.head.appendChild(s);
  });
}

async function imagemDataUrl(url) {
  const r = await fetch(url);
  const b = await r.blob();
  return new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
}

function data(ms) {
  return new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * n: { numero, ano, planilhas, itens: [{grupo, cadeteGuerra, fato, descricao, mce, transferidaDe}], fo: [...],
 *      assinante, cargo, local }
 * Devolve o jsPDF; com salvar=true baixa o arquivo.
 */
export async function gerarNamcePdf(n, { previa = false, salvar = true, base = "" } = {}) {
  await carregarScript(JSPDF);
  await carregarScript(AUTOTABLE);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const ME = 50, MD = 50, larg = W - ME - MD;
  const preto = [0, 0, 0], cinza = [200, 200, 200];
  doc.setLineHeightFactor(1.2);

  // ---------- Cabeçalho institucional (1ª página)
  const [esq, dir] = await Promise.all([imagemDataUrl(base + "img/brasao-parana.png"), imagemDataUrl(base + "img/brasao-pmpr.png")]);
  doc.addImage(esq, "PNG", 62, 40, 62, 78, "parana", "FAST");
  doc.addImage(dir, "PNG", W - 62 - 64, 42, 64, 77, "pmpr", "FAST");
  let y = 52;
  const linhaCab = (txt, tam, estilo = "bold") => { doc.setFont("helvetica", estilo); doc.setFontSize(tam); doc.text(txt, W / 2, y, { align: "center" }); y += tam * 1.12; };
  linhaCab("ESTADO DO PARANÁ", 12.5); linhaCab("POLÍCIA MILITAR", 12.5); linhaCab("DIRETORIA DE EDUCAÇÃO CORPORATIVA", 12.5);
  linhaCab("ACADEMIA POLICIAL MILITAR DO GUATUPÊ", 10.5); linhaCab("“CORONEL PM ANTONIO MICHALISZYN”", 10.5, "bolditalic");
  linhaCab("ESCOLA DE FORMAÇÃO DE OFICIAIS", 10.5);
  y = Math.max(y, 122) + 4;
  doc.setLineWidth(0.8); doc.setDrawColor(...preto); doc.line(ME - 10, y, W - MD + 10, y);
  y += 24;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Nota de Aplicação de Medida Corretiva Escolar n° ${n.numero}/${n.ano}`, W / 2, y, { align: "center" });
  y += 26;

  const paragrafo = (txt, { tam = 11, estilo = "normal", alinh = "justify", depois = 13 } = {}) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tam);
    const linhas = doc.splitTextToSize(txt, larg);
    const alt = linhas.length * tam * 1.2;
    if (y + alt > H - 50) { doc.addPage(); y = 60; }
    linhas.forEach((l, i) => {
      const ultima = i === linhas.length - 1;
      if (alinh === "justify" && !ultima) doc.text(l, ME, y, { align: "justify", maxWidth: larg });
      else doc.text(l, alinh === "right" ? W - MD : alinh === "center" ? W / 2 : ME, y, { align: alinh === "justify" ? "left" : alinh });
      y += tam * 1.2;
    });
    y += depois;
  };

  paragrafo(`1. Considerando a regular e prévia ciência dos militares acerca das Alterações Administrativas Disciplinares (AAD) a eles imputadas, conforme registro exarado na Planilha de Anotados n° ${n.planilhas || "___"}.`);
  paragrafo("2. Considerando as prescrições da Portaria do Comando-Geral n° 294, de 16 de março de 2009 (Sistema Disciplinar Especial), bem como a imperativa adequação disciplinar e a finalidade pedagógica inerentes aos cursos de formação, cuja responsabilização materializa-se por intermédio das Medidas Corretivas Escolares (MCE).");
  paragrafo("3. Considerando o transcurso do prazo regulamentar para a apresentação de defesa, garantindo-se assim o pleno exercício do contraditório; e que eventual recurso em face da presente MCE deverá ser interposto no prazo estrito de 24 (vinte e quatro) horas, conforme preconizam o Art. 12 e o Capítulo V da Portaria do Comando-Geral n° 294.");
  paragrafo("Os militares abaixo relacionados ficam sujeitos às seguintes MCEs:", { depois: 8 });

  const estiloTabela = {
    theme: "grid",
    margin: { left: ME, right: MD, top: 60 },
    styles: { font: "helvetica", fontSize: 10, textColor: preto, lineColor: preto, lineWidth: 0.6, halign: "center", valign: "middle", cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [255, 255, 255], textColor: preto, fontStyle: "bold", lineColor: preto, lineWidth: 0.6 },
    rowPageBreak: "avoid",
    showHead: "firstPage"
  };
  const titulo = (txt, cols) => [{ content: txt, colSpan: cols, styles: { fillColor: cinza, fontSize: 11.5, cellPadding: 6 } }];

  // ---------- FO+
  if (n.fo && n.fo.length) {
    doc.autoTable({
      ...estiloTabela, startY: y,
      head: [titulo("Fato Observado Positivo (FO+)", 6), ["N°", "Data", "Anotador", "Pel.", "Cadete", "Descrição"]],
      body: n.fo.map((f, i) => [String(i + 1), data(f.fato), f.anotadorNome, f.pel, f.cadeteGuerra,
        /^\(FO\+\)/i.test(f.descricao) ? f.descricao : "(FO+) " + f.descricao]),
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 62 }, 2: { cellWidth: 70 }, 3: { cellWidth: 52 }, 4: { cellWidth: 70 } }
    });
    y = doc.lastAutoTable.finalY + 28;
  }

  // ---------- AAD por turma
  const grupos = [];
  (n.itens || []).forEach((it) => {
    let g = grupos.find((x) => x.nome === it.grupo);
    if (!g) { g = { nome: it.grupo, itens: [] }; grupos.push(g); }
    g.itens.push(it);
  });
  for (const g of grupos) {
    if (y > H - 140) { doc.addPage(); y = 60; }
    doc.autoTable({
      ...estiloTabela, startY: y,
      head: [titulo(g.nome, 5), ["N°", "Data", g.nome === "CHOE" ? "Aluno-Oficial" : "Cadete", "AAD", "MCE"]],
      body: g.itens.map((it, i) => [String(i + 1), data(it.fato), it.cadeteGuerra,
        it.descricao + (it.transferidaDe ? ` (Transferida NAMCE ${it.transferidaDe.split("/")[0]}).` : ""),
        (it.mce || "").replace(/ \+ /g, "\n")]),
      columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 66 }, 2: { cellWidth: 86 }, 4: { cellWidth: 72 } }
    });
    y = doc.lastAutoTable.finalY + 28;
  }

  // ---------- Tabela de MCEs
  const corpoMce = [];
  TABELA_MCE.forEach(([dia, blocos]) => blocos.forEach(([b, hr], i) => {
    corpoMce.push(i === 0 ? [{ content: dia, rowSpan: blocos.length }, b, hr] : [b, hr]);
  }));
  corpoMce.push(["EEsp", { content: "Escala Especial", colSpan: 2 }], ["LC", { content: "Licença Cassada", colSpan: 2 }], ["TD", { content: "Trabalho Didático", colSpan: 2 }]);
  const largMce = 320;
  if (y > H - 520) { doc.addPage(); y = 60; }
  doc.autoTable({
    ...estiloTabela, startY: y, pageBreak: "avoid",
    margin: { left: (W - largMce) / 2, right: (W - largMce) / 2, top: 60 },
    head: [[{ content: "TABELA DE MEDIDAS CORRETIVAS ESCOLARES (MCEs)", colSpan: 3, styles: { fillColor: cinza, fontSize: 10.5 } }]],
    body: corpoMce,
    styles: { ...estiloTabela.styles, fontSize: 10.5, cellPadding: 5.5 },
    columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 116 }, 2: { cellWidth: 122 } }
  });
  y = doc.lastAutoTable.finalY + 30;

  // ---------- Orientações e assinatura
  if (y > H - 380) { doc.addPage(); y = 70; }
  paragrafo("Orientações diversas:", { estilo: "bold", alinh: "left" });
  ORIENTACOES.forEach((t) => paragrafo(t));
  y += 30;
  paragrafo(`${n.local || PADRAO.local}, datado eletronicamente.`, { alinh: "right", depois: 40 });
  if (y > H - 80) { doc.addPage(); y = 80; }
  doc.setFont("helvetica", "italic"); doc.setFontSize(11); doc.setTextColor(120, 120, 120);
  doc.text("Assinado eletronicamente", W / 2, y, { align: "center" }); y += 14;
  doc.setTextColor(...preto); doc.setFont("helvetica", "normal");
  doc.text(`${n.assinante || PADRAO.assinante},`, W / 2, y, { align: "center" }); y += 14;
  doc.setFont("helvetica", "bold");
  doc.text(`${n.cargo || PADRAO.cargo}.`, W / 2, y, { align: "center" });

  // ---------- Marca d'água da prévia
  if (previa) {
    const tot = doc.getNumberOfPages();
    for (let p = 1; p <= tot; p++) {
      doc.setPage(p);
      doc.setTextColor(215, 215, 215); doc.setFont("helvetica", "bold"); doc.setFontSize(54);
      doc.text("PRÉVIA · NÃO PUBLICADA", W / 2, H / 2, { align: "center", angle: 35 });
    }
    doc.setTextColor(...preto);
  }

  if (salvar) doc.save(`NAMCE_${n.numero || "sem-numero"}_${n.ano}${previa ? "_PREVIA" : ""}.pdf`);
  return doc;
}
