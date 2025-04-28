-- Create quote_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'revised');
  END IF;
END
$$;

-- Create invoice_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');
  END IF;
END
$$;

-- Create payment_method enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'check', 'credit_card', 'bank_transfer', 'paypal', 'venmo', 'other');
  END IF;
END
$$;

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  contractor_id INTEGER NOT NULL REFERENCES users(id),
  landlord_id INTEGER NOT NULL REFERENCES users(id),
  quote_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status quote_status NOT NULL DEFAULT 'draft',
  subtotal DOUBLE PRECISION NOT NULL,
  tax_rate DOUBLE PRECISION DEFAULT 0,
  tax_amount DOUBLE PRECISION DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  notes TEXT,
  terms TEXT,
  valid_until TIMESTAMP,
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  viewed_at TIMESTAMP,
  payment_methods JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create quote_line_items table
CREATE TABLE IF NOT EXISTS quote_line_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  quote_id INTEGER REFERENCES quotes(id),
  contractor_id INTEGER NOT NULL REFERENCES users(id),
  landlord_id INTEGER NOT NULL REFERENCES users(id),
  invoice_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal DOUBLE PRECISION NOT NULL,
  tax_rate DOUBLE PRECISION DEFAULT 0,
  tax_amount DOUBLE PRECISION DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  amount_paid DOUBLE PRECISION DEFAULT 0,
  notes TEXT,
  terms TEXT,
  due_date TIMESTAMP,
  issued_date TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_date TIMESTAMP,
  payment_method payment_method,
  payment_details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contractor_id ON quotes(contractor_id);
CREATE INDEX IF NOT EXISTS idx_quotes_landlord_id ON quotes(landlord_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);

CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contractor_id ON invoices(contractor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_landlord_id ON invoices(landlord_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);