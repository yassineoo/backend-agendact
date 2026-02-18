import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsService } from './events.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
        EventEmitterModule.forRoot(),
        forwardRef(() => NotificationsModule),
        SmsModule,
        EmailModule,
    ],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }
