const { google } = require("googleapis");

const SUPERVISORES_LIST = [
  "Erika Silvestre Nunes",
  "Joyce Francieli Silva"",
  "Joyce Carla Santos Marques",
  "Renata Ferreira de Oliveira",
  "Layra da Silva Reginaldo"
];

function normalize(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function acessarPlanilha() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function lerAba(sheets, sheetId, range, tipo) {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = resp.data.values || [];
  return rows.map(row => {
    if (tipo === "analistas") {
      return { nome: row[0]||"", tma: row[4]||"", tme: row[5]||"", tempoProd: row[6]||"", abs: row[7]||"", nivel: (row[14]||"").toUpperCase().trim(), supervisao: row[15]||"" };
    } else {
      return { nome: row[0]||"", eficiencia: row[2]||"", vrep: row[3]||"", abs: row[4]||"", nivel: (row[10]||"").toUpperCase().trim(), supervisao: row[11]||"" };
    }
  }).filter(r => r.nome);
}

function parseTime(str) {
  if (!str) return 0;
  const p = String(str).split(":").map(Number);
  return (p[0]||0)*3600 + (p[1]||0)*60 + (p[2]||0);
}
function parsePct(str) {
  return parseFloat(String(str||"0").replace("%","").replace(",",".")) || 0;
}

function indicadoresFora_analista(row) {
  const fora = [];
  if (parseTime(row.tma)       > parseTime("00:08:00")) fora.push("TMA");
  if (parseTime(row.tme)       > parseTime("00:00:35")) fora.push("TME");
  if (parseTime(row.tempoProd) < parseTime("06:20:00")) fora.push("Tempo Prod.");
  if (parsePct(row.abs)        > 10)                    fora.push("ABS");
  return fora;
}
function indicadoresFora_auxiliar(row) {
  const fora = [];
  if (parsePct(row.abs) > 10) fora.push("ABS");
  return fora;
}

const NIVEL_ORDER = { "SUPERAÇÃO": 1, "DEFINIDA": 2, "TOLERÁVEL": 3, "NÃO ATINGIU": 4 };

function calcTendencia(m2, m1, atual) {
  const v2 = NIVEL_ORDER[m2]||0, v1 = NIVEL_ORDER[m1]||0, va = NIVEL_ORDER[atual]||0;
  if (!v2&&!v1&&!va) return "sem_dados";
  const vals = [v2,v1,va].filter(v=>v>0);
  if (vals.length < 2) return "neutro";
  const primeiro = vals[0], ultimo = vals[vals.length-1];
  if (ultimo < primeiro) return "melhora";
  if (ultimo > primeiro) return "piora";
  if (vals.length===3 && (vals[1]!==vals[0]||vals[1]!==vals[2])) return "instavel";
  return "estavel";
}

function buildMap(arr) {
  const map = {};
  arr.forEach(r => { map[normalize(r.nome)] = r; });
  return map;
}

function calcIndicadoresGeraisAux(auxAtual, supervisorFiltro) {
  const lista = supervisorFiltro
    ? auxAtual.filter(r => normalize(r.supervisao) === normalize(supervisorFiltro))
    : auxAtual;
  if (!lista.length) return { eficiencia: null, vrep: null, metaEficiencia: 86.9, metaVrep: 90 };
  const efs   = lista.map(r => parsePct(r.eficiencia)).filter(v => v > 0);
  const vreps = lista.map(r => parsePct(r.vrep)).filter(v => v > 0);
  const media = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : null;
  return { eficiencia: media(efs), vrep: media(vreps), metaEficiencia: 86.9, metaVrep: 90 };
}

module.exports = async (req, res) => {
  try {
    const query = req.method === "GET" ? req.query : req.body;
    const cargo = (query.cargo || "").trim();
    const supervisao = query.supervisao || "";

    const isCoord       = normalize(cargo) === normalize("Leticia Caroline Da Silva");
    const isSupervisora = SUPERVISORES_LIST.map(normalize).includes(normalize(cargo));
    if (!isCoord && !isSupervisora) return res.status(403).json({ erro: "Acesso não autorizado." });

    const targetSup = supervisao || (isSupervisora ? cargo : null);
    const sheets    = await acessarPlanilha();
    const sheetId   = process.env.SHEET_ID;

    const [analistasAtual, auxAtual, analistasM1, auxM1, analistasM2, auxM2] = await Promise.all([
      lerAba(sheets, sheetId, "Relatorio Analistas!A2:P",  "analistas"),
      lerAba(sheets, sheetId, "Relatorio Auxiliares!A2:L", "auxiliares"),
      lerAba(sheets, sheetId, "META M-1 Analistas!A2:P",   "analistas"),
      lerAba(sheets, sheetId, "META M-1 Auxiliares!A2:L",  "auxiliares"),
      lerAba(sheets, sheetId, "META M-2 Analistas!A2:P",   "analistas"),
      lerAba(sheets, sheetId, "META M-2 Auxiliares!A2:L",  "auxiliares"),
    ]);

    const mapAtualAnal = buildMap(analistasAtual);
    const mapAtualAux  = buildMap(auxAtual);
    const mapM1Anal    = buildMap(analistasM1);
    const mapM1Aux     = buildMap(auxM1);
    const mapM2Anal    = buildMap(analistasM2);
    const mapM2Aux     = buildMap(auxM2);

    function montarColaboradores(mapAtual, mapM1, mapM2, tipoStr, supervisorFiltro) {
      return Object.entries(mapAtual)
        .filter(([,data]) => !supervisorFiltro || normalize(data.supervisao) === normalize(supervisorFiltro))
        .map(([nomeNorm, data]) => {
          const src = tipoStr === "analista" ? analistasAtual : auxAtual;
          const nomeOriginal = src.find(r => normalize(r.nome) === nomeNorm)?.nome || nomeNorm;
          const m2 = mapM2[nomeNorm]?.nivel||"", m1 = mapM1[nomeNorm]?.nivel||"", atual = data.nivel||"";
          const tend = calcTendencia(m2, m1, atual);
          const indicadoresFora = (tend==="piora"||tend==="instavel")
            ? (tipoStr==="analista" ? indicadoresFora_analista(data) : indicadoresFora_auxiliar(data))
            : [];
          const base = { nome: nomeOriginal, supervisao: data.supervisao, historico:{m2,m1,atual}, tendencia: tend, indicadoresFora };
          if (tipoStr === "analista") return { ...base, tma:data.tma, tme:data.tme, tempoProd:data.tempoProd, abs:data.abs };
          return { ...base, eficiencia:data.eficiencia, vrep:data.vrep, abs:data.abs };
        });
    }

    function montarPorSupervisao(sup) {
      return {
        analistas:  montarColaboradores(mapAtualAnal, mapM1Anal, mapM2Anal, "analista",  sup),
        auxiliares: montarColaboradores(mapAtualAux,  mapM1Aux,  mapM2Aux,  "auxiliar",  sup),
        indicadoresGeraisAux: calcIndicadoresGeraisAux(auxAtual, sup)
      };
    }

    if (isCoord && !targetSup) {
      const resultado = {};
      for (const sup of SUPERVISORES_LIST) resultado[sup] = montarPorSupervisao(sup);
      return res.json({ supervisores: resultado, indicadoresGeraisAux: calcIndicadoresGeraisAux(auxAtual, null) });
    }

    return res.json({ supervisao: targetSup, ...montarPorSupervisao(targetSup) });

  } catch(e) {
    console.error("Erro acompanhamento:", e);
    return res.status(500).json({ erro: e.message });
  }
};
