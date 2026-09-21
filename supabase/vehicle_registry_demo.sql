-- SENTINEL vehicle registry: fictional presentation data only.
-- Run this in Supabase SQL Editor after SETUP.sql.
-- Existing plates are preserved; duplicates are skipped.

insert into public.registered_vehicles
  (plate_number, owner_name, vehicle_type, status)
values
  ('MH12AB1234', 'Aarav Deshmukh', 'Car', 'ACTIVE'),
  ('MH14CD5678', 'Isha Kulkarni', 'Motorcycle', 'ACTIVE'),
  ('MH01XY9090', 'Rohan Patil', 'Car', 'BLOCKED'),
  ('MH04EF2468', 'Neha Joshi', 'Car', 'EXPIRED'),
  ('MH02GH1357', 'Kabir Mehta', 'Truck', 'ACTIVE'),
  ('MH43JK7788', 'Anaya Shah', 'Car', 'ACTIVE'),
  ('MH05LM4321', 'Dev Nair', 'Motorcycle', 'BLOCKED'),
  ('MH46NP6543', 'Sana Khan', 'Bus', 'ACTIVE'),
  ('MH03QR8877', 'Vihaan Rao', 'Car', 'EXPIRED'),
  ('24BH1234AA', 'Mira Sethi', 'Car', 'ACTIVE'),
  ('MH12ST2198', 'Aditya Jadhav', 'Car', 'ACTIVE'),
  ('MH14UV4582', 'Pooja Bhosale', 'Motorcycle', 'ACTIVE'),
  ('MH01WX7612', 'Kunal More', 'Car', 'ACTIVE'),
  ('MH02YZ3490', 'Riya Chavan', 'Car', 'BLOCKED'),
  ('MH04AA7415', 'Siddharth Kulkarni', 'Truck', 'ACTIVE'),
  ('MH12BC8046', 'Tanya Sharma', 'Car', 'ACTIVE'),
  ('MH14DE6913', 'Harsh Vora', 'Motorcycle', 'EXPIRED'),
  ('MH01FG5258', 'Nisha Naik', 'Car', 'ACTIVE'),
  ('MH43HJ9172', 'Omkar Shinde', 'Bus', 'ACTIVE'),
  ('MH05KL3469', 'Aditi Sawant', 'Car', 'BLOCKED'),
  ('MH46MN1384', 'Pranav Joshi', 'Truck', 'ACTIVE'),
  ('MH03PQ6710', 'Sakshi Patil', 'Motorcycle', 'ACTIVE'),
  ('MH12RS2945', 'Yash Thakur', 'Car', 'ACTIVE'),
  ('MH14TU7306', 'Ira Malhotra', 'Car', 'EXPIRED'),
  ('MH01VW8621', 'Ritesh Kapoor', 'Car', 'ACTIVE'),
  ('MH02XY4173', 'Meera Iyer', 'Motorcycle', 'ACTIVE'),
  ('MH04ZA5839', 'Arjun Shetty', 'Truck', 'BLOCKED'),
  ('MH43AB2607', 'Kavya Menon', 'Car', 'ACTIVE'),
  ('MH05CD9754', 'Nikhil Bendre', 'Motorcycle', 'ACTIVE'),
  ('MH46EF3186', 'Ayesha Ansari', 'Bus', 'EXPIRED')
on conflict (plate_number) do nothing;

-- Verify the registry after inserting.
select plate_number, owner_name, vehicle_type, status, created_at
from public.registered_vehicles
order by plate_number;
