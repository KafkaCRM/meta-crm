import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EnrollmentController } from './academics.controller';
import { EnrollmentService } from './academics.service';
import { EnrollmentTriggersService } from './enrollment-triggers.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { TestScoresController } from './test-scores.controller';
import { TestScoresService } from './test-scores.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AssignmentSubmissionsController } from './assignment-submissions.controller';
import { AssignmentSubmissionsService } from './assignment-submissions.service';
import { StudyMaterialsController } from './study-materials.controller';
import { StudyMaterialsService } from './study-materials.service';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { TenantModule } from '../../core/tenant/tenant.module';
import { HooksModule } from '../../core/hooks/hooks.module';
import { WhatsAppModule } from '../../integrations/whatsapp/whatsapp.module';
import { CapabilityModule } from '../../core/capability/capability.module';

@Module({
  imports: [
    TenantModule,
    HooksModule,
    WhatsAppModule,
    CapabilityModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [
    EnrollmentController,
    CoursesController,
    BatchesController,
    EnrollmentsController,
    AttendanceController,
    TestsController,
    TestScoresController,
    AssignmentsController,
    AssignmentSubmissionsController,
    StudyMaterialsController,
    CertificatesController,
  ],
  providers: [
    EnrollmentService,
    EnrollmentTriggersService,
    CoursesService,
    BatchesService,
    EnrollmentsService,
    AttendanceService,
    TestsService,
    TestScoresService,
    AssignmentsService,
    AssignmentSubmissionsService,
    StudyMaterialsService,
    CertificatesService,
  ],
  exports: [
    EnrollmentService, CoursesService, BatchesService, EnrollmentsService, AttendanceService,
    TestsService, TestScoresService, AssignmentsService, AssignmentSubmissionsService,
    StudyMaterialsService, CertificatesService,
  ],
})
export class AcademicsModule {}

