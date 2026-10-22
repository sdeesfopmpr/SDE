// SDE · EsFO — Geração do PDF da Planilha de Anotados (publicada no fechamento da semana, sem dosimetria)
import { JSPDF, AUTOTABLE, carregarScript, cabecalhoInstitucional } from "./namce-pdf.js";

export const PADRAO = {
  assinante: "Cad. 3° PM Bruno Pettenuci Gentine",
  cargo: "Chefe da Missão SDE",
  local: "São José dos Pinhais"
};

const FUSO = "America/Sao_Paulo";
function data(ms) {
  return new Date(ms).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
}
/** "26 de outubro de 2026" */
function extenso(ms) {
  return new Date(ms).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "long", year: "numeric" });
}

/**
 * p: { numero, ano, fechamento (ms, sexta 18h), inicio (ms, sexta anterior 18h), prazo (ms, segunda 23h59),
 *      sexta (ms, sexta do cumprimento 00h), fo: [{fato, anotadorNome, pel, cadeteGuerra, descricao}],
 *      itens: [{grupo, fato, anotadorNome, pel, cadeteGuerra, descricao}], assinante, cargo, local }
 */
export async function gerarPlanilhaPdf(p, { previa = false, salvar = true, base = "" } = {}) {
  await carregarScript(JSPDF);
  await carregarScript(AUTOTABLE);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const ME = 50, MD = 50, larg = W - ME - MD;
  const preto = [0, 0, 0], cinza = [200, 200, 200];
  doc.setLineHeightFactor(1.2);

  let y = await cabecalhoInstitucional(doc, base);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Planilha de Anotados n° ${p.numero || "___"}/${p.ano}`, W / 2, y, { align: "center" });
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

  const domingo = p.sexta + 2 * 86400000;
  paragrafo("1. Os militares listados neste documento deverão tomar ciência de suas respectivas anotações no Sistema Disciplinar Especial (SDE), onde elas ficam disponíveis desde o lançamento;");
  paragrafo(`2. Faculta-se aos militares listados a apresentação de razões de defesa, que deverão ser formalizadas no SDE até as 23h59min de segunda-feira (${extenso(p.prazo)});`);
  paragrafo(`3. O cumprimento das Medidas Corretivas Escolares (MCE) ocorrerá no período compreendido entre sexta-feira (${extenso(p.sexta)}) e domingo (${extenso(domingo)}), podendo sofrer alterações em virtude das escalas de serviço e da rotina administrativa da Escola de Formação de Oficiais;`);
  paragrafo(`4. Período analisado: de ${extenso(p.inicio)}, às 18h, a ${extenso(p.fechamento)}, às 18h.`, { depois: 16 });

  const estiloTabela = {
    theme: "grid",
    margin: { left: ME, right: MD, top: 60 },
    styles: { font: "helvetica", fontSize: 9.5, textColor: preto, lineColor: preto, lineWidth: 0.6, halign: "center", valign: "middle", cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [255, 255, 255], textColor: preto, fontStyle: "bold", lineColor: preto, lineWidth: 0.6, fontSize: 10.5 },
    rowPageBreak: "avoid",
    showHead: "firstPage",
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 66 }, 2: { cellWidth: 98 }, 3: { cellWidth: 62 }, 4: { cellWidth: 84 } }
  };
  const titulo = (txt) => [{ content: txt, colSpan: 6, styles: { fillColor: cinza, fontSize: 11.5, cellPadding: 6 } }];
  const tabela = (nome, colCadete, linhas, fo) => {
    if (y > H - 140) { doc.addPage(); y = 60; }
    doc.autoTable({
      ...estiloTabela, startY: y,
      head: [titulo(nome), ["Nº", "Data", "Anotador", "Pel.", colCadete, "Descrição"]],
      body: linhas.map((a, i) => [String(i + 1), data(a.fato), a.anotadorNome, a.pel, a.cadeteGuerra,
        fo && !/^\(FO\+\)/i.test(a.descricao) ? "(FO+) " + a.descricao : a.descricao])
    });
    y = doc.lastAutoTable.finalY + 28;
  };

  if (p.fo && p.fo.length) tabela("FO+", "Cadete", p.fo, true);
  const grupos = [];
  (p.itens || []).forEach((it) => {
    let g = grupos.find((x) => x.nome === it.grupo);
    if (!g) { g = { nome: it.grupo, itens: [] }; grupos.push(g); }
    g.itens.push(it);
  });
  grupos.forEach((g) => tabela(g.nome, g.nome === "CHOE" ? "Aluno Oficial" : "Cadete", g.itens, false));
  if (!(p.fo && p.fo.length) && !grupos.length) paragrafo("Nenhuma anotação no período.", { alinh: "center" });

  // ---------- Local e assinatura
  y += 10;
  if (y > H - 130) { doc.addPage(); y = 80; }
  paragrafo(`${p.local || PADRAO.local}, datado eletronicamente.`, { alinh: "right", depois: 40 });
  doc.setFont("helvetica", "italic"); doc.setFontSize(11); doc.setTextColor(120, 120, 120);
  doc.text("Assinado eletronicamente", W / 2, y, { align: "center" }); y += 14;
  doc.setTextColor(...preto); doc.setFont("helvetica", "normal");
  doc.text(`${p.assinante || PADRAO.assinante},`, W / 2, y, { align: "center" }); y += 14;
  doc.setFont("helvetica", "bold");
  doc.text(`${p.cargo || PADRAO.cargo}.`, W / 2, y, { align: "center" });

  if (previa) {
    const tot = doc.getNumberOfPages();
    for (let i = 1; i <= tot; i++) {
      doc.setPage(i);
      doc.setTextColor(215, 215, 215); doc.setFont("helvetica", "bold"); doc.setFontSize(54);
      doc.text("PRÉVIA · NÃO PUBLICADA", W / 2, H / 2, { align: "center", angle: 35 });
    }
    doc.setTextColor(...preto);
  }

  if (salvar) doc.save(`Planilha_de_Anotados_${p.numero || "sem-numero"}_${p.ano}${previa ? "_PREVIA" : ""}.pdf`);
  return doc;
}
