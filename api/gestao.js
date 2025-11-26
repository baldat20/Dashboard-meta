// /api/gestao.js
const { google } = require("googleapis");

// lista fixa das supervisoras permitidas (conforme combinado)
const SUPERVISORES_LIST = [
  "Erika Silvestre Nunes",
  "Agata Angel Pereira Oliveira",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Layra da Silva Reginaldo",
];

// ordem de prioridade para ordenação por nível
const NIVEL_ORDER = {
  "SUPERAÇÃO": 1,
  "DEFINIDA": 2,
  "TOLERÁVEL": 3,
  "NÃO ATINGIU": 4
};

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

function sortByNivel(a, b) {
  const aRank = NIVEL_ORDER[(a.nivel || "").toUpperCase()] || 999;
  const bRank = NIVEL_ORDER[(b.nivel || "").toUpperCase()] || 999;
  if (aRank !== bRank) return aRank - bRank;
  // fallback: ordenar alfabeticamente pelo nome
  return (a.nome || "").localeCompare(b.nome || "");
}

module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const tipo = (query.tipo || "").toLowerCase(); // 'analistas' | 'auxiliares' | ''
    const supervisao = query.supervisao || ""; // nome da supervisora (opcional)
    const cargo = (query.cargo || "").trim(); // nome do usuário logado, ex: 'Leticia Caroline Da Silva'

    const sheets = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;
    if (!sheetId) {
      return res.status(500).json({ erro: "SHEET_ID não configurado." });
    }

    // --- Carrega Analistas (precisamos até a coluna P) ---
    const analistasResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Analistas!A2:P", // inclui até P (index 15)
    });
    const analistasRows = analistasResp.data.values || [];

    // Mapeia analistas para objetos (sem senha)
    const analistas = analistasRows.map(row => {
      return {
        usuario: row[0] || "",
        // senha = row[2] (col C) existe mas NÃO vamos retornar
        nome: row[0] || "",
        tma: row[4] || "",
        tme: row[5] || "",
        tempoProd: row[6] || "",
        abs: row[7] || "",
        nivel: row[14] || "", // coluna O -> index 14
        supervisao: row[15] || "" // coluna P -> index 15
      };
    });

    // --- Carrega Auxiliares (precisamos até a coluna L) ---
    const auxiliaresResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Auxiliares!A2:L", // inclui até L (index 11)
    });
    const auxiliaresRows = auxiliaresResp.data.values || [];

    const auxiliares = auxiliaresRows.map(row => {
      return {
        usuario: row[0] || "",
        // senha = row[1] (col B) existe mas NÃO vamos retornar
        nome: row[0] || "",
        eficiencia: row[2] || "",
        vrep: row[3] || "",
        abs: row[4] || "",
        nivel: row[10] || "", // coluna K -> index 10
        supervisao: row[11] || "" // coluna L -> index 11
      };
    });

    // Função utilitária de filtro por supervisão (exata)
    function filtrarAnalistasPor(supervisorNome) {
      return analistas
        .filter(a => (a.supervisao || "").trim() === supervisorNome)
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
      return auxiliares
        .filter(a => (a.supervisao || "").trim() === supervisorNome)
        .map(a => ({
          nome: a.nome,
          eficiencia: a.eficiencia,
          vrep: a.vrep,
          abs: a.abs,
          nivel: a.nivel
        }))
        .sort(sortByNivel);
    }

    // Se cargo indica coordenação (Leticia) e não foi passada uma supervisao específica,
    // devolvemos os dados agrupados por supervisora (excluindo "Outra Regional")
    const isCoord = cargo === "Leticia Caroline Da Silva";

    // Se coordenação sem supervisao e sem tipo => retorna grouped para todas as supervisoras
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

    // Caso seja coordenação com supervisao explicita OU supervisor comum:
    // Se supervisao está presente, usamos ela; senão usamos cargo (usuário logado é supervisor)
    const targetSupervisao = supervisao || cargo;

    // Se for coordenacao e o targetSupervisao for um dos supervisoras válidos:
    if (isCoord && targetSupervisao && SUPERVISORES_LIST.includes(targetSupervisao)) {
      // retorna somente a supervisao solicitada
      const respObj = {
        supervisao: targetSupervisao,
        analistas: filtrarAnalistasPor(targetSupervisao),
        auxiliares: filtrarAuxiliaresPor(targetSupervisao)
      };

      if (tipo === "analistas") return res.json({ analistas: respObj.analistas });
      if (tipo === "auxiliares") return res.json({ auxiliares: respObj.auxiliares });
      return res.json(respObj);
    }

    // Se não for coordenação, pode ser uma supervisora (cargo = nome da supervisora)
    if (!isCoord && SUPERVISORES_LIST.includes(cargo)) {
      const respObj = {
        supervisao: cargo,
        analistas: filtrarAnalistasPor(cargo),
        auxiliares: filtrarAuxiliaresPor(cargo)
      };

      if (tipo === "analistas") return res.json({ analistas: respObj.analistas });
      if (tipo === "auxiliares") return res.json({ auxiliares: respObj.auxiliares });
      return res.json(respObj);
    }

    // Caso seja coordenação mas o targetSupervisao não seja da lista (ou um request específico por supervisao),
    // respondemos com erro amigável.
    // Também protegemos contra retorno de "Outra Regional".
    if (isCoord && targetSupervisao && targetSupervisao === "Outra Regional") {
      return res.status(400).json({ erro: "Solicitação para 'Outra Regional' não permitida." });
    }

    // Se chegou aqui e não cumpriu nenhum caso válido, retorna erro 403
    return res.status(403).json({ erro: "Acesso não autorizado ou supervisão inválida." });

  } catch (e) {
    console.error("Erro API /api/gestao:", e);
    return res.status(500).json({ erro: e.message });
  }
};
