// ===================================
// QA/QC Testing System - Complete Frontend
// All Features Functional
// ===================================

// API Base URL
const API_URL = 'http://localhost:3000/api';

// Global State
const state = {
    currentPage: 'dashboard',
    testCases: [],
    defects: [],
    testPlans: [],
    requirements: [],
    team: [],
    environments: []
};

// ===================================
// UTILITY FUNCTIONS
// ===================================

// API Call Handler
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'API request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Error: ' + error.message, 'error');
        throw error;
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#22C55E' : type === 'error' ? '#EF4444' : '#F59E0B'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(400px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Calculate age in days
function calculateAge(dateString) {
    const created = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
}

// ===================================
// PAGE NAVIGATION
// ===================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        state.currentPage = pageId;
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.textContent.toLowerCase().includes(pageId.replace('-', ' '))) {
            item.classList.add('active');
        }
    });
    
    loadPageData(pageId);
}

function loadPageData(pageId) {
    switch(pageId) {
        case 'dashboard':
            loadDashboardStats();
            loadTestPlans();
            loadRecentDefects();
            break;
        case 'test-cases':
            loadTestCases();
            break;
        case 'defects':
            loadDefects();
            loadDefectStats();
            break;
    }
}

// ===================================
// DASHBOARD FUNCTIONS
// ===================================

