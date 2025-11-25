const { google } = require("googleapis");

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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

    // ===============================
    // 1) BUSCA NA ABA USUARIOS
    // ===============================
    const usuariosData = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Usuarios!A2:D",
    });

    const usuarios = usuariosData.data.values || [];

    const user = usuarios.find(
      (u) =>
        String(u[0]).trim().toLowerCase() === usuario.toLowerCase() &&
        String(u[1]).trim() === senha
    );

    if (!user) {
      return res.status(401).json({ erro: "Usuário ou senha incorretos." });
    }

    const nome = user[0];
    const cargo = user[2];
    const supervisor = user[3] || "";

    // ===============================
    // LOGIN DE ANALISTA DE COP
    // ===============================
    if (cargo === "ANALISTA DE COP") {
      const analistas = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Relatorio Analistas!A2:O",
      });

      const row = (analistas.data.values || []).find(
        (r) => String(r[1]).trim().toLowerCase() === usuario.toLowerCase()
      );

      if (!row) return res.json({ erro: "Dados não encontrados." });

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
      });
    }

    // ===============================
    // LOGIN DE AUXILIAR DE COP
    // ===============================
    if (cargo === "AUXILIAR DE COP") {
      const aux = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Relatorio Auxiliares!A2:O",
      });

      const row = (aux.data.values || []).find(
        (r) => String(r[0]).trim().toLowerCase() === usuario.toLowerCase()
      );

      if (!row) return res.json({ erro: "Dados não encontrados." });

      return res.json({
        tipo: "auxiliar",
        nome: row[0] || "",
        EFICIENCIA: row[2] || "",
        VREP: row[3] || "",
        PercentualABS: row[4] || "",
        PercentualSalario: row[9] || "",
        Nivel: row[10] || "",
        Status: row[14] || "",
      });
    }

    // ===============================
    // SUPERVISORA OU COORDENADORA
    // ===============================
    const subordinados =
      cargo === "COORDENADORA"
        ? usuarios.filter((u) => u[2] !== "COORDENADORA") // todos menos coordenação
        : usuarios.filter((u) => u[3] === nome); // subordinados da supervisora

    const analistasSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Analistas!A2:O",
    });

    const auxiliaresSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Relatorio Auxiliares!A2:O",
    });

    const analistasRows = analistasSheet.data.values || [];
    const auxiliaresRows = auxiliaresSheet.data.values || [];

    let lista = [];

    for (let sub of subordinados) {
      const nomeSub = sub[0];
      const cargoSub = sub[2];

      if (cargoSub === "ANALISTA DE COP") {
        const row = analistasRows.find((r) => r[0] === nomeSub);
        if (row)
          lista.push({
            nome: row[0],
            cargo: cargoSub,
            status: row[14] || "",
          });
      }

      if (cargoSub === "AUXILIAR DE COP") {
        const row = auxiliaresRows.find((r) => r[0] === nomeSub);
        if (row)
          lista.push({
            nome: row[0],
            cargo: cargoSub,
            status: row[14] || "",
          });
      }
    }

    // ===============================
    // ORDENACAO POR STATUS
    // ===============================
    const ordem = {
      "Superação": 1,
      "Definida": 2,
      "Tolerável": 3,
      "Não atingiu": 4,
      "": 5,
    };

    lista.sort((a, b) => (ordem[a.status] || 9) - (ordem[b.status] || 9));

    return res.json({
      tipo: cargo.toLowerCase(),
      nome,
      subordinados: lista,
    });

  } catch (e) {
    console.error("Erro API /api/login:", e);
    return res.status(500).json({ erro: e.message });
  }
};
