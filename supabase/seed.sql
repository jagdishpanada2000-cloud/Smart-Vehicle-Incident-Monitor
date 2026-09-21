-- OPTIONAL: presentation-only records. Run after the schema migration.
-- Owners are fictional. UI marks these incidents as samples. Samples do not affect risk history.
insert into public.registered_vehicles(plate_number,owner_name,vehicle_type,status) values
('MH12AB1234','Aarav Deshmukh','Car','ACTIVE'),
('MH14CD5678','Isha Kulkarni','Motorcycle','ACTIVE'),
('MH01XY9090','Rohan Patil','Car','BLOCKED'),
('MH04EF2468','Neha Joshi','Car','EXPIRED'),
('MH02GH1357','Kabir Mehta','Truck','ACTIVE'),
('MH43JK7788','Anaya Shah','Car','ACTIVE'),
('MH05LM4321','Dev Nair','Motorcycle','BLOCKED'),
('MH46NP6543','Sana Khan','Bus','ACTIVE'),
('MH03QR8877','Vihaan Rao','Car','EXPIRED'),
('24BH1234AA','Mira Sethi','Car','ACTIVE')
on conflict(plate_number) do nothing;

insert into public.incident_log(request_id,detected_text,detected_plate,matched_plate,vehicle_status,similarity_score,edit_distance,threshold,risk_level,risk_reasons,decision,reason,source,ai_status,is_sample,created_at)
select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  case when n%4=0 then 'MH01XY9090' when n%4=1 then 'MH12AB1234' when n%4=2 then 'MH14CD5678' else 'MH04EF2468' end,
  case when n%4=0 then 'MH01XY9090' when n%4=1 then 'MH12AB1234' when n%4=2 then 'MH14CD5678' else 'MH04EF2468' end,
  case when n%4=0 then 'MH01XY9090' when n%4=1 then 'MH12AB1234' when n%4=2 then 'MH14CD5678' else 'MH04EF2468' end,
  case when n%4=0 then 'BLOCKED' when n%4=3 then 'EXPIRED' else 'ACTIVE' end,
  100,0,60,
  case when n%4 in (0,3) then 'HIGH' else 'LOW' end,
  case when n%4 in (0,3) then '["Presentation sample: registration is blocked or expired."]'::jsonb else '["Presentation sample: exact active match and no prior denials."]'::jsonb end,
  case when n%4 in (0,3) then 'DENIED' else 'GRANTED' end,
  case when n%4=0 then 'Exact match, but registration is BLOCKED.' when n%4=3 then 'Exact match, but registration is EXPIRED.' else 'Active vehicle matched at 100%, meeting the 60% threshold.' end,
  'MANUAL','unavailable',true,now() - n * interval '5 hours'
from generate_series(1,24) n
on conflict(request_id) do nothing;
