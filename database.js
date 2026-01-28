const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'qa_testing.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
const initDatabase = () => {
  db.serialize(() => {
    // Test Cases Table
    db.run(`CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      industry TEXT NOT NULL,
      test_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      automation_status TEXT DEFAULT 'Manual',
      status TEXT DEFAULT 'Draft',
      assigned_to TEXT,
      preconditions TEXT,
      test_data TEXT,
      expected_execution_time TEXT,
      tags TEXT,
      reference_links TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Test Steps Table
    db.run(`CREATE TABLE IF NOT EXISTS test_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      action TEXT NOT NULL,
      expected_result TEXT NOT NULL,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(test_case_id)
    )`);

    // Requirements Table
    db.run(`CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requirement_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      priority TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Test Case - Requirements Mapping (RTM)
    db.run(`CREATE TABLE IF NOT EXISTS test_case_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_case_id TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(test_case_id),
      FOREIGN KEY (requirement_id) REFERENCES requirements(requirement_id)
    )`);

    // Test Plans Table
    db.run(`CREATE TABLE IF NOT EXISTS test_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      industry TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'Planning',
      assigned_to TEXT,
      total_test_cases INTEGER DEFAULT 0,
      executed_test_cases INTEGER DEFAULT 0,
      passed_test_cases INTEGER DEFAULT 0,
      failed_test_cases INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Test Execution Table
    db.run(`CREATE TABLE IF NOT EXISTS test_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT UNIQUE NOT NULL,
      test_case_id TEXT NOT NULL,
      test_plan_id TEXT,
      executed_by TEXT NOT NULL,
      execution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      actual_result TEXT,
      comments TEXT,
      environment TEXT,
      build_version TEXT,
      execution_time INTEGER,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(test_case_id),
      FOREIGN KEY (test_plan_id) REFERENCES test_plans(plan_id)
    )`);

    // Defects Table
    db.run(`CREATE TABLE IF NOT EXISTS defects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      defect_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT DEFAULT 'Open',
      test_case_id TEXT,
      assigned_to TEXT,
      reported_by TEXT NOT NULL,
      environment TEXT,
      steps_to_reproduce TEXT,
      expected_result TEXT,
      actual_result TEXT,
      attachments TEXT,
      resolution TEXT,
      resolution_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(test_case_id)
    )`);

    // Team Members Table
    db.run(`CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      specialization TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Test Environments Table
    db.run(`CREATE TABLE IF NOT EXISTS test_environments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      environment_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT,
      status TEXT DEFAULT 'Available',
      configuration TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Reports Table
    db.run(`CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT UNIQUE NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      date_range_start DATE,
      date_range_end DATE,
      industry_filter TEXT,
      phase_filter TEXT,
      generated_by TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_path TEXT,
      status TEXT DEFAULT 'Generated'
    )`);

    // Insert sample requirements
    db.run(`INSERT OR IGNORE INTO requirements (requirement_id, title, description, category, priority) VALUES
      ('REQ-001', 'User Authentication & Authorization', 'System must support secure user authentication', 'Security', 'Critical'),
      ('REQ-002', 'Data Encryption & Security', 'All sensitive data must be encrypted', 'Security', 'Critical'),
      ('REQ-003', 'Role-Based Access Control', 'Implement RBAC for system access', 'Security', 'High'),
      ('REQ-004', 'Audit Trail & Logging', 'Comprehensive audit logging required', 'Compliance', 'High'),
      ('REQ-005', 'HIPAA Compliance', 'Healthcare applications must be HIPAA compliant', 'Compliance', 'Critical'),
      ('REQ-006', 'PCI-DSS Compliance', 'Payment processing must meet PCI-DSS', 'Compliance', 'Critical')
    `);

    // Insert sample team members
    db.run(`INSERT OR IGNORE INTO team_members (member_id, name, email, role, specialization) VALUES
      ('TM-001', 'Sarah Johnson', 'sarah.j@qatest.com', 'Senior QA Engineer', 'Real Estate'),
      ('TM-002', 'Michael Chen', 'michael.c@qatest.com', 'QA Lead', 'Healthcare'),
      ('TM-003', 'Alex Rodriguez', 'alex.r@qatest.com', 'QA Engineer', 'AI/ML'),
      ('TM-004', 'David Kumar', 'david.k@qatest.com', 'Senior QA Engineer', 'Brokerage'),
      ('TM-005', 'Emma Wilson', 'emma.w@qatest.com', 'QA Engineer', 'Food & Beverage')
    `);

    // Insert sample test environments
    db.run(`INSERT OR IGNORE INTO test_environments (environment_id, name, type, url, status) VALUES
      ('ENV-001', 'Development', 'Development', 'https://dev.qatest.com', 'Available'),
      ('ENV-002', 'QA Testing', 'Testing', 'https://qa.qatest.com', 'Available'),
      ('ENV-003', 'Staging', 'Staging', 'https://staging.qatest.com', 'Available'),
      ('ENV-004', 'Production', 'Production', 'https://qatest.com', 'Available')
    `);

    console.log('✅ Database initialized successfully');
  });
};

// Helper function to run queries with promises
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
