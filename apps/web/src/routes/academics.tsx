import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { CourseList } from '@/components/academics/CourseList';
import { BatchList } from '@/components/academics/BatchList';
import { AttendanceSheet } from '@/components/academics/AttendanceSheet';
import { TestList } from '@/components/academics/TestList';
import { AssignmentList } from '@/components/academics/AssignmentList';
import { EnrollmentList } from '@/components/academics/EnrollmentList';
import { StudyMaterialsList } from '@/components/academics/StudyMaterialsList';
import { CertificatesPage } from '@/components/academics/CertificatesPage';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const gate = (children: React.ReactNode) => (
  <CapabilityGate
    capabilityId="capability/academics"
    capabilityName="Enrollment & Academics"
    description="Your workspace has not enabled the Enrollment module. Enable it from Capabilities settings to manage courses, batches, tests, and assignments."
  >
    {children}
  </CapabilityGate>
);

export const coursesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/courses', component: () => gate(<CourseList />) });
export const batchesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/batches', component: () => gate(<BatchList />) });
export const attendanceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/attendance', component: () => gate(<AttendanceSheet />) });
export const testsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/tests', component: () => gate(<TestList />) });
export const assignmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/assignments', component: () => gate(<AssignmentList />) });
export const enrollmentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/enrollments', component: () => gate(<EnrollmentList />) });
export const studyMaterialsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/study-materials', component: () => gate(<StudyMaterialsList />) });
export const certificatesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/certificates', component: () => gate(<CertificatesPage />) });
