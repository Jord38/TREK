import { AppSettings } from '../../db/entities/AppSettings.entity';
import { AppSettingsRepository } from '../../db/repositories/AppSettings.repository';
import { FORK_CHANGELOG_ENTRIES, FORK_CHANGELOG_LIVE_KEY_PREFIX } from '../../systemNotices/fork-changelog';
import { UnitOfWork } from '../database/unit-of-work';
import { CronRegistrarService } from '../scheduling/cron-registrar.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { ForkChangelogEntry } from '@trek/shared';

@Injectable()
export class ForkChangelogService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(AppSettings) private readonly appSettings: AppSettingsRepository,
    private readonly registrar: CronRegistrarService,
    private readonly uow: UnitOfWork,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.registrar.runOnBoot('fork-changelog-live', () => this.recordLiveTimes());
  }

  /**
   * An entry goes live the first time the server runs with it. The first writer
   * keeps the row, so a later start (or a second process) never moves the time.
   */
  async recordLiveTimes(): Promise<void> {
    const now = new Date().toISOString();
    await this.uow.transactional(async () => {
      await Promise.all(
        FORK_CHANGELOG_ENTRIES.map((entry) =>
          this.appSettings.insertIfAbsent(`${FORK_CHANGELOG_LIVE_KEY_PREFIX}${entry.id}`, now),
        ),
      );
    });
  }

  entries(): ForkChangelogEntry[] {
    return [...FORK_CHANGELOG_ENTRIES];
  }
}
