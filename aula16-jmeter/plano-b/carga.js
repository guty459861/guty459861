// =============================================================
// PLANO B · Teste de carga sem JMeter (só Node.js)
// -------------------------------------------------------------
// Use SOMENTE se o JMeter não funcionar no seu computador
// (por exemplo, sem Java). Ele faz o mesmo roteiro do plano do
// JMeter e mostra a mesma tabela de resultados.
//
// Como usar (com a API ligada em outro terminal):
//   node carga.js <usuarios> <repeticoes> <rampa_em_segundos>
// Exemplo: 10 usuários, cada um repete 10 vezes, entrando em 5 s
//   node carga.js 10 10 5
// =============================================================

const http = require('http');

const USUARIOS   = parseInt(process.argv[2] || '5', 10);
const REPETICOES = parseInt(process.argv[3] || '10', 10);
const RAMPA_S    = parseFloat(process.argv[4] || '5');
const HOST = process.env.HOST || 'localhost';
const PORTA = process.env.PORTA || 3333;

const agente = new http.Agent({ keepAlive: true, maxSockets: 1000 });

// O roteiro de cada usuário virtual (igual ao do JMeter)
const ROTEIRO = [
  { nome: 'POST /api/login',    metodo: 'POST', caminho: '/api/login',    corpo: { email: 'instrutor@senac.br', senha: '123456' } },
  { nome: 'GET /api/chamados',  metodo: 'GET',  caminho: '/api/chamados' },
  { nome: 'GET /api/relatorio', metodo: 'GET',  caminho: '/api/relatorio' },
  { nome: 'POST /api/chamados', metodo: 'POST', caminho: '/api/chamados', corpo: { titulo: 'Teste de carga', sala: 'Sala 10' } }
];

const resultados = {}; // nome -> lista de { ms, ok }
ROTEIRO.forEach(p => (resultados[p.nome] = []));

function requisicao(passo) {
  return new Promise(resolve => {
    const corpo = passo.corpo ? JSON.stringify(passo.corpo) : null;
    const inicio = process.hrtime.bigint();
    const req = http.request({
      host: HOST, port: PORTA, path: passo.caminho, method: passo.metodo, agent: agente,
      headers: corpo ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) } : {}
    }, res => {
      res.resume();
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
        resolve({ ms, ok: res.statusCode < 400 });
      });
    });
    req.on('error', () => resolve({ ms: Number(process.hrtime.bigint() - inicio) / 1e6, ok: false }));
    if (corpo) req.write(corpo);
    req.end();
  });
}

async function usuarioVirtual(n) {
  await new Promise(r => setTimeout(r, (RAMPA_S * 1000 / USUARIOS) * n));
  for (let i = 0; i < REPETICOES; i++) {
    for (const passo of ROTEIRO) {
      resultados[passo.nome].push(await requisicao(passo));
    }
  }
}

function p90(lista) {
  const ord = [...lista].sort((a, b) => a - b);
  return ord[Math.max(0, Math.ceil(ord.length * 0.9) - 1)];
}

(async () => {
  console.log(`Iniciando: ${USUARIOS} usuários · ${REPETICOES} repetições · rampa de ${RAMPA_S} s`);
  const inicio = Date.now();
  await Promise.all([...Array(USUARIOS)].map((_, i) => usuarioVirtual(i)));
  const duracaoS = (Date.now() - inicio) / 1000;

  const linhas = [];
  let todos = [];
  for (const nome of Object.keys(resultados)) {
    const r = resultados[nome]; todos = todos.concat(r);
    linhas.push(linha(nome, r, duracaoS));
  }
  linhas.push(linha('TOTAL', todos, duracaoS));
  console.table(linhas);
  console.log(`Duração do teste: ${duracaoS.toFixed(1)} s`);
  agente.destroy();
})();

function linha(nome, r, duracaoS) {
  const tempos = r.map(x => x.ms);
  return {
    'Requisição': nome,
    'Amostras': r.length,
    'Média (ms)': Math.round(tempos.reduce((a, b) => a + b, 0) / r.length),
    '90% (ms)': Math.round(p90(tempos)),
    'Máx (ms)': Math.round(Math.max(...tempos)),
    'Erro %': ((r.filter(x => !x.ok).length / r.length) * 100).toFixed(1) + '%',
    'Vazão (req/s)': (r.length / duracaoS).toFixed(1)
  };
}
