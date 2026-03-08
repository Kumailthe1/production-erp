USE amsal_erp;

INSERT INTO users (full_name, email, phone, password_hash, role, status)
VALUES (
  'Kumailthe1',
  'kumailthe1@gmail.com',
  NULL,
  '$2y$12$7/PdsyZym0f3qlKgaQHzTuMJZPz77nDzRHESdNdsEZDIV9s6.EHqq',
  'admin',
  'active'
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  status = VALUES(status);

INSERT INTO production_parameters
  (name, code, parameter_kind, quantity_unit, unit_cost, default_quantity, notes, sort_order, is_active)
VALUES
  ('Base Batch Size', 'base_batch_size', 'config', 'liter', 0, 50, 'Default planning size from the workbook', 1, 1),
  ('Milk', 'milk', 'input', 'kg', 850, 12, 'Milk price per kg', 10, 1),
  ('Sugar', 'sugar', 'input', 'kg', 1450, 4, 'Sugar price per kg', 20, 1),
  ('Stabilizer', 'stabilizer', 'input', 'gram', 2.5, 250, 'Estimated stabilizer cost per gram', 30, 1),
  ('Bottle', 'bottle', 'packaging', 'piece', 55, 100, 'Bottle cost per piece', 40, 1),
  ('Label', 'label', 'packaging', 'piece', 15, 100, 'Label cost per piece', 50, 1),
  ('Bottle Size', 'bottle_size', 'config', 'ml', 0, 500, 'Default bottle size', 60, 1),
  ('Selling Price per Bottle', 'selling_price_per_bottle', 'output', 'naira', 0, 500, 'Projected selling price per bottle', 70, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  parameter_kind = VALUES(parameter_kind),
  quantity_unit = VALUES(quantity_unit),
  unit_cost = VALUES(unit_cost),
  default_quantity = VALUES(default_quantity),
  notes = VALUES(notes),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO packaging_sizes
  (name, code, volume_liters, bottle_cost, cap_cost, label_cost, extra_packaging_cost, default_selling_price, status)
VALUES
  ('0.5L Bottle', 'bottle_0_5l', 0.5, 55, 10, 15, 0, 500, 'active'),
  ('1.0L Bottle', 'bottle_1l', 1.0, 70, 12, 18, 0, 900, 'active'),
  ('2.0L Bottle', 'bottle_2l', 2.0, 95, 15, 25, 0, 1700, 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  volume_liters = VALUES(volume_liters),
  bottle_cost = VALUES(bottle_cost),
  cap_cost = VALUES(cap_cost),
  label_cost = VALUES(label_cost),
  extra_packaging_cost = VALUES(extra_packaging_cost),
  default_selling_price = VALUES(default_selling_price),
  status = VALUES(status);
