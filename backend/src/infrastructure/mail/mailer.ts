import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "../../config/env.js";

export type TransactionalMail =
  | { kind: "verify-email"; to: string; token: string }
  | { kind: "reset-password"; to: string; token: string };

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }
  const env = getEnv();
  if (env.MAIL_MODE !== "smtp" || !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error("SMTP transport is not configured");
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: env.SMTP_REQUIRE_TLS,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000
  });
  return transporter;
}

export async function sendTransactionalMail(mail: TransactionalMail): Promise<void> {
  const env = getEnv();
  if (env.MAIL_MODE === "token") {
    return;
  }

  const isVerification = mail.kind === "verify-email";
  const path = isVerification ? "/verificar-correo" : "/restablecer-contrasena";
  const actionUrl = new URL(path, env.APP_PUBLIC_URL);
  actionUrl.searchParams.set("token", mail.token);
  const subject = isVerification
    ? "Verifica tu correo en ADP"
    : "Restablece tu contraseña de ADP";
  const actionLabel = isVerification ? "Verificar correo" : "Restablecer contraseña";

  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: mail.to,
    subject,
    text: `${actionLabel}: ${actionUrl.toString()}\n\nSi no solicitaste esta acción, ignora este mensaje.`,
    html: `<p>Usa el siguiente enlace para continuar en ADP:</p><p><a href="${actionUrl.toString()}">${actionLabel}</a></p><p>Si no solicitaste esta acción, ignora este mensaje.</p>`
  });
}

export async function verifyMailTransport(): Promise<void> {
  if (getEnv().MAIL_MODE === "smtp") {
    await getTransporter().verify();
  }
}

export function resetMailerForTests(): void {
  transporter = undefined;
}
