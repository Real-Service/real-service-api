-- Add new enum types
CREATE TYPE time_slot_status AS ENUM ('available', 'booked', 'unavailable');
CREATE TYPE schedule_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE job_dependency_type AS ENUM ('sequential', 'can_start_together', 'must_finish_before');

-- Create time_slots table for contractor availability
CREATE TABLE IF NOT EXISTS time_slots (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER NOT NULL REFERENCES users(id),
  date TIMESTAMP NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status time_slot_status NOT NULL DEFAULT 'available',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create job_schedules table for scheduling jobs
CREATE TABLE IF NOT EXISTS job_schedules (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_all_day BOOLEAN DEFAULT FALSE,
  status schedule_status NOT NULL DEFAULT 'scheduled',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create job_dependencies table for multi-trade job dependencies
CREATE TABLE IF NOT EXISTS job_dependencies (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  depends_on_job_id INTEGER NOT NULL REFERENCES jobs(id),
  dependency_type job_dependency_type NOT NULL DEFAULT 'sequential',
  delay_days INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create job_templates table for reusable job templates
CREATE TABLE IF NOT EXISTS job_templates (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_tags JSONB DEFAULT '[]',
  estimated_duration INTEGER NOT NULL DEFAULT 1,
  estimated_budget DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create job_template_tasks table for tasks within a job template
CREATE TABLE IF NOT EXISTS job_template_tasks (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES job_templates(id),
  description TEXT NOT NULL,
  estimated_hours DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create job_template_materials table for materials within a job template
CREATE TABLE IF NOT EXISTS job_template_materials (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES job_templates(id),
  description TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_time_slots_contractor_id ON time_slots(contractor_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots(date);
CREATE INDEX IF NOT EXISTS idx_job_schedules_job_id ON job_schedules(job_id);
CREATE INDEX IF NOT EXISTS idx_job_schedules_date_range ON job_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_job_dependencies_job_id ON job_dependencies(job_id);
CREATE INDEX IF NOT EXISTS idx_job_dependencies_depends_on_job_id ON job_dependencies(depends_on_job_id);
CREATE INDEX IF NOT EXISTS idx_job_templates_contractor_id ON job_templates(contractor_id);
CREATE INDEX IF NOT EXISTS idx_job_template_tasks_template_id ON job_template_tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_job_template_materials_template_id ON job_template_materials(template_id);