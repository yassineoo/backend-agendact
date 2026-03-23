import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ClientsModule } from './clients/clients.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ReservationsModule } from './reservations/reservations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { HolidaysModule } from './holidays/holidays.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PaymentsModule } from './payments/payments.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { StripeModule } from './stripe/stripe.module';
import { SmsModule } from './sms/sms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { PrestationsModule } from './prestations/prestations.module';
import { PublicBookingModule } from './public-booking/public-booking.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ClientsModule,
    VehiclesModule,
    ReservationsModule,
    DashboardModule,
    HolidaysModule,
    PromotionsModule,
    PaymentsModule,
    SettingsModule,
    UsersModule,
    SuperAdminModule,
    ChatModule,
    PrestationsModule,
    // New modules
    StripeModule,
    SmsModule,
    NotificationsModule,
    EmailModule,
    EventsModule,
    PublicBookingModule,
    UploadsModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

