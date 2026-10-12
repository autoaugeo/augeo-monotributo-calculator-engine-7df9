"use strict";

// Motor de cálculo de la calculadora de Monotributo. Funciones puras, sin DOM.
// En el navegador queda como MonotributoEngine; en node se carga por module.exports.
// Los importes se comparan y se suman en centavos para no arrastrar errores de coma flotante.
var MonotributoEngine = (function () {
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"];

  var PARAMETROS = [
    {id: "ingresos", campo: "ingresos_brutos_anuales_max", soloVenta: false},
    {id: "superficie", campo: "superficie_afectada_max_m2", soloVenta: false},
    {id: "energia", campo: "energia_electrica_anual_max_kw", soloVenta: false},
    {id: "alquileres", campo: "alquileres_anuales_max", soloVenta: false},
    {id: "precioUnitario", campo: "precio_unitario_max_venta_cosas_muebles", soloVenta: true}
  ];

  function centavos(valor) {
    return Math.round(valor * 100);
  }

  function esMonto(valor) {
    return typeof valor === "number" && isFinite(valor) && valor >= 0;
  }

  function falta(valor) {
    return valor === undefined || valor === null || valor === "";
  }

  // "1.500.000", "1500000,50", "1500000.5" o "$ 1.500.000,50" -> número. NaN si no se entiende.
  function parseMonto(texto) {
    if (typeof texto === "number") {
      return esMonto(texto) ? texto : NaN;
    }
    var s = String(falta(texto) ? "" : texto).replace(/[\s$]/g, "");
    if (s === "" || !/^[0-9.,]+$/.test(s)) {
      return NaN;
    }
    var comas = (s.match(/,/g) || []).length;
    var puntos = (s.match(/\./g) || []).length;
    if (comas > 1) {
      return /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s) ? Number(s.replace(/,/g, "")) : NaN;
    }
    if (comas === 1) {
      var partes = s.split(",");
      var enteroValido = /^\d+$/.test(partes[0]) || /^\d{1,3}(\.\d{3})+$/.test(partes[0]);
      if (!enteroValido || !/^\d{1,2}$/.test(partes[1])) {
        return NaN;
      }
      return Number(partes[0].replace(/\./g, "") + "." + partes[1]);
    }
    if (puntos === 0) {
      return Number(s);
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      return Number(s.replace(/\./g, ""));
    }
    if (puntos === 1 && /^\d+\.\d{1,2}$/.test(s)) {
      return Number(s);
    }
    return NaN;
  }

  function formatoNumero(valor, decimales) {
    var d = decimales === undefined ? 2 : decimales;
    var partes = Math.abs(valor).toFixed(d).split(".");
    var entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (valor < 0 ? "-" : "") + entero + (d > 0 ? "," + partes[1] : "");
  }

  function formatoPesos(valor) {
    return "$ " + formatoNumero(valor, 2);
  }

  // "2026-08-01" -> "1/08/2026", como lo escribe ARCA.
  function formatoFecha(iso) {
    var partes = String(iso).split("-");
    return Number(partes[2]) + "/" + partes[1] + "/" + partes[0];
  }

  function nombreMes(mes) {
    return MESES[mes - 1];
  }

  function sumarMeses(periodo, cantidad) {
    var indice = periodo.anio * 12 + (periodo.mes - 1) + cantidad;
    return {anio: Math.floor(indice / 12), mes: (indice % 12) + 1};
  }

  function textoPeriodo(periodo) {
    return nombreMes(periodo.mes) + " de " + periodo.anio;
  }

  // Suma en centavos de lista[desde] a lista[hasta - 1], devuelta en pesos.
  function sumar(lista, desde, hasta) {
    var total = 0;
    for (var i = desde; i < hasta; i += 1) {
      total += centavos(lista[i]);
    }
    return total / 100;
  }

  function esListaDeMontos(lista, largo) {
    return Array.isArray(lista) && lista.length === largo && lista.every(esMonto);
  }

  function cuotaDe(categoria, actividad) {
    return {
      impuesto_integrado: categoria["impuesto_integrado_" + actividad],
      aporte_sipa: categoria.aporte_sipa,
      aporte_obra_social: categoria.aporte_obra_social,
      total: categoria["total_mensual_" + actividad]
    };
  }

  // Índice de la categoría más baja cuyo máximo alcanza para ese valor; -1 si supera a todas.
  function indiceMinimo(categorias, campo, valor) {
    var buscado = centavos(valor);
    for (var i = 0; i < categorias.length; i += 1) {
      if (buscado <= centavos(categorias[i][campo])) {
        return i;
      }
    }
    return -1;
  }

  // entrada: {ingresos, actividad: "servicios" | "venta", superficie, energia, alquileres,
  // precioUnitario}. Solo ingresos es obligatorio. La categoría es la más alta que exige
  // cualquiera de los parámetros cargados; precioUnitario cuenta solo para venta.
  function calcular(datos, entrada) {
    var categorias = datos.categorias;
    var ultima = categorias[categorias.length - 1];
    var actividad = entrada.actividad === "venta" ? "venta" : "servicios";
    if (!esMonto(entrada.ingresos)) {
      throw new RangeError("ingresos: se espera un importe mayor o igual a cero");
    }
    var detalle = [];
    var excedidos = [];
    var indice = 0;
    PARAMETROS.forEach(function (parametro) {
      var valor = entrada[parametro.id];
      if (falta(valor) || (parametro.soloVenta && actividad !== "venta")) {
        return;
      }
      if (!esMonto(valor)) {
        throw new RangeError(parametro.id + ": se espera un número mayor o igual a cero");
      }
      var i = indiceMinimo(categorias, parametro.campo, valor);
      detalle.push({
        parametro: parametro.id,
        valor: valor,
        indice: i,
        categoria: i < 0 ? null : categorias[i].categoria,
        maximo: ultima[parametro.campo]
      });
      if (i < 0) {
        excedidos.push(parametro.id);
      } else if (i > indice) {
        indice = i;
      }
    });
    var base = {
      actividad: actividad,
      ingresos: entrada.ingresos,
      detalle: detalle,
      excedidos: excedidos,
      ultima: ultima.categoria
    };
    if (excedidos.length > 0) {
      base.excede = true;
      base.indice = -1;
      base.categoria = null;
      return base;
    }
    var categoria = categorias[indice];
    var siguiente = categorias[indice + 1];
    base.excede = false;
    base.indice = indice;
    base.categoria = categoria.categoria;
    base.categoriaPorIngresos = detalle[0].categoria;
    base.determinantes = detalle.filter(function (d) {
      return d.indice === indice;
    }).map(function (d) {
      return d.parametro;
    });
    base.cuota = cuotaDe(categoria, actividad);
    base.topeIngresos = categoria.ingresos_brutos_anuales_max;
    base.margen = (centavos(categoria.ingresos_brutos_anuales_max) - centavos(entrada.ingresos)) / 100;
    base.siguiente = siguiente ? siguiente.categoria : null;
    return base;
  }

  function mesesDeRecategorizacion(datos) {
    return datos.recategorizacion.meses.map(function (nombre) {
      return MESES.indexOf(nombre) + 1;
    }).sort(function (a, b) {
      return a - b;
    });
  }

  // hoy: {anio, mes, dia}. Aplica la regla publicada (meses y día límite); no conoce prórrogas.
  function proximaRecategorizacion(datos, hoy) {
    var regla = datos.recategorizacion;
    var meses = mesesDeRecategorizacion(datos);
    var candidatos = [];
    [hoy.anio, hoy.anio + 1].forEach(function (anio) {
      meses.forEach(function (mes) {
        candidatos.push({anio: anio, mes: mes, dia: regla.dia_limite});
      });
    });
    function orden(fecha) {
      return fecha.anio * 10000 + fecha.mes * 100 + fecha.dia;
    }
    var elegida = candidatos.filter(function (c) {
      return orden(c) >= orden(hoy);
    })[0];
    var vigencia = regla.vigencia_de_la_nueva_categoria.filter(function (v) {
      return v.rige_desde_periodo_devengado === nombreMes(elegida.mes);
    })[0];
    return {
      anio: elegida.anio,
      mes: elegida.mes,
      dia: elegida.dia,
      texto: elegida.dia + " de " + nombreMes(elegida.mes) + " de " + elegida.anio,
      rigeDesde: vigencia ? vigencia.rige_desde_periodo_devengado : null,
      rigeHasta: vigencia ? vigencia.rige_hasta_periodo_devengado : null
    };
  }

  // Reparte un total de 12 meses en 12 importes que suman exactamente ese total.
  function historialUniforme(total) {
    var enCentavos = centavos(total);
    var base = Math.floor(enCentavos / 12);
    var resto = enCentavos - base * 12;
    var salida = [];
    for (var i = 0; i < 12; i += 1) {
      salida.push((base + (i < resto ? 1 : 0)) / 100);
    }
    return salida;
  }

  function validarParametros(parametros) {
    var cierre = parametros.cierre_meses_antes;
    if (parametros.ventana_meses !== 12 || !(parametros.meses_proyectados >= 1)) {
      throw new RangeError("parámetros de proyección no válidos");
    }
    if (cierre !== 0 && cierre !== 1) {
      throw new RangeError("cierre_meses_antes tiene que ser 0 o 1");
    }
  }

  // Proyección mes a mes. entrada: {historial: 12 importes (del más viejo al más nuevo),
  // futuros: importes desde el mes `inicio`, inicio: {anio, mes}, actividad y los demás
  // parámetros de calcular}. En cada mes de recategorización se evalúan los 12 meses que
  // terminan `cierre_meses_antes` meses antes, y la categoría que resulta rige desde ese mes.
  function proyectar(datos, parametros, entrada) {
    validarParametros(parametros);
    var n = parametros.ventana_meses;
    var m = parametros.meses_proyectados;
    var cierre = parametros.cierre_meses_antes;
    if (!esListaDeMontos(entrada.historial, n)) {
      throw new RangeError("historial: se esperan " + n + " importes");
    }
    if (!esListaDeMontos(entrada.futuros, m)) {
      throw new RangeError("futuros: se esperan " + m + " importes");
    }
    var serie = entrada.historial.concat(entrada.futuros);
    var mesesRecat = mesesDeRecategorizacion(datos);

    function ventana(fin) {
      return sumar(serie, fin - n + 1, fin + 1);
    }
    function evaluar(total) {
      return calcular(datos, {
        ingresos: total,
        actividad: entrada.actividad,
        superficie: entrada.superficie,
        energia: entrada.energia,
        alquileres: entrada.alquileres,
        precioUnitario: entrada.precioUnitario
      });
    }

    var actual = evaluar(ventana(n - 1));
    var vigente = actual;
    var filas = [];
    var cambios = [];
    var primerExceso = null;
    for (var i = 0; i < m; i += 1) {
      var periodo = sumarMeses(entrada.inicio, i);
      var acumulado = ventana(n + i);
      var segunAcumulado = evaluar(acumulado);
      var esRecat = mesesRecat.indexOf(periodo.mes) >= 0;
      if (esRecat) {
        var evaluada = evaluar(ventana(n + i - cierre));
        if (evaluada.categoria !== vigente.categoria) {
          cambios.push({
            indice: i,
            periodo: periodo,
            desde: vigente.categoria,
            hacia: evaluada.categoria,
            fueraDeTabla: evaluada.excede,
            ingresosEvaluados: evaluada.ingresos,
            cuota: evaluada.excede ? null : evaluada.cuota
          });
        }
        vigente = evaluada;
      }
      var supera = segunAcumulado.excede || (!vigente.excede && segunAcumulado.indice > vigente.indice);
      if (supera && primerExceso === null && !vigente.excede) {
        primerExceso = {indice: i, periodo: periodo, acumulado: acumulado, categoriaVigente: vigente.categoria};
      }
      filas.push({
        indice: i,
        periodo: periodo,
        facturacion: entrada.futuros[i],
        acumulado: acumulado,
        categoriaSegunAcumulado: segunAcumulado.categoria,
        esRecategorizacion: esRecat,
        categoriaVigente: vigente.categoria,
        cuotaVigente: vigente.excede ? null : vigente.cuota.total
      });
    }
    return {
      actual: actual,
      filas: filas,
      cambios: cambios,
      primerCambio: cambios.length > 0 ? cambios[0] : null,
      primerExceso: primerExceso
    };
  }

  // Techo mensual de facturación para quedar en una categoría elegida, mirando solo ingresos.
  // entrada: {categoria: "C", historial: 12 importes, inicio: {anio, mes}}.
  function planFacturacion(datos, parametros, entrada) {
    validarParametros(parametros);
    var n = parametros.ventana_meses;
    var cierre = parametros.cierre_meses_antes;
    if (!esListaDeMontos(entrada.historial, n)) {
      throw new RangeError("historial: se esperan " + n + " importes");
    }
    var categoria = datos.categorias.filter(function (c) {
      return c.categoria === entrada.categoria;
    })[0];
    if (!categoria) {
      throw new RangeError("categoría desconocida: " + entrada.categoria);
    }
    var topeCentavos = centavos(categoria.ingresos_brutos_anuales_max);
    var mesesRecat = mesesDeRecategorizacion(datos);
    // Primera recategorización que todavía deja al menos un mes por facturar dentro de su ventana.
    var i = 0;
    var planificables = 0;
    for (i = 0; i <= n; i += 1) {
      planificables = i - cierre + 1;
      if (mesesRecat.indexOf(sumarMeses(entrada.inicio, i).mes) >= 0 && planificables >= 1) {
        break;
      }
    }
    var yaFacturado = sumar(entrada.historial, planificables, n);
    var disponibleCentavos = topeCentavos - centavos(yaFacturado);
    return {
      categoria: categoria.categoria,
      tope: categoria.ingresos_brutos_anuales_max,
      promedioMensual: Math.floor(topeCentavos / n) / 100,
      recategorizacion: sumarMeses(entrada.inicio, i),
      mesesPlanificables: planificables,
      primerMes: sumarMeses(entrada.inicio, 0),
      ultimoMes: sumarMeses(entrada.inicio, planificables - 1),
      yaFacturadoEnVentana: yaFacturado,
      alcanzable: disponibleCentavos >= 0,
      disponible: disponibleCentavos / 100,
      techoMensual: disponibleCentavos >= 0 ? Math.floor(disponibleCentavos / planificables) / 100 : 0
    };
  }

  // provincia: una entrada de la lista de provincias de los datos Pro.
  // entrada: {categoria, actividad, ingresos}. Devuelve null si la escala no tiene ese caso.
  function estimarProvincia(provincia, entrada) {
    var actividad = entrada.actividad === "venta" ? "venta" : "servicios";
    var fila;
    if (provincia.tipo_de_escala === "por_categoria_de_monotributo") {
      fila = provincia.importes.filter(function (f) {
        return f.categoria === entrada.categoria;
      })[0];
      return fila ? {tipo: "categoria", referencia: fila.categoria, importe: fila[actividad]} : null;
    }
    if (provincia.tipo_de_escala === "por_tramo_de_ingresos_brutos_anuales") {
      if (!esMonto(entrada.ingresos)) {
        return null;
      }
      fila = provincia.importes.filter(function (f) {
        return centavos(entrada.ingresos) <= centavos(f.ingresos_hasta);
      })[0];
      return fila ? {tipo: "tramo", referencia: fila.categoria, importe: fila.importe_mensual} : null;
    }
    return null;
  }

  // direccion: el valor del atributo href del enlace de compra (null si no lo trae).
  // Devuelve true si hay una dirección cargada y el botón de compra se puede mostrar.
  function hayEnlaceDeCompra(direccion) {
    return typeof direccion === "string" && direccion.trim() !== "";
  }

  return {
    MESES: MESES,
    parseMonto: parseMonto,
    formatoNumero: formatoNumero,
    formatoPesos: formatoPesos,
    formatoFecha: formatoFecha,
    nombreMes: nombreMes,
    sumarMeses: sumarMeses,
    textoPeriodo: textoPeriodo,
    sumar: sumar,
    cuotaDe: cuotaDe,
    calcular: calcular,
    proximaRecategorizacion: proximaRecategorizacion,
    historialUniforme: historialUniforme,
    proyectar: proyectar,
    planFacturacion: planFacturacion,
    estimarProvincia: estimarProvincia,
    hayEnlaceDeCompra: hayEnlaceDeCompra
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MonotributoEngine;
}
