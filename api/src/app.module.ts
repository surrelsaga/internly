import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { StubUserGuard } from './auth/current-user.js';
import { dataSource } from './data-source.js';
import { User } from './users/user.entity.js';

@Module({
  imports: [TypeOrmModule.forRoot(dataSource.options), TypeOrmModule.forFeature([User])],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: StubUserGuard }],
})
export class AppModule {}
