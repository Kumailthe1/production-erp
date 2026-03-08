USE amsal_erp;

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

CREATE TABLE IF NOT EXISTS finished_goods_layers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_batch_id BIGINT UNSIGNED NOT NULL,
  available_on DATE NOT NULL,
  original_bottles INT NOT NULL DEFAULT 0,
  remaining_bottles INT NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('active', 'consumed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_finished_goods_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
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
  CONSTRAINT fk_distributor_orders_distributor FOREIGN KEY (distributor_id) REFERENCES distributors(id),
  CONSTRAINT fk_distributor_orders_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id),
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
  bottles_allocated INT NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributor_allocations_order FOREIGN KEY (distributor_order_id) REFERENCES distributor_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_allocations_layer FOREIGN KEY (finished_goods_layer_id) REFERENCES finished_goods_layers(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_allocations_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
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
  CONSTRAINT fk_retail_sales_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id),
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
  bottles_allocated INT NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_retail_allocations_sale FOREIGN KEY (retail_sale_id) REFERENCES retail_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_allocations_layer FOREIGN KEY (finished_goods_layer_id) REFERENCES finished_goods_layers(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_allocations_batch FOREIGN KEY (source_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
);
