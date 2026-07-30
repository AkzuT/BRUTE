import { InternalServerErrorException } from "@nestjs/common";

export function getEnvCors(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new InternalServerErrorException(
      `La variable de entorno "${key}" no está definida.`,
    );
  }

  return value;
}
