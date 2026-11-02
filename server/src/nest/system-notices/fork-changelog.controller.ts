import { JwtAuthGuard } from '../auth-core/jwt-auth.guard';
import { ResponseContract } from '../common/response-contract';
import { ForkChangelogService } from './fork-changelog.service';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { forkChangelogResponseSchema, type ForkChangelogResponse } from '@trek/shared';

/** /api/fork-changelog — every entry of this fork's changelog, newest first. */
@Controller('api/fork-changelog')
@UseGuards(JwtAuthGuard)
export class ForkChangelogController {
  constructor(private readonly changelog: ForkChangelogService) {}

  @Get()
  @ResponseContract(forkChangelogResponseSchema)
  list(): ForkChangelogResponse {
    return { entries: this.changelog.entries() };
  }
}
