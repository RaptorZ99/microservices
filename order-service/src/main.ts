import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Instanciation de l'application Nest
  const app = await NestFactory.create(AppModule);

  // Validation globale (DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Retire les champs non attendus
      forbidNonWhitelisted: false,
    }),
  );

  // Activation CORS (nécessaire pour les appels front)
  app.enableCors({
    origin: true, // Accepte l'origine envoyée par le client
    credentials: true, // Autorise cookies / headers
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 Order Service running at http://localhost:${port}`);
}

bootstrap();
