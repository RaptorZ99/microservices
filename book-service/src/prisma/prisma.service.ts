import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service global Prisma.
 * - Initialise la connexion SQLite au démarrage
 * - Fournit PrismaClient aux autres composants NestJS
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
