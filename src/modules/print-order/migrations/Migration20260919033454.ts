import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260919033454 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "print_job" drop constraint if exists "print_job_status_check";`);

    this.addSql(`alter table if exists "print_job" add column if not exists "order_item_id" text null, add column if not exists "side" text check ("side" in ('front', 'back')) null, add column if not exists "quantity" integer not null default 1, add column if not exists "garment_size" text null, add column if not exists "color_name" text null, add column if not exists "color_hex" text null, add column if not exists "supplier_color_code" text null, add column if not exists "needs_underbase" boolean null, add column if not exists "placement" jsonb null, add column if not exists "preview_url" text null;`);
    this.addSql(`alter table if exists "print_job" add constraint "print_job_status_check" check("status" in ('pending', 'proof_approved', 'processing', 'shipped', 'delivered', 'cancelled'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "print_job" drop constraint if exists "print_job_status_check";`);

    this.addSql(`alter table if exists "print_job" drop column if exists "order_item_id", drop column if exists "side", drop column if exists "quantity", drop column if exists "garment_size", drop column if exists "color_name", drop column if exists "color_hex", drop column if exists "supplier_color_code", drop column if exists "needs_underbase", drop column if exists "placement", drop column if exists "preview_url";`);

    this.addSql(`alter table if exists "print_job" add constraint "print_job_status_check" check("status" in ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));`);
  }

}
