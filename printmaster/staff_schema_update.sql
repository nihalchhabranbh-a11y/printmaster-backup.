-- 1. Extend existing workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS salary_type text DEFAULT 'Monthly',
ADD COLUMN IF NOT EXISTS salary_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS salary_cycle text DEFAULT '1 to 1 Every month',
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;

-- 2. Create worker_attendance table
CREATE TABLE IF NOT EXISTS public.worker_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
    organisation_id text,
    date date NOT NULL,
    status text NOT NULL CHECK (status IN ('P', 'A', 'HD', 'PL', 'WO')),
    created_at timestamp with time zone DEFAULT now()
);

-- Ensure a worker has only one attendance record per day
CREATE UNIQUE INDEX IF NOT EXISTS unique_worker_attendance_date ON public.worker_attendance (worker_id, date);

-- 3. Create worker_transactions table (Ledger/Payroll)
CREATE TABLE IF NOT EXISTS public.worker_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
    organisation_id text,
    type text NOT NULL CHECK (type IN ('Salary', 'Advance', 'Payment', 'Deduction')),
    amount numeric NOT NULL DEFAULT 0,
    date timestamp with time zone DEFAULT now(),
    note text,
    created_at timestamp with time zone DEFAULT now()
);
