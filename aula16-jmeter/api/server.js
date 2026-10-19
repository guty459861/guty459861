// =============================================================
// API DO MINI CHAMADOS · Aula 16 · Testes de carga e desempenho
// -------------------------------------------------------------
// Uma API simples, feita só com Node.js (nada para instalar).
// Ela será o ALVO dos testes com o JMeter.
//
// Para rodar:   node server.js
// Depois abra:  http://localhost:3333   (painel de monitoramento)
//
// ATENÇÃO: não mexa no código antes de testar. A missão é
// descobrir, só MEDINDO, quais rotas aguentam carga e quais não.
// =============================================================

const http = require('http');

const PORTA = process.env.PORTA || 3333;

// ---------- "banco de dados" em memória ----------
const usuarios = [
  { email: 'instrutor@senac.br', senha: '123456', nome: 'Instrutor Teste' },
  { email: 'tecnico@senac.br',   senha: '123456', nome: 'Técnico Teste' }
];
const salas = ['Sala 10', 'Sala 11', 'Sala 12', 'Laboratório 3'];
const chamados = [];
for (let i = 1; i <= 30; i++) {
  chamados.push({ id: i, titulo: `Chamado de exemplo ${i}`, sala: salas[i % 4], status: i % 3 ? 'aberto' : 'fechado' });
}
let proximoId = 31;

// ---------- números do monitoramento ----------
const mon = { ativas: 0, picoAtivas: 0, total: 0, erros: 0, inicio: Date.now(), ultimos: [] };

// ---------- funções de apoio ----------
const esperar = ms => new Promise(r => setTimeout(r, ms));
const aleatorio = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function enviarJSON(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corpo) });
  res.end(corpo);
}

function lerCorpo(req) {
  return new Promise(resolve => {
    let dados = '';
    req.on('data', parte => (dados += parte));
    req.on('end', () => {
      try { resolve(dados ? JSON.parse(dados) : {}); } catch (e) { resolve(null); }
    });
  });
}

// Simula um banco de dados com poucas conexões disponíveis
const banco = { conexoes: 3, emUso: 0 };

// ---------- rotas ----------
async function rotas(req, res) {
  const url = req.url.split('?')[0];

  // Toda requisição POST precisa avisar que o corpo está em JSON
  if (req.method === 'POST' && !(req.headers['content-type'] || '').includes('application/json')) {
    return enviarJSON(res, 415, { erro: 'Envie o cabeçalho Content-Type: application/json' });
  }

  // Painel de monitoramento (abra no navegador)
  if (req.method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAINEL);
  }

  // Números do servidor em tempo real (usado pelo painel)
  if (req.method === 'GET' && url === '/api/status') {
    const agora = Date.now();
    mon.ultimos = mon.ultimos.filter(t => agora - t < 5000);
    return enviarJSON(res, 200, {
      requisicoesAtivas: mon.ativas - 1,
      picoAtivas: mon.picoAtivas,
      totalRequisicoes: mon.total,
      totalErros: mon.erros,
      requisicoesPorSegundo: +(mon.ultimos.length / 5).toFixed(1),
      memoriaMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1),
      ligadoHaSegundos: Math.round((agora - mon.inicio) / 1000)
    });
  }

  // POST /api/login  { "email": "...", "senha": "..." }
  if (req.method === 'POST' && url === '/api/login') {
    const corpo = await lerCorpo(req);
    await esperar(aleatorio(20, 40));
    if (!corpo || !corpo.email || !corpo.senha) return enviarJSON(res, 400, { erro: 'Informe o e-mail e a senha' });
    const u = usuarios.find(x => x.email === corpo.email && x.senha === corpo.senha);
    if (!u) return enviarJSON(res, 401, { erro: 'E-mail ou senha inválidos' });
    return enviarJSON(res, 200, { token: 'tk-' + Date.now(), nome: u.nome });
  }

  // GET /api/chamados  → lista todos os chamados
  if (req.method === 'GET' && url === '/api/chamados') {
    await esperar(aleatorio(10, 25));
    return enviarJSON(res, 200, chamados.slice(-50));
  }

  // GET /api/relatorio  → resumo dos chamados por sala
  if (req.method === 'GET' && url === '/api/relatorio') {
    await esperar(100 + 45 * mon.ativas);
    const porSala = {};
    salas.forEach(s => (porSala[s] = chamados.filter(c => c.sala === s).length));
    return enviarJSON(res, 200, { total: chamados.length, porSala });
  }

  // POST /api/chamados  { "titulo": "...", "sala": "..." }
  if (req.method === 'POST' && url === '/api/chamados') {
    const corpo = await lerCorpo(req);
    if (!corpo || !corpo.titulo || corpo.titulo.length < 5 || !salas.includes(corpo.sala)) {
      return enviarJSON(res, 400, { erro: 'Dados do chamado inválidos' });
    }
    if (banco.emUso >= banco.conexoes) {
      return enviarJSON(res, 503, { erro: 'Banco ocupado: nenhuma conexão livre' });
    }
    banco.emUso++;
    try {
      await esperar(aleatorio(150, 250));
      const novo = { id: proximoId++, titulo: corpo.titulo, sala: corpo.sala, status: 'aberto' };
      chamados.push(novo);
      return enviarJSON(res, 201, novo);
    } finally {
      banco.emUso--;
    }
  }

  return enviarJSON(res, 404, { erro: 'Rota não encontrada' });
}

