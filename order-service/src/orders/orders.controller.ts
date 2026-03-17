import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../auth/user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@User() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  @Get()
  findAll(@User() user: JwtPayload) {
    return this.ordersService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @User() user: JwtPayload) {
    return this.ordersService.findOne(id, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: JwtPayload) {
    return this.ordersService.remove(id, user.sub);
  }
}
