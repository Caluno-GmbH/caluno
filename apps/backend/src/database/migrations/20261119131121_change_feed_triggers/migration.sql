CREATE OR REPLACE FUNCTION record_change_feed_entry() RETURNS trigger AS $$
DECLARE
  row_data jsonb := CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  INSERT INTO change_feed_entries (area, organization_unit_id, user_id)
  VALUES (TG_ARGV[0], (row_data->>'organization_unit_id')::uuid, row_data->>TG_ARGV[1]);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_change_feed AFTER INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION record_change_feed_entry('contracts', 'volunteer_id');
CREATE TRIGGER invoices_change_feed AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION record_change_feed_entry('invoices', 'volunteer_id');
CREATE TRIGGER membership_requests_change_feed AFTER INSERT OR UPDATE OR DELETE ON membership_requests
  FOR EACH ROW EXECUTE FUNCTION record_change_feed_entry('membership-requests', 'user_id');