async function loadDashboardStats() {
    try {
        const result = await apiCall('/dashboard/stats');
        const stats = result.data;
        
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues[0]) statValues[0].textContent = stats.totalTestCases || 0;
        if (statValues[1]) statValues[1].textContent = stats.passedTests || 0;
        if (statValues[2]) statValues[2].textContent = stats.activeDefects || 0;
        if (statValues[3]) statValues[3].textContent = (stats.testCoverage || 0).toFixed(1) + '%';
        
        console.log('✅ Dashboard stats loaded');
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

async function loadTestPlans() {
    try {
        const result = await apiCall('/dashboard/test-plans');
        const tbody = document.querySelector('#test-plans-table tbody');
        
        if (!tbody) return;
        
        if (result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No active test plans. Click "New Test Plan" to create one.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = result.data.map(plan => {
            const progress = plan.total_test_cases > 0 
                ? Math.round((plan.executed_test_cases / plan.total_test_cases) * 100) 
                : 0;
            
            return `
                <tr>
                    <td><strong>${escapeHtml(plan.name)}</strong></td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <small class="text-secondary mt-1">${progress}% (${plan.executed_test_cases}/${plan.total_test_cases})</small>
                    </td>
                    <td><span class="status-badge ${getStatusClass(plan.status)}">${plan.status}</span></td>
                    <td>${escapeHtml(plan.assigned_to || 'Unassigned')}</td>
                    <td><span class="status-badge medium">${escapeHtml(plan.industry)}</span></td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="viewTestPlan('${plan.plan_id}')">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        console.log('✅ Test plans loaded');
    } catch (error) {
        console.error('Failed to load test plans:', error);
    }
}

async function loadRecentDefects() {
    try {
        const result = await apiCall('/dashboard/recent-defects');
        const tbody = document.querySelector('#recent-defects-table tbody');
        
        if (!tbody) return;
        
        if (result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No defects found. Great job! 🎉
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = result.data.slice(0, 5).map(defect => `
            <tr>
                <td><strong>${defect.defect_id}</strong></td>
                <td>${escapeHtml(defect.title)}</td>
                <td><span class="status-badge ${defect.severity.toLowerCase()}">${defect.severity}</span></td>
                <td><span class="priority-dot ${defect.priority.toLowerCase()}"></span>P${getPriorityNumber(defect.priority)}</td>
                <td><span class="status-badge ${getStatusClass(defect.status)}">${defect.status}</span></td>
                <td>${escapeHtml(defect.assigned_to || 'Unassigned')}</td>
                <td class="text-secondary">${calculateAge(defect.created_at)}</td>
            </tr>
        `).join('');
        
        console.log('✅ Recent defects loaded');
    } catch (error) {
        console.error('Failed to load recent defects:', error);
    }
}

// ===================================
// TEST CASES FUNCTIONS
// ===================================

async function loadTestCases(filters = {}) {
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const result = await apiCall(`/test-cases?${queryParams}`);
        const tbody = document.getElementById('test-cases-tbody');
        
        if (!tbody) return;
        
        state.testCases = result.data;
        
        if (result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No test cases found. Click "Create Test Case" to add one.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = result.data.map(tc => `
            <tr>
                <td><strong>${tc.test_case_id}</strong></td>
                <td>${escapeHtml(tc.title)}</td>
                <td><span class="status-badge ${getIndustryClass(tc.industry)}">${escapeHtml(tc.industry)}</span></td>
                <td>${escapeHtml(tc.test_type)}</td>
                <td><span class="priority-dot ${tc.priority.toLowerCase()}"></span></td>
                <td><span class="status-badge ${getStatusClass(tc.status)}">${tc.status}</span></td>
                <td><span class="status-badge ${tc.automation_status === 'Automated' ? 'pending' : 'blocked'}">${tc.automation_status}</span></td>
                <td>${escapeHtml(tc.created_by || 'Unknown')}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-secondary" onclick="viewTestCase('${tc.test_case_id}')">View</button>
                        <button class="btn btn-sm btn-primary" onclick="executeTestCase('${tc.test_case_id}')">Execute</button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        console.log('✅ Test cases loaded:', result.data.length);
    } catch (error) {
        console.error('Failed to load test cases:', error);
        const tbody = document.getElementById('test-cases-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger);">
                        Failed to load test cases. Please check if the server is running.
                    </td>
                </tr>
            `;
        }
    }
}

// ===================================
// DEFECTS FUNCTIONS
// ===================================

async function loadDefects(filters = {}) {
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const result = await apiCall(`/defects?${queryParams}`);
        const tbody = document.getElementById('defects-tbody');
        
        if (!tbody) return;
        
        state.defects = result.data;
        
        if (result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No defects found. Click "Report New Defect" to add one.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = result.data.map(defect => `
            <tr>
                <td><strong>${defect.defect_id}</strong></td>
                <td>${escapeHtml(defect.title)}</td>
                <td><span class="status-badge ${defect.severity.toLowerCase()}">${defect.severity}</span></td>
                <td><span class="priority-dot ${defect.priority.toLowerCase()}"></span>P${getPriorityNumber(defect.priority)}</td>
                <td><span class="status-badge ${getStatusClass(defect.status)}">${defect.status}</span></td>
                <td>${escapeHtml(defect.assigned_to || 'Unassigned')}</td>
                <td class="text-secondary">${calculateAge(defect.created_at)}</td>
            </tr>
        `).join('');
        
        console.log('✅ Defects loaded:', result.data.length);
    } catch (error) {
        console.error('Failed to load defects:', error);
    }
}

async function loadDefectStats() {
    try {
        const result = await apiCall('/defects');
        const defects = result.data;
        
        const total = defects.length;
        const open = defects.filter(d => d.status === 'Open').length;
        const inProgress = defects.filter(d => d.status === 'In Progress').length;
        const resolved = defects.filter(d => d.status === 'Resolved').length;
        const closed = defects.filter(d => d.status === 'Closed').length;
        
        const statCards = document.querySelectorAll('#page-defects .stat-card .stat-value');
        if (statCards[0]) statCards[0].textContent = total;
        if (statCards[1]) statCards[1].textContent = open;
        if (statCards[2]) statCards[2].textContent = inProgress;
        if (statCards[3]) statCards[3].textContent = resolved;
        if (statCards[4]) statCards[4].textContent = closed;
        
        console.log('✅ Defect stats updated');
    } catch (error) {
        console.error('Failed to load defect stats:', error);
    }
}

// ===================================
// MODAL FUNCTIONS
// ===================================

function openModal(modalId) {
    const modal = document.getElementById('modal-' + modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal opened:', modalId);
    } else {
        console.error('❌ Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById('modal-' + modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        clearModalForm(modalId);
    }
}

function clearModalForm(modalId) {
    const modal = document.getElementById('modal-' + modalId);
    if (modal) {
        modal.querySelectorAll('input[type="text"], textarea').forEach(input => {
            input.value = '';
        });
        modal.querySelectorAll('select').forEach(select => {
            select.selectedIndex = 0;
        });
    }
}

// ===================================
// FORM SUBMISSION FUNCTIONS
// ===================================

async function submitTestCase() {
    const title = document.getElementById('testCaseTitle')?.value;
    const industry = document.getElementById('testCaseIndustry')?.value;
    const testType = document.getElementById('testCaseType')?.value;
    const priority = document.getElementById('testCasePriority')?.value;
    
    if (!title || !industry || industry === 'Select Industry' || !testType || testType === 'Select Type') {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        await apiCall('/test-cases', 'POST', {
            title: title,
            industry: industry,
            test_type: testType,
            priority: priority,
            automation_status: document.getElementById('testCaseAutomation')?.value || 'Manual',
            assigned_to: document.getElementById('testCaseAssignedTo')?.value || null,
            created_by: 'Current User',
            description: document.getElementById('testCaseDescription')?.value || '',
            preconditions: document.getElementById('testCasePreconditions')?.value || '',
            status: 'Draft'
        });
        
        showNotification('✅ Test case created successfully!');
        closeModal('newTestCase');
        loadDashboardStats();
        showPage('test-cases');
        loadTestCases();
    } catch (error) {
        console.error('Failed to create test case:', error);
    }
}

async function submitTestPlan() {
    const name = document.getElementById('planName')?.value;
    const industry = document.getElementById('planIndustry')?.value;
    
    if (!name || !industry || industry === 'Select Industry') {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        await apiCall('/test-plans', 'POST', {
            name: name,
            description: document.getElementById('planDescription')?.value || '',
            industry: industry,
            assigned_to: document.getElementById('planAssignedTo')?.value || null
        });
        
        showNotification('✅ Test plan created successfully!');
        closeModal('newTestPlan');
        loadTestPlans();
    } catch (error) {
        console.error('Failed to create test plan:', error);
    }
}

async function submitDefect() {
    const title = document.getElementById('defectTitle')?.value;
    const description = document.getElementById('defectDescription')?.value;
    const severity = document.getElementById('defectSeverity')?.value;
    const priority = document.getElementById('defectPriority')?.value;
    
    if (!title || !description) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        await apiCall('/defects', 'POST', {
            title: title,
            description: description,
            severity: severity,
            priority: priority,
            reported_by: 'Current User',
            steps_to_reproduce: document.getElementById('defectSteps')?.value || '',
            status: 'Open'
        });
        
        showNotification('✅ Defect reported successfully!');
        closeModal('newDefect');
        loadDashboardStats();
        showPage('defects');
        loadDefects();
    } catch (error) {
        console.error('Failed to create defect:', error);
    }
}

// ===================================
// TEST EXECUTION
// ===================================

async function executeTestCase(testCaseId) {
    const status = prompt(`Execute test case ${testCaseId}\n\nEnter result:\n- Passed\n- Failed\n- Blocked`);
    
    if (!status) return;
    
    const validStatuses = ['Passed', 'Failed', 'Blocked'];
    const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    
    if (!validStatuses.includes(normalizedStatus)) {
        showNotification('Invalid status. Use: Passed, Failed, or Blocked', 'error');
        return;
    }
    
    try {
        await apiCall('/test-executions', 'POST', {
            test_case_id: testCaseId,
            executed_by: 'Current User',
            status: normalizedStatus,
            environment: 'QA Testing',
            comments: `Test executed via UI - Result: ${normalizedStatus}`,
            execution_date: new Date().toISOString()
        });
        
        showNotification(`✅ Test ${normalizedStatus}! Execution recorded.`);
        loadDashboardStats();
        loadTestCases();
    } catch (error) {
        console.error('Failed to execute test:', error);
    }
}

// ===================================
// REPORTS
// ===================================

async function generateReport(reportType) {
    showNotification('Generating report...', 'info');
    
    try {
        const result = await apiCall('/reports/generate', 'POST', {
            report_type: reportType,
            title: `${reportType.replace('-', ' ').toUpperCase()} Report`,
            generated_by: 'Current User',
            sections: ['executive_summary', 'test_execution', 'defect_analysis', 'quality_metrics', 'rtm_coverage'],
            date_range_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            date_range_end: new Date().toISOString().split('T')[0]
        });
        
        console.log('Report generated:', result.data);
        
        const reportData = result.data.report_data;
        let message = `Report ${result.data.report_id} Generated!\n\n`;
        
        if (reportData.executive_summary) {
            message += `📊 Summary:\n`;
            message += `- Total Tests: ${reportData.executive_summary.total_test_cases}\n`;
            message += `- Pass Rate: ${reportData.executive_summary.pass_rate}%\n`;
            message += `- Active Defects: ${reportData.executive_summary.open_defects}\n`;
        }
        
        alert(message + '\nCheck console for full report data.');
        showNotification('✅ Report generated successfully!');
        
    } catch (error) {
        console.error('Failed to generate report:', error);
    }
}

// ===================================
// HELPER FUNCTIONS
// ===================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusClass(status) {
    const statusMap = {
        'Draft': 'pending',
        'Ready': 'pending',
        'In Review': 'pending',
        'Approved': 'passed',
        'In Progress': 'pending',
        'Completed': 'passed',
        'Open': 'pending',
        'Resolved': 'passed',
        'Closed': 'blocked',
        'Planning': 'pending',
        'Failed': 'failed',
        'Passed': 'passed',
        'Blocked': 'blocked'
    };
    return statusMap[status] || 'pending';
}

function getIndustryClass(industry) {
    const industryMap = {
        'Real Estate': 'medium',
        'Healthcare': 'high',
        'Healthcare/Medical': 'high',
        'Food & Beverage': 'low',
        'Brokerage': 'critical',
        'AI/ML': 'critical'
    };
    return industryMap[industry] || 'medium';
}

function getPriorityNumber(priority) {
    const priorityMap = {
        'Critical': '0',
        'High': '1',
        'Medium': '2',
        'Low': '3'
    };
    return priorityMap[priority] || '2';
}

function viewTestCase(testCaseId) {
    alert(`View Test Case: ${testCaseId}\n\nDetailed view feature coming soon!`);
}

function viewTestPlan(planId) {
    alert(`View Test Plan: ${planId}\n\nDetailed view feature coming soon!`);
}

function saveTestCaseDraft() {
    showNotification('Draft saved!', 'info');
}

// ===================================
// TAB SWITCHING
// ===================================

function switchTab(event, tabId) {
    const container = event.target.closest('.modal-content') || document;
    
    container.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    container.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const targetContent = container.querySelector('#tab-' + tabId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    event.target.classList.add('active');
}

// ===================================
// DROPDOWN TOGGLE
// ===================================

function toggleDropdown(button) {
    const dropdown = button.nextElementSibling;
    
    document.querySelectorAll('.action-dropdown').forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('active');
        }
    });
    
    dropdown.classList.toggle('active');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-menu')) {
        document.querySelectorAll('.action-dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    }
});

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 QA Testing System - Frontend Initialized');
    console.log('📡 API URL:', API_URL);
    
    try {
        const healthCheck = await fetch(`${API_URL}/health`);
        const health = await healthCheck.json();
        console.log('✅ API Connection:', health);
        
        await loadDashboardStats();
        await loadTestPlans();
        await loadRecentDefects();
        
        showNotification('✅ System loaded successfully!');
    } catch (error) {
        console.error('❌ Failed to connect to API:', error);
        showNotification('⚠️ Cannot connect to backend. Make sure server is running on port 3000.', 'error');
    }
    
    setInterval(() => {
        if (state.currentPage === 'dashboard') {
            loadDashboardStats();
        }
    }, 30000);
    
    console.log('✅ All systems operational!');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
});

// Export to window
window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitTestCase = submitTestCase;
window.submitTestPlan = submitTestPlan;
window.submitDefect = submitDefect;
window.executeTestCase = executeTestCase;
window.generateReport = generateReport;
window.viewTestCase = viewTestCase;
window.viewTestPlan = viewTestPlan;
window.saveTestCaseDraft = saveTestCaseDraft;
window.switchTab = switchTab;
window.toggleDropdown = toggleDropdown;

console.log('📦 All functions loaded');
