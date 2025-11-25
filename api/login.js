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
    const query = req.method === "GET" ? req.query : req.body;
    const usuario = query.usuario;
    const senha = query.senha;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();

    // ---------------------------------------------------
    // 1) TENTAR LOGAR COMO ANALISTA
    // ---------------------------------------------------
    const analistas = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Analistas!A2:O",
    });

    for (let row of analistas.data.values || []) {
      if (row[0] === usuario && row[1] === senha) {
        return res.json({
          tipo: "analista",
          nome: row[0],
          TMA: row[4],
          TME: row[5],
          TempoProdutivo: row[6],
          PercentualABS: row[7],
          PercentualSalario: row[13],
          Nivel: row[14],
          Status: row[14] ?? ""
        });
      }
    }

    // ---------------------------------------------------
    // 2) TENTAR LOGAR COMO AUXILIAR
    // ---------------------------------------------------
    const auxiliares = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Auxiliares!A2:K",
    });

    for (let row of auxiliares.data.values || []) {
      if (row[0] === usuario && row[1] === senha) {
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

    // ---------------------------------------------------
    // 3) SE NÃO ACHOU NAS DUAS ABAS → LOGIN INVÁLIDO
    // ---------------------------------------------------
    return res.status(401).json({ erro: "Usuário ou senha incorretos." });

  } catch (e) {
    console.error("Erro API /api/login:", e);
    return res.status(500).json({ erro: e.message });
  }
};
