# AGENT.md — Meta CRM Platform
# Master Instruction File for AI Agents

> Read this file completely before writing a single line of code.
> Read it again if you are unsure about anything.
> This file overrides any assumption from your training data.

---

## 1. What You Are Building

Meta CRM is a **multi-tenant CRM platform** with two frontend applications and one backend API.

```
meta-crm/
├── apps/
│   ├── api/      ← NestJS 11 modular monolith. ONE deployable. ONE process.
│   ├── web/      ← React 19 SPA. Tenant-facing CRM.
│   └── admin/    ← React 19 SPA. Platform admin panel. Separate app, same API.
├── packages/
│   ├── types/        ← @meta-crm/types. Shared Zod schemas + DTOs + enums.
│   ├── permissions/  ← @meta-crm/permissions. CASL ability definitions.
│   └── ui/           ← @meta-crm/ui. Shared shadcn/ui wrappers.
└── plugins/
    └── healthcare/   ← @meta-crm/plugin-healthcare. Example plugin.
```

You will be assigned **one task at a time** from `TASKS.md`. You implement that task. Nothing else.

---

## 2. The Non-Negotiable Rules

These rules are absolute. Violating any of them means your output is rejected regardless of whether it works.

### 2.1 Dependencies

- **Never install a package not in `DEPS.lock.json`.** If you think you need one, stop and ask.
- **Never change a version in `package.json`.** Versions are locked by the human.
- **Never use a deprecated package.** Specifically: never use `react-beautiful-dnd`, `moment`, `lodash`, `axios`, `express`, `redux`, `react-router-dom`, `@nestjs/typeorm`, `sequelize`, `mongoose`.
- Use `pnpm` only. Never `npm install` or `yarn add`.

### 2.2 Database Access

- **Never instantiate `PrismaClient` directly.** Always inject `TenantScopedPrismaService`.
- **Never write `WHERE tenant_id = x` manually.** `TenantScopedPrismaService` does this automatically.
- **Never use `OFFSET` pagination.** Always cursor-based.
- Every write that changes a `Case` must also write a `case_events` record **in the same Prisma transaction**.
- Background jobs (BullMQ workers) must call `ClsService.run()` to set tenant context before any DB access.

### 2.3 Secrets and Credentials

- **Never store a credential value in the database.** Only `secret_ref` path strings.
- **Never read credentials from environment variables in application code.** Use `SecretsService.get(ref)`.
- **Never log a secret value.** Ever.

### 2.4 Error Handling

- **Never use `throw` in a service method.** Return `Result<T, E>` using `neverthrow`.
- Every error must have a typed `code` field. No generic `{ message: 'Something went wrong' }`.
- HTTP controllers catch `Result` errors and map them to typed HTTP responses.

### 2.5 Module Boundaries

```
core → nothing (never imports capabilities, integrations, or plugins)
capabilities → core only (never imports another capability)
integrations → core only (never imports a capability or another integration)
plugins → hooks only (via HooksService, never imports core services directly)
apps/web → never imports from apps/api or apps/admin
apps/admin → never imports from apps/api or apps/web
```

Violating a module boundary is an automatic rejection.

### 2.6 Frontend Rules

- **Never call `fetch()` directly in a component.** All API calls go through `src/api/*.ts` functions.
- **Never use `useState` for server data.** TanStack Query handles all server state.
- **Never build a list view without TanStack Virtual.** Lists must handle 500+ rows without lag.
- **Never build a form without unsaved-change protection.** TanStack Router `beforeLeave` guard required.
- **Never build a Kanban without optimistic updates.** Card must move immediately; rollback on error.
- **Never use `<form>` HTML element.** Use React Hook Form with `onSubmit` handler.
- **Never use `disabled` to hide a field from unauthorized users.** Render a read-only `<span>` instead.
- **Never render a field the user cannot `read`.** Do not render it at all.

### 2.7 Platform Admin Separation

