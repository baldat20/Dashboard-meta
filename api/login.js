const { google } = require("googleapis");

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

module.exports = async (req, res) => {
  try {
    // Configurar CORS se necessário
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const query = req.method === "GET" ? req.query : req.body;
    const usuario = query?.usuario;
    const senha = query?.senha;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Credenciais faltando." });
    }

    const sheets = await acessarPlanilha();

    // ---------------------------------------------------
    // INDICADORES PRÉ-DEFINIDOS
    // ---------------------------------------------------
    const indicadoresAnalistas = [
      { indicador: "SUPERAÇÃO", percentual: "110%", TMA: "00:08:00", TME: "00:00:35", tempoProd: "06:20:00", abs: "10%" },
      { indicador: "DEFINIDA", percentual: "100%", TMA: "00:08:40", TME: "00:00:45", tempoProd: "06:20:00", abs: "10%" },
      { indicador: "TOLERÁVEL", percentual: "50%", TMA: "00:09:30", TME: "00:01:00", tempoProd: "06:20:00", abs: "10%" },
    ];

    const indicadoresAuxiliares = [
      { indicador: "SUPERAÇÃO", percentual: "110%", eficiencia: "86.9%", reparo24: "90%", abs: "10%", faixa: "60%" },
      { indicador: "DEFINIDA", percentual: "100%", eficiencia: "81.9%", reparo24: "85%", abs: "10%", faixa: "40%" },
      { indicador: "TOLERÁVEL", percentual: "50%", eficiencia: "76.9%", reparo24: "80%", abs: "10%", faixa: "20%" },
    ];

    // ---------------------------------------------------
    // 1) LOGIN COMO ANALISTA
    // ---------------------------------------------------
    try {
      const analistas = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Relatorio Analistas!A2:O",
      });

      const rowsAnalistas = analistas.data.values || [];
      
      for (let row of rowsAnalistas) {
        if (row[0] === usuario && row[1] === senha) {
          return res.json({
            tipo: "analista",
            nome: row[0] || "",
            TMA: row[4] || "",
            TME: row[5] || "",
            TempoProdutivo: row[6] || "",
            PercentualABS: row[7] || "",
            PercentualSalario: row[13] || "",
            Nivel: row[14] || "",
            Status: row[14] || "",
            indicadores: indicadoresAnalistas
          });
        }
      }
    } catch (sheetError) {
      console.error("Erro ao acessar planilha de analistas:", sheetError);
    }

    // ---------------------------------------------------
    // 2) LOGIN COMO AUXILIAR
    // ---------------------------------------------------
    try {
      const auxiliares = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Relatorio Auxiliares!A2:K",
      });

      const rowsAuxiliares = auxiliares.data.values || [];
      
      for (let row of rowsAuxiliares) {
        if (row[0] === usuario && row[1] === senha) {
          return res.json({
            tipo: "auxiliar",
            nome: row[0] || "",
            EFICIENCIA: row[2] || "",
            VREP: row[3] || "",
            PercentualABS: row[4] || "",
            PercentualSalario: row[9] || "",
            Nivel: row[10] || "",
            Status: row[10] || "",
            indicadores: indicadoresAuxiliares
          });
        }
      }
    } catch (sheetError) {
      console.error("Erro ao acessar planilha de auxiliares:", sheetError);
    }

    // ---------------------------------------------------
    // NÃO ENCONTROU → LOGIN INVÁLIDO
    // ---------------------------------------------------
    return res.status(401).json({ erro: "Usuário ou senha incorretos." });

  } catch (e) {
    console.error("Erro API /api/login:", e);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
};