// ---------- servidor ----------
const servidor = http.createServer(async (req, res) => {
  mon.ativas++; mon.total++; mon.ultimos.push(Date.now());
  if (mon.ativas > mon.picoAtivas) mon.picoAtivas = mon.ativas;
  res.on('finish', () => { mon.ativas--; if (res.statusCode >= 400) mon.erros++; });
  try { await rotas(req, res); }
  catch (e) { console.error(e); if (!res.headersSent) enviarJSON(res, 500, { erro: 'Erro interno' }); }
});

servidor.listen(PORTA, () => {
  console.log('==============================================');
  console.log(` API do Mini Chamados rodando na porta ${PORTA}`);
  console.log(` Painel de monitoramento: http://localhost:${PORTA}`);
  console.log(' Para parar: Ctrl + C');
  console.log('==============================================');
});

// A cada 5 segundos com tráfego, mostra um resumo no terminal
let totalAnterior = 0;
setInterval(() => {
  if (mon.total === totalAnterior) return;
  const novas = mon.total - totalAnterior; totalAnterior = mon.total;
  const mem = (process.memoryUsage().heapUsed / 1048576).toFixed(1);
  console.log(`[monitor] ${(novas / 5).toFixed(1)} req/s · ativas agora: ${mon.ativas} · pico: ${mon.picoAtivas} · erros: ${mon.erros} · memória: ${mem} MB`);
}, 5000);

// ---------- página do painel ----------
const PAINEL = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monitor · API Mini Chamados</title>
<style>body{font-family:Arial,sans-serif;background:#0F2744;color:#F4F6F9;margin:0;padding:24px}h1{margin:0 0 4px}p{color:#CFE0F2}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:20px 0}.c{background:#173A63;border-radius:12px;padding:16px}
.c b{display:block;font-size:34px;color:#FFC47A}.c span{font-size:14px;color:#CFE0F2}table{border-collapse:collapse;width:100%;max-width:760px}
td,th{border-bottom:1px solid #2C527E;padding:8px;text-align:left;font-size:15px}code{color:#FFC47A}</style></head><body>
<h1>Monitor da API</h1><p>Deixe esta página aberta enquanto o JMeter roda. Ela atualiza sozinha a cada segundo.</p>
<div class="g"><div class="c"><b id="rps">0</b><span>requisições por segundo</span></div>
<div class="c"><b id="at">0</b><span>requisições em andamento agora</span></div>
<div class="c"><b id="pico">0</b><span>pico de requisições ao mesmo tempo</span></div>
<div class="c"><b id="tot">0</b><span>requisições desde que ligou</span></div>
<div class="c"><b id="err">0</b><span>respostas com erro (4xx e 5xx)</span></div>
<div class="c"><b id="mem">0</b><span>memória usada (MB)</span></div></div>
<h2>Rotas disponíveis</h2><table><tr><th>Método</th><th>Rota</th><th>Corpo (JSON)</th></tr>
<tr><td>POST</td><td><code>/api/login</code></td><td>{"email":"instrutor@senac.br","senha":"123456"}</td></tr>
<tr><td>GET</td><td><code>/api/chamados</code></td><td>sem corpo</td></tr>
<tr><td>GET</td><td><code>/api/relatorio</code></td><td>sem corpo</td></tr>
<tr><td>POST</td><td><code>/api/chamados</code></td><td>{"titulo":"Projetor sem imagem","sala":"Sala 10"}</td></tr></table>
<script>async function t(){try{const r=await fetch('/api/status');const d=await r.json();
rps.textContent=d.requisicoesPorSegundo;at.textContent=d.requisicoesAtivas;pico.textContent=d.picoAtivas;tot.textContent=d.totalRequisicoes;err.textContent=d.totalErros;mem.textContent=d.memoriaMB;}catch(e){}}
setInterval(t,1000);t();</script></body></html>`;
