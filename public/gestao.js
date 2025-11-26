// public/gestao.js (frontend)
// Lê query string (nome/cargo) e monta a interface que consome /api/gestao

const urlParams = new URLSearchParams(window.location.search);
const nome = urlParams.get('nome') || '';   // nome do usuário logado (ex: "Erika ...")
const cargo = urlParams.get('cargo') || ''; // aqui estamos passando cargo = nome do usuário (por redirect)

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
  "SUPERAÇÃO": "#a129d9",
  "DEFINIDA": "#42f554",
  "TOLERÁVEL": "#dbd951",
  "NÃO ATINGIU": "#db4c42"
};

let supervisaoSelecionada = null;
let tipoAtual = null;

function isCoord() {
  return (cargo === "Leticia Caroline Da Silva");
}

function logDebug(...args) {
  // comente a linha abaixo se quiser silêncio em produção
  console.log("[gestao.js]", ...args);
}

document.addEventListener("DOMContentLoaded", () => {
  // valida elementos mínimos
  if (!document.getElementById("tituloPainel")) {
    console.error("gestao.js: elemento #tituloPainel não encontrado");
    return;
  }
  document.getElementById("tituloPainel").innerText = `Painel de Gestão - ${nome || ''}`;

  if (isCoord()) {
    gerarMenuSupervisoes();
  } else {
    supervisaoSelecionada = nome;
    document.getElementById("menuTipoRelatorio").style.display = "flex";
  }

  const btnAnal = document.getElementById("btnAnalistas");
  const btnAux = document.getElementById("btnAuxiliares");
  if (btnAnal) btnAnal.onclick = () => { tipoAtual = 'analistas'; carregarRelatorio('analistas'); };
  if (btnAux) btnAux.onclick = () => { tipoAtual = 'auxiliares'; carregarRelatorio('auxiliares'); };

  logDebug("iniciado", { nome, cargo, isCoord: isCoord() });
});

function gerarMenuSupervisoes() {
  const menu = document.getElementById("menuSupervisoes");
  if (!menu) { console.error("menuSupervisoes não encontrado"); return; }
  menu.innerHTML = "";
  SUPERVISORES.forEach(sup => {
    const btn = document.createElement("button");
    btn.innerText = sup;
    btn.onclick = () => {
      supervisaoSelecionada = sup;
      document.getElementById("menuTipoRelatorio").style.display = "flex";
      document.getElementById("areaTabela").innerHTML = "<em>Selecione Analistas ou Auxiliares...</em>";
    };
    menu.appendChild(btn);
  });
}

async function carregarRelatorio(tipo) {
  if (!supervisaoSelecionada) {
    document.getElementById("areaTabela").innerHTML = "<em>Selecione uma supervisão primeiro.</em>";
    return;
  }

  document.getElementById("areaTabela").innerHTML = "<em>Carregando...</em>";

  // envia cargo = nome (usuário logado) para que a API reconheça coordenação / supervisora
  const url = `/api/gestao?tipo=${encodeURIComponent(tipo)}&supervisao=${encodeURIComponent(supervisaoSelecionada)}&cargo=${encodeURIComponent(nome)}`;

  logDebug("fetch", url);
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      document.getElementById("areaTabela").innerHTML = `<em>Erro: ${err.erro || resp.statusText}</em>`;
      return;
    }

    const dados = await resp.json();

    if (dados.supervisores) {
      montarResumoCoordenacao(dados.supervisores);
      return;
    }

    if (tipo === 'analistas') {
      const lista = dados.analistas || dados;
      montarTabelaAnalistas(lista);
    } else if (tipo === 'auxiliares') {
      const lista = dados.auxiliares || dados;
      montarTabelaAuxiliares(lista);
    } else {
      if (dados.analistas) montarTabelaAnalistas(dados.analistas || []);
      if (dados.auxiliares) montarTabelaAuxiliares(dados.auxiliares || []);
    }
  } catch (e) {
    document.getElementById("areaTabela").innerHTML = `<em>Erro: ${e.message}</em>`;
    console.error("Erro fetch /api/gestao:", e);
  }
}

function montarResumoCoordenacao(objSupervisores) {
  let html = `<div>`;
  for (const supName of Object.keys(objSupervisores)) {
    const sup = objSupervisores[supName];
    html += `<div style="margin-bottom:18px; padding:12px; border-radius:8px; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,0.06);">
      <h3 style="margin:0 0 8px 0; background:#42a7f5; color:#fff; display:inline-block; padding:6px 10px; border-radius:6px;">${supName}</h3>
      <div style="margin-top:8px;"><strong>Analistas:</strong> ${ (sup.analistas||[]).length } — <strong>Auxiliares:</strong> ${ (sup.auxiliares||[]).length }</div>
      <div style="margin-top:10px;">
        <button onclick="filtrarEVer('${encodeURIComponent(supName)}','analistas')">Ver Analistas</button>
        <button onclick="filtrarEVer('${encodeURIComponent(supName)}','auxiliares')">Ver Auxiliares</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  document.getElementById("areaTabela").innerHTML = html;
}

function filtrarEVer(supEncoded, tipo) {
  supervisaoSelecionada = decodeURIComponent(supEncoded);
  tipoAtual = tipo;
  carregarRelatorio(tipo);
}

function montarTabelaAnalistas(lista) {
  if (!lista || lista.length === 0) {
    document.getElementById("areaTabela").innerHTML = "<em>Nenhum analista encontrado.</em>";
    return;
  }

  let html = `<table><thead><tr><th>Nome</th><th>TMA</th><th>TME</th><th>Tempo Prod</th><th>% ABS</th><th>Nível</th></tr></thead><tbody>`;
  lista.forEach(row => {
    const cor = CORES_NIVEL[(row.nivel||"").toUpperCase()] || '#ccc';
    html += `<tr>
      <td>${row.nome}</td>
      <td>${row.tma}</td>
      <td>${row.tme}</td>
      <td>${row.tempoProd}</td>
      <td>${row.abs}</td>
      <td><span class="tagNivel" style="background:${cor}">${row.nivel}</span></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("areaTabela").innerHTML = html;
}

function montarTabelaAuxiliares(lista) {
  if (!lista || lista.length === 0) {
    document.getElementById("areaTabela").innerHTML = "<em>Nenhum auxiliar encontrado.</em>";
    return;
  }

  let html = `<table><thead><tr><th>Nome</th><th>Eficiência</th><th>VREP</th><th>% ABS</th><th>Nível</th></tr></thead><tbody>`;
  lista.forEach(row => {
    const cor = CORES_NIVEL[(row.nivel||"").toUpperCase()] || '#ccc';
    html += `<tr>
      <td>${row.nome}</td>
      <td>${row.eficiencia}</td>
      <td>${row.vrep}</td>
      <td>${row.abs}</td>
      <td><span class="tagNivel" style="background:${cor}">${row.nivel}</span></td>
    </tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("areaTabela").innerHTML = html;
}
