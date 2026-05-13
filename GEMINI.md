# Projeto App Finanças Pessoais V2

## REGRAS DE OURO

### Datas (Bypass de Timezone)
NUNCA use bibliotecas de calendário do React que sofrem mutação de fuso horário. Use estritamente o `<input type="date">` nativo do HTML5. Ao ler a coluna date do Supabase, use a técnica de `.split('-')` ou `.substring()` na string literal para exibir na tela, garantindo que o fuso horário nunca diminua um dia.

### Mobile-First Estrito
As listas de transações não devem ser `<Table>` convencionais com rolagem para o lado no mobile. Devem ser renderizadas como Cards empilhados. O layout principal deve ter uma Bottom Navigation Bar para o celular (fixa no rodapé) e uma Sidebar apenas para telas `md:`.

### Inserções e Tipagens
A tabela `pessoal_transactions` OBRIGATORIAMENTE exige relacionamentos UUID em `account_id` e `subcategory_id`. O valor (`amount`) deve ser tratado como numeric (float). A coluna `type` recebe estritamente as strings `'income'` ou `'expense'`.

### Autenticação e Contexto
Nunca usar IDs hardcoded. Usar sempre `supabase.auth.getUser()` para obter o ID real do usuário autenticado. A interface deve sempre possuir um Toggle para alternar entre as tabelas de domínio `pessoal_transactions` e `negocio`.

---

## ESQUEMA DO BANCO DE DADOS (POSTGRESQL)

### pessoal_accounts
- id (uuid)
- user_id (uuid)
- name (text)

### pessoal_categories
- id (uuid)
- user_id (uuid)
- type (varchar)
- name (text)

### pessoal_subcategories
- id (uuid)
- user_id (uuid)
- category_id (uuid)
- name (text)

### pessoal_transactions
- id (uuid)
- user_id (uuid)
- account_id (uuid)
- subcategory_id (uuid)
- amount (numeric)
- date (date)
- type (varchar)
- description (text)
- installment_current (int)
- installment_total (int)

### negocio
- id (uuid)
- user_id (uuid)
- amount (numeric)
- date (date)
- description (text)
- type (varchar)
- category (text)