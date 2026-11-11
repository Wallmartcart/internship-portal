let currentApplications = [];
let currentUserEmail = '';
let currentUserName = '';
let applicationStatus = {}; // internshipId -> status text from the server (e.g. 'Pending', 'Accepted')
let filterStatus = 'all'; // 'all', 'pending', 'completed'

// Escape text before putting it into innerHTML (company-written text is untrusted)
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
    // Load applications (also fetches the logged-in user + saved statuses)
    loadApplications();

    // Set up filter buttons
    document.getElementById('show-all-btn').addEventListener('click', () => setFilter('all'));
    document.getElementById('show-pending-btn').addEventListener('click', () => setFilter('pending'));
    document.getElementById('show-completed-btn').addEventListener('click', () => setFilter('completed'));
});

async function loadApplications() {
    const applicationList = document.getElementById('application-list');
    applicationList.innerHTML = '<div class="loading">Loading your applications...</div>';

    try {
        // Who is logged in?
        const sessionData = await (await fetch('/api/session', { credentials: 'include' })).json();
        if (!sessionData.loggedIn || sessionData.user.role !== 'student') {
            window.location.href = '/user/login';
            return;
        }
        currentUserName = sessionData.user.full_name || '';
        currentUserEmail = sessionData.user.email || '';

        // Which internships has this student already applied to? (stored in the database)
        const appsResponse = await fetch('/api/applications', { credentials: 'include' });
        if (!appsResponse.ok) throw new Error('Failed to fetch applications');
        applicationStatus = {};
        (await appsResponse.json()).forEach(a => { applicationStatus[a.internship_id] = a.status; });

        // Fetch bookmarks - now includes credentials for session cookies
        const bookmarksResponse = await fetch('/api/bookmarks', { credentials: 'include' });
        if (!bookmarksResponse.ok) {
            if (bookmarksResponse.status === 401) {
                // Redirect to login if unauthorized
                window.location.href = '/user/login';
                return;
            }
            throw new Error('Failed to fetch bookmarks');
        }

        const bookmarks = await bookmarksResponse.json();
        console.log('Fetched bookmarks:', bookmarks);

        // Show bookmarked internships plus anything already applied to
        const bookmarkedIds = bookmarks.map(b => b.id || b.internship_id)
            .concat(Object.keys(applicationStatus).map(Number));
        if (bookmarkedIds.length === 0) {
            showNoApplicationsMessage();
            return;
        }
        console.log('Bookmark IDs:', bookmarkedIds);

        // Get all internships
        const internshipsResponse = await fetch('/api/internships', { credentials: 'include' });
        if (!internshipsResponse.ok) {
            throw new Error('Failed to fetch internships');
        }

        const allInternships = await internshipsResponse.json();
        console.log('All internships:', allInternships.length);

        // Filter for bookmarked internships
        currentApplications = allInternships.filter(internship => bookmarkedIds.includes(internship.id));

        console.log('Current applications:', currentApplications.length);

        if (currentApplications.length === 0) {
            showNoApplicationsMessage();
            return;
        }

        displayApplications();
        updateStats();

    } catch (error) {
        console.error('Error loading applications:', error);
        applicationList.innerHTML = `
            <div class="error-message">
                <h3>😔 Error loading applications</h3>
                <p>${esc(error.message)}. Please try refreshing the page.</p>
                <button onclick="loadApplications()" style="margin-top: 10px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
}

function displayApplications() {
    const applicationList = document.getElementById('application-list');

    let applicationsToShow = currentApplications;
    if (filterStatus === 'pending') {
        applicationsToShow = currentApplications.filter(app => !applicationStatus[app.id]);
    } else if (filterStatus === 'completed') {
        applicationsToShow = currentApplications.filter(app => applicationStatus[app.id]);
    }

    if (applicationsToShow.length === 0) {
        const filterText = filterStatus === 'all' ? '' : ` (${filterStatus})`;
        applicationList.innerHTML = `
            <div class="no-applications">
                <h3>No applications found${filterText}</h3>
                <p>Try changing your filter or bookmark more internships.</p>
            </div>
        `;
        return;
    }

    applicationList.innerHTML = applicationsToShow.map(internship => {
        const isCompleted = applicationStatus[internship.id];
        const deadline = internship.deadline ? new Date(internship.deadline) : null;
        const today = new Date();

        let deadlineText = 'No deadline specified';
        let daysLeft = null;

        if (deadline) {
            daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
            deadlineText = deadline.toLocaleDateString();
            if (daysLeft < 0) {
                deadlineText += ' (Expired)';
            } else if (daysLeft <= 7) {
                deadlineText += ` (${daysLeft} days left)`;
            }
        }

        return `
            <div class="application-card" id="app-${internship.id}">
                <div class="application-status ${isCompleted ? 'completed' : ''}">
                    ${isCompleted ? 'Submitted · ' + esc(applicationStatus[internship.id]) : 'Pending'}
                </div>
                
                ${isCompleted ? '' : `<button class="remove-btn" onclick="removeApplication(${internship.id})" title="Remove from bookmarks">
                    ×
                </button>`}

                <div class="card-header">
                    <div class="card-title-section">
                        <h2>${esc(internship.title) || 'No Title'}</h2>
                        <div class="company-name">${esc(internship.company_name) || 'Company Name'}</div>
                    </div>
                </div>

                <div class="description">
                    ${esc(internship.description) || 'No description available.'}
                </div>

                <div class="card-content">
                    <p><strong>📍 Location:</strong> ${esc(internship.location) || 'Not specified'}</p>
                    <p><strong>⏱️ Duration:</strong> ${esc(internship.duration) || 'Not specified'}</p>
                    <p><strong>💰 Salary:</strong> ${esc(internship.salary) || 'Not specified'}</p>
                    <p><strong>📅 Deadline:</strong> ${deadlineText}</p>
                    <p><strong>🏢 Work Type:</strong> ${esc(internship.type) || 'Not specified'}</p>
                    <p><strong>🎯 Industry:</strong> ${esc(internship.industry) || 'Not specified'}</p>
                </div>

                <div class="tags">
                    ${internship.industry ? `<span class="tag">${esc(internship.industry)}</span>` : ''}
                    ${internship.type ? `<span class="tag">${esc(internship.type)}</span>` : ''}
                    ${daysLeft !== null && daysLeft <= 7 && daysLeft > 0 ? '<span class="tag">⚠️ Urgent</span>' : ''}
                    ${daysLeft !== null && daysLeft < 0 ? '<span class="tag">❌ Expired</span>' : ''}
                </div>

                ${isCompleted ? `
                    <div class="completed-message">
                        ✅ Application Successfully Submitted!
                        <br><small>Current status: <strong>${esc(applicationStatus[internship.id])}</strong></small>
                    </div>
                ` : `
                    <form class="application-form" onsubmit="submitApplication(event, ${internship.id})">
                        <h3>📝 Submit Your Application</h3>
                        
                        <div class="form-group">
                            <label for="name-${internship.id}">Full Name *</label>
                            <input type="text" id="name-${internship.id}" name="applicantName" required value="${esc(currentUserName)}">
                        </div>

                        <div class="form-group">
                            <label for="email-${internship.id}">Email Address *</label>
                            <input type="email" id="email-${internship.id}" name="applicantEmail" required value="${esc(currentUserEmail)}">
                        </div>

                        <div class="form-group">
                            <label for="phone-${internship.id}">Phone Number</label>
                            <input type="tel" id="phone-${internship.id}" name="phone" placeholder="e.g., +1234567890">
                        </div>

                        <div class="form-group">
                            <label for="cover-${internship.id}">Cover Letter *</label>
                            <textarea id="cover-${internship.id}" name="coverLetter" required 
                                      placeholder="Tell us why you're interested in this position and what makes you a great candidate..."></textarea>
                        </div>

                        <div class="form-group">
                            <label for="experience-${internship.id}">Relevant Experience</label>
                            <textarea id="experience-${internship.id}" name="experience" 
                                      placeholder="Describe any relevant experience, projects, or skills..."></textarea>
                        </div>

                        <button type="submit" class="submit-btn">
                            🚀 Submit Application
                        </button>
                    </form>
                `}
            </div>
        `;
    }).join('');
}

async function submitApplication(event, internshipId) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('.submit-btn');

    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Submitting...';

    const applicationData = {
        internshipId: internshipId,
        applicantName: formData.get('applicantName'),
        applicantEmail: formData.get('applicantEmail'),
        phone: formData.get('phone') || '',
        coverLetter: formData.get('coverLetter'),
        experience: formData.get('experience') || ''
    };

    try {
        // Submit to server with credentials included
        const response = await fetch('/api/applications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(applicationData)
        });

        if (response.ok) {
            applicationStatus[internshipId] = 'Pending';
            displayApplications();
            updateStats();
            alert('🎉 Application submitted successfully!');
        } else {
            const error = await response.json().catch(() => ({}));
            alert(`Error: ${error.error || 'Failed to submit application'}`);
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Submit Application';
        }
    } catch (error) {
        console.error('Error submitting application:', error);
        alert('Could not reach the server. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit Application';
    }
}

async function removeApplication(internshipId) {
    if (!confirm('Remove this internship from your bookmarks?')) {
        return;
    }

    try {
        const response = await fetch('/api/bookmarks', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ internshipId: internshipId })
        });

        if (response.ok) {
            currentApplications = currentApplications.filter(app => app.id !== internshipId);

            if (currentApplications.length === 0) {
                showNoApplicationsMessage();
            } else {
                displayApplications();
            }
            updateStats();

            alert('Removed from your bookmarks.');
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to remove application. Please try again.');
        }
    } catch (error) {
        console.error('Error removing application:', error);
        alert('Error removing application. Please try again.');
    }
}

function setFilter(status) {
    filterStatus = status;
    document.querySelectorAll('.filter-buttons button').forEach(btn => btn.classList.remove('active'));

    const activeButton = {
        'all': 'show-all-btn',
        'pending': 'show-pending-btn',
        'completed': 'show-completed-btn'
    }[status];

    document.getElementById(activeButton).classList.add('active');

    displayApplications();
}

function updateStats() {
    const total = currentApplications.length;
    const completed = currentApplications.filter(app => applicationStatus[app.id]).length;
    const pending = total - completed;

    document.getElementById('total-count').textContent = total;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('completed-count').textContent = completed;
}

function showNoApplicationsMessage() {
    const applicationList = document.getElementById('application-list');
    applicationList.innerHTML = `
        <div class="no-applications">
            <h3>📋 No Applications Yet</h3>
            <p>You haven't bookmarked any internships or applied to any yet.</p>
            <p><a href="/user/internships" style="color: #007bff; text-decoration: none; font-weight: bold;">Browse internships</a> and bookmark the ones you're interested in!</p>
        </div>
    `;

    document.getElementById('total-count').textContent = '0';
    document.getElementById('pending-count').textContent = '0';
    document.getElementById('completed-count').textContent = '0';
}
