const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// 1. Cargar configuración de entorno
const envPath = path.resolve(process.cwd(), '.env.local');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
}

const { createClient } = require('@supabase/supabase-js');

describe('ETAPA 1: Seguridad de Datos y Control de Fuerza Bruta', () => {
  test('La clave de Service Role NO debe tener prefijo NEXT_PUBLIC', () => {
    assert.strictEqual(env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, undefined);
    assert.ok(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY debe existir en el servidor');
  });

  test('El cliente anónimo no debe poder leer registros_auditoria', async () => {
    const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await anonClient.from('registros_auditoria').select('*');
    // RLS deniega o retorna lista vacía a anónimos
    assert.ok(data === null || data.length === 0, 'Cliente anónimo no debe ver registros de auditoría');
  });

  test('La migración SQL contiene la definición de intentos_acceso_pin sin campo PIN', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261116000005_cerrar_rls_e_intentos_pin.sql');
    assert.ok(fs.existsSync(migrationPath), 'El archivo de migración debe existir');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Verificar que la tabla de intentos existe y que no guarda contraseñas ni PINs
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.intentos_acceso_pin'));
    assert.ok(!sql.includes('pin VARCHAR'), 'Por seguridad, intentos_acceso_pin NUNCA debe almacenar el PIN ingresado');
    assert.ok(sql.includes('DROP POLICY IF EXISTS "incidencias_select"'));
    assert.ok(sql.includes('incidencias_admin_select'));
  });

  test('Simulación lógica de mitigación de fuerza bruta (5 intentos fallidos en 15 min)', () => {
    const LIMITE_INTENTOS = 5;
    const intentosMock = [
      { exitoso: false, tiempoMin: 2 },
      { exitoso: false, tiempoMin: 4 },
      { exitoso: false, tiempoMin: 7 },
      { exitoso: false, tiempoMin: 10 },
      { exitoso: false, tiempoMin: 12 },
    ];

    const intentosFallidos = intentosMock.filter(i => !i.exitoso && i.tiempoMin <= 15).length;
    const bloqueado = intentosFallidos >= LIMITE_INTENTOS;
    assert.strictEqual(bloqueado, true, 'Debe bloquearse al alcanzar 5 intentos fallidos');

    const restantes = Math.max(0, LIMITE_INTENTOS - intentosFallidos);
    assert.strictEqual(restantes, 0, 'No deben quedar intentos restantes');
  });
});
