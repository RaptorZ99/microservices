import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service global pour gérer la connexion Prisma (ORM SQLite)
 * - Initialise et connecte Prisma au démarrage
 * - Fournit PrismaClient à l'ensemble des modules Nest
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
