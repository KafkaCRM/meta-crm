import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class HooksService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    this.eventEmitter.emit(event, payload);
  }
}
