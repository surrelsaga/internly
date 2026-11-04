import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from './auth/current-user.js';

@Controller()
export class AppController {
  constructor(private ds: DataSource) {}

  @Public()
  @Get('health')
  async health() {
    await this.ds.query('select 1');
    return { ok: true };
  }
}