- `apps/admin` only renders for `platform_*` roles. Any other role gets redirected to `/unauthorized`.
- Platform roles (`platform_owner`, `platform_admin`, `platform_support`, `platform_sales`, `platform_billing`, `platform_developer`, `platform_ops`) are completely separate from tenant roles.
- **Never mix platform roles and tenant roles in the same table, guard, or CASL ability.**

### 2.8 Extensibility

- **Never hardcode an industry name in core modules.** Core is industry-agnostic.
- **Never hardcode a label in UI components.** All labels come from the label resolution system: `t('key')`.
- **Never hardcode a provider name in core.** Providers are adapters behind interfaces.

---

## 3. Technology Reference

### Backend (`apps/api`)

| What | How |
|---|---|
| Framework | NestJS 11 with Fastify adapter |
| Database | Prisma 7 via `TenantScopedPrismaService` |
| Auth | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` |
| Permissions | `@casl/ability` 6 via `PermissionsGuard` + `@CheckPermissions()` decorator |
| Validation | `class-validator` + `class-transformer` on all DTOs |
| Schema validation | Zod 4 for runtime config, plugin manifests, API responses |
| Queues | BullMQ 5 via `@nestjs/bullmq` |
| Request context | `nestjs-cls` — inject `ClsService` to read `tenant_id` in any service |
| Events (internal) | `@nestjs/event-emitter` 3 via `HooksService` |
| Real-time | `@nestjs/websockets` + `@nestjs/platform-socket.io` |
| Rate limiting | `@nestjs/throttler` 6 |
| Phone normalization | `libphonenumber-js` 1 |
| IDs | `@paralleldrive/cuid2` 2 — never `uuid`, never auto-increment |
| Result type | `neverthrow` 8 — `Result<T, E>`, `ok()`, `err()` |

### Frontend (`apps/web` and `apps/admin`)

| What | How |
|---|---|
| Framework | React 19 + Vite 6 |
| Routing | TanStack Router 1 — file-based, type-safe |
| Server state | TanStack Query 5 — all API data |
| Tables | TanStack Table 8 + TanStack Virtual 3 |
| Forms | React Hook Form 7 + `@hookform/resolvers` 5 + Zod 4 |
| Drag and drop | `@dnd-kit/core` 6 + `@dnd-kit/sortable` 10 |
| Permissions | `@casl/ability` 6 + `@casl/react` 6 |
| Styling | Tailwind CSS 4 + shadcn/ui (latest via CLI) |
| Class utility | `clsx` + `tailwind-merge` + `class-variance-authority` |
| Toasts | Sonner 2 |
| Date | Day.js 1 |
| Real-time | Socket.io client 4 |
| Fuzzy search | Fuse.js 7 |
| Immutable state | `immer` 11 + `use-immer` |
| Charts | Recharts 2 |
| HTTP | Native `fetch` only. No axios. |

### Shared Packages

| Package | Contents |
|---|---|
| `@meta-crm/types` | Zod schemas, DTOs, enums, `evaluateVisibilityRules()` pure function |
| `@meta-crm/permissions` | CASL ability builder, platform role maps, tenant role maps |
| `@meta-crm/ui` | Shared shadcn/ui component wrappers |

---

## 4. Key Patterns — Read Before Implementing

### 4.1 Service Method Signature (Backend)

```typescript
// Always: inject TenantScopedPrismaService, not PrismaClient
// Always: accept RequestScope from nestjs-cls
// Always: return Result<T, E> using neverthrow
// Never: throw

