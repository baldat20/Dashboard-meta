// /api/gestao.js
const { google } = require("googleapis");

// ----------------------------------------
// LISTA FIXA DAS SUPERVISORAS
// ----------------------------------------
const SUPERVISORES_LIST = [
  "Erika Silvestre Nunes",
  "Agata Angel Pereira Oliveira",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Layra da Silva Reginaldo"
];

// ----------------------------------------
// ORDEM DE PRIORIDADE DO NÍVEL
// ----------------------------------------
const NIVEL_ORDER = {
  "SUPERAÇÃO": 1,
  "DEFINIDA": 2,
  "TOLERÁVEL": 3,
  "NÃO ATINGIU": 4
};

// ----------------------------------------
// NORMALIZA TEXTO (remove acentos, espaços extras, maiúsculas/minúsculas)
// ESSA PARTE CORRIGE O PROBLEMA DO PROC-V
// ----------------------------------------
function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ----------------------------------------
// ORDENAÇÃO POR NÍVEL
// ----------------------------------------
function sortByNivel(a, b) {
  const aRank = NIVEL_ORDER[(a.nivel || "").toUpperCase()] || 999;
  const bRank = NIVEL_ORDER[(b.nivel || "").toUpperCase()] || 999;
  if (aRank !== bRank) return aRank - bRank;
  return (a.nome || "").localeCompare(b.nome || "");
}

// ----------------------------------------
// AUTENTICAÇÃO GOOGLE SHEETS
// ----------------------------------------
async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:
        process.env.GOOGLE_PRIVATE_KEY &&
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

// ----------------------------------------
// ENDPOINT PRINCIPAL
// ----------------------------------------
module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;

    const tipo = (query.tipo || "").toLowerCase(); 
    const supervisao = query.supervisao || ""; 
    const cargo = (query.cargo || "").trim(); // nome do usuário logado

    const sheets = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;

    if (!sheetId) {
      return res.status(500).json({ erro: "SHEET_ID não configurado." });
    }

    // ----------------------------------------
    // CARREGA ANALISTAS
    // ----------------------------------------
    const analistasResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Analistas!A2:P",
    });

    const analistasRows = analistasResp.data.values || [];

    const analistas = analistasRows.map(row => ({
      usuario: row[0] || "",
      nome: row[0] || "",
      tma: row[4] || "",
      tme: row[5] || "",
      tempoProd: row[6] || "",
      abs: row[7] || "",
      nivel: row[14] || "",
      supervisao: row[15] || ""
    }));

    // ----------------------------------------
    // CARREGA AUXILIARES
    // ----------------------------------------
    const auxiliaresResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Auxiliares!A2:L",
    });

    const auxiliaresRows = auxiliaresResp.data.values || [];

    const auxiliares = auxiliaresRows.map(row => ({
      usuario: row[0] || "",
      nome: row[0] || "",
      eficiencia: row[2] || "",
      vrep: row[3] || "",
      abs: row[4] || "",
      nivel: row[10] || "",
      supervisao: row[11] || ""
    }));

    // ----------------------------------------
    // FUNÇÕES DE FILTRO COM normalize()
    // ----------------------------------------
    function filtrarAnalistasPor(supervisorNome) {
      const target = normalize(supervisorNome);

      return analistas
        .filter(a => normalize(a.supervisao) === target)
        .map(a => ({
          nome: a.nome,
          tma: a.tma,
          tme: a.tme,
          tempoProd: a.tempoProd,
          abs: a.abs,
          nivel: a.nivel
        }))
        .sort(sortByNivel);
    }

    function filtrarAuxiliaresPor(supervisorNome) {
      const target = normalize(supervisorNome);

      return auxiliares
        .filter(a => normalize(a.supervisao) === target)
        .map(a => ({
          nome: a.nome,
          eficiencia: a.eficiencia,
          vrep: a.vrep,
          abs: a.abs,
          nivel: a.nivel
        }))
        .sort(sortByNivel);
    }

    // ----------------------------------------
    // CONTROLE DE ACESSO
    // ----------------------------------------
    const isCoord = cargo === "Leticia Caroline Da Silva";

    // COORDENAÇÃO → todas supervisoras
    if (isCoord && !supervisao) {
      const resultado = {};
      for (const sup of SUPERVISORES_LIST) {
        resultado[sup] = {
          analistas: filtrarAnalistasPor(sup),
          auxiliares: filtrarAuxiliaresPor(sup)
        };
      }
      return res.json({ supervisores: resultado });
    }

    const targetSupervisao = supervisao || cargo;

    // COORDENAÇÃO → supervisão específica
    if (isCoord && SUPERVISORES_LIST.includes(targetSupervisao)) {
      const respObj = {
        supervisao: targetSupervisao,
        analistas: filtrarAnalistasPor(targetSupervisao),
        auxiliares: filtrarAuxiliaresPor(targetSupervisao),
      };

      if (tipo === "analistas") return res.json({ analistas: respObj.analistas });
      if (tipo === "auxiliares") return res.json({ auxiliares: respObj.auxiliares });

      return res.json(respObj);
    }

    // SUPERVISORA
    if (!isCoord && SUPERVISORES_LIST.includes(cargo)) {
      const respObj = {
        supervisao: cargo,
        analistas: filtrarAnalistasPor(cargo),
        auxiliares: filtrarAuxiliaresPor(cargo),
      };

      if (tipo === "analistas") return res.json({ analistas: respObj.analistas });
      if (tipo === "auxiliares") return res.json({ auxiliares: respObj.auxiliares });

      return res.json(respObj);
    }

    // proibido solicitar "Outra Regional"
    if (isCoord && normalize(targetSupervisao) === "outra regional") {
      return res.status(400).json({ erro: "Solicitação para 'Outra Regional' não permitida." });
    }

    return res.status(403).json({ erro: "Acesso não autorizado ou supervisão inválida." });

  } catch (e) {
    console.error("Erro API /api/gestao:", e);
    return res.status(500).json({ erro: e.message });
  }
};
