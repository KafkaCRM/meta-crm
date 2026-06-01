import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface ProvisioningEvent {
  stage: string;
  message: string;
  progress: number;
  data?: any;
  error?: any;
}

@Injectable()
export class ProvisioningStreamService {
  private readonly streams = new Map<string, Subject<ProvisioningEvent>>();

  getOrCreateStream(sessionId: string): Subject<ProvisioningEvent> {
    let stream = this.streams.get(sessionId);
    if (!stream) {
      stream = new Subject<ProvisioningEvent>();
      this.streams.set(sessionId, stream);
    }
    return stream;
  }

  emit(sessionId: string, stage: string, message: string, progress: number, data?: any) {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.next({ stage, message, progress, data });
    }
  }

  complete(sessionId: string, data?: any) {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.next({ stage: 'COMPLETE', message: 'Provisioning completed successfully.', progress: 100, data });
      stream.complete();
      this.streams.delete(sessionId);
    }
  }

  error(sessionId: string, message: string, error?: any) {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.next({ stage: 'ERROR', message, progress: 0, error });
      stream.complete();
      this.streams.delete(sessionId);
    }
  }
}