@Injectable()
export class ExampleService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly cls: ClsService,
    private readonly hooks: HooksService,
  ) {}

  async doSomething(
    input: DoSomethingDto,
  ): Promise<Result<OutputType, AppError>> {
    const scope = this.cls.get<RequestScope>('scope');

    // scope.tenant_id is available here automatically
    // db.getClient() returns a Prisma client already scoped to this tenant

    const result = await this.db.getClient().someModel.findFirst({ ... });

    if (!result) {
      return err({ code: 'NOT_FOUND', resource: 'SomeModel' });
    }

    await this.hooks.emit('resource:action', { ...result, tenant_id: scope.tenant_id });

    return ok(result);
  }
}
```

### 4.2 Controller Pattern (Backend)

```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Get(':id')
  @CheckPermissions('read', 'Resource')
  async findOne(@Param('id') id: string): Promise<ResponseDto> {
    const result = await this.service.findOne(id);

    if (result.isErr()) {
      const error = result.error;
      if (error.code === 'NOT_FOUND') throw new NotFoundException(error);
      throw new InternalServerErrorException(error);
    }

    return result.value;
  }
}
```

### 4.3 API Function Pattern (Frontend)

```typescript
// src/api/cases.ts
// All API calls live here. Never fetch() in components.

import { CaseDto, CreateCaseDto } from '@meta-crm/types';
import { apiCall } from '@/lib/api';

