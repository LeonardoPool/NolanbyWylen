import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { GET as getAdminManifest } from "../app/manifest-admin.webmanifest/route.ts";
import { GET as getChecadorManifest } from "../app/manifest-checador.webmanifest/route.ts";

test("DOS PWA: Manifiesto Administrativo independiente", async () => {
  const res = getAdminManifest();
  assert.strictEqual(res.status, 200);
  const data = await res.json();

  assert.strictEqual(data.id, "/admin");
  assert.strictEqual(data.start_url, "/");
  assert.strictEqual(data.scope, "/");
  assert.strictEqual(data.name, "NOLAN Administrador");
  assert.strictEqual(data.short_name, "NOLAN");
  assert.strictEqual(data.display, "standalone");

  // Iconos administrativos
  assert.ok(data.icons.some((i) => i.src === "/icons/admin-192.png"));
  assert.ok(data.icons.some((i) => i.src === "/icons/admin-512.png"));
  assert.ok(data.icons.some((i) => i.src === "/icons/admin-apple-touch-icon.png"));
});

test("DOS PWA: Manifiesto Checador independiente", async () => {
  const res = getChecadorManifest();
  assert.strictEqual(res.status, 200);
  const data = await res.json();

  assert.strictEqual(data.id, "/checador");
  assert.strictEqual(data.start_url, "/checador");
  assert.strictEqual(data.scope, "/checador");
  assert.strictEqual(data.name, "NOLAN Checador");
  assert.strictEqual(data.short_name, "Checador");
  assert.strictEqual(data.display, "standalone");

  // Iconos del checador
  assert.ok(data.icons.some((i) => i.src === "/icons/checador-192.png"));
  assert.ok(data.icons.some((i) => i.src === "/icons/checador-512.png"));
  assert.ok(data.icons.some((i) => i.src === "/icons/checador-apple-touch-icon.png"));
});

test("DOS PWA: Recursos gráficos e iconos en disco", () => {
  const requiredIcons = [
    "public/icons/admin-192.png",
    "public/icons/admin-512.png",
    "public/icons/admin-maskable-512.png",
    "public/icons/admin-apple-touch-icon.png",
    "public/icons/checador-192.png",
    "public/icons/checador-512.png",
    "public/icons/checador-maskable-512.png",
    "public/icons/checador-apple-touch-icon.png",
  ];

  for (const relPath of requiredIcons) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `El icono ${relPath} debe existir en el repositorio`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 1000, `El icono ${relPath} debe ser un archivo de imagen válido (>1KB)`);
  }
});
