import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppointmentReminderService } from './appointment-reminder.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'appointment-reminders',
    }),
    EventEmitterModule.forRoot(),
  ],
  providers: [AppointmentReminderService],
  exports: [AppointmentReminderService],
})
export class HealthcareModule {}
