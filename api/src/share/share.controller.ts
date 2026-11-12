import { randomBytes } from 'node:crypto';
import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser, Public } from '../auth/current-user.js';
import { weekDetail, weeksAndSections } from '../internship/internship.controller.js';
import { Internship, Week } from '../internship/internship.entity.js';
import { User } from '../users/user.entity.js';

class ShareDto {
  @IsBoolean()
  enabled: boolean;
}

// A uuid that matches nothing is a 404, not a 400.
const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller()
export class ShareController {
  constructor(private ds: DataSource) {}

  // Turns the share link on or off. The token is made the first time and then kept, so the link never changes.
  @Put('share')
  async set(@CurrentUser() user: User, @Body() dto: ShareDto) {
    const repo = this.ds.getRepository(Internship);
    const internship = await repo.findOneBy({ userId: user.id });
    if (!internship) throw new NotFoundException();
    const shareToken = internship.shareToken ?? randomBytes(24).toString('base64url');
    await repo.update(internship.id, { shareToken, shareEnabled: dto.enabled });
    return { shareToken, shareEnabled: dto.enabled };
  }

  // Everything below is public and read-only: anyone with the link, no login. There are no write routes here.
  // An unknown token and a turned-off link look the same: 404.
  private async shared(token: string) {
    const internship = await this.ds.getRepository(Internship).findOneBy({ shareToken: token, shareEnabled: true });
    if (!internship) throw new NotFoundException();
    return internship;
  }

  @Public()
  @Get('shared/:token')
  async internship(@Param('token') token: string) {
    const i = await this.shared(token);
    const owner = await this.ds.getRepository(User).findOneByOrFail({ id: i.userId });
    // Picked field by field: no ids of the user, no email, no share or email settings.
    return {
      name: owner.name,
      company: i.company,
      startDate: i.startDate,
      endDate: i.endDate,
      reflectionPosition: i.reflectionPosition,
      ...(await weeksAndSections(this.ds, i.id)),
    };
  }

  @Public()
  @Get('shared/:token/weeks/:id')
  async week(@Param('token') token: string, @Param('id', uuid) id: string) {
    const i = await this.shared(token);
    const week = await this.ds.getRepository(Week).findOneBy({ id, internshipId: i.id });
    if (!week) throw new NotFoundException();
    return weekDetail(this.ds, week);
  }
}
