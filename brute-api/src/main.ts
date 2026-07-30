import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import * as express from "express";
import { join } from "path";

import { AppModule } from "./app.module";

import cookieParser from "cookie-parser";

import { getEnvCors } from "./brute-api-config/env-config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: [getEnvCors("PUBLIC_WEB_URL")],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use("/profile-pictures", express.static("profile-pictures"));
  app.setBaseViewsDir(join(__dirname, "..", "src", "mailer", "templates"));
  app.useStaticAssets(
    join(__dirname, "..", "src", "mailer", "templates", "assets"),
    {
      prefix: "/assets/",
    },
  );
  app.setViewEngine("hbs");
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
