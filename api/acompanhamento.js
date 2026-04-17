const { google } = require("googleapis");

const SUPERVISORES_LIST = [
  "Erika Silvestre Nunes",
  "Joyce Francieli Silva",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Layra da Silva Reginaldo",
  "Leticia Caroline Da Silva" // ✅ adicionada
];

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:
        process.env.GOOGLE_PRIVATE_KEY &&
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Lê uma aba e retorna array de objetos { nome, nivel, supervisao, cargo }
async function lerAba(sheets, sheetId, range, tipo) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  const rows = resp.data.values || [];

  return rows.map(row => {
    if (tipo === "analistas") {
      return {
        nome: row[0] || "",
        nivel: (row[14] || "").toUpperCase().trim(),
        supervisao: row[15] || "",
        cargo: "analista"
      };
    } else {
      return {
        nome: row[0] || "",
        nivel: (row[10] || "").toUpperCase().trim(),
        supervisao: row[11] || "",
        cargo: "auxiliar"
      };
    }
  }).filter(r => r.nome);
}

module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const cargo = (query.cargo || "").trim();
    const supervisao = query.supervisao || "";

    // ✅ corrigido com normalize
    const isCoord = normalize(cargo) === normalize("Leticia Caroline Da Silva");

    const isSupervisora = SUPERVISORES_LIST
      .map(normalize)
      .includes(normalize(cargo));

    if (!isCoord && !isSupervisora) {
      return res.status(403).json({ erro: "Acesso não autorizado." });
    }

    const targetSup = supervisao || (isSupervisora ? cargo : null);

    const sheets = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;

    const [
      analistasAtual,
      auxAtual,
      analistasM1,
      auxM1,
      analistasM2,
      auxM2
    ] = await Promise.all([
      lerAba(sheets, sheetId, "Relatorio Analistas!A2:P", "analistas"),
      lerAba(sheets, sheetId, "Relatorio Auxiliares!A2:L", "auxiliares"),
      lerAba(sheets, sheetId, "META M-1 Analistas!A2:P", "analistas"),
      lerAba(sheets, sheetId, "META M-1 Auxiliares!A2:L", "auxiliares"),
      lerAba(sheets, sheetId, "META M-2 Analistas!A2:P", "analistas"),
      lerAba(sheets, sheetId, "META M-2 Auxiliares!A2:L", "auxiliares"),
    ]);

    function buildMap(arr) {
      const map = {};
      arr.forEach(r => {
        map[normalize(r.nome)] = {
          nivel: r.nivel,
          supervisao: r.supervisao
        };
      });
      return map;
    }

    const mapAtualAnal = buildMap(analistasAtual);
    const mapAtualAux  = buildMap(auxAtual);
    const mapM1Anal    = buildMap(analistasM1);
    const mapM1Aux     = buildMap(auxM1);
    const mapM2Anal    = buildMap(analistasM2);
    const mapM2Aux     = buildMap(auxM2);

    const NIVEL_ORDER = {
      "SUPERAÇÃO": 1,
      "DEFINIDA": 2,
      "TOLERÁVEL": 3,
      "NÃO ATINGIU": 4
    };

    function calcTendencia(m2, m1, atual) {
      const v2 = NIVEL_ORDER[m2] || 0;
      const v1 = NIVEL_ORDER[m1] || 0;
      const va = NIVEL_ORDER[atual] || 0;

      if (!v2 && !v1 && !va) return "sem_dados";

      const vals = [v2, v1, va].filter(v => v > 0);

      if (vals.length < 2) return "neutro";

      const primeiro = vals[0];
      const ultimo = vals[vals.length - 1];

      if (ultimo < primeiro) return "melhora";
      if (ultimo > primeiro) return "piora";

      if (vals.length === 3 && (vals[1] !== vals[0] || vals[1] !== vals[2])) {
        return "instavel";
      }

      return "estavel";
    }

    function montarColaboradores(mapAtual, mapM1, mapM2, tipoStr, supervisorFiltro) {
      const todos = Object.entries(mapAtual)
        .filter(([nome, data]) => {
          if (!supervisorFiltro) return true;
          return normalize(data.supervisao) === normalize(supervisorFiltro);
        })
        .map(([nomeNorm, data]) => {
          const nomeOriginal = (tipoStr === "analista" ? analistasAtual : auxAtual)
            .find(r => normalize(r.nome) === nomeNorm)?.nome || nomeNorm;

          const m2 = mapM2[nomeNorm]?.nivel || "";
          const m1 = mapM1[nomeNorm]?.nivel || "";
          const atual = data.nivel || "";

          return {
            nome: nomeOriginal,
            cargo: tipoStr,
            supervisao: data.supervisao,
            historico: { m2, m1, atual },
            tendencia: calcTendencia(m2, m1, atual)
          };
        });

      return todos;
    }

    function montarPorSupervisao(sup) {
      const analistas = montarColaboradores(mapAtualAnal, mapM1Anal, mapM2Anal, "analista", sup);
      const auxiliares = montarColaboradores(mapAtualAux, mapM1Aux, mapM2Aux, "auxiliar", sup);
      return { analistas, auxiliares };
    }

    if (isCoord && !targetSup) {
      const resultado = {};
      for (const sup of SUPERVISORES_LIST) {
        resultado[sup] = montarPorSupervisao(sup);
      }
      return res.json({ supervisores: resultado });
    }

    const sup = targetSup;
    return res.json({ supervisao: sup, ...montarPorSupervisao(sup) });

  } catch (e) {
    console.error("Erro acompanhamento:", e);
    return res.status(500).json({ erro: e.message });
  }
};
