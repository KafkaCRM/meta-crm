ALTER TABLE "Case" RENAME COLUMN "workflow_definition_id" TO "pipeline_definition_id";

ALTER TABLE "WorkflowDefinition" RENAME TO "PipelineDefinition";
ALTER TABLE "WorkflowStage" RENAME TO "PipelineStage";
ALTER TABLE "WorkflowTransition" RENAME TO "PipelineTransition";
ALTER TABLE "AutomationFlow" RENAME TO "AutomationWorkflow";

ALTER TABLE "PipelineStage" RENAME COLUMN "workflow_definition_id" TO "pipeline_definition_id";
ALTER TABLE "PipelineTransition" RENAME COLUMN "workflow_definition_id" TO "pipeline_definition_id";

ALTER INDEX IF EXISTS "WorkflowDefinition_pkey" RENAME TO "PipelineDefinition_pkey";
ALTER INDEX IF EXISTS "WorkflowStage_pkey" RENAME TO "PipelineStage_pkey";
ALTER INDEX IF EXISTS "WorkflowTransition_pkey" RENAME TO "PipelineTransition_pkey";
ALTER INDEX IF EXISTS "AutomationFlow_pkey" RENAME TO "AutomationWorkflow_pkey";

ALTER TABLE "PipelineStage" RENAME CONSTRAINT "WorkflowStage_workflow_definition_id_fkey" TO "PipelineStage_pipeline_definition_id_fkey";
ALTER TABLE "PipelineTransition" RENAME CONSTRAINT "WorkflowTransition_workflow_definition_id_fkey" TO "PipelineTransition_pipeline_definition_id_fkey";
ALTER TABLE "PipelineDefinition" RENAME CONSTRAINT "WorkflowDefinition_tenant_id_fkey" TO "PipelineDefinition_tenant_id_fkey";
ALTER TABLE "AutomationWorkflow" RENAME CONSTRAINT "AutomationFlow_tenant_id_fkey" TO "AutomationWorkflow_tenant_id_fkey";

ALTER TABLE "Case" ADD CONSTRAINT "Case_pipeline_definition_id_fkey" FOREIGN KEY ("pipeline_definition_id") REFERENCES "PipelineDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "PipelineDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Case_tenant_id_pipeline_definition_id_idx" ON "Case"("tenant_id", "pipeline_definition_id");
CREATE INDEX IF NOT EXISTS "Campaign_tenant_id_pipeline_id_idx" ON "Campaign"("tenant_id", "pipeline_id");
