# SDE · EsFO

Sistema Disciplinar Especial da Escola de Formação de Oficiais (APMG).

- Site: https://sdeesfopmpr.github.io/SDE/
- Firebase: projeto `sde-esfo` (login por e-mail e senha, banco Firestore em São Paulo)

## Publicar uma versão nova
- Altere o número em `<meta name="sde-versao" content="...">` no `index.html` a cada publicação: quem estiver com o site aberto recebe o aviso "Há uma versão nova do sistema".

## Dados pessoais
- O sistema **não guarda CPF**. Contas e cadastros têm só nome, nome de guerra, turma, pelotão e e-mail. Nas escalas importadas, o CPF é ignorado: só nome, data e horário são usados.

## Arquivos
- `index.html`: o sistema inteiro (uma página só).
- `firestore.rules`: regras de segurança. Sempre que mudar, copie o conteúdo para Firebase → Firestore Database → Regras → Publicar.

## Níveis de acesso
1. Cadete: vê as próprias anotações, faz a defesa até a segunda-feira 23h59 seguinte ao fechamento da semana, vê a MCE após a NAMCE.
2. Anotador: nível 1 + lança anotações e FO+ (fato de no máximo 72 horas antes do lançamento).
3. Administração (cadetes da Missão SDE e Coordenação, com os mesmos acessos): tudo + acompanhamento, dosimetria, Planilha de Anotados, NAMCE, cadastro de cadetes (com "Promover turmas"), escalas e acessos. Na aba Acessos, cada conta tem a etiqueta "Cadete" ou "Coordenação".

O primeiro usuário a se cadastrar vira administrador (nível 3). Os demais pedidos ficam pendentes até um nível 3 aprovar na aba Acessos.
Ninguém anula, edita ou apaga anotação. NAMCE e Planilha de Anotados ficam travadas depois de publicadas.

## Semana disciplinar
- A semana de anotações **fecha na sexta-feira às 18h** (pela hora do lançamento no sistema). O que for lançado depois entra na semana seguinte.
- A defesa escrita pode ser enviada desde o lançamento até a **segunda-feira seguinte, 23h59** (travado nas regras do servidor).
- Aba **Dosimetria** tem duas abas internas: **Semana atual** (acompanhamento ao vivo das anotações e defesas, com relógio até o fechamento) e **Semana fechada** (Planilha de Anotados, defesas até segunda, dosimetria e NAMCE).
- **Após o fechamento:** publicar a **Planilha de Anotados** (PDF sem dosimetria, `js/planilha-pdf.js`). Ela fica guardada em `namces/{prazo}.planilha` e o número dela entra sozinho no campo "Planilhas de Anotados nº" da NAMCE.
- **Quinta-feira:** dosimetria. **Sexta a domingo:** cumprimento (o segundo fim de semana depois da anotação).
- Ex.: anotação de 20/10 → fecha 23/10 18h → defesa até 26/10 23h59 → dosimetria 29/10 → cumprimento 30/10 a 01/11.

## Escalas de serviço (horários usados)
- Respondente, Dia-à-EsFO, Cmt. da Guarda, Cmt. do Bloco III, Plantões do Bloco III, Postos Externos e seus sobreavisos: 07h15 às 07h15.
- Sentinelas da Guarda e do Posto II (e o sobreaviso delas): dia útil 18h50 às 07h15; sábado, domingo e feriado 07h15 às 07h15.
- Quem está de sobreaviso não cumpre MCE.
- `js/importar-escalas.js` lê o PDF no navegador (pdf.js) e liga os nomes ao cadastro pelo nome completo.

## Etapas
- [x] 1. Login, pedido de acesso, aprovação e regras de segurança
- [x] 2. Minhas anotações e defesa
- [x] 3. Lançamento de anotações e FO+ (e lista provisória "Anotações da semana" para o nível 3)
- [x] 4. Dosimetria (13 blocos, Justif., Transf., TD, Já cumprida), publicação da NAMCE, anulação, escalas (lançamento manual) e cadastro de cadetes. Importação de escalas em PDF (Previsão de Serviço Interno, Boletim Interno e escalas especiais com graduação, nome e turno).
- [x] 5. NAMCE em PDF no layout oficial (prévia com marca d’água e geração automática ao publicar; "Baixar PDF" nas NAMCEs publicadas)
- [x] 5b. Dosimetria em duas abas (semana atual / semana fechada) e Planilha de Anotados em PDF
- [ ] 6. Teste com cadetes e liberação
