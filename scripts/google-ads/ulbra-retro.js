// ULBRA · sem agendamento, carga historica
//
// Cole este arquivo inteiro no editor de scripts da conta.

var SCRIPT_LABEL = 'GOOGLE ADS ETL [Retro] ULBRA';
var DIAS_ATRAS   = null;
var RETRO_INICIO = '2026-07-01';   // usados SO quando DIAS_ATRAS = null
var RETRO_FIM    = '2026-08-27';

var WEBHOOK_URL   = 'https://n8n.ulbrads.site/webhook/googleads';
var WEBHOOK_TOKEN = 'TROQUE_POR_UM_SEGREDO_LONGO';
var LOTE = 500;

/**
 * Com DRY_RUN ligado o script NAO envia nada: ele monta o payload e joga no
 * log. Serve para validar consulta, periodo e formato antes de existir
 * webhook, tabela ou qualquer outra peca. Desligue quando o n8n estiver de pe.
 */
var DRY_RUN = true;

/** Data no fuso da CONTA, nao no do script - perto da virada eles divergem. */
function diaRelativo(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd');
}

function periodo() {
  if (DIAS_ATRAS === null) return { inicio: RETRO_INICIO, fim: RETRO_FIM };
  var d = diaRelativo(DIAS_ATRAS);
  return { inicio: d, fim: d };
}

function enviar(lote) {
  if (DRY_RUN) {
    Logger.log('[DRY_RUN] ' + lote.length + ' linhas — amostra:');
    Logger.log(JSON.stringify(lote.slice(0, 3), null, 2));
    return;
  }

  var res = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Token': WEBHOOK_TOKEN },
    payload: JSON.stringify(lote),
    muteHttpExceptions: true
  });

  var codigo = res.getResponseCode();
  if (codigo >= 300) {
    // Lancar de proposito: o painel do Google precisa marcar FALHA. Com o
    // erro apenas logado, o script aparecia "Concluido sem mudancas" e
    // ninguem percebia que nada chegava do outro lado - foi o que manteve
    // os scripts antigos verdes por dois meses sem entregar linha nenhuma.
    throw new Error('Webhook respondeu ' + codigo + ' - ' + res.getContentText().slice(0, 300));
  }
  Logger.log('OK ' + lote.length + ' linhas enviadas.');
}

function main() {
  var p = periodo();
  Logger.log('Conta: ' + AdsApp.currentAccount().getName() +
             ' (' + AdsApp.currentAccount().getCustomerId() + ')');
  Logger.log('Periodo: ' + p.inicio + ' ate ' + p.fim + (DRY_RUN ? '  [DRY_RUN]' : ''));

  var query =
    'SELECT segments.date, customer.descriptive_name, customer.id, ' +
    'campaign.id, campaign.name, campaign.advertising_channel_type, ' +
    'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, ' +
    'metrics.average_cpc, metrics.conversions, metrics.cost_per_conversion, ' +
    'metrics.conversions_value ' +
    'FROM campaign ' +
    "WHERE segments.date BETWEEN '" + p.inicio + "' AND '" + p.fim + "'";

  var report = AdsApp.search(query);
  var payload = [];
  var enviadas = 0;
  var gastoTotal = 0;

  while (report.hasNext()) {
    var row = report.next();
    var custo = row.metrics.costMicros / 1000000;
    var conv = Number(row.metrics.conversions || 0);

    // O filtro de gasto saiu do GAQL e veio para ca: assim a campanha que
    // teve conversao atribuida num dia sem gasto nao some da base.
    if (custo === 0 && conv === 0) continue;
    gastoTotal += custo;

    payload.push({
      script_name: SCRIPT_LABEL,
      date: row.segments.date,
      account_id: String(row.customer.id),
      account_name: row.customer.descriptiveName,
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      channel_type: row.campaign.advertisingChannelType,
      entity_level: 'campaign',
      spend: custo,
      impressions: Number(row.metrics.impressions || 0),
      clicks: Number(row.metrics.clicks || 0),
      ctr: Number(row.metrics.ctr || 0),
      cpc: row.metrics.averageCpc / 1000000,
      cpa: row.metrics.costPerConversion / 1000000,
      conversions: conv,
      conversion_value: Number(row.metrics.conversionsValue || 0),
      platform: 'GOOGLE'
    });

    // Lotes: o Retro cobre meses e um POST unico estoura o webhook.
    if (payload.length >= LOTE) {
      enviar(payload);
      enviadas += payload.length;
      payload = [];
    }
  }

  if (payload.length > 0) {
    enviar(payload);
    enviadas += payload.length;
  }

  Logger.log('Total: ' + enviadas + ' linhas, R$ ' + gastoTotal.toFixed(2) + ' de gasto.');
  if (enviadas === 0) Logger.log('AVISO: nada encontrado no periodo.');
}
