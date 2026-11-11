// Escape text before putting it into innerHTML (company-written text is untrusted)
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let allInternships = [];
let filteredInternships = [];
let bookmarkedInternships = new Set();

document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('internship-list');
    const filterInput = document.getElementById('filter-input');
    const industryFilter = document.getElementById('industry-filter');
    const workTypeFilter = document.getElementById('work-type-filter');
    const locationFilter = document.getElementById('location-filter');
    const salaryFilter = document.getElementById('salary-filter');
    const sortBy = document.getElementById('sort-by');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const resultsCount = document.getElementById('results-count');

    // Fetch internships and bookmarks
    fetchInternships();
    fetchBookmarks();

    async function fetchInternships() {
        try {
            const response = await fetch('/api/internships');
            if (!response.ok) throw new Error('Failed to fetch internships');
            allInternships = await response.json();
            filteredInternships = [...allInternships];
            displayInternships(filteredInternships);
            updateResultsCount();
        } catch (error) {
            console.error('Error fetching internships:', error);
            listContainer.innerHTML = `
                <div class="no-results">
                    <h3>😔 Error loading internships</h3>
                    <p>Please try refreshing the page or contact support if the problem persists.</p>
                </div>`;
        }
    }

    async function fetchBookmarks() {
        try {
            const response = await fetch(`/api/bookmarks`);
            if (response.ok) {
                const bookmarks = await response.json();
                bookmarkedInternships = new Set(bookmarks.map(b => b.internship_id));
                if (filteredInternships.length > 0) {
                    displayInternships(filteredInternships);
                }
            }
        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    }

    filterInput.addEventListener('input', debounce(applyFilters, 300));
    locationFilter.addEventListener('input', debounce(applyFilters, 300));
    salaryFilter.addEventListener('input', debounce(applyFilters, 300));
    industryFilter.addEventListener('change', applyFilters);
    workTypeFilter.addEventListener('change', applyFilters);
    sortBy.addEventListener('change', applyFilters);
    applyFiltersBtn.addEventListener('click', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    function applyFilters() {
        const searchQuery = filterInput.value.toLowerCase().trim();
        const industryValue = industryFilter.value;
        const workTypeValue = workTypeFilter.value;
        const locationValue = locationFilter.value.toLowerCase().trim();
        const minSalary = parseInt(salaryFilter.value) || 0;

        filteredInternships = allInternships.filter(internship => {
            const matchesSearch = !searchQuery ||
                (internship.title && internship.title.toLowerCase().includes(searchQuery)) ||
                (internship.company_name && internship.company_name.toLowerCase().includes(searchQuery)) ||
                (internship.description && internship.description.toLowerCase().includes(searchQuery));
            const matchesIndustry = !industryValue || internship.industry === industryValue;
            const matchesWorkType = !workTypeValue || internship.type === workTypeValue;
            const matchesLocation = !locationValue || (internship.location && internship.location.toLowerCase().includes(locationValue));
            const salaryMatch = () => {
                if (minSalary === 0) return true;
                if (!internship.salary) return false;
                const salaryText = internship.salary.toString().toLowerCase();
                const numbers = salaryText.match(/\d+,?\d+/g);
                if (!numbers) return false;
                const salary = parseInt(numbers[0].replace(',', ''));
                return salaryText.includes('week') ? (salary * 4) >= minSalary : salary >= minSalary;
            };
            return matchesSearch && matchesIndustry && matchesWorkType && matchesLocation && salaryMatch();
        });

        const sortValue = sortBy.value;
        filteredInternships.sort((a, b) => {
            switch (sortValue) {
                case 'company': return (a.company_name || '').localeCompare(b.company_name || '');
                case 'position': return (a.title || '').localeCompare(b.title || '');
                case 'location': return (a.location || '').localeCompare(b.location || '');
                case 'salary':
                    const getSalaryValue = (salaryRange) => {
                        if (!salaryRange) return 0;
                        const numbers = salaryRange.match(/\d+,?\d+/g);
                        if (!numbers) return 0;
                        let salary = parseInt(numbers[0].replace(',', ''));
                        return salaryRange.toLowerCase().includes('week') ? salary * 4 : salary;
                    };
                    return getSalaryValue(b.salary) - getSalaryValue(a.salary);
                case 'deadline':
                default:
                    return new Date(a.deadline || 0) - new Date(b.deadline || 0);
            }
        });

        displayInternships(filteredInternships);
        updateResultsCount();
    }

    function clearFilters() {
        filterInput.value = '';
        industryFilter.value = '';
        workTypeFilter.value = '';
        locationFilter.value = '';
        salaryFilter.value = '';
        sortBy.value = 'deadline';
        filteredInternships = [...allInternships];
        displayInternships(filteredInternships);
        updateResultsCount();
    }

    function updateResultsCount() {
        resultsCount.textContent = `Showing ${filteredInternships.length} of ${allInternships.length} internships`;
    }

    function displayInternships(internships) {
        if (internships.length === 0) {
            listContainer.innerHTML = `
                <div class="no-results">
                    <h3>😔 No internships found</h3>
                    <p>Try adjusting your filters or search terms to find more opportunities.</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = internships.map(internship => {
            const deadline = internship.deadline ? new Date(internship.deadline) : null;
            const today = new Date();
            let deadlineText = 'No deadline', isUrgent = false, isExpired = false;

            if (deadline) {
                const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                isUrgent = daysLeft <= 7 && daysLeft > 0;
                isExpired = daysLeft < 0;
                deadlineText = deadline.toLocaleDateString() + (isExpired ? ' (Expired)' : isUrgent ? ` (${daysLeft} days left)` : '');
            }

            return `
                <div class="internship-card">
                    <button class="bookmark-btn ${bookmarkedInternships.has(internship.id) ? 'bookmarked' : 'not-bookmarked'}" 
                            onclick="toggleBookmark(${internship.id})">
                        ${bookmarkedInternships.has(internship.id) ? '★' : '☆'}
                    </button>
                    <div class="card-header">
                        <div class="card-title-section">
                            <h2>${esc(internship.title) || 'No title'}</h2>
                            <div class="company-name">${esc(internship.company_name) || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="description">${esc(internship.description)}</div>
                    <div class="card-content">
                        <p><strong>📍 Location:</strong> ${esc(internship.location) || 'Not specified'}</p>
                        <p><strong>⏱️ Duration:</strong> ${esc(internship.duration) || 'Not specified'}</p>
                        <p><strong>💰 Salary:</strong> ${esc(internship.salary) || 'Not specified'}</p>
                        <p><strong>📅 Deadline:</strong> ${deadlineText}</p>
                        <p><strong>🏢 Work Type:</strong> ${esc(internship.type) || 'Not specified'}</p>
                        <p><strong>🎯 Industry:</strong> ${esc(internship.industry) || 'Not specified'}</p>
                    </div>
                    <div class="tags">
                        <span class="tag">${esc(internship.industry)}</span>
                        <span class="tag">${esc(internship.type)}</span>
                        ${isUrgent ? '<span class="tag">⚠️ Urgent</span>' : ''}
                        ${isExpired ? '<span class="tag">❌ Expired</span>' : ''}
                    </div>
                </div>`;
        }).join('');
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});

async function toggleBookmark(internshipId) {
    const isBookmarked = bookmarkedInternships.has(internshipId);
    if (isBookmarked) {
        await removeBookmark(internshipId);
    } else {
        await addBookmark(internshipId);
    }
}

async function addBookmark(internshipId) {
    try {
        const response = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ internshipId })
        });

        if (response.ok) {
            bookmarkedInternships.add(internshipId);
            updateBookmarkButton(internshipId, true);
            alert('Internship bookmarked!');
        } else {
            const error = await response.json();
            alert(error.error || 'Bookmark failed');
        }
    } catch (error) {
        console.error('Error bookmarking:', error);
        alert('Something went wrong. Try again.');
    }
}

async function removeBookmark(internshipId) {
    try {
        const response = await fetch('/api/bookmarks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ internshipId })
        });

        if (response.ok) {
            bookmarkedInternships.delete(internshipId);
            updateBookmarkButton(internshipId, false);
            alert('Bookmark removed');
        } else {
            const error = await response.json();
            alert(error.error || 'Remove failed');
        }
    } catch (error) {
        console.error('Error removing bookmark:', error);
        alert('Something went wrong. Try again.');
    }
}


document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/session', { credentials: 'include' });
    const data = await response.json();

    if (!data.loggedIn) {
      window.location.href = '/user/login'; // redirect if not logged in
      return;
    }

  } catch (err) {
    console.error('Session fetch error:', err);
  }
});


function updateBookmarkButton(internshipId, isBookmarked) {
    const button = document.querySelector(`[onclick="toggleBookmark(${internshipId})"]`);
    if (button) {
        button.textContent = isBookmarked ? '★' : '☆';
        button.className = `bookmark-btn ${isBookmarked ? 'bookmarked' : 'not-bookmarked'}`;
    }
}
