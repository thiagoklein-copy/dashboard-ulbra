# Google Ads Scripts

Seis instalações: três scripts em cada uma das duas contas. O código é
idêntico entre as contas — script roda dentro da conta onde está instalado,
então `customer.id` vem certo sozinho. Só o rótulo muda, para você saber
qual gravou cada linha quando for depurar.

| Arquivo | Conta | Agendamento |
|---|---|---|
| [`ulbra-d1.js`](ulbra-d1.js) | ULBRA `847-259-4330` | diário, 07:00–08:00 |
| [`ulbra-d2.js`](ulbra-d2.js) | ULBRA | diário, 08:00–09:00 |
| [`ulbra-retro.js`](ulbra-retro.js) | ULBRA | nenhum, manual |
| [`pop-d1.js`](pop-d1.js) | Ulbra Pop - EAD `467-212-3684` | diário, 07:00–08:00 |
| [`pop-d2.js`](pop-d2.js) | Ulbra Pop - EAD | diário, 08:00–09:00 |
| [`pop-retro.js`](pop-retro.js) | Ulbra Pop - EAD | nenhum, manual |

**Não dá para fazer um script só no MCC cobrindo as duas.** A conta
Ulbra Pop - EAD não está sob o MCC da ULBRA — ela só responde à API
passando `login_customer_id` igual a ela mesma.

## Por que D-1 e D-2

O D-1 pega ontem. O D-2 refaz anteontem, quando o Google já atribuiu as
conversões que chegaram atrasadas. Como a gravação é upsert na chave
`(data, platform, account_id, campaign_id)`, o D-2 **substitui** a linha do
D-1 com o número maduro em vez de duplicar.

Por isso `script_name` fica fora da chave primária da tabela. Se entrasse,
D-1 e D-2 virariam duas linhas e o gasto do dia apareceria dobrado.

## Ordem de instalação

**1. Comece com `DRY_RUN = true`** (já vem assim). Nesse modo o script não
envia nada: monta o payload e joga no log. Você valida consulta, período e
formato **antes de existir webhook, tabela ou qualquer outra peça**.

Instale só o `ulbra-d1.js` primeiro, clique em **Visualizar** e confira no
log: nome da conta, período, quantidade de linhas, gasto total e a amostra
das três primeiras.

**2. Autorize.** O diálogo aparece na primeira execução — é o passo que
faltava nos scripts antigos. Eles ficaram "Ativado" sem rodar desde
26 de junho porque a autorização de quem os criou não valia mais.

**3. Só depois do n8n de pé**, troque para `DRY_RUN = false` e ponha um
segredo real em `WEBHOOK_TOKEN` — o mesmo valor no nó IF do n8n.

**4. Replique nos outros cinco** e agende os quatro diários.

## O que foi corrigido em relação aos scripts antigos

| Mudança | Por quê |
|---|---|
| Erro de webhook **lança** em vez de só logar | O `try/catch` fazia terminar "verde" entregando nada |
| `DRY_RUN` | Testar sem depender de nenhuma outra peça |
| `X-Token` no cabeçalho | A URL do webhook é pública |
| Lotes de 500 | O Retro cobre meses; um POST único estoura |
| Data pelo fuso da **conta** | `new Date()` usa o fuso do script |
| Filtro de gasto no JS, não no GAQL | `cost_micros > 0` derrubava campanha com conversão em dia sem gasto |
| `String()` nos ids | Chegavam como número; as colunas são texto |
| Log de gasto total | Confere contra o painel do Google antes de gravar |

## Nenhuma credencial nova

Google Ads Scripts roda **dentro** da conta: não precisa de developer token,
OAuth client nem refresh token. O `WEBHOOK_TOKEN` é um segredo que você
inventa. E o n8n grava no Supabase com as variáveis de ambiente que o
workflow da Meta já usa (`SUPABASE_PROJECT_REF`,
`SUPABASE_SERVICE_ROLE_KEY`).

Passo a passo completo em
[`docs/google-ads-no-dashboard.md`](../../docs/google-ads-no-dashboard.md).
