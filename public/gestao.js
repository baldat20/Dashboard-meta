// public/gestao.js (frontend) - versão com o visual solicitado

const urlParams = new URLSearchParams(window.location.search);

// Proteção: se aberto direto sem nome/cargo -> volta para index
if (!urlParams.get("nome") || !urlParams.get("cargo")) {
  window.location.href = "index.html";
}

const nome = urlParams.get('nome') || '';
const cargo = urlParams.get('cargo') || '';

// supervisoras fixas (ordem)
const SUPERVISORES = [
  "Erika Silvestre Nunes",
  "Agata Angel Pereira Oliveira",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Layra da Silva Reginaldo"
];

// cores por nível (conforme solicitado)
const CORES_NIVEL = {
  "SUPERAÇÃO": { cls: "nivel-super", hex: "#a129d9" },
  "DEFINIDA":  { cls: "nivel-defin",  hex: "#42f554" },
  "TOLERÁVEL": { cls: "nivel-toler",  hex: "#dbd951" },
  "NÃO ATINGIU":{ cls: "nivel-nao",   hex: "#db4c42" }
};

let supervisaoSelecionada = null;
let tipoAtual = 'analistas';

function isCoord() {
  return (cargo === "Leticia Caroline Da Silva");
}

function showCard() {
  document.getElementById('cardArea').style.display = 'block';
}

document.addEventListener("DOMContentLoaded", () => {
  // preencher titulo com nome da supervisora
  document.getElementById('supNome').innerText = nome;

  // botões
  const btnAnal = document.getElementById("tabAnal");
  const btnAux = document.getElementById("tabAux");
  const btnSair = document.getElementById("btnSair");

  btnAnal.addEventListener("click", () => {
    tipoAtual = 'analistas';
    btnAnal.classList.add('active');
    btnAux.classList.remove('active');
    if (supervisaoSelecionada) carregarRelatorio(tipoAtual);
  });
  btnAux.addEventListener("click", () => {
    tipoAtual = 'auxiliares';
    btnAux.classList.add('active');
    btnAnal.classList.remove('active');
    if (supervisaoSelecionada) carregarRelatorio(tipoAtual);
  });

  btnSair.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  // se for coordenação, mostrar menu de supervisoras (usaremos prompt simples)
  if (isCoord()) {
    // gerar select simples: vamos usar prompt pra não mexer em DOM extra
    const sel = prompt("Digite a supervisora desejada ou deixe em branco para ver todas:\n(Ex: Erika Silvestre Nunes)");
    if (sel && sel.trim().length>0) {
      supervisaoSelecionada = sel.trim();
      carregarRelatorio(tipoAtual);
    } else {
      // se quiser ver resumo por supervisora podemos chamar API com cargo=Leticia...
      carregarResumoCoordenacao();
    }
  } else {
    // supervisor logado vê sua própria equipe
    supervisaoSelecionada = nome;
    // marca Analistas ativo por padrão
    document.getElementById("tabAnal").classList.add('active');
    carregarRelatorio('analistas');
  }
});

// chama a API /api/gestao para trazer dados
async function carregarRelatorio(tipo) {
  if (!supervisaoSelecionada) {
    document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Selecione uma supervisão.</td></tr>`;
    return;
  }

  document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Carregando...</td></tr>`;
  showCard();

  const url = `/api/gestao?tipo=${encodeURIComponent(tipo)}&supervisao=${encodeURIComponent(supervisaoSelecionada)}&cargo=${encodeURIComponent(nome)}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(()=>({erro:resp.statusText}));
      document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Erro: ${err.erro || resp.statusText}</td></tr>`;
      return;
    }

    const dados = await resp.json();

    const lista = (tipo === 'analistas') ? (dados.analistas || []) : (dados.auxiliares || []);

    montarTabela(lista, tipo);
  } catch (e) {
    document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Erro: ${e.message}</td></tr>`;
    console.error("Erro fetch /api/gestao:", e);
  }
}

async function carregarResumoCoordenacao() {
  // chama API para coletar todas as supervisoras
  const url = `/api/gestao?cargo=${encodeURIComponent(cargo)}`; // cargo = Leticia...
  const resp = await fetch(url);
  if (!resp.ok) {
    document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Erro ao carregar resumo.</td></tr>`;
    return;
  }
  const dados = await resp.json();
  // montar um menu simples com botões por supervisora no topo (se preferir, podemos renderizar aqui)
  const supNames = Object.keys(dados.supervisores || {});
  if (supNames.length === 0) {
    document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Nenhuma supervisora encontrada.</td></tr>`;
    return;
  }

  // montar HTML simples com botões para cada supervisora
  let html = `<tr><td colspan="6" style="padding:12px">`;
  html += `<div style="display:flex;flex-wrap:wrap;gap:10px">`;
  supNames.forEach(sup => {
    html += `<button style="padding:8px 12px;border-radius:8px;border:1px solid #dbeffd;background:#fff;cursor:pointer" onclick="selecionarSupervisora('${encodeURIComponent(sup)}')">${sup} (${(dados.supervisores[sup].analistas||[]).length} / ${(dados.supervisores[sup].auxiliares||[]).length})</button>`;
  });
  html += `</div></td></tr>`;
  document.getElementById("tabelaBody").innerHTML = html;
  showCard();
}

function selecionarSupervisora(supEnc) {
  supervisaoSelecionada = decodeURIComponent(supEnc);
  document.getElementById("tabAnal").classList.add('active');
  document.getElementById("tabAux").classList.remove('active');
  carregarRelatorio('analistas');
}

function montarTabela(lista, tipo) {
  if (!lista || lista.length === 0) {
    document.getElementById("tabelaBody").innerHTML = `<tr><td colspan="6" style="padding:18px">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  // construir linhas
  let html = '';
  for (const row of lista) {
    // adaptar campos para analistas / auxiliares
    const nomeVal = row.nome || '';
    const tma = row.tma || (row.EFICIENCIA || '');
    const tme = row.tme || (row.vrep || '');
    const tempo = row.tempoProd || '';
    const abs = row.abs || '';
    const nivel = (row.nivel || '').toUpperCase();

    const nivelClass = (CORES_NIVEL[nivel] || {}).cls || '';
    const levelText = nivel || '';

    html += `<tr>
      <td class="col-name">${escapeHtml(nomeVal)}</td>
      <td>${tma}</td>
      <td>${tme}</td>
      <td>${tempo}</td>
      <td>${abs}</td>
      <td style="text-align:center"><span class="badge ${nivelClass}">${levelText}</span></td>
    </tr>`;
  }

  document.getElementById("tabelaBody").innerHTML = html;
  showCard();
}

// small utility to avoid XSS in names
function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
