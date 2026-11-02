import { AppSettings } from '../../db/entities/AppSettings.entity';
import { Trips } from '../../db/entities/Trips.entity';
import { UserNoticeDismissals } from '../../db/entities/UserNoticeDismissals.entity';
import { Users } from '../../db/entities/Users.entity';
import { AddonsModule } from '../addons/addons.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ForkChangelogController } from './fork-changelog.controller';
import { ForkChangelogService } from './fork-changelog.service';
import { SystemNoticesController } from './system-notices.controller';
import { SystemNoticesService } from './system-notices.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

/**
 * System-notices domain. Registered in AppModule.
 * `MikroOrmModule.forFeature([Users, Trips, UserNoticeDismissals, AppSettings])`
 * (Plan 3f Task 6) registers UsersRepository/TripsRepository/
 * UserNoticeDismissalsRepository/AppSettingsRepository for
 * `SystemNoticesService`'s `@InjectRepository` constructor params. Only this
 * module needs the registration — `SystemNoticesService` has no other
 * constructing module.
 */
@Module({
  imports: [
    AppConfigModule,
    AddonsModule,
    SchedulingModule,
    MikroOrmModule.forFeature([Users, Trips, UserNoticeDismissals, AppSettings]),
  ],
  controllers: [SystemNoticesController, ForkChangelogController],
  providers: [SystemNoticesService, ForkChangelogService],
})
export class SystemNoticesModule {}
