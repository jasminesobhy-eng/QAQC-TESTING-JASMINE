const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, runQuery, getQuery, allQuery } = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize database
initDatabase();

// ==================== UTILITY FUNCTIONS ====================

const generateId = (prefix) => {
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${randomNum}`;
};

// ==================== ROOT ROUTE ====================

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ==================== DASHBOARD ENDPOINTS ====================

// Get dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalTestCases = await getQuery('SELECT COUNT(*) as count FROM test_cases');
    const passedTests = await getQuery('SELECT COUNT(*) as count FROM test_executions WHERE status = "Passed"');
    const activeDefects = await getQuery('SELECT COUNT(*) as count FROM defects WHERE status NOT IN ("Closed", "Resolved")');
    const totalExecutions = await getQuery('SELECT COUNT(*) as count FROM test_executions');
    
    const coverage = totalTestCases.count > 0 
      ? ((passedTests.count / totalTestCases.count) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        totalTestCases: totalTestCases.count,
        passedTests: passedTests.count,
        activeDefects: activeDefects.count,
        testCoverage: parseFloat(coverage)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active test plans
app.get('/api/dashboard/test-plans', async (req, res) => {
  try {
    const plans = await allQuery(`
      SELECT * FROM test_plans 
      WHERE status IN ('Planning', 'In Progress', 'Completed')
      ORDER BY created_at DESC
      LIMIT 10
    `);
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent defects
app.get('/api/dashboard/recent-defects', async (req, res) => {
  try {
    const defects = await allQuery(`
      SELECT * FROM defects 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    res.json({ success: true, data: defects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TEST CASE ENDPOINTS ====================

// Get all test cases with filtering
app.get('/api/test-cases', async (req, res) => {
  try {
    const { industry, test_type, priority, status, search } = req.query;
    
    let sql = 'SELECT * FROM test_cases WHERE 1=1';
    const params = [];

    if (industry && industry !== 'All Industries') {
      sql += ' AND industry = ?';
      params.push(industry);
    }
    if (test_type && test_type !== 'All Types') {
      sql += ' AND test_type = ?';
      params.push(test_type);
    }
    if (priority && priority !== 'All Priorities') {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    if (status && status !== 'All Status') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (test_case_id LIKE ? OR title LIKE ? OR tags LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    
    const testCases = await allQuery(sql, params);
    res.json({ success: true, data: testCases });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single test case with steps
app.get('/api/test-cases/:id', async (req, res) => {
  try {
    const testCase = await getQuery('SELECT * FROM test_cases WHERE test_case_id = ?', [req.params.id]);
    
    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Test case not found' });
    }

    const steps = await allQuery('SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY step_number', [req.params.id]);
    const requirements = await allQuery(`
      SELECT r.* FROM requirements r
      JOIN test_case_requirements tcr ON r.requirement_id = tcr.requirement_id
      WHERE tcr.test_case_id = ?
    `, [req.params.id]);

    res.json({ 
      success: true, 
      data: { ...testCase, steps, requirements } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new test case
app.post('/api/test-cases', async (req, res) => {
  try {
    const {
      title,
      description,
      industry,
      test_type,
      priority,
      automation_status,
      assigned_to,
      preconditions,
      test_data,
      expected_execution_time,
      tags,
      reference_links,
      created_by,
      steps,
      requirements
    } = req.body;

    // Validation
    if (!title || !industry || !test_type || !priority) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: title, industry, test_type, priority' 
      });
    }

    const testCaseId = generateId('TC');

    // Insert test case
    await runQuery(`
      INSERT INTO test_cases (
        test_case_id, title, description, industry, test_type, priority,
        automation_status, assigned_to, preconditions, test_data,
        expected_execution_time, tags, reference_links, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testCaseId, title, description, industry, test_type, priority,
      automation_status || 'Manual', assigned_to, preconditions, test_data,
      expected_execution_time, tags, reference_links, created_by, 'Draft'
    ]);

    // Insert test steps
    if (steps && Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        await runQuery(`
          INSERT INTO test_steps (test_case_id, step_number, action, expected_result)
          VALUES (?, ?, ?, ?)
        `, [testCaseId, i + 1, steps[i].action, steps[i].expected_result]);
      }
    }

    // Link requirements
    if (requirements && Array.isArray(requirements)) {
      for (const reqId of requirements) {
        await runQuery(`
          INSERT INTO test_case_requirements (test_case_id, requirement_id)
          VALUES (?, ?)
        `, [testCaseId, reqId]);
      }
    }

    res.status(201).json({ 
      success: true, 
      message: 'Test case created successfully',
      data: { test_case_id: testCaseId }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update test case
app.put('/api/test-cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'steps' && key !== 'requirements') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await runQuery(`
      UPDATE test_cases SET ${fields.join(', ')} WHERE test_case_id = ?
    `, values);

    // Update steps if provided
    if (updates.steps) {
      await runQuery('DELETE FROM test_steps WHERE test_case_id = ?', [id]);
      for (let i = 0; i < updates.steps.length; i++) {
        await runQuery(`
          INSERT INTO test_steps (test_case_id, step_number, action, expected_result)
          VALUES (?, ?, ?, ?)
        `, [id, i + 1, updates.steps[i].action, updates.steps[i].expected_result]);
      }
    }

    // Update requirements if provided
    if (updates.requirements) {
      await runQuery('DELETE FROM test_case_requirements WHERE test_case_id = ?', [id]);
      for (const reqId of updates.requirements) {
        await runQuery(`
          INSERT INTO test_case_requirements (test_case_id, requirement_id)
          VALUES (?, ?)
        `, [id, reqId]);
      }
    }

    res.json({ success: true, message: 'Test case updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete test case
app.delete('/api/test-cases/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM test_steps WHERE test_case_id = ?', [req.params.id]);
    await runQuery('DELETE FROM test_case_requirements WHERE test_case_id = ?', [req.params.id]);
    await runQuery('DELETE FROM test_cases WHERE test_case_id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Test case deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TEST EXECUTION ENDPOINTS ====================

// Execute a test case
app.post('/api/test-executions', async (req, res) => {
  try {
    const {
      test_case_id,
      test_plan_id,
      executed_by,
      status,
      actual_result,
      comments,
      environment,
      build_version,
      execution_time
    } = req.body;

    if (!test_case_id || !executed_by || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const executionId = generateId('EXE');

    await runQuery(`
      INSERT INTO test_executions (
        execution_id, test_case_id, test_plan_id, executed_by,
        status, actual_result, comments, environment, build_version, execution_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      executionId, test_case_id, test_plan_id, executed_by,
      status, actual_result, comments, environment, build_version, execution_time
    ]);

    // Update test plan statistics
    if (test_plan_id) {
      await runQuery(`
        UPDATE test_plans 
        SET executed_test_cases = executed_test_cases + 1,
            ${status === 'Passed' ? 'passed_test_cases = passed_test_cases + 1' : ''},
            ${status === 'Failed' ? 'failed_test_cases = failed_test_cases + 1' : ''},
            updated_at = CURRENT_TIMESTAMP
        WHERE plan_id = ?
      `, [test_plan_id]);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Test execution recorded successfully',
      data: { execution_id: executionId }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get test execution history
app.get('/api/test-executions', async (req, res) => {
  try {
    const { test_case_id, test_plan_id } = req.query;
    let sql = 'SELECT * FROM test_executions WHERE 1=1';
    const params = [];

    if (test_case_id) {
      sql += ' AND test_case_id = ?';
      params.push(test_case_id);
    }
    if (test_plan_id) {
      sql += ' AND test_plan_id = ?';
      params.push(test_plan_id);
    }

    sql += ' ORDER BY execution_date DESC';
    const executions = await allQuery(sql, params);
    res.json({ success: true, data: executions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEFECT ENDPOINTS ====================

// Get all defects
app.get('/api/defects', async (req, res) => {
  try {
    const { status, severity, priority } = req.query;
    let sql = 'SELECT * FROM defects WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY created_at DESC';
    const defects = await allQuery(sql, params);
    res.json({ success: true, data: defects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new defect
app.post('/api/defects', async (req, res) => {
  try {
    const {
      title,
      description,
      severity,
      priority,
      test_case_id,
      assigned_to,
      reported_by,
      environment,
      steps_to_reproduce,
      expected_result,
      actual_result,
      attachments
    } = req.body;

    if (!title || !description || !severity || !priority || !reported_by) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const defectId = generateId('DEF');

    await runQuery(`
      INSERT INTO defects (
        defect_id, title, description, severity, priority, test_case_id,
        assigned_to, reported_by, environment, steps_to_reproduce,
        expected_result, actual_result, attachments, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      defectId, title, description, severity, priority, test_case_id,
      assigned_to, reported_by, environment, steps_to_reproduce,
      expected_result, actual_result, attachments, 'Open'
    ]);

    res.status(201).json({ 
      success: true, 
      message: 'Defect created successfully',
      data: { defect_id: defectId }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update defect
app.put('/api/defects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await runQuery(`
      UPDATE defects SET ${fields.join(', ')} WHERE defect_id = ?
    `, values);

    res.json({ success: true, message: 'Defect updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TEST PLAN ENDPOINTS ====================

// Get all test plans
app.get('/api/test-plans', async (req, res) => {
  try {
    const plans = await allQuery('SELECT * FROM test_plans ORDER BY created_at DESC');
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create test plan
app.post('/api/test-plans', async (req, res) => {
  try {
    const {
      name,
      description,
      industry,
      start_date,
      end_date,
      assigned_to
    } = req.body;

    if (!name || !industry) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const planId = generateId('PLAN');

    await runQuery(`
      INSERT INTO test_plans (plan_id, name, description, industry, start_date, end_date, assigned_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [planId, name, description, industry, start_date, end_date, assigned_to, 'Planning']);

    res.status(201).json({ 
      success: true, 
      message: 'Test plan created successfully',
      data: { plan_id: planId }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update test plan
app.put('/api/test-plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await runQuery(`
      UPDATE test_plans SET ${fields.join(', ')} WHERE plan_id = ?
    `, values);

    res.json({ success: true, message: 'Test plan updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REQUIREMENTS ENDPOINTS ====================

// Get all requirements
app.get('/api/requirements', async (req, res) => {
  try {
    const requirements = await allQuery('SELECT * FROM requirements ORDER BY requirement_id');
    res.json({ success: true, data: requirements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Requirements Traceability Matrix
app.get('/api/rtm', async (req, res) => {
  try {
    const rtm = await allQuery(`
      SELECT 
        r.requirement_id,
        r.title as requirement_title,
        r.priority,
        GROUP_CONCAT(tc.test_case_id) as test_cases,
        COUNT(tc.test_case_id) as test_case_count
      FROM requirements r
      LEFT JOIN test_case_requirements tcr ON r.requirement_id = tcr.requirement_id
      LEFT JOIN test_cases tc ON tcr.test_case_id = tc.test_case_id
      GROUP BY r.requirement_id
      ORDER BY r.requirement_id
    `);
    res.json({ success: true, data: rtm });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TEAM ENDPOINTS ====================

// Get team members
app.get('/api/team', async (req, res) => {
  try {
    const team = await allQuery('SELECT * FROM team_members WHERE status = "Active" ORDER BY name');
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENVIRONMENT ENDPOINTS ====================

// Get test environments
app.get('/api/environments', async (req, res) => {
  try {
    const environments = await allQuery('SELECT * FROM test_environments ORDER BY name');
    res.json({ success: true, data: environments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REPORTING ENDPOINTS ====================

// Generate comprehensive report
app.post('/api/reports/generate', async (req, res) => {
  try {
    const {
      report_type,
      title,
      date_range_start,
      date_range_end,
      industry_filter,
      phase_filter,
      generated_by,
      sections
    } = req.body;

    const reportId = generateId('RPT');
    const reportData = {};

    // Executive Summary
    if (sections.includes('executive_summary')) {
      const totalTests = await getQuery('SELECT COUNT(*) as count FROM test_cases');
      const totalExecutions = await getQuery('SELECT COUNT(*) as count FROM test_executions');
      const passedTests = await getQuery('SELECT COUNT(*) as count FROM test_executions WHERE status = "Passed"');
      const failedTests = await getQuery('SELECT COUNT(*) as count FROM test_executions WHERE status = "Failed"');
      const totalDefects = await getQuery('SELECT COUNT(*) as count FROM defects');
      const openDefects = await getQuery('SELECT COUNT(*) as count FROM defects WHERE status = "Open"');

      reportData.executive_summary = {
        total_test_cases: totalTests.count,
        total_executions: totalExecutions.count,
        passed_tests: passedTests.count,
        failed_tests: failedTests.count,
        pass_rate: totalExecutions.count > 0 ? ((passedTests.count / totalExecutions.count) * 100).toFixed(2) : 0,
        total_defects: totalDefects.count,
        open_defects: openDefects.count
      };
    }

    // Test Execution Details
    if (sections.includes('test_execution')) {
      let sql = 'SELECT * FROM test_executions WHERE 1=1';
      const params = [];
      
      if (date_range_start && date_range_end) {
        sql += ' AND execution_date BETWEEN ? AND ?';
        params.push(date_range_start, date_range_end);
      }
      
      reportData.test_executions = await allQuery(sql, params);
    }

    // Defect Analysis
    if (sections.includes('defect_analysis')) {
      const defectsBySeverity = await allQuery(`
        SELECT severity, COUNT(*) as count 
        FROM defects 
        GROUP BY severity
      `);
      
      const defectsByStatus = await allQuery(`
        SELECT status, COUNT(*) as count 
        FROM defects 
        GROUP BY status
      `);

      reportData.defect_analysis = {
        by_severity: defectsBySeverity,
        by_status: defectsByStatus
      };
    }

    // Quality Metrics
    if (sections.includes('quality_metrics')) {
      const avgExecutionTime = await getQuery(`
        SELECT AVG(execution_time) as avg_time 
        FROM test_executions 
        WHERE execution_time IS NOT NULL
      `);

      reportData.quality_metrics = {
        avg_execution_time: avgExecutionTime.avg_time || 0
      };
    }

    // RTM Coverage
    if (sections.includes('rtm_coverage')) {
      reportData.rtm_coverage = await allQuery(`
        SELECT 
          r.requirement_id,
          r.title,
          COUNT(tcr.test_case_id) as coverage_count
        FROM requirements r
        LEFT JOIN test_case_requirements tcr ON r.requirement_id = tcr.requirement_id
        GROUP BY r.requirement_id
      `);
    }

    // Save report to database
    await runQuery(`
      INSERT INTO reports (
        report_id, report_type, title, date_range_start, date_range_end,
        industry_filter, phase_filter, generated_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportId, report_type, title, date_range_start, date_range_end,
      industry_filter, phase_filter, generated_by, 'Generated'
    ]);

    res.status(201).json({ 
      success: true, 
      message: 'Report generated successfully',
      data: {
        report_id: reportId,
        report_data: reportData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get saved reports
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await allQuery('SELECT * FROM reports ORDER BY generated_at DESC LIMIT 50');
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

// Get test execution trends
app.get('/api/analytics/execution-trends', async (req, res) => {
  try {
    const trends = await allQuery(`
      SELECT 
        DATE(execution_date) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed
      FROM test_executions
      GROUP BY DATE(execution_date)
      ORDER BY date DESC
      LIMIT 30
    `);
    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get defect trends
app.get('/api/analytics/defect-trends', async (req, res) => {
  try {
    const trends = await allQuery(`
      SELECT 
        DATE(created_at) as date,
        severity,
        COUNT(*) as count
      FROM defects
      GROUP BY DATE(created_at), severity
      ORDER BY date DESC
      LIMIT 30
    `);
    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'QA Testing System API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        QA/QC Testing Management System - Backend         ║
║                                                           ║
║  🚀 Server running on http://localhost:${PORT}            ║
║  📊 Database: SQLite (qa_testing.db)                     ║
║  ✅ All endpoints operational                            ║
║                                                           ║
║  API Documentation:                                       ║
║  - GET  /api/health                                       ║
║  - GET  /api/dashboard/stats                             ║
║  - GET  /api/test-cases                                  ║
║  - POST /api/test-cases                                  ║
║  - GET  /api/defects                                     ║
║  - POST /api/defects                                     ║
║  - POST /api/reports/generate                            ║
║  - GET  /api/rtm                                         ║
║  - GET  /api/analytics/execution-trends                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
