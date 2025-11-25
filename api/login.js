const { google } = require("googleapis");

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

module.exports = async (req, res) => {
  try {
    const query = req.method === 'GET' ? req.query : req.body;
    const usuario = query.usuario;
    const senha = query.senha;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();

    // 🔹 LER A ABA DE USUÁRIOS
    const usuarios = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "usuarios!A2:E",
    });

    let usuarioEncontrado = null;
    for (let row of usuarios.data.values || []) {
      if (String(row[0]).trim() === usuario && String(row[1]).trim() === senha) {
        usuarioEncontrado = {
          nome: row[2],
          cargo: row[3],   // ANALISTA DE COP / AUXILIAR DE COP / SUP / COORD
        };
        break;
      }
    }

    if (!usuarioEncontrado) {
      return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    }

    const cargo = usuarioEncontrado.cargo.toUpperCase();

    // ---------------------------------------------------
    // ANALISTAS → Buscar na aba Relatorio Analistas
    // ---------------------------------------------------
    if (cargo === "ANALISTA DE COP") {

      const dadosAnalistas = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Relatorio Analistas!A2:O",
      });

      for (let row of dadosAnalistas.data.values || []) {
        if (row[0] === usuarioEncontrado.nome) {
          return res.json({
            tipo: "analista",
            nome: row[0],
            TMA: row[4],
            TME: row[5],
            TempoProdutivo: row[6],
            PercentualABS: row[7],
            PercentualSalario: row[13],
            Nivel: row[14],
            Status: row[14] ?? "" // se tiver coluna do status
          });
        }
      }
    }

    // ---------------------------------------------------
    // AUXILIARES → Buscar na aba Relatorio Auxiliares
    // ---------------------------------------------------
    if (cargo === "AUXILIAR DE COP") {

      const dadosAux = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Relatorio Auxiliares!A2:K",
      });

      for (let row of dadosAux.data.values || []) {
        if (row[0] === usuarioEncontrado.nome) {
          return res.json({
            tipo: "auxiliar",
            nome: row[0],
            EFICIENCIA: row[2],
            VREP: row[3],
            PercentualABS: row[4],
            PercentualSalario: row[9],
            Nivel: row[10],
            Status: row[10] ?? ""
          });
        }
      }
    }

    // ---------------------------------------------------
    // SUPERVISORES E COORDENAÇÃO
    // ---------------------------------------------------
    const relAnalistas = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Analistas!A2:O",
    });

    const relAux = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Auxiliares!A2:K",
    });

    let subordinados = [];

    for (let row of relAnalistas.data.values || []) {
      subordinados.push({
        nome: row[0],
        cargo: "Analista de COP",
        status: row[14] || "—",
      });
    }

    for (let row of relAux.data.values || []) {
      subordinados.push({
        nome: row[0],
        cargo: "Auxiliar de COP",
        status: row[10] || "—",
      });
    }

    return res.json({
      tipo: cargo.toLowerCase(),
      nome: usuarioEncontrado.nome,
      subordinados
    });

  } catch (e) {
    console.error("Erro API /api/login:", e);
    return res.status(500).json({ erro: e.message });
  }
};
