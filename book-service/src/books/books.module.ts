import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { OpenLibraryService } from './open-library.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, OpenLibraryService],
})
export class BooksModule {}
