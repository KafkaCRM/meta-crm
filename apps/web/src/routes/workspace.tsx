import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { TaskList } from '@/components/workspace/TaskList';
import { NoteList } from '@/components/workspace/NoteList';
import { Inbox } from '@/components/workspace/Inbox';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const gate = (children: React.ReactNode) => (
  <CapabilityGate capabilityId="capability/workspace" capabilityName="Workspace Tasks & Notes"
    description="Your workspace has not enabled the Workspace module. Enable it from Capabilities settings to manage tasks, notes, and inbox.">
    {children}
  </CapabilityGate>
);

export const tasksRoute = createRoute({ getParentRoute: () => rootRoute, path: '/tasks', component: () => gate(<TaskList />) });
export const notesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/notes', component: () => gate(<NoteList />) });
export const inboxRoute = createRoute({ getParentRoute: () => rootRoute, path: '/inbox', component: () => gate(<Inbox />) });
