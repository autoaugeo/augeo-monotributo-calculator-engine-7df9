"use strict";

const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const engine = require("../engine.js");

const raiz = path.join(__dirname, "..");
const datos = JSON.parse(fs.readFileSync(path.join(raiz, "data", "monotributo.json"), "utf8"));

let fallos = 0;
function check(nombre, fn) {
  try {
    fn();
    console.log("ok    " + nombre);
  } catch (e) {
    fallos += 1;
    console.log("FALLA " + nombre + ": " + e.message);
  }
}

function fila(letra) {
  return datos.categorias.filter(function (c) { return c.categoria === letra; })[0];
}

["A", "F", "K"].forEach(function (letra) {
  const c = fila(letra);
  ["servicios", "venta"].forEach(function (actividad) {
    check("categoría " + letra + " (" + actividad + "): categoría y cuota mensual del JSON", function () {
      const r = engine.calcular(datos, {ingresos: c.ingresos_brutos_anuales_max, actividad: actividad});
      assert.strictEqual(r.excede, false);
      assert.strictEqual(r.categoria, letra);
      assert.strictEqual(r.cuota.total, c["total_mensual_" + actividad]);
      assert.strictEqual(r.margen, 0);
    });
  });
});

check("un peso sobre el tope de K queda fuera de la tabla", function () {
  const r = engine.calcular(datos, {ingresos: fila("K").ingresos_brutos_anuales_max + 1, actividad: "servicios"});
  assert.strictEqual(r.excede, true);
  assert.strictEqual(r.categoria, null);
});

check("un peso sobre el tope de A pasa a B", function () {
  const r = engine.calcular(datos, {ingresos: fila("A").ingresos_brutos_anuales_max + 1, actividad: "venta"});
  assert.strictEqual(r.categoria, "B");
});

check("el margen hasta el tope se calcula en centavos", function () {
  const r = engine.calcular(datos, {ingresos: 10000000, actividad: "servicios"});
  assert.strictEqual(r.categoria, "A");
  assert.strictEqual(r.margen, 2009410.45);
});

check("rechaza ingresos negativos, NaN, texto o ausentes", function () {
  [-1, NaN, Infinity, "100", undefined, null].forEach(function (valor) {
    assert.throws(function () {
      engine.calcular(datos, {ingresos: valor, actividad: "servicios"});
    }, RangeError);
  });
});

check("rechaza un parámetro opcional inválido", function () {
  assert.throws(function () {
    engine.calcular(datos, {ingresos: 1000, superficie: -5});
  }, RangeError);
});

check("parseMonto entiende formatos argentinos y rechaza basura", function () {
  assert.strictEqual(engine.parseMonto("1.500.000"), 1500000);
  assert.strictEqual(engine.parseMonto("$ 1.500.000,50"), 1500000.5);
  assert.ok(Number.isNaN(engine.parseMonto("abc")));
  assert.ok(Number.isNaN(engine.parseMonto("")));
  assert.ok(Number.isNaN(engine.parseMonto("1,2,3")));
});

check("el JSON trae la fecha de las tablas y la fuente de ARCA", function () {
  assert.strictEqual(datos.vigente_desde, "2026-08-01");
  assert.ok(datos.fuente_url.indexOf("https://www.arca.gob.ar/") === 0);
});

function compararCopia(nombre, copia, original) {
  check(nombre, function () {
    if (!fs.existsSync(original)) {
      console.log("nota  " + nombre + ": no existe " + path.relative(raiz, original) + " (solo repo/ montado), comparación omitida");
      return;
    }
    assert.ok(fs.readFileSync(copia).equals(fs.readFileSync(original)), "las copias difieren");
  });
}

compararCopia("repo/engine.js idéntico byte por byte a site/engine.js",
  path.join(raiz, "engine.js"), path.join(raiz, "..", "site", "engine.js"));
compararCopia("repo/data/monotributo.json idéntico byte por byte a data/monotributo.json",
  path.join(raiz, "data", "monotributo.json"), path.join(raiz, "..", "data", "monotributo.json"));

if (fallos > 0) {
  console.log(fallos + " control(es) con falla");
  process.exit(1);
}
console.log("TODO OK");
