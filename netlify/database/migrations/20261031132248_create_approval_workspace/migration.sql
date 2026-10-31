CREATE TABLE "applications" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"institution_id" text NOT NULL,
	"type" text NOT NULL,
	"year" text DEFAULT '2026–27' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"assigned_to" text,
	"deadline" timestamp with time zone NOT NULL,
	"intake" integer NOT NULL,
	"program" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bureaus" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_records" (
	"id" text PRIMARY KEY,
	"institution_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"score" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"blob_key" text,
	"size" integer NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_history" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"user_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"type" text NOT NULL,
	"email" text NOT NULL,
	"established" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" text PRIMARY KEY,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"application_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"priority" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"bureau_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_requirements" (
	"id" text PRIMARY KEY,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"threshold" integer DEFAULT 75 NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"workspace" text DEFAULT 'demo' NOT NULL,
	"identity_id" text UNIQUE,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"bureau_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "applications_scope_status_idx" ON "applications" ("workspace","status");--> statement-breakpoint
CREATE INDEX "application_deadline_idx" ON "applications" ("deadline");--> statement-breakpoint
CREATE INDEX "audits_workspace_created_idx" ON "audit_logs" ("workspace","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_institution_requirement_idx" ON "compliance_records" ("institution_id","requirement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_application_category_idx" ON "application_documents" ("application_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "escalation_application_idx" ON "escalations" ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_code_workspace_idx" ON "institutions" ("workspace","code");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_idx" ON "notification_reads" ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "users_workspace_idx" ON "users" ("workspace");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_institution_id_institutions_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_institution_id_institutions_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_ZcWItye844R1_fkey" FOREIGN KEY ("requirement_id") REFERENCES "compliance_requirements"("id");--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id");--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id");--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id");--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id");--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id");--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_bureau_id_bureaus_id_fkey" FOREIGN KEY ("bureau_id") REFERENCES "bureaus"("id");--> statement-breakpoint
ALTER TABLE "demo_sessions" ADD CONSTRAINT "demo_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_bureau_id_bureaus_id_fkey" FOREIGN KEY ("bureau_id") REFERENCES "bureaus"("id");