import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './health.controller';

@Module({
  imports: [OrdersModule],
  providers: [PrismaService],
  controllers: [HealthController], // Ajout du contrôleur health
})
export class AppModule {}
