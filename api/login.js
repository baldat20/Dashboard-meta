const { google } = require("googleapis");

/* --------------------------
   CONEXÃO COM A PLANILHA
-------------------------- */
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

/* --------------------------
   FUNÇÃO PRINCIPAL
-------------------------- */
module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const usuario = (query.usuario || "").trim();
    const senha = (query.senha || "").trim();

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();

    /* --------------------------
       LER A ABA DE USUÁRIOS
    -------------------------- */
    const usuariosResp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "usuarios!A2:E",
    });

    const usuarios = usuariosResp.data.values || [];
    let usuarioEncontrado = null;

    for (let row of usuarios) {
      if (String(row[0]).trim() === usuario && String(row[1]).trim() === senha) {
        usuarioEncontrado = {
          login: row[0],
          nome: row[2],
          cargo: row[3],        // ANALISTA / AUXILIAR / SUP / COORD
          supervisor: row[4] || null, // responsável direto (para filtros)
        };
        break;
      }
    }

    if (!usuarioEncontrado) {
      return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    }

    const cargo = usuarioEncontrado.cargo.toUpperCase();
    const nomeUsuario = usuarioEncontrado.nome;

    /* -----------------------------------
       BUSCAR ABA ANALISTAS (1 vez só)
    ----------------------------------- */
    const analistasResp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Analistas!A2:O",
    });
    const dadosAnalistas = analistasResp.data.values || [];

    /* -----------------------------------
       BUSCAR ABA AUXILIARES (1 vez só)
    ----------------------------------- */
    const auxiliaresResp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Auxiliares!A2:K",
    });
    const dadosAux = auxiliaresResp.data.values || [];

    /* -----------------------------------
       ANALISTA
    ----------------------------------- */
    if (cargo === "ANALISTA COP") {
      const row = dadosAnalistas.find((r) => r[0] === nomeUsuario);

      if (!row)
        return res.status(404).json({ erro: "Dados não encontrados." });

      return res.json({
        tipo: "analista",
        nome: row[0],
        TMA: row[4],
        TME: row[5],
        TempoProdutivo: row[6],
        PercentualABS: row[7],
        PercentualSalario: row[13],
        Nivel: row[14],
        Status: row[14] || "",
      });
    }

    /* -----------------------------------
       AUXILIAR
    ----------------------------------- */
    if (cargo === "AUXILIAR COP") {
      const row = dadosAux.find((r) => r[0] === nomeUsuario);

      if (!row)
        return res.status(404).json({ erro: "Dados não encontrados." });

      return res.json({
        tipo: "auxiliar",
        nome: row[0],
        EFICIENCIA: row[2],
        VREP: row[3],
        PercentualABS: row[4],
        PercentualSalario: row[9],
        Nivel: row[10],
        Status: row[10] || "",
      });
    }

    /* ---------------------------------------------------------
       SUPERVISORES E COORDENAÇÃO → Filtrar subordinados
    --------------------------------------------------------- */

    // Mapeia colaboradores e seus responsáveis (aba usuarios col E)
    const responsaveis = {};
    for (let r of usuarios) {
      const nomeColab = r[2];
      const chefe = r[4] || null;
      responsaveis[nomeColab] = chefe;
    }

    let subordinados = [];

    // Analistas filtrados
    for (let row of dadosAnalistas) {
      const nomeColab = row[0];
      if (responsaveis[nomeColab] === nomeUsuario) {
        subordinados.push({
          nome: nomeColab,
          cargo: "Analista COP",
          status: row[14] || "—",
        });
      }
    }

    // Auxiliares filtrados
    for (let row of dadosAux) {
      const nomeColab = row[0];
      if (responsaveis[nomeColab] === nomeUsuario) {
        subordinados.push({
          nome: nomeColab,
          cargo: "Auxiliar COP",
          status: row[10] || "—",
        });
      }
    }

    return res.json({
      tipo: cargo.toLowerCase(),
      nome: nomeUsuario,
      subordinados,
    });
  } catch (e) {
    console.error("Erro API /api/login:", e);
    return res.status(500).json({ erro: e.message });
  }
};
