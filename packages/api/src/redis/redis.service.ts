import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RateStore } from '@app/core/server';

/**
 * Store de rate limiting persistente (decisão da auditoria — P0).
 * Implementa a abstração RateStore do núcleo usando Redis, de modo que o
 * limite seja COMPARTILHADO entre instâncias/serverless (não reseta no deploy).
 */
@Injectable()
export class RedisService implements RateStore, OnModuleDestroy {
  private readonly client = new Redis(process.env.REDIS_URL as string);

  async incr(chave: string): Promise<number> {
    return this.client.incr(chave);
  }

  async expire(chave: string, segundos: number): Promise<void> {
    await this.client.expire(chave, segundos);
  }

  /** Limpa todo o Redis. Uso restrito a testes (flush do rate-limit entre suites e2e). */
  async limparTudo(): Promise<void> {
    await this.client.flushall();
  }

  async onModuleDestroy() { await this.client.quit(); }
}
