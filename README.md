# SDE · EsFO

Sistema Disciplinar Especial da Escola de Formação de Oficiais (APMG).

- Site: https://sdeesfopmpr-dotcom.github.io/SDE/
- Firebase: projeto `sde-esfo` (login por e-mail e senha, banco Firestore em São Paulo)

## Arquivos
- `index.html`: o sistema inteiro (uma página só).
- `firestore.rules`: regras de segurança. Sempre que mudar, copie o conteúdo para Firebase → Firestore Database → Regras → Publicar.

## Níveis de acesso
1. Cadete: vê as próprias anotações, faz a defesa até quarta 23h59, vê a MCE após a dosimetria.
2. Anotador: nível 1 + lança anotações e FO+.
3. Coordenação / admin: tudo + dosimetria, cadastro de cadetes, escalas, acessos e NAMCE.

O primeiro usuário a se cadastrar vira administrador (nível 3). Os demais pedidos ficam pendentes até um nível 3 aprovar na aba Acessos.

## Etapas
- [x] 1. Login, pedido de acesso, aprovação e regras de segurança
- [ ] 2. Minhas anotações e defesa
- [ ] 3. Lançamento de anotações e FO+
- [ ] 4. Cadetes, escalas e dashboard de dosimetria
- [ ] 5. NAMCE em PDF
- [ ] 6. Teste com cadetes e liberação
