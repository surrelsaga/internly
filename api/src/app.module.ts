import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController, AiService } from './ai/ai.js';
import { AppController } from './app.controller.js';
import { AuthController, GoogleStrategy } from './auth/auth.js';
import { JwtGuard } from './auth/current-user.js';
import { dataSource } from './data-source.js';
import { EmailService, WeeklyEmail } from './email/email.js';
import { ExportController } from './export/export.js';
import { InternshipController } from './internship/internship.controller.js';
import { NotesController } from './notes/notes.controller.js';
import { UploadsController } from './notes/uploads.controller.js';
import { ReflectionController } from './reflection/reflection.controller.js';
import { ShareController } from './share/share.controller.js';
import { TasksController } from './tasks/tasks.controller.js';
import { User } from './users/user.entity.js';

@Module({
  imports: [TypeOrmModule.forRoot(dataSource.options), TypeOrmModule.forFeature([User]), ScheduleModule.forRoot()],
  controllers: [AppController, AuthController, InternshipController, TasksController, ReflectionController, NotesController, UploadsController, AiController, ExportController, ShareController],
  providers: [
    GoogleStrategy,
    AiService,
    EmailService,
    WeeklyEmail,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
  ],
})
export class AppModule {}
