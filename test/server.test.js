const test = require("node:test");
const assert = require("node:assert/strict");
const { validEmail, calculateShipping } = require("../server");

test("acepta correos con formato básico válido", () => {
  assert.equal(validEmail("alumno@example.com"), true);
});
test("rechaza correo sin arroba o dominio", () => {
  assert.equal(validEmail("alumnoexample.com"), false);
  assert.equal(validEmail("alumno@"), false);
});
test("rechaza entradas vacías y correos excesivamente largos", () => {
  assert.equal(validEmail(""), false);
  assert.equal(validEmail("x".repeat(250) + "@example.com"), false);
});
test("cobra envío en compras menores a 999", () => {
  assert.equal(calculateShipping(500), 79);
  assert.equal(calculateShipping(998.99), 79);
});
test("el envío es gratis desde 999", () => {
  assert.equal(calculateShipping(999), 0);
  assert.equal(calculateShipping(1647), 0);
});