export const casesApi = {
  list: (params: CaseListParams) =>
    apiCall<PaginatedResponse<CaseDto>>(`/cases?${toQueryString(params)}`),

  get: (id: string) =>
    apiCall<CaseDto>(`/cases/${id}`),

  create: (data: CreateCaseDto) =>
    apiCall<CaseDto>('/cases', { method: 'POST', body: JSON.stringify(data) }),

  transitionStage: (id: string, toStageId: string) =>
    apiCall<CaseDto>(`/cases/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStageId }),
    }),
};
```

### 4.4 TanStack Query Pattern (Frontend)

```typescript
// Query key convention: [resource, identifier, filters]
// Always typed. Always with error handling.

const { data: caseData, isLoading } = useQuery({
  queryKey: ['cases', caseId],
  queryFn: () => casesApi.get(caseId),
  staleTime: 30_000,
});

// Mutation with optimistic update
const { mutate: transitionStage } = useMutation({
  mutationFn: ({ id, toStageId }: TransitionArgs) =>
    casesApi.transitionStage(id, toStageId),
  onMutate: async ({ id, toStageId }) => {
    await queryClient.cancelQueries({ queryKey: ['cases', id] });
    const previous = queryClient.getQueryData<CaseDto>(['cases', id]);
    queryClient.setQueryData<CaseDto>(['cases', id], (old) =>
      old ? { ...old, stage: toStageId } : old
    );
    return { previous };
  },
  onError: (err, { id }, context) => {
    queryClient.setQueryData(['cases', id], context?.previous);
    toast.error(`Stage transition failed: ${err.message}`);
  },
  onSettled: (_, __, { id }) => {
    queryClient.invalidateQueries({ queryKey: ['cases', id] });
  },
});
```

### 4.5 Permission Check Pattern (Frontend)

```typescript
// usePermissions hook returns CASL ability
const { can } = usePermissions();

// In JSX:
{can('read', 'Report') && <ReportWidget />}
{can('delete', 'Case') && <DeleteButton />}

// For fields — never disabled, always conditional render:
{can('update', 'Case')
  ? <input {...register('title')} />
  : <span className="text-muted-foreground">{caseData.title}</span>
}
```

### 4.6 Real-time Pattern (Frontend)

```typescript
// useRealtime hook — subscribe to socket events, invalidate queries
useRealtime('case:stage_changed', (payload) => {
  queryClient.invalidateQueries({ queryKey: ['cases', payload.case_id] });
  queryClient.invalidateQueries({ queryKey: ['cases'] });
});

useRealtime('interaction:received', (payload) => {
  queryClient.invalidateQueries({
    queryKey: ['interactions', payload.party_id],
  });
  toast.info(`New ${payload.channel} from ${payload.party_name}`, {
    action: { label: 'View', onClick: () => navigate({ to: `/parties/${payload.party_id}` }) },
  });
});
```

### 4.7 Stage Transition (Backend — Full Pattern)

```typescript
// Never simplify this. The full pattern is required every time.
async transitionStage(caseId, toStageId, actorId, scope) {
  // 1. Load and verify ownership
  // 2. Load target stage + entry_criteria
  // 3. Evaluate criteria → return Err if unmet
  // 4. Verify transition exists in workflow_transitions
  // 5. Prisma transaction: update case.stage + insert case_events
  // 6. After commit: enqueue BullMQ job for triggers (non-blocking)
  // 7. Emit HooksService event
  // 8. Emit Socket.io event to tenant room
  // 9. Return Ok(updatedCase)
}
```

---

## 5. What Each App Looks Like

### `apps/api` — NestJS Backend

```
src/
├── core/
│   ├── auth/               ← JWT strategy, guards, token service
│   ├── permissions/        ← PermissionsGuard, @CheckPermissions(), PermissionCacheService
│   ├── secrets/            ← SecretsService (Vault/AWS SM abstraction)
│   ├── tenant/             ← TenantScopedPrismaService, scope middleware
│   ├── party/              ← PartyService, party-upsert.service.ts
│   ├── case/               ← CaseService, stage-transition.service.ts, events/
│   ├── interaction/        ← InteractionService, thread grouping
│   ├── metadata/           ← FieldDefinitionService, LabelService
│   ├── communication/      ← MessagingAdapter interface + dispatcher
│   ├── realtime/           ← Socket.io gateway, room manager
│   ├── report/
│   │   ├── tenant/         ← Tier 1: scoped to tenant
│   │   └── platform/       ← Tier 2: cross-tenant, platform_admin only
│   └── database/
│       ├── tenant-scoped-prisma.service.ts
│       └── platform-prisma.service.ts
├── capabilities/
│   ├── enrollment/
│   ├── appointment/
│   ├── billing/
│   └── property/
├── integrations/
│   ├── whatsapp/
│   ├── facebook/
│   ├── justdial/
│   └── generic-webhook/    ← BullMQ dispatcher, HMAC signing
├── platform/               ← Platform admin endpoints (tenant management, plugin registry)
│   ├── tenants/
│   ├── plans/
│   ├── plugins/
│   └── templates/
├── plugins/
│   └── registry/           ← PluginRegistryService
└── main.ts
```

### `apps/web` — Tenant CRM Frontend

```
src/
├── api/                    ← typed fetch wrappers per resource
├── lib/
│   ├── api.ts              ← base fetch, auth header, error normalization
│   ├── socket.ts           ← Socket.io singleton
│   └── query-client.ts     ← TanStack Query client config
├── components/
│   ├── party/              ← PartyForm, PartyList, PartyDetail, MergeWizard
│   ├── case/               ← CaseKanban, CaseDetail, StageBar, BulkActionBar
│   ├── interaction/        ← Timeline, ComposeBar
│   ├── dashboard/          ← widgets/, DateRangePicker
│   ├── settings/           ← RoleMatrix, WorkflowBuilder, FieldEditor, LabelEditor
│   │                          BranchManager, BrandManager, IntegrationSettings
│   │                          CapabilityToggle, PluginStore
│   └── shared/
│       ├── DynamicForm.tsx ← config-driven form renderer
│       ├── VirtualTable.tsx← TanStack Table + Virtual
│       └── NotificationToast.tsx
├── hooks/
│   ├── usePermissions.ts
│   ├── useRealtime.ts
│   ├── useOptimistic.ts
│   └── useLabels.ts        ← label resolution: tenant → industry → default
└── routes/                 ← TanStack Router file-based routes
```

### `apps/admin` — Platform Admin Frontend

```
src/
├── api/                    ← platform-specific fetch wrappers
├── components/
│   ├── tenants/            ← TenantList, TenantDetail, CreateTenantForm
│   ├── plans/              ← PlanList, PlanEditor, AssignPlan
│   ├── plugins/            ← PluginRegistry, PublishPlugin, DeprecatePlugin
│   ├── templates/          ← IndustryTemplateEditor
│   ├── reports/            ← PlatformReports (Tier 2 only)
│   ├── team/               ← PlatformUserList, InvitePlatformUser, PlatformRoleMatrix
│   └── system/             ← QueueMonitor, WebhookFailures, SystemHealth
└── routes/
```

---

## 6. Label System

Every user-facing string in `apps/web` is a label key resolved through:

```typescript
const { t } = useLabels();
// t('party.singular') → 'Student' (education) or 'Contact' (default)
// t('case.singular') → 'Admission' (education) or 'Case' (default)
// t('workflow.stage.enquiry') → 'Fresh Lead' (tenant override) or 'Enquiry' (default)
```

Resolution order: **tenant override → industry preset → hardcoded default**

**Never hardcode a domain label in a component.** Always use `t('key')`.

---

## 7. Platform Admin Role System

Platform roles are separate from tenant roles. They share the same `@casl/ability` library but use a completely different ability definition in `packages/permissions/src/platform-ability.ts`.

| Role | Access |
|---|---|
| `platform_owner` | Everything |
| `platform_admin` | Everything except billing destructive actions |
| `platform_support` | Read-only view of any tenant config. Cannot modify. |
| `platform_sales` | Create tenants, assign plans, apply templates |
| `platform_billing` | Create/edit plans, assign plans to tenants, view revenue |
| `platform_developer` | Plugin registry management only |
| `platform_ops` | Tier 2 reports + system health. Read only. |

Platform users are stored in `platform_users` and `platform_user_roles` tables — separate from tenant `users` and `user_roles`.

---

## 8. Extensibility Model

This is why the architecture is designed the way it is. Understand it before implementing anything.

**Capabilities** — NestJS modules in `capabilities/`. Adding a new one never touches core. Tenants enable/disable them in Settings → Capabilities.

**Integrations** — Adapter classes in `integrations/`. Each implements a typed interface (`MessagingAdapter`, `LeadSourceAdapter`). Adding a new integration never touches core or other integrations.

**Plugins** — pnpm workspace packages in `plugins/`. They listen to hook events. They never import core services. Platform developer registers them in the plugin registry. Tenants install them from their Plugin Store in Settings.

**Result:** In 3 years, adding `capability/loan-tracking`, `integration/exotel`, or `plugin/advanced-analytics` is a self-contained unit of work. Nothing existing breaks.

---

## 9. Your Workflow For Every Task

1. **Read this file** (AGENT.md) — you are reading it now
2. **Read `DEPS.lock.json`** — know what packages are available
3. **Read your assigned task** from `TASKS.md`
4. **Read the referenced spec file** in `specs/`
5. **Read existing related files** before writing new ones — understand what already exists
6. **Implement exactly the task scope** — nothing more, nothing less
7. **Write tests** as specified in the task
8. **Check your output against the rules in Section 2** before submitting
9. **Do not modify files outside your task scope**
10. **If anything is ambiguous, ask** — do not guess, do not simplify

---

## 10. What "Done" Means

A task is done when:

- [ ] All acceptance criteria in the task are implemented
- [ ] All rules in Section 2 of this file are satisfied
- [ ] Unit tests pass
- [ ] TypeScript compiles with zero errors (`turbo typecheck`)
- [ ] ESLint passes with zero errors (`turbo lint`)
- [ ] No package was installed that isn't in `DEPS.lock.json`
- [ ] No module boundary was crossed
- [ ] No credential value appears anywhere except the secrets backend
- [ ] Every service method returns `Result<T, E>` — no `throw`

If any checkbox is unchecked, it is not done.

---

## 11. When You Are Unsure

Stop. Ask the human. Specifically state:

- What you are unsure about
- What the two or three options are
- Which one you think is correct and why

Do not guess. Do not pick the simpler option without flagging it. Do not implement a partial version and call it done.

---

*This file is the law. The spec files elaborate. The tasks assign work. This file governs everything.*
