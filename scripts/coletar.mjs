// Coleta indicadores (Banco Central, Tesouro) e ofertas de renda fixa (Investidor10)
// e grava em data/mercado.json. Roda no GitHub Actions (Node 20+) ou localmente: node scripts/coletar.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept': 'application/json,text/plain,*/*' };
const erros = [];

async function getJson(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} em ${url}`);
  return r.json();
}
const num = s => +String(s).replace(',', '.');
const tentar = async (nome, fn) => { try { return await fn(); } catch (e) { erros.push(`${nome}: ${e.message}`); return null; } };

// ---- Banco Central (SGS) ----
const sgs = async cod => {
  const [d] = await getJson(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${cod}/dados/ultimos/1?formato=json`);
  return { valor: num(d.valor), data: d.data };
};
const selic = await tentar('Selic', () => sgs(432));     // meta Selic % a.a.
const cdi = await tentar('CDI', () => sgs(4389));        // CDI anualizado base 252
const ipca = await tentar('IPCA', () => sgs(13522));     // IPCA acumulado 12 meses

// ---- Focus (expectativas anuais, mediana mais recente) ----
const focus = await tentar('Focus', async () => {
  const out = {};
  for (const ind of ['Selic', 'IPCA']) {
    const f = encodeURIComponent(`Indicador eq '${ind}' and baseCalculo eq 0`);
    const j = await getJson(`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=40&$filter=${f}&$orderby=Data%20desc&$select=Data,DataReferencia,Mediana&$format=json`);
    const ultima = j.value[0]?.Data;
    out[ind] = { data: ultima, anos: Object.fromEntries(j.value.filter(v => v.Data === ultima).map(v => [v.DataReferencia, v.Mediana]).sort()) };
  }
  return out;
});

// ---- Tesouro Direto (dados abertos, última data disponível) ----
const tesouro = await tentar('Tesouro', async () => {
  const url = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv';
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status}`);
  const linhas = (await r.text()).trim().split(/\r?\n/).slice(1).map(l => l.split(';'));
  const iso = d => d.split('/').reverse().join('-');
  const ult = linhas.reduce((m, l) => (iso(l[2]) > m ? iso(l[2]) : m), '');
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    data: ult,
    titulos: linhas.filter(l => iso(l[2]) === ult && iso(l[1]) > hoje)
      .map(l => ({ titulo: l[0], vencimento: iso(l[1]), taxaCompra: num(l[3]), pu: num(l[5]) }))
      .filter(t => t.taxaCompra > 0)
      .sort((a, b) => a.titulo.localeCompare(b.titulo) || a.vencimento.localeCompare(b.vencimento)),
  };
});

// ---- Ofertas de CDB, LCI e LCA (Investidor10; fonte não oficial) ----
async function ofertas(tipo) {
  const out = [];
  for (let p = 1; p <= 40; p++) {
    const j = await getJson(`https://investidor10.com.br/api/fixed-incomes/${tipo}?page=${p}&filter=&order=`);
    out.push(...j.data);
    if (p >= j.last_page) break;
  }
  return out;
}
const lista = [];
for (const tipo of ['cdb', 'lci', 'lca']) {
  const r = await tentar(`Ofertas ${tipo}`, () => ofertas(tipo));
  for (const x of r || []) {
    if (!x.active) continue;
    const [d, m, a] = String(x.redemption_period).split('/');
    lista.push({
      tipo: tipo.toUpperCase(), nome: x.name.trim(), emissor: x.issuer_name, distribuidor: x.distributor_name,
      vencimento: `${a}-${m}-${d}`, indexador: x.indexer_profitability, modalidade: x.type_profitability,
      taxa: +x.value_profitability, brutaFonte: +x.gross_income, minimo: +x.minimum_investment,
      liquidezDiaria: x.daily_liquidity === 'Diária', fgc: !!x.fgc_guarantee, risco: x.financial_risk,
    });
  }
}

const saida = {
  atualizadoEm: new Date().toISOString(),
  indicadores: { selic, cdi, ipca }, focus, tesouro,
  ofertas: lista, fontes: ['Banco Central (SGS e Focus)', 'Tesouro Transparente', 'Investidor10'], erros,
};
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/mercado.json', import.meta.url), JSON.stringify(saida));
console.log(`OK: ${lista.length} ofertas, Tesouro ${tesouro?.titulos.length ?? 0} títulos, erros: ${erros.length ? erros.join(' | ') : 'nenhum'}`);
