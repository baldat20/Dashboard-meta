// /api/login.js
const { google } = require("googleapis");

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

module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const usuario = query.usuario;
    const senha = query.senha;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();
    const sheetId = process.env.SHEET_ID;

    // 1) verificar aba usuarios primeiro (A: Usuario | B: Senha | C: Cargo/Nome da pessoa)
    const usuariosResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "usuarios!A:C"
    });
    const usuariosRows = usuariosResp.data.values || [];
    const matchGestao = usuariosRows.find(row => (row[0] === usuario && row[1] === senha));

    if (matchGestao) {
      // matchGestao[0] = Usuario (nome de login), matchGestao[1] = senha, matchGestao[2] = Cargo (p.ex. "Supervisor" ou "Leticia ..."?)
      // Como definimos antes, vamos retornar nome = matchGestao[0] (nome da pessoa) e cargo = matchGestao[2] (cargo texto)
      return res.json({
        success: true,
        perfil: "gestao",
        nome: matchGestao[0],
        cargo: matchGestao[2] || "Gestão"
      });
    }

    // 2) Analistas
    const analResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Analistas!A2:O"
    });
 for (let row of (analResp.data.values || [])) {
  if (row[0] === usuario && row[2] === senha) { // senha dos analistas está na coluna C
    return res.json({
      tipo: "analista",
      nome: row[0],
      TMA: row[4],
      TME: row[5],

      // novos nomes com espaço
      "Tempo Produtivo": row[6],
      "Percentual ABS": row[7],
      "Percentual Salário": row[13],

      Nivel: row[14]
    });
  }
}


    // 3) Auxiliares
    const auxResp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Relatorio Auxiliares!A2:K"
    });
    for (let row of (auxResp.data.values || [])) {
      if (row[0] === usuario && row[1] === senha) { // senha auxiliares está na coluna B
        return res.json({
          tipo: "auxiliar",
          nome: row[0],
          EFICIENCIA: row[2],
          VREP: row[3],
          PercentualABS: row[4],
          PercentualSalario: row[9],
          Nivel: row[10]
        });
      }
    }

    return res.status(401).json({ erro: "Usuário ou senha incorretos." });

  } catch (err) {
    console.error("Erro /api/login:", err);
    return res.status(500).json({ erro: err.message });
  }
};
