# SDE · EsFO

Sistema Disciplinar Especial da Escola de Formação de Oficiais (APMG).

- Site: https://sdeesfopmpr.github.io/SDE/
- Firebase: projeto `sde-esfo` (login por e-mail e senha, banco Firestore em São Paulo)

## Arquivos
- `index.html`: o sistema inteiro (uma página só).
- `firestore.rules`: regras de segurança. Sempre que mudar, copie o conteúdo para Firebase → Firestore Database → Regras → Publicar.

## Níveis de acesso
1. Cadete: vê as próprias anotações, faz a defesa até a segunda-feira 23h59 seguinte ao fechamento da semana, vê a MCE após a dosimetria.
2. Anotador: nível 1 + lança anotações e FO+.
3. Coordenação / admin: tudo + dosimetria, cadastro de cadetes, escalas, acessos e NAMCE.

O primeiro usuário a se cadastrar vira administrador (nível 3). Os demais pedidos ficam pendentes até um nível 3 aprovar na aba Acessos.

## Semana disciplinar
- A semana de anotações **fecha na sexta-feira às 18h** (pela hora do lançamento no sistema). O que for lançado depois entra na semana seguinte.
- A defesa escrita pode ser enviada desde o lançamento até a **segunda-feira seguinte, 23h59** (travado nas regras do servidor).
- **Quinta-feira:** dosimetria. **Sexta a domingo:** cumprimento (o segundo fim de semana depois da anotação).
- Ex.: anotação de 20/10 → fecha 23/10 18h → defesa até 26/10 23h59 → dosimetria 29/10 → cumprimento 30/10 a 01/11.

## Escalas de serviço (horários usados)
- Respondente, Dia-à-EsFO, Cmt. da Guarda, Cmt. do Bloco III, Plantões do Bloco III, Postos Externos e seus sobreavisos: 07h15 às 07h15.
- Sentinelas da Guarda e do Posto II (e o sobreaviso delas): dia útil 18h50 às 07h15; sábado, domingo e feriado 07h15 às 07h15.
- Quem está de sobreaviso não cumpre MCE.
- `js/importar-escalas.js` lê o PDF no navegador (pdf.js) e liga os nomes ao cadastro (nome completo e, na escala especial, CPF parcial).

## Etapas
- [x] 1. Login, pedido de acesso, aprovação e regras de segurança
- [x] 2. Minhas anotações e defesa
- [x] 3. Lançamento de anotações e FO+ (e lista provisória "Anotações da semana" para o nível 3)
- [x] 4. Dosimetria (13 blocos, Justif., Transf., TD, Já cumprida), publicação da NAMCE, anulação, escalas (lançamento manual) e cadastro de cadetes. Importação de escalas em PDF (Previsão de Serviço Interno, Boletim Interno e escalas especiais com CPF e turno).
- [x] 5. NAMCE em PDF no layout oficial (prévia com marca d’água e geração automática ao publicar; "Baixar PDF" nas NAMCEs publicadas)
- [ ] 6. Teste com cadetes e liberação
