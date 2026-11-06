// SDE · EsFO — Extratos de ciência (nível 3)
//  · gerarExtratoCienciaPdf: AAD e FO+ da semana com a ciência da anotação (liberado depois do prazo de defesa)
//  · gerarExtratoNamcePdf: AAD da NAMCE com a ciência do resultado (liberado a partir de sexta-feira, 12h)
import { JSPDF, AUTOTABLE, carregarScript, cabecalhoInstitucional } from "./namce-pdf.js";

const FUSO = "America/Sao_Paulo";
const dataHora = (ms) => new Date(ms).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
const extenso = (ms) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "long", year: "numeric" });
const curta = (ms) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: FUSO }).replaceAll("/", "-");

/** Monta o documento: cabeçalho, título, linhas de informação, tabela e rodapé. */
async function montar({ titulo, infos, destaque, head, body, colunas, colCiencia, nomeArquivo, geradoPor, rodape }, { salvar, base }) {
  await carregarScript(JSPDF);
  await carregarScript(AUTOTABLE);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape", compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const ME = 40, MD = 40, larg = W - ME - MD;
  const preto = [0, 0, 0];
  doc.setLineHeightFactor(1.2);

  let y = await cabecalhoInstitucional(doc, base);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(titulo, W / 2, y, { align: "center" });
  y += 18;
  const texto = (t, { estilo = "normal", tam = 10, depois = 4 } = {}) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tam);
    doc.splitTextToSize(t, larg).forEach((l) => { doc.text(l, ME, y); y += tam * 1.25; });
    y += depois;
  };
  infos.forEach((t) => texto(t));
  texto(destaque, { estilo: "bold", depois: 10 });

  doc.autoTable({
    startY: y,
    theme: "grid",
    margin: { left: ME, right: MD, top: 40, bottom: 46 },
    head: [head],
    body: body.length ? body : [[{ content: "Nenhuma anotação.", colSpan: head.length, styles: { halign: "center" } }]],
    styles: { font: "helvetica", fontSize: 8.5, textColor: preto, lineColor: preto, lineWidth: 0.5, valign: "middle", cellPadding: 3.5, overflow: "linebreak" },
    headStyles: { fillColor: [225, 225, 225], textColor: preto, fontStyle: "bold", halign: "center" },
    columnStyles: colunas,
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === colCiencia && String(d.cell.raw).startsWith("SEM")) d.cell.styles.fontStyle = "bold";
    },
    rowPageBreak: "avoid"
  });

  const tot = doc.getNumberOfPages();
  for (let i = 1; i <= tot; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    doc.text(rodape, ME, H - 26);
    doc.text(`Extrato gerado em ${dataHora(Date.now())}${geradoPor ? " por " + geradoPor : ""} · página ${i} de ${tot}`, ME, H - 15);
    doc.setTextColor(...preto);
  }
  if (salvar) doc.save(nomeArquivo);
  return doc;
}

const cadete = (l) => `${l.cadeteGuerra}\n${l.cadeteNome || ""}`;

/**
 * e: { inicio, fechamento, prazo (ms), planilha ("39/2026" ou ""), geradoPor,
 *      linhas: [{ cadeteGuerra, cadeteNome, turma, tipo ('aad'|'fo'), fato, anotadorNome, descricao, criado, ciente (ms|null) }] }
 */
