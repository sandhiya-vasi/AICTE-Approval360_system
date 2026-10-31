CREATE INDEX "session_expiry_idx" ON "demo_sessions" ("expires_at");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "application_status_valid" CHECK ("status" in ('Draft','Submitted','Under Scrutiny','Clarification Required','Under Bureau Review','Pending Final Approval','Approved','Rejected'));--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "application_intake_positive" CHECK ("intake" > 0 and "intake" <= 5000);--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_score_range" CHECK ("score" between 0 and 100);--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "document_verification_status" CHECK ("status" in ('Pending','Verified','Rejected'));--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "document_size_limit" CHECK ("size" >= 5 and "size" <= 4194304);--> statement-breakpoint
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "requirement_threshold_range" CHECK ("threshold" between 0 and 100);--> statement-breakpoint
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "requirement_weight_positive" CHECK ("weight" > 0);