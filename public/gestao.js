// ===========================
//   PARÂMETROS DA URL
// ===========================
const urlParams = new URLSearchParams(window.location.search);
if (!urlParams.get("nome") || !urlParams.get("cargo")) {
  window.location.href = "index.html";
}

const nome = urlParams.get("nome");
const cargo = urlParams.get("cargo");

// ===========================
//   FIXO: LISTA SUPERVISORAS
// ===========================
const SUPERVISORES = [
  "Erika Silvestre Nunes",
  "Agata Angel Pereira Oliveira",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Layra da Silva Reginaldo"
];

const CORES_NIVEL = {
  "SUPERAÇÃO": "nivel-super",
  "DEFINIDA": "nivel-defin",
  "TOLERÁVEL": "nivel-toler",
  "NÃO ATINGIU": "nivel-nao"
};

let supervisaoSelecionada = null;
let tipoAtual = "analistas";

function isCoord() {
  return cargo === "Leticia Caroline Da Silva";
}

// ===========================
//   INICIALIZAÇÃO
// ===========================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("supNome").innerText = nome;
  document.getElementById("btnSair").onclick = () => (window.location.href = "index.html");

  // Aba eventos
  document.getElementById("tabAnal").onclick = () => selecionarAba("analistas");
  document.getElementById("tabAux").onclick = () => selecionarAba("auxiliares");

  if (isCoord()) montarMenuCoord();
  else iniciarSupervisor();
});

// ===========================
//   COORDENAÇÃO
// ===========================
function montarMenuCoord() {
  const menu = document.getElementById("menuCoord");
  const divBtns = document.getElementById("coordBtns");

  menu.style.display = "block";

  SUPERVISORES.forEach(sup => {
    const btn = document.createElement("button");
    btn.className = "sup-btn";
    btn.innerText = sup;
    btn.onclick = () => selecionarSupervisora(sup);
    divBtns.appendChild(btn);
  });
}

function selecionarSupervisora(sup) {
  supervisaoSelecionada = sup;
  document.getElementById("menuCoord").style.display = "none";

  document.getElementById("tabsRow").style.display = "flex";
  selecionarAba("analistas");
}

// ===========================
//   SUPERVISOR
// ===========================
function iniciarSupervisor() {
  supervisaoSelecionada = nome;
  document.getElementById("tabsRow").style.display = "flex";
  selecionarAba("analistas");
}

// ===========================
//   AÇÃO SELECIONAR ABA
// ===========================
function selecionarAba(tipo) {
  tipoAtual = tipo;

  document.getElementById("tabAnal").classList.remove("active");
  document.getElementById("tabAux").classList.remove("active");

  if (tipo === "analistas") document.getElementById("tabAnal").classList.add("active");
  else document.getElementById("tabAux").classList.add("active");

  carregarRelatorio(tipo);
}

// ===========================
//   CARREGAR API /api/gestao
// ===========================
async function carregarRelatorio(tipo) {
  if (!supervisaoSelecionada) return;

  document.getElementById("cardArea").style.display = "block";
  document.getElementById("tabelaBody").innerHTML =
    `<tr><td colspan="6">Carregando...</td></tr>`;

  const url =
    `/api/gestao?tipo=${encodeURIComponent(tipo)}&supervisao=${encodeURIComponent(supervisaoSelecionada)}&cargo=${encodeURIComponent(nome)}`;

  const resp = await fetch(url);
  const dados = await resp.json();

  const lista = tipo === "analistas" ? dados.analistas : dados.auxiliares;
  montarTabela(lista || []);
}

// ===========================
//   MONTAR TABELA
// ===========================
function montarTabela(lista) {
  if (!lista.length) {
    document.getElementById("tabelaBody").innerHTML =
      `<tr><td colspan="6">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  let html = "";
  lista.forEach(row => {
    const nivelClass = CORES_NIVEL[(row.nivel || "").toUpperCase()] || "";

    html += `
      <tr>
        <td>${row.nome}</td>
        <td>${row.tma || row.eficiencia || ""}</td>
        <td>${row.tme || row.vrep || ""}</td>
        <td>${row.tempoProd || ""}</td>
        <td>${row.abs || ""}</td>
        <td style="text-align:center;">
          <span class="badge ${nivelClass}">${row.nivel}</span>
        </td>
      </tr>`;
  });

  document.getElementById("tabelaBody").innerHTML = html;
}
