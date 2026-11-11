// SDE · EsFO — Estatísticas (nível 3): PDF da visão atual (Anotados ou Anotadores), com os filtros aplicados.
import { JSPDF, AUTOTABLE, carregarScript, cabecalhoInstitucional } from "./namce-pdf.js";

const FUSO = "America/Sao_Paulo";
const dataHora = (ms) => new Date(ms).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
const curta = (ms) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: FUSO }).replaceAll("/", "-");

/**
 * e: { titulo, filtros: [texto], resumo: [texto], head: [..], body: [[..]], colunas: {i: estilo}, geradoPor, nome }
 */
export async function gerarEstatisticasPdf(e, { salvar = true, base = "" } = {}) {
  await carregarScript(JSPDF);
  await carregarScript(AUTOTABLE);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: e.head.length > 7 ? "landscape" : "portrait", compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const ME = 40, larg = W - 2 * ME, preto = [0, 0, 0];
  doc.setLineHeightFactor(1.2);
  let y = await cabecalhoInstitucional(doc, base);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(e.titulo, W / 2, y, { align: "center" });
  y += 18;
  const texto = (t, estilo = "normal") => {
    doc.setFont("helvetica", estilo); doc.setFontSize(9.5);
    doc.splitTextToSize(t, larg).forEach((l) => { doc.text(l, ME, y); y += 12; });
  };
  e.filtros.forEach((t) => texto(t));
  y += 2;
  texto(e.resumo.join(" · "), "bold");
  y += 6;
  doc.autoTable({
    startY: y, theme: "grid", margin: { left: ME, right: ME, top: 40, bottom: 46 },
    head: [e.head],
    body: e.body.length ? e.body : [[{ content: "Ninguém nesta seleção.", colSpan: e.head.length, styles: { halign: "center" } }]],
    styles: { font: "helvetica", fontSize: 8.5, textColor: preto, lineColor: preto, lineWidth: 0.5, valign: "middle", cellPadding: 3.5 },
    headStyles: { fillColor: [225, 225, 225], textColor: preto, fontStyle: "bold", halign: "center" },
    columnStyles: e.colunas,
    rowPageBreak: "avoid"
  });
  const tot = doc.getNumberOfPages();
  for (let i = 1; i <= tot; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    doc.text(`Gerado pelo SDE em ${dataHora(Date.now())}${e.geradoPor ? " por " + e.geradoPor : ""} · página ${i} de ${tot}`, ME, H - 15);
    doc.setTextColor(...preto);
  }
  if (salvar) doc.save(`${e.nome}_${curta(Date.now())}.pdf`);
  return doc;
}
