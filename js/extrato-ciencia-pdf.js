// SDE · EsFO — Extrato de Ciência das Anotações (nível 3; liberado depois do prazo de defesa da semana)
// Lista cada AAD e FO+ da semana com o registro de ciência do cadete (data e hora do servidor).
import { JSPDF, AUTOTABLE, carregarScript, cabecalhoInstitucional } from "./namce-pdf.js";

const FUSO = "America/Sao_Paulo";
const dataHora = (ms) => new Date(ms).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
const extenso = (ms) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "long", year: "numeric" });

/**
 * e: { inicio, fechamento, prazo (ms), planilha ("39/2026" ou ""), geradoPor,
 *      linhas: [{ cadeteGuerra, cadeteNome, turma, tipo ('aad'|'fo'), fato, anotadorNome, descricao, criado, ciente (ms|null) }] }
 */
export async function gerarExtratoCienciaPdf(e, { salvar = true, base = "" } = {}) {
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
  doc.text("Extrato de Ciência das Anotações", W / 2, y, { align: "center" });
  y += 18;

  const total = e.linhas.length;
  const cientes = e.linhas.filter((l) => l.ciente).length;
  const aad = e.linhas.filter((l) => l.tipo !== "fo").length;
  const texto = (t, { estilo = "normal", tam = 10, depois = 4 } = {}) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tam);
    doc.splitTextToSize(t, larg).forEach((l) => { doc.text(l, ME, y); y += tam * 1.25; });
    y += depois;
  };
  texto(`Período analisado: de ${extenso(e.inicio)}, às 18h, a ${extenso(e.fechamento)}, às 18h.`
    + (e.planilha ? ` Planilha de Anotados nº ${e.planilha}.` : ""));
  texto(`Prazo de defesa: até ${extenso(e.prazo)}, às 23h59.`);
  texto(`Anotações: ${total} (${aad} AAD e ${total - aad} FO+) · com ciência registrada: ${cientes} · sem ciência: ${total - cientes}.`,
    { estilo: "bold", depois: 10 });

  const corpo = e.linhas.map((l, i) => [
    String(i + 1),
    `${l.cadeteGuerra}\n${l.cadeteNome || ""}`,
    l.turma,
    l.tipo === "fo" ? "FO+" : "AAD",
    dataHora(l.fato),
    l.anotadorNome || "—",
    l.descricao,
    dataHora(l.criado),
    l.ciente ? dataHora(l.ciente) + (l.ciente > e.prazo ? "\n(após o prazo de defesa)" : "") : "SEM CIÊNCIA"
  ]);
  doc.autoTable({
    startY: y,
    theme: "grid",
    margin: { left: ME, right: MD, top: 40, bottom: 46 },
    head: [["Nº", "Cadete", "Turma · Pel.", "Tipo", "Fato", "Anotador", "Descrição", "Lançada em", "Ciência do cadete"]],
    body: corpo.length ? corpo : [[{ content: "Nenhuma anotação na semana.", colSpan: 9, styles: { halign: "center" } }]],
    styles: { font: "helvetica", fontSize: 8.5, textColor: preto, lineColor: preto, lineWidth: 0.5, valign: "middle", cellPadding: 3.5, overflow: "linebreak" },
    headStyles: { fillColor: [225, 225, 225], textColor: preto, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: 96 }, 2: { cellWidth: 66, halign: "center" }, 3: { cellWidth: 34, halign: "center" },
      4: { cellWidth: 66, halign: "center" }, 5: { cellWidth: 70 }, 6: { cellWidth: "auto" }, 7: { cellWidth: 66, halign: "center" },
      8: { cellWidth: 84, halign: "center" }
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 8 && String(d.cell.raw).startsWith("SEM")) d.cell.styles.fontStyle = "bold";
    },
    rowPageBreak: "avoid"
  });

  // Rodapé: como a ciência é registrada, quem gerou e a página
  const tot = doc.getNumberOfPages();
  for (let i = 1; i <= tot; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    doc.text("A ciência é registrada automaticamente pelo SDE quando o cadete abre a aba \"Minhas anotações\" (data e hora do servidor).",
      ME, H - 26);
    doc.text(`Extrato gerado em ${dataHora(Date.now())}${e.geradoPor ? " por " + e.geradoPor : ""} · página ${i} de ${tot}`, ME, H - 15);
    doc.setTextColor(...preto);
  }

  if (salvar) doc.save(`Extrato_de_Ciencia_${new Date(e.fechamento).toLocaleDateString("pt-BR", { timeZone: FUSO }).replaceAll("/", "-")}.pdf`);
  return doc;
}
