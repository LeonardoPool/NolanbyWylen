"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validaciones/auth.schema";

export interface AuthState {
  error?: string;
  success?: boolean;
}

/**
 * Server Action para iniciar sesión con correo y contraseña.
 * Retorna estado para permitir que el cliente ejecute notificaciones SILEO con física.
 */
export async function iniciarSesion(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  const validation = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message;
    return {
      error: firstError || "Datos de acceso inválidos.",
    };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Credenciales incorrectas. Verifica tu correo y contraseña."
          : `Error al iniciar sesión: ${error.message}`,
    };
  }

  return {
    success: true,
  };
}

/**
 * Server Action para cerrar la sesión administrativa.
 */
export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Obtiene la sesión y el perfil del usuario autenticado actual.
 */
export async function obtenerUsuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    user,
    perfil,
  };
}
