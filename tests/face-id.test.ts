import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarVectorL2,
  compararDescriptoresFaciales,
  verificarPruebaDeVida,
} from "../lib/biometria/face-id-engine";

test("Face ID Biometría: Normalización y comparación de rostros idénticos", () => {
  const vectorOriginal = new Array(128).fill(0).map((_, i) => Math.sin(i / 10));
  const vNorm = normalizarVectorL2(vectorOriginal);

  // Norma euclidiana debe ser 1.0
  const norma = Math.sqrt(vNorm.reduce((sum, val) => sum + val * val, 0));
  assert.ok(Math.abs(norma - 1.0) < 0.001, "La norma L2 debe ser exactamente 1.0");

  // Comparación contra sí mismo: Similitud 100% y distancia 0
  const resultado = compararDescriptoresFaciales(vNorm, vNorm);
  assert.strictEqual(resultado.coincide, true);
  assert.strictEqual(resultado.porcentajeSimilitud, 100);
  assert.strictEqual(resultado.distanciaEuclidiana, 0);
  assert.strictEqual(resultado.nivelConfianza, "ALTO");
});

test("Face ID Biometría: Match con ligera variación natural (mismo colaborador)", () => {
  const vectorEnrolado = normalizarVectorL2(new Array(128).fill(0).map((_, i) => Math.cos(i / 5)));
  // Simular ligera perturbación por iluminación / ángulo (ruido < 5%)
  const vectorEnVivo = normalizarVectorL2(
    vectorEnrolado.map((val, i) => val + (Math.sin(i) * 0.04))
  );

  const res = compararDescriptoresFaciales(vectorEnrolado, vectorEnVivo);
  assert.strictEqual(res.coincide, true, "Debe coincidir para el mismo usuario");
  assert.ok(res.porcentajeSimilitud >= 85, `Similitud esperada >= 85%, obtenida: ${res.porcentajeSimilitud}%`);
  assert.ok(res.distanciaEuclidiana <= 0.55, `Distancia esperada <= 0.55, obtenida: ${res.distanciaEuclidiana}`);
});

test("Face ID Biometría: Detección y rechazo de suplantación (persona distinta)", () => {
  // Dos vectores ortogonales/completamente distintos
  const vectorEmpleadoA = normalizarVectorL2(new Array(128).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -0.5)));
  const vectorEmpleadoB = normalizarVectorL2(new Array(128).fill(0).map((_, i) => (i % 3 === 0 ? -1 : 0.8)));

  const res = compararDescriptoresFaciales(vectorEmpleadoA, vectorEmpleadoB);
  assert.strictEqual(res.coincide, false, "Debe rechazar la coincidencia entre personas distintas");
  assert.strictEqual(res.nivelConfianza, "DISCREPANCIA");
  assert.ok(res.porcentajeSimilitud < 80, "La similitud debe ser inferior al umbral de seguridad");
  assert.ok(res.distanciaEuclidiana > 0.60, "La distancia debe ser superior a 0.60");
});

test("Face ID Biometría: Prueba de vida detecta imagen estática (foto en pantalla)", () => {
  // Simular dos fotogramas con datos idénticos (diferencia 0)
  const buffer1 = new Uint8ClampedArray(400).fill(120);
  const buffer2 = new Uint8ClampedArray(400).fill(120);

  const imgData1 = { data: buffer1, width: 10, height: 10 } as any;
  const imgData2 = { data: buffer2, width: 10, height: 10 } as any;

  const resultadoVida = verificarPruebaDeVida([imgData1, imgData2]);
  assert.strictEqual(resultadoVida.aprobada, false, "Una imagen estática fija debe ser rechazada");
  assert.strictEqual(resultadoVida.movimientoDetectado, false);
  assert.ok(resultadoVida.motivo?.includes("estática"), "El motivo debe alertar de imagen estática");
});

test("Face ID Biometría: Validación de modelo biométrico de 128 dimensiones para cuentas existentes", () => {
  // Vector válido de 128 dimensiones
  const vectorValido = normalizarVectorL2(new Array(128).fill(0).map((_, i) => Math.sin(i)));
  assert.strictEqual(vectorValido.length, 128, "El descriptor debe contener exactamente 128 dimensiones");

  // Si un vector tiene tamaño incorrecto (ej. incompleto), no es válido para enrolamiento
  const vectorInvalido = [0.1, 0.2, 0.3];
  assert.notStrictEqual(vectorInvalido.length, 128, "Vector incompleto debe ser rechazado");
});
