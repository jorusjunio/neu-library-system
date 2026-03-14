-- ============================================================
--  NEU Library System — Replace demo data with real students
--  Run this in MySQL Workbench
-- ============================================================

USE neu_library;

-- 1. Clear old demo data first
DELETE FROM visits;
DELETE FROM students;

-- 2. Insert real students
INSERT INTO students (school_id, name, college, type) VALUES
('26-00123-001', 'Jorus Junio',          'College of Informatics and Computing Studies', 'Student'),
('24-00456-002', 'Andrea Reyes',         'College of Nursing',                           'Student'),
('23-00789-003', 'Lourd Allen Amante',   'College of Engineering',                       'Student'),
('25-00321-004', 'Camille Dela Cruz',    'College of Business Administration',           'Student'),
('22-00654-005', 'Alexis Castro',        'College of Arts and Sciences',                 'Student'),
('24-00987-006', 'Trisha Bautista',      'College of Education',                         'Student'),
('23-00147-007', 'John Patrick Hawac',   'College of Informatics and Computing Studies', 'Student'),
('25-00258-008', 'Nicole Villanueva',    'College of Nursing',                           'Student'),
('22-00369-009', 'Paolo Ramos',          'College of Engineering',                       'Student'),
('FAC-2024-001', 'Prof. Maria Gonzales', 'College of Informatics and Computing Studies', 'Faculty'),
('FAC-2024-002', 'Prof. Jose Fernandez', 'College of Business Administration',           'Faculty');

-- 3. Verify
SELECT * FROM students;
