import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { EmployeeAttendanceController } from './employee-attendance.controller';
import { EmployeeAttendanceService } from './employee-attendance.service';
import { PayslipsController } from './payslips.controller';
import { PayslipsService } from './payslips.service';
import { TenantModule } from '../../core/tenant/tenant.module';
import { CapabilityModule } from '../../core/capability/capability.module';

@Module({
  imports: [TenantModule, CapabilityModule],
  controllers: [DepartmentsController, EmployeesController, LeaveTypesController, LeaveRequestsController, EmployeeAttendanceController, PayslipsController],
  providers: [DepartmentsService, EmployeesService, LeaveTypesService, LeaveRequestsService, EmployeeAttendanceService, PayslipsService],
  exports: [DepartmentsService, EmployeesService, LeaveTypesService, LeaveRequestsService, EmployeeAttendanceService, PayslipsService],
})
export class HrModule {}
