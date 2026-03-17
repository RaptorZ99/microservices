import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './books/books.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, BooksModule],
  controllers: [HealthController],
})
export class AppModule {}
