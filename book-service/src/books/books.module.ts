import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OpenLibraryService } from './open-library.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, PrismaService, OpenLibraryService],
})
export class BooksModule {}
