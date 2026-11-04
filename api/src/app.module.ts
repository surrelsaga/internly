import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { StubUserGuard } from './auth/current-user.js';
import { dataSource } from './data-source.js';
import { InternshipController } from './internship/internship.controller.js';
import { User } from './users/user.entity.js';

@Module({
  imports: [TypeOrmModule.forRoot(dataSource.options), TypeOrmModule.forFeature([User])],
  controllers: [AppController, InternshipController],
  providers: [
    { provide: APP_GUARD, useClass: StubUserGuard },
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
  ],
})
export class AppModule {}
