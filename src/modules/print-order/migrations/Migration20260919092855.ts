import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260919092855 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_print_job_order_id" ON "print_job" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_print_job_status" ON "print_job" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_print_job_order_id";`);
    this.addSql(`drop index if exists "IDX_print_job_status";`);
  }

}
