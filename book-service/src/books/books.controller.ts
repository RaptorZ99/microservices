import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../auth/user.decorator';
import { AddBookDto } from './dto/add-book.dto';

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get('search')
  search(@Query('q') q: string, @Query('scope') scope?: 'author' | 'title') {
    const effectiveScope: 'author' | 'title' =
      scope === 'author' ? 'author' : 'title';
    return this.booksService.search(q, effectiveScope);
  }

  @Get('library')
  library(@User() user: any) {
    return this.booksService.listLibrary(user.sub);
  }

  @Post('library')
  add(@User() user: any, @Body() dto: AddBookDto) {
    return this.booksService.addBook(user.sub, dto);
  }

  @Delete('library/:workId')
  remove(@User() user: any, @Param('workId') workId: string) {
    return this.booksService.remove(user.sub, workId);
  }

  @Get('details/:workId')
  details(@Param('workId') workId: string) {
    return this.booksService.details(workId);
  }
}
