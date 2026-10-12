# Motor de la Calculadora de Monotributo

Motor de cálculo en JavaScript (sin dependencias, sin red) que, dado un importe de ingresos brutos anuales, devuelve la categoría del Monotributo argentino, la cuota mensual total y el margen hasta el tope de la categoría. Funciona en node y en el navegador.

This project is built and maintained by an automated agent system.

*English summary:* a dependency-free JavaScript engine that maps annual gross income to the Argentine Monotributo category, monthly fee and margin to the category cap, using a JSON copy of the official ARCA table. Informational only; not tax or accounting advice.

## Avisos

- Es una estimación informativa. No es asesoramiento impositivo ni contable.
- Verificar siempre en ARCA o con un contador público matriculado.
- Herramienta independiente: no está afiliada ni avalada por ARCA/AFIP.

## Qué calcula

- Categoría (A a K) según ingresos brutos anuales y, si se cargan, superficie, energía eléctrica, alquileres y precio unitario (venta de cosas muebles).
- Cuota mensual total para servicios o venta de bienes (impuesto integrado + aporte SIPA + obra social).
- Margen en pesos hasta el tope de ingresos de la categoría, calculado en centavos.
- Otras funciones del motor: lectura de importes en formato argentino, próxima recategorización según la regla publicada, proyección mes a mes y plan de facturación.

Si los ingresos superan el máximo de la categoría K, el resultado indica que queda fuera de la tabla. Los importes inválidos (negativos, NaN, texto) lanzan `RangeError`.

## Tablas

- Vigentes desde: 1/08/2026 (`vigente_desde` en `data/monotributo.json`), leídas el 2026-10-05.
- Fuente: https://www.arca.gob.ar/monotributo/categorias.asp

Las tablas se actualizan por semestre: si ARCA publicó valores más nuevos, estos datos están desactualizados.

## Uso

Requiere node 18 o superior.

```
node examples/categoria.js 30.000.000 servicios
node examples/categoria.js 20000000 venta
```

Imprime las tablas usadas, la categoría, la cuota mensual y el margen hasta el tope.

En código:

```js
const engine = require("./engine.js");
const datos = require("./data/monotributo.json");
const r = engine.calcular(datos, {ingresos: 30000000, actividad: "servicios"});
console.log(r.categoria, r.cuota.total, r.margen);
```

## Pruebas

```
node tests/run.js
```

Verifica con asserts de node (sin procesos hijos, sin red, sin escribir archivos) la categoría y la cuota mensual del JSON para A, F y K en servicios y venta, el rechazo de entradas inválidas y que `engine.js` y `data/monotributo.json` sean idénticos byte por byte a las copias del sitio cuando existen (si solo está este directorio, esa comparación se omite con una nota). Imprime una línea `ok` por control y sale con código distinto de cero si algo falla.

## Calculadora en línea

https://augeo-calculadora-de-monotributo-categoria-cuo-7df9.pages.dev/

## Licencia

MIT, titular Augeo. Ver `LICENSE`.
