const test = require("node:test");
const assert = require("node:assert/strict");
const { validEmail } = require("../server");

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
