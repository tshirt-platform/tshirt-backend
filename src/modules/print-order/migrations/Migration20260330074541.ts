import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260330074541 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "print_job" ("id" text not null, "order_id" text not null, "status" text check ("status" in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')) not null default 'pending', "design_png_url" text not null, "design_json_url" text not null, "tracking_number" text null, "notes" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "print_job_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_print_job_deleted_at" ON "print_job" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "print_job" cascade;`);
  }

}
