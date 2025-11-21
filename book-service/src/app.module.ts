import { Module } from '@nestjs/common';
import { BooksModule } from './books/books.module';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health.controller';

@Module({
  imports: [BooksModule],
  providers: [PrismaService],
  controllers: [HealthController],
})
export class AppModule {}
