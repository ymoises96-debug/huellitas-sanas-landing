// Huellitas Sanas - Landing de campaña de temporada con reservas por cupos (Express)
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: false }));

// ---- Configuración (todo desde variables de entorno, sin secretos en el código) ----
const PORT = process.env.PORT || 3000;
const LEADS_FILE = process.env.LEADS_FILE || path.join(__dirname, "leads.json");
const CUPOS_POR_DIA = parseInt(process.env.CUPOS_POR_DIA || "8", 10);
const FECHA_LIMITE = process.env.FECHA_LIMITE || "2026-12-20"; // AAAA-MM-DD
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // opcional: si existe, /admin pide ?token=

const OFERTA = {
  titulo: "Chequeo Preventivo de Fin de Año",
  descripcion: "Consulta general + desparasitación + limpieza dental o baño medicado de temporada.",
  precioNormal: 85,
  precioPromo: 49,
  moneda: "S/",
};

const DIAS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ---- Utilidades ----
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function isoLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function etiqueta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  return `${DIAS_ES[f.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

// Días de campaña: desde hoy hasta la fecha límite, sin domingos
function diasCampania() {
  const dias = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (isoLocal(d) <= FECHA_LIMITE) {
    if (d.getDay() !== 0) dias.push(isoLocal(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

function cargarLeads() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
  } catch {
    return [];
  }
}

// ---- Leads de ejemplo (ficticios) en memoria ----
// No se guardan en leads.json: se recrean siempre, aunque Railway reinicie el servidor.
// Usan los primeros días disponibles de la campaña para que siempre se vean cupos descontados.
// Para desactivarlos: variable de entorno DEMO_LEADS=0
const DEMO_ACTIVO = process.env.DEMO_LEADS !== "0";
const DEMO_BASE = [
  { nombre: "María López (ejemplo)", telefono: "900 000 001", mascota: "Luna, gata - baño medicado", diaIdx: 0 },
  { nombre: "Carlos Pérez (ejemplo)", telefono: "900 000 002", mascota: "Rocky, perro - limpieza dental", diaIdx: 0 },
  { nombre: "Ana Torres (ejemplo)", telefono: "900 000 003", mascota: "Toby, perro - limpieza dental", diaIdx: 0 },
  { nombre: "Jorge Ramos (ejemplo)", telefono: "900 000 004", mascota: "Michi, gato - baño medicado", diaIdx: 1 },
];

function leadsDemo() {
  if (!DEMO_ACTIVO) return [];
  const dias = diasCampania();
  return DEMO_BASE.filter((l) => dias[l.diaIdx]).map((l, i) => ({
    id: `demo-${i + 1}`,
    nombre: l.nombre,
    telefono: l.telefono,
    mascota: l.mascota,
    dia: dias[l.diaIdx],
    creado: "ejemplo",
    demo: true,
  }));
}

// Leads reales (archivo) + leads de ejemplo (memoria)
const todosLosLeads = () => [...leadsDemo(), ...cargarLeads()];

function guardarLeads(leads) {
  const tmp = LEADS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(leads, null, 2), "utf8");
  fs.renameSync(tmp, LEADS_FILE); // escritura atómica
}

function cuposRestantes(leads) {
  const usados = {};
  for (const l of leads) usados[l.dia] = (usados[l.dia] || 0) + 1;
  const cupos = {};
  for (const d of diasCampania()) cupos[d] = CUPOS_POR_DIA - (usados[d] || 0);
  return cupos;
}

// ---- Plantilla base ----
function layout(titulo, contenido) {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>
:root{--verde:#2e8b6e;--verde-osc:#1f6650;--naranja:#ff8a3d;--fondo:#f6faf8;--texto:#24343a}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--fondo);color:var(--texto);line-height:1.5}
header{background:var(--verde);color:#fff;padding:14px 20px;font-weight:700;font-size:1.2rem}
.wrap{max-width:960px;margin:0 auto;padding:24px 20px 60px}
.hero{display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:start}
@media(max-width:760px){.hero{grid-template-columns:1fr}}
.badge{display:inline-block;background:var(--naranja);color:#fff;padding:4px 12px;border-radius:999px;font-size:.85rem;font-weight:700}
h1{font-size:2.1rem;line-height:1.15;margin:12px 0}
.precio{margin:18px 0}
.tachado{text-decoration:line-through;color:#8a9a9f;font-size:1.3rem;margin-right:10px}
.promo{font-size:2.6rem;font-weight:800;color:var(--verde-osc)}
.ahorro{color:var(--naranja);font-weight:700;margin-left:8px}
.aviso{background:#fff4e8;border-left:4px solid var(--naranja);padding:10px 14px;border-radius:6px}
.card{background:#fff;border-radius:14px;padding:22px;box-shadow:0 6px 24px rgba(0,0,0,.07)}
label{display:block;font-weight:600;margin:12px 0 4px}
input,select{width:100%;padding:11px;border:1px solid #cdd9d5;border-radius:8px;font-size:1rem}
button{margin-top:18px;width:100%;padding:14px;background:var(--naranja);color:#fff;border:0;border-radius:10px;font-size:1.1rem;font-weight:700;cursor:pointer}
button:hover{filter:brightness(.95)}
.error{background:#fde8e8;color:#9b1c1c;padding:10px;border-radius:8px}
table{width:100%;border-collapse:collapse;background:#fff;margin-bottom:28px}
th,td{padding:8px 10px;border-bottom:1px solid #e3ebe8;text-align:left;font-size:.95rem}
th{background:#e8f3ef}
.lleno{color:#9b1c1c;font-weight:700}
footer{text-align:center;color:#7a8a8f;font-size:.85rem;padding:20px}
</style></head>
<body>
<header>🐾 Huellitas Sanas · Veterinaria</header>
<main class="wrap">${contenido}</main>
<footer>Huellitas Sanas · Cuidamos a quien más quieres</footer>
</body></html>`;
}

