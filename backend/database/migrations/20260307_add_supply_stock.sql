USE amsal_erp;

CREATE TABLE IF NOT EXISTS supply_receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(100) NOT NULL UNIQUE,
  supply_date DATE NOT NULL,
  supplier_name VARCHAR(150) NULL,
  status ENUM('draft', 'received', 'cancelled') NOT NULL DEFAULT 'received',
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_supply_receipts_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS supply_receipt_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_id BIGINT UNSIGNED NOT NULL,
  parameter_id BIGINT UNSIGNED NOT NULL,
  quantity_unit VARCHAR(50) NOT NULL,
  quantity_received DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantity_consumed DECIMAL(12,3) NOT NULL DEFAULT 0,
  remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_supply_items_receipt FOREIGN KEY (receipt_id) REFERENCES supply_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_supply_items_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id)
);

CREATE TABLE IF NOT EXISTS inventory_stock_layers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parameter_id BIGINT UNSIGNED NOT NULL,
  source_receipt_id BIGINT UNSIGNED NOT NULL,
  source_receipt_item_id BIGINT UNSIGNED NOT NULL,
  available_on DATE NOT NULL,
  original_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity_unit VARCHAR(50) NOT NULL,
  status ENUM('active', 'consumed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_layers_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id),
  CONSTRAINT fk_inventory_layers_receipt FOREIGN KEY (source_receipt_id) REFERENCES supply_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_layers_receipt_item FOREIGN KEY (source_receipt_item_id) REFERENCES supply_receipt_items(id) ON DELETE CASCADE
);

ALTER TABLE production_batch_items
  ADD COLUMN IF NOT EXISTS inventory_quantity_issued DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER new_quantity_added,
  ADD COLUMN IF NOT EXISTS inventory_unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER inventory_quantity_issued,
  ADD COLUMN IF NOT EXISTS inventory_consumed_cost DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER inventory_unit_cost;
