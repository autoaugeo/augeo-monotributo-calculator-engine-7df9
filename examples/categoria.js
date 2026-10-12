"use strict";

// Uso: node examples/categoria.js <ingresos anuales> [servicios|venta]
// Ejemplo: node examples/categoria.js 30.000.000 servicios
const fs = require("fs");
const path = require("path");
const engine = require("../engine.js");

const datos = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "monotributo.json"), "utf8"));
const ingresos = engine.parseMonto(process.argv[2]);
const actividad = process.argv[3] === "venta" ? "venta" : "servicios";

if (Number.isNaN(ingresos)) {
  console.error("Uso: node examples/categoria.js <ingresos anuales, ej. 30.000.000> [servicios|venta]");
  process.exit(1);
}

const r = engine.calcular(datos, {ingresos: ingresos, actividad: actividad});
console.log("Tablas vigentes desde " + engine.formatoFecha(datos.vigente_desde) + " (fuente: " + datos.fuente_url + ")");
console.log("Ingresos brutos anuales: " + engine.formatoPesos(ingresos) + " (" + actividad + ")");
if (r.excede) {
  console.log("Supera el máximo de la categoría " + r.ultima + ": queda fuera de la tabla del Monotributo.");
} else {
  console.log("Categoría: " + r.categoria);
  console.log("Cuota mensual total: " + engine.formatoPesos(r.cuota.total));
  console.log("Margen hasta el tope de la categoría: " + engine.formatoPesos(r.margen));
}
console.log("Estimación informativa; verificar en ARCA o con un contador público matriculado.");
