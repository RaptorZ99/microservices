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

/**
 * Contrôleur REST pour les commandes utilisateur.
 * Toutes les routes nécessitent un JWT valide.
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@User() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  @Get()
  findAll(@User() user: any) {
    return this.ordersService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.ordersService.findOne(id, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.ordersService.remove(id, user.sub);
  }
}
