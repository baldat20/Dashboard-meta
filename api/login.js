const { google } = require("googleapis");

// ------------------------------------------------------------
// FUNÇÃO PARA ACESSAR A PLANILHA
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// HANDLER PRINCIPAL
// ------------------------------------------------------------
module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const usuario = query.usuario;
    const senha = query.senha;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();

    // ----------------------------------------------------------
    // 0) PRIMEIRO: VALIDAR SE É GESTÃO (ABA 'usuarios')
    // ----------------------------------------------------------
    const usuariosResp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "usuarios!A:C", // A = usuário | B = senha | C = cargo
    });

    const usuarios = usuariosResp.data.values || [];

    const matchGestao = usuarios.find(
      (row) => row[0] === usuario && row[1] === senha
    );

    if (matchGestao) {
      return res.status(200).json({
        success: true,
        perfil: "gestao",
        nome: matchGestao[0],
        cargo: matchGestao[2] || "Gestão",
      });
    }

    // ----------------------------------------------------------
    // INDICADORES PADRÃO — Analistas
    // ----------------------------------------------------------
    const indicadoresAnalistas = [
      {
        indicador: "SUPERAÇÃO",
        percentual: "110%",
        TMA: "00:08:00",
        TME: "00:00:35",
        tempoProd: "06:20:00",
        abs: "10%",
      },
      {
        indicador: "DEFINIDA",
        percentual: "100%",
        TMA: "00:08:40",
        TME: "00:00:45",
        tempoProd: "06:20:00",
        abs: "10%",
      },
      {
        indicador: "TOLERÁVEL",
        percentual: "50%",
        TMA: "00:09:30",
        TME: "00:01:00",
        tempoProd: "06:20:00",
        abs: "10%",
      },
    ];

    // ----------------------------------------------------------
    // INDICADORES PADRÃO — Auxiliares
    // ----------------------------------------------------------
    const indicadoresAuxiliares = [
      {
        indicador: "SUPERAÇÃO",
        percentual: "110%",
        eficiencia: "86.9%",
        reparo24: "90%",
        abs: "10%",
        faixa: "60%",
      },
      {
        indicador: "DEFINIDA",
        percentual: "100%",
        eficiencia: "81.9%",
        reparo24: "85%",
        abs: "10%",
        faixa: "40%",
      },
      {
        indicador: "TOLERÁVEL",
        percentual: "50%",
        eficiencia: "76.9%",
        reparo24: "80%",
        abs: "10%",
        faixa: "20%",
      },
    ];

    // ----------------------------------------------------------
    // 1) LOGIN ANALISTA
    // ----------------------------------------------------------
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
          indicadores: indicadoresAnalistas,
        });
      }
    }

    // ----------------------------------------------------------
    // 2) LOGIN AUXILIAR
    // ----------------------------------------------------------
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
          indicadores: indicadoresAuxiliares,
        });
      }
    }

    // ----------------------------------------------------------
    // NÃO ENCONTROU LOGIN
    // ----------------------------------------------------------
    return res.status(401).json({ erro: "Usuário ou senha incorretos." });
  } catch (e) {
    console.error("Erro API /api/login:", e);
    return res.status(500).json({ erro: e.message });
  }
};