export async function gerarExtratoCienciaPdf(e, { salvar = true, base = "" } = {}) {
  const total = e.linhas.length, cientes = e.linhas.filter((l) => l.ciente).length, aad = e.linhas.filter((l) => l.tipo !== "fo").length;
  return montar({
    titulo: "Extrato de Ciência das Anotações",
    infos: [
      `Período analisado: de ${extenso(e.inicio)}, às 18h, a ${extenso(e.fechamento)}, às 18h.` + (e.planilha ? ` Planilha de Anotados nº ${e.planilha}.` : ""),
      `Prazo de defesa: até ${extenso(e.prazo)}, às 23h59.`
    ],
    destaque: `Anotações: ${total} (${aad} AAD e ${total - aad} FO+) · com ciência registrada: ${cientes} · sem ciência: ${total - cientes}.`,
    head: ["Nº", "Cadete", "Turma · Pel.", "Tipo", "Fato", "Anotador", "Descrição", "Lançada em", "Ciência do cadete"],
    body: e.linhas.map((l, i) => [String(i + 1), cadete(l), l.turma, l.tipo === "fo" ? "FO+" : "AAD", dataHora(l.fato), l.anotadorNome || "—",
      l.descricao, dataHora(l.criado),
      l.ciente ? dataHora(l.ciente) + (l.ciente > e.prazo ? "\n(após o prazo de defesa)" : "") : "SEM CIÊNCIA"]),
    colunas: {
      0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: 96 }, 2: { cellWidth: 66, halign: "center" }, 3: { cellWidth: 34, halign: "center" },
      4: { cellWidth: 66, halign: "center" }, 5: { cellWidth: 70 }, 6: { cellWidth: "auto" }, 7: { cellWidth: 66, halign: "center" },
      8: { cellWidth: 84, halign: "center" }
    },
    colCiencia: 8,
    rodape: "A ciência é registrada automaticamente pelo SDE quando o cadete abre a aba \"Minhas anotações\" (data e hora do servidor).",
    nomeArquivo: `Extrato_de_Ciencia_${curta(e.fechamento)}.pdf`,
    geradoPor: e.geradoPor
  }, { salvar, base });
}

/**
 * e: { numero, ano, publicada (ms), sexta (ms, sexta do cumprimento 00h), prazoCiencia (ms), geradoPor,
 *      linhas: [{ cadeteGuerra, cadeteNome, turma, fato, anotadorNome, descricao, mce, cienteAnot (ms|null), ciente (ms|null) }] }
 */
export async function gerarExtratoNamcePdf(e, { salvar = true, base = "" } = {}) {
  const total = e.linhas.length, cientes = e.linhas.filter((l) => l.ciente).length;
  const tarde = e.linhas.filter((l) => l.ciente && l.ciente > e.prazoCiencia).length;
  return montar({
    titulo: `Extrato de Ciência da NAMCE nº ${e.numero}/${e.ano}`,
    infos: [
      (e.publicada ? `NAMCE publicada em ${dataHora(e.publicada)}. ` : "") + `Cumprimento: de ${extenso(e.sexta)} a ${extenso(e.sexta + 2 * 86400000)}.`,
      `Prazo para a ciência do resultado: ${extenso(e.prazoCiencia)}, às 12h.`
    ],
    destaque: `AAD na NAMCE: ${total} · ciência no prazo: ${cientes - tarde} · após o prazo: ${tarde} · sem ciência: ${total - cientes}.`,
    head: ["Nº", "Cadete", "Turma · Pel.", "Fato", "Anotador", "AAD", "Decisão / MCE", "Ciência da anotação", "Ciência do resultado"],
    body: e.linhas.map((l, i) => [String(i + 1), cadete(l), l.turma, dataHora(l.fato), l.anotadorNome || "—", l.descricao, l.mce || "—",
      l.cienteAnot ? dataHora(l.cienteAnot) : "—",
      l.ciente ? dataHora(l.ciente) + (l.ciente > e.prazoCiencia ? "\n(após sexta 12h)" : "") : "SEM CIÊNCIA"]),
    colunas: {
      0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: 92 }, 2: { cellWidth: 62, halign: "center" }, 3: { cellWidth: 62, halign: "center" },
      4: { cellWidth: 66 }, 5: { cellWidth: "auto" }, 6: { cellWidth: 120 }, 7: { cellWidth: 64, halign: "center" },
      8: { cellWidth: 80, halign: "center" }
    },
    colCiencia: 8,
    rodape: "A ciência do resultado é registrada automaticamente pelo SDE quando o cadete abre a aba \"Minhas anotações\" depois da publicação da NAMCE (data e hora do servidor).",
    nomeArquivo: `Extrato_de_Ciencia_NAMCE_${e.numero}-${e.ano}.pdf`,
    geradoPor: e.geradoPor
  }, { salvar, base });
}
