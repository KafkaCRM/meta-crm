import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { DepartmentList } from '@/components/hr/DepartmentList';
import { EmployeeList } from '@/components/hr/EmployeeList';
import { LeaveRequestList } from '@/components/hr/LeaveRequestList';
import { PayslipList } from '@/components/hr/PayslipList';
import { EmployeeAttendanceSheet } from '@/components/hr/EmployeeAttendanceSheet';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const gate = (children: React.ReactNode) => (
  <CapabilityGate capabilityId="capability/hr" capabilityName="HR & Workforce"
    description="Your workspace has not enabled the HR module. Enable it from Capabilities settings to manage employees, leaves, attendance, and payroll.">
    {children}
  </CapabilityGate>
);

export const departmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/departments', component: () => gate(<DepartmentList />) });
export const employeesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/employees', component: () => gate(<EmployeeList />) });
export const leaveRequestsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/leave-requests', component: () => gate(<LeaveRequestList />) });
export const payslipsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/payslips', component: () => gate(<PayslipList />) });
export const employeeAttendanceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/employee-attendance', component: () => gate(<EmployeeAttendanceSheet />) });
