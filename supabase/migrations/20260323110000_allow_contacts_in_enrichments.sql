-- Allow 'contacts' as a valid lead_table in lead_enrichments
alter table lead_enrichments drop constraint if exists lead_enrichments_lead_table_check;
alter table lead_enrichments add constraint lead_enrichments_lead_table_check
  check (lead_table in ('leads', 'cabo_leads', 'cre_leads', 'contacts'));