function paginaInicio(error = null, form = {}) {
  const cupos = cuposRestantes(todosLosLeads());
  const dias = diasCampania();
  const descuento = Math.round(100 - (OFERTA.precioPromo * 100) / OFERTA.precioNormal);
  const [fy, fm, fd] = FECHA_LIMITE.split("-");

  const opciones = dias.map((d) => {
    const c = cupos[d];
    return `<option value="${d}" ${c <= 0 ? "disabled" : ""} ${form.dia === d ? "selected" : ""}>
      ${etiqueta(d)} — ${c > 0 ? `${c} cupos libres` : "AGOTADO"}</option>`;
  }).join("");

  const formulario = dias.length ? `
    <form method="post" action="/reservar">
      <label for="nombre">Tu nombre</label>
      <input id="nombre" name="nombre" maxlength="80" required value="${esc(form.nombre)}">
      <label for="telefono">Teléfono / WhatsApp</label>
      <input id="telefono" name="telefono" type="tel" maxlength="20" required placeholder="999 999 999" value="${esc(form.telefono)}">
      <label for="mascota">Mascota y servicio</label>
      <input id="mascota" name="mascota" maxlength="100" required placeholder="Ej: Rocky, perro - limpieza dental" value="${esc(form.mascota)}">
      <label for="dia">Día preferido</label>
      <select id="dia" name="dia" required><option value="">Elige un día…</option>${opciones}</select>
      <button type="submit">¡Quiero mi cupo!</button>
    </form>` : `<p>La campaña ya terminó. ¡Gracias por tu interés! Escríbenos para la próxima.</p>`;

  return layout(`${OFERTA.titulo} · Huellitas Sanas`, `
  <section class="hero">
    <div>
      <span class="badge">Campaña de temporada · -${descuento}%</span>
      <h1>${esc(OFERTA.titulo)}</h1>
      <p>${esc(OFERTA.descripcion)}</p>
      <div class="precio">
        <span class="tachado">${OFERTA.moneda} ${OFERTA.precioNormal}</span>
        <span class="promo">${OFERTA.moneda} ${OFERTA.precioPromo}</span>
        <span class="ahorro">Ahorras ${OFERTA.moneda} ${OFERTA.precioNormal - OFERTA.precioPromo}</span>
      </div>
      <ul>
        <li>Examen clínico completo con médico veterinario</li>
        <li>Desparasitación interna</li>
        <li>A elegir: limpieza dental <b>o</b> baño medicado de temporada</li>
      </ul>
      <p class="aviso">⏰ Válido hasta el <b>${fd}/${fm}/${fy}</b>. Solo <b>${CUPOS_POR_DIA} cupos por día</b> para atender a cada mascota con calma.</p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Reserva tu cupo</h2>
      ${error ? `<p class="error">${esc(error)}</p>` : ""}
      ${formulario}
    </div>
  </section>`);
}

