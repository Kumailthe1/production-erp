CREATE DATABASE IF NOT EXISTS amsal_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE amsal_erp;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_name VARCHAR(100) NOT NULL DEFAULT 'api-login',
  token_hash CHAR(64) NOT NULL UNIQUE,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_access_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS production_parameters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  parameter_kind ENUM('input', 'packaging', 'config', 'output') NOT NULL,
  quantity_unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  default_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
  CONSTRAINT fk_supply_items_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE
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
  CONSTRAINT fk_inventory_layers_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_layers_receipt FOREIGN KEY (source_receipt_id) REFERENCES supply_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_layers_receipt_item FOREIGN KEY (source_receipt_item_id) REFERENCES supply_receipt_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS distributors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  address TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_number VARCHAR(100) NOT NULL UNIQUE,
  production_date DATE NOT NULL,
  batch_size_liters DECIMAL(12,3) NOT NULL DEFAULT 0,
  bottles_produced INT NOT NULL DEFAULT 0,
  selling_price_per_bottle DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  projected_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  projected_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('draft', 'completed', 'cancelled') NOT NULL DEFAULT 'completed',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_production_batches_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS production_batch_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  parameter_id BIGINT UNSIGNED NOT NULL,
  quantity_unit VARCHAR(50) NOT NULL,
  new_quantity_added DECIMAL(12,3) NOT NULL DEFAULT 0,
  inventory_quantity_issued DECIMAL(12,3) NOT NULL DEFAULT 0,
  inventory_unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  inventory_consumed_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  opening_leftover_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  total_available_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantity_consumed DECIMAL(12,3) NOT NULL DEFAULT 0,
  fresh_quantity_consumed DECIMAL(12,3) NOT NULL DEFAULT 0,
  leftover_quantity_consumed DECIMAL(12,3) NOT NULL DEFAULT 0,
  closing_leftover_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
  consumed_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_items_batch FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_batch_items_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS production_batch_expenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  expense_label VARCHAR(150) NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_expenses_batch FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS production_leftover_layers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parameter_id BIGINT UNSIGNED NOT NULL,
  source_batch_id BIGINT UNSIGNED NOT NULL,
  source_batch_item_id BIGINT UNSIGNED NOT NULL,
  original_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity_unit VARCHAR(50) NOT NULL,
  status ENUM('active', 'consumed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leftovers_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE,
  CONSTRAINT fk_leftovers_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_leftovers_batch_item FOREIGN KEY (source_batch_item_id) REFERENCES production_batch_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packaging_sizes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  volume_liters DECIMAL(10,3) NOT NULL,
  bottle_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  cap_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  label_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_packaging_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  default_selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_batch_packaging_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NOT NULL,
  volume_liters DECIMAL(10,3) NOT NULL,
  bottles_allocated INT NOT NULL DEFAULT 0,
  liters_allocated DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_packaging_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_liquid_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_total_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  selling_price_per_bottle DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_packaging_batch FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_batch_packaging_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finished_goods_layers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  available_on DATE NOT NULL,
  original_bottles INT NOT NULL DEFAULT 0,
  remaining_bottles INT NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  selling_price_per_bottle DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('active', 'consumed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_finished_goods_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_finished_goods_packaging_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS distributor_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(100) NOT NULL UNIQUE,
  distributor_id BIGINT UNSIGNED NOT NULL,
  selected_batch_id BIGINT UNSIGNED NOT NULL,
  order_date DATE NOT NULL,
  bottles_issued INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_type ENUM('cash', 'partial', 'credit') NOT NULL DEFAULT 'partial',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_of_goods_sold DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('draft', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributor_orders_distributor FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_orders_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_orders_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS distributor_order_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distributor_order_id BIGINT UNSIGNED NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash', 'transfer', 'pos', 'other') NOT NULL DEFAULT 'cash',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributor_payments_order FOREIGN KEY (distributor_order_id) REFERENCES distributor_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_payments_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS distributor_order_batch_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distributor_order_id BIGINT UNSIGNED NOT NULL,
  finished_goods_layer_id BIGINT UNSIGNED NOT NULL,
  source_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  bottles_allocated INT NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributor_allocations_order FOREIGN KEY (distributor_order_id) REFERENCES distributor_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_allocations_layer FOREIGN KEY (finished_goods_layer_id) REFERENCES finished_goods_layers(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_allocations_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_alloc_packaging_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS distributor_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distributor_order_id BIGINT UNSIGNED NOT NULL,
  selected_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NOT NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  bottles_issued INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributor_order_lines_order FOREIGN KEY (distributor_order_id) REFERENCES distributor_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_order_lines_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_order_lines_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS retail_sales (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_number VARCHAR(100) NOT NULL UNIQUE,
  selected_batch_id BIGINT UNSIGNED NOT NULL,
  sale_date DATE NOT NULL,
  customer_name VARCHAR(150) NULL,
  customer_phone VARCHAR(30) NULL,
  bottles_sold INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_type ENUM('cash', 'partial', 'credit') NOT NULL DEFAULT 'cash',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_of_goods_sold DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('draft', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_retail_sales_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_sales_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS retail_sale_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  retail_sale_id BIGINT UNSIGNED NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash', 'transfer', 'pos', 'other') NOT NULL DEFAULT 'cash',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_retail_payments_sale FOREIGN KEY (retail_sale_id) REFERENCES retail_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_payments_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS retail_sale_batch_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  retail_sale_id BIGINT UNSIGNED NOT NULL,
  finished_goods_layer_id BIGINT UNSIGNED NOT NULL,
  source_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  bottles_allocated INT NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_retail_allocations_sale FOREIGN KEY (retail_sale_id) REFERENCES retail_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_allocations_layer FOREIGN KEY (finished_goods_layer_id) REFERENCES finished_goods_layers(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_allocations_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_alloc_packaging_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS retail_sale_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  retail_sale_id BIGINT UNSIGNED NOT NULL,
  selected_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NOT NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  bottles_sold INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_retail_sale_lines_sale FOREIGN KEY (retail_sale_id) REFERENCES retail_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_sale_lines_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_sale_lines_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);
