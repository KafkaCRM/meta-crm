import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HooksService } from './hooks.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [HooksService],
  exports: [HooksService],
})
export class HooksModule {}