// ---- Rutas ----
app.get("/", (req, res) => res.send(paginaInicio()));

app.post("/reservar", (req, res) => {
  const form = {};
  for (const k of ["nombre", "telefono", "mascota", "dia"]) form[k] = String(req.body[k] || "").trim();

  let error = null;
  if (!Object.values(form).every(Boolean)) error = "Por favor completa todos los campos.";
  else if (form.nombre.length > 80 || form.mascota.length > 100) error = "Algún campo es demasiado largo.";
  else if (!/^[\d\s+()-]{7,20}$/.test(form.telefono)) error = "Ingresa un teléfono/WhatsApp válido (solo números).";

  if (!error) {
    // Node ejecuta este bloque síncrono sin interrupciones: dos reservas no pueden tomar el mismo último cupo.
    const leads = cargarLeads(); // solo reales: los de ejemplo nunca se escriben al archivo
    const cupos = cuposRestantes([...leadsDemo(), ...leads]);
    if (!(form.dia in cupos)) error = "El día elegido no es válido o ya pasó.";
    else if (cupos[form.dia] <= 0) error = "¡Uy! Ese día se acaba de llenar. Elige otro día, por favor.";
    else {
      leads.push({ id: leads.length + 1, ...form, creado: new Date().toISOString() });
      guardarLeads(leads);
      const q = new URLSearchParams({ nombre: form.nombre, mascota: form.mascota, dia: form.dia });
      return res.redirect(303, `/gracias?${q}`);
    }
  }
  res.status(400).send(paginaInicio(error, form));
});

app.get("/gracias", (req, res) => {
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dia || "") ? etiqueta(req.query.dia) : "";
  res.send(layout("¡Reserva confirmada! · Huellitas Sanas", `
  <div class="card" style="max-width:560px;margin:30px auto;text-align:center">
    <div style="font-size:3rem">🐶🐱</div>
    <h1>¡Listo, ${esc(req.query.nombre)}!</h1>
    <p>Separamos tu cupo para <b>${esc(req.query.mascota)}</b> el <b>${esc(dia)}</b>.</p>
    <p>Te escribiremos por WhatsApp para confirmar la hora. ¡Gracias por confiar en Huellitas Sanas! 💚</p>
    <p><a href="/">← Volver al inicio</a></p>
  </div>`));
});

app.get("/admin", (req, res) => {
  if (ADMIN_TOKEN && req.query.token !== ADMIN_TOKEN) return res.status(403).send("Acceso denegado");
  const leads = todosLosLeads();
  const cupos = cuposRestantes(leads);

  const filasCupos = Object.entries(cupos).map(([d, c]) => `
    <tr><td>${etiqueta(d)}</td><td>${CUPOS_POR_DIA - c}</td>
    <td class="${c <= 0 ? "lleno" : ""}">${c > 0 ? c : "AGOTADO"}</td></tr>`).join("");

  const filasLeads = [...leads].reverse().map((l) => `
    <tr style="${l.demo ? "color:#8a9a9f;font-style:italic" : ""}"><td>${esc(l.id)}</td><td>${esc(l.nombre)}</td><td>${esc(l.telefono)}</td>
    <td>${esc(l.mascota)}</td><td>${esc(l.dia)}</td><td>${esc(l.creado)}</td></tr>`).join("");

  res.send(layout("Admin · Huellitas Sanas", `
    <h1>Panel de reservas</h1>
    <p>Total de leads: <b>${leads.length}</b></p>
    <h2>Cupos por día</h2>
    <table><tr><th>Día</th><th>Reservas</th><th>Cupos restantes</th></tr>${filasCupos}</table>
    <h2>Leads</h2>
    ${leads.length ? `<table><tr><th>#</th><th>Nombre</th><th>WhatsApp</th><th>Mascota / servicio</th><th>Día</th><th>Registrado</th></tr>${filasLeads}</table>`
      : "<p>Aún no hay reservas.</p>"}`));
});

app.listen(PORT, () => console.log(`Huellitas Sanas escuchando en http://localhost:${PORT}`));
