import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * Service métier pour la gestion des commandes.
 */
@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  create(user: string, data: CreateOrderDto) {
    return this.prisma.order.create({
      data: { user, item: data.item },
    });
  }

  findAll(user: string) {
    return this.prisma.order.findMany({
      where: { user },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number, user: string) {
    return this.prisma.order.findFirst({
      where: { id, user },
    });
  }

  remove(id: number, user: string) {
    return this.prisma.order.deleteMany({
      where: { id, user },
    });
  }
}
