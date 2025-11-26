// gestao.js - Geração dinâmica das visões de supervisão para coordenação

/**
 * FUNÇÃO PRINCIPAL
 * Carrega os dados após login da coordenação e monta as abas por supervisão
 */
async function carregarGestao(dados, usuarioLogado) {
  const secoes = document.getElementById("conteudoGestao");
  secoes.innerHTML = "";

  const supervisoras = [
    "Erika Silvestre Nunes",
    "Agata Angel Pereira Oliveira",
    "Joyce Carla Santos Marques",
    "Renata Ferreira de Oliveira",
    "Layra da Silva Reginaldo"
  ];

  supervisoras.forEach(supervisora => {
    const grupo = filtrarPorSupervisao(dados, supervisora);
    secoes.appendChild(gerarAba(supervisora, grupo));
  });
}

/** FILTRA OS REGISTROS DA SUPERVISÃO */
function filtrarPorSupervisao(dados, supervisao) {
  return dados.filter(linha => linha.supervisao === supervisao);
}

/** GERA UMA ABA COMPLETA (CARD + TABELA) */
function gerarAba(nomeSupervisao, registros) {
  const aba = document.createElement("div");
  aba.className = "aba-supervisao";

  const titulo = document.createElement("h2");
  titulo.textContent = nomeSupervisao;
  titulo.className = "tituloAba";

  const tabela = gerarTabela(registros);

  aba.appendChild(titulo);
  aba.appendChild(tabela);
  return aba;
}

/** GERA TABELA COM CORES AUTOMÁTICAS POR NÍVEL */
function gerarTabela(registros) {
  const tabela = document.createElement("table");
  tabela.className = "tabelaGestao";

  const head = document.createElement("thead");
  head.innerHTML = `
    <tr>
      <th>Nome</th>
      <th>TMA</th>
      <th>TME</th>
      <th>Tempo Prod</th>
      <th>% ABS</th>
      <th>Nível</th>
    </tr>`;

  const body = document.createElement("tbody");

  registros.forEach(r => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.nome}</td>
      <td>${r.tma}</td>
      <td>${r.tme}</td>
      <td>${r.tempoProd}</td>
      <td>${r.abs}</td>
      <td><span class="tagNivel" style="background:${corNivel(r.nivel)};">${r.nivel}</span></td>
    `;

    body.appendChild(tr);
  });

  tabela.appendChild(head);
  tabela.appendChild(body);
  return tabela;
}

/** RETORNA A COR DO NÍVEL */
function corNivel(nivel) {
  switch (nivel?.toUpperCase()) {
    case "SUPERAÇÃO": return "#a129d9";
    case "DEFINIDA": return "#42f554";
    case "TOLERÁVEL": return "#dbd951";
    case "NÃO ATINGIU": return "#db4c42";
    default: return "#cccccc";
  }
}

/** ESTILOS DINÂMICOS */
const estilo = document.createElement("style");
estilo.innerHTML = `
  .aba-supervisao {
    background: #ffffff;
    padding: 20px;
    margin-top: 25px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .tituloAba {
    background: #42a7f5;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 20px;
    margin-bottom: 18px;
  }

  .tabelaGestao {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .tabelaGestao th {
    background: #42a7f5;
    color: white;
    padding: 10px;
  }

  .tabelaGestao td {
    padding: 8px;
    border-bottom: 1px solid #dddddd;
  }

  .tagNivel {
    padding: 4px 10px;
    color: #000;
    border-radius: 6px;
    font-weight: bold;
  }
`;

document.head.appendChild(estilo);
