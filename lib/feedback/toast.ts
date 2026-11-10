import { sileo } from "sileo";

/**
 * Envoltorio limpio sobre Sileo Toast para notificaciones consistentes en el sistema.
 */
export const notify = {
  success: (title: string, description?: string) =>
    sileo.success({
      title,
      description,
    }),
  error: (title: string, description?: string) =>
    sileo.error({
      title,
      description,
    }),
  warning: (title: string, description?: string) =>
    sileo.warning({
      title,
      description,
    }),
  info: (title: string, description?: string) =>
    sileo.info({
      title,
      description,
    }),
};

