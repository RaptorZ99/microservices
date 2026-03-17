import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}
