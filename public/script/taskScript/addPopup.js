// Handle submit button click inside form
document.getElementById('submitTaskBtn').addEventListener('click', function () {
    const taskNameInput = document.getElementById('taskName');
    if (!taskNameInput.value.trim()) {
        alert('กรุณากรอกชื่อของงาน');
        event.preventDefault();
        return false;
    }
    prepareFormData().then(() => {
        document.getElementById('taskForm').submit();
    });
});
// Function to prepare form data
async function prepareFormData() {
    const dueDateInput = document.getElementById('dueDate');
    const startDateInput = document.getElementById('startDate');
    const isoDate = dueDateInput.dataset.isoDate || "";
    const isoStartDate = startDateInput.dataset.isoDate || "";

    console.log("📅 ISO Date ที่ถูกส่งไป: ", isoDate);

    if (isoDate) {
        dueDateInput.value = isoDate;
    } else {
        console.warn("⚠️ ไม่มีค่า Due Date ที่ถูกเลือก!");
    }

    if (isoStartDate) {
        startDateInput.value = isoStartDate;
    } else {
        console.warn("⚠️ ไม่มีค่า Start Date ที่ถูกเลือก!");
    }

    return true;
}

// detail
document.addEventListener('DOMContentLoaded', function () {
    const detailTextarea = document.getElementById('taskDetail');

    detailTextarea.addEventListener('focus', function () {
        detailTextarea.style.transition = 'height 0.3s ease-in-out';
        detailTextarea.style.height = '100px';
    });

    detailTextarea.addEventListener('blur', function () {
        if (!detailTextarea.value) {
            detailTextarea.style.height = '40px';
        }
    });

    detailTextarea.addEventListener('input', function () {
        if (detailTextarea.value) {
            detailTextarea.style.height = '100px';
        }
    });
});

// status
document.addEventListener('DOMContentLoaded', async function () {
    const statusDropdown = document.querySelector('#statusDropdown');
    const spaceId = document.querySelector('#spaceId').value;
    const statusToggle = document.querySelector('#statusToggle');
    const statusSection = document.querySelector('.status-section'); // เลือก status-section
    const currentStatus = document.querySelector('#currentStatus');
    const taskStatusInput = document.querySelector('#taskStatus');
    const statusIdInput = document.querySelector('#statusId');

    // กำหนดสีของแต่ละสถานะ
    const statusColors = {
        toDo: '#44546f',
        inProgress: '#0880ea',
        fix: '#F93827',
        finished: '#299764'
    };

    // ฟังก์ชันอัปเดตสีพื้นหลังของ .status-section
    function updateStatusSectionColor(status) {
        if (statusColors[status]) {
            statusSection.style.backgroundColor = statusColors[status];
            statusSection.style.color = '#fff'; // ปรับสีข้อความให้ชัดขึ้น
            statusSection.style.padding = '8px 12px';
            statusSection.style.borderRadius = '5px';
        }
    }

    // Fetch statuses from the server
    async function fetchStatuses() {
        try {
            const response = await fetch(`/${spaceId}/statuses`);
            if (!response.ok) {
                throw new Error('Failed to fetch statuses');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching statuses:', error);
            return [];
        }
    }

    // Populate the dropdown with statuses
    async function populateDropdown() {
        const statuses = await fetchStatuses();
        if (statuses.length === 0) {
            statusDropdown.innerHTML = '<p>ไม่มีสถานะที่พร้อมใช้งาน</p>';
            return;
        }

        statusDropdown.innerHTML = ''; // Clear existing options
        statuses.forEach(status => {
            const option = document.createElement('div');
            option.classList.add('status-option');
            option.setAttribute('data-status-id', status._id);
            option.setAttribute('data-status', status.category);
            option.textContent = status.name;

            // ตั้งค่าพื้นหลังของแต่ละสถานะ
            if (statusColors[status.category]) {
                option.style.backgroundColor = statusColors[status.category];
                option.style.color = '#fff';
                option.style.padding = '8px';
                option.style.borderRadius = '5px';
                option.style.cursor = 'pointer';
            }

            // Mark "toDo" as the default selection
            if (status.category === 'toDo') {
                currentStatus.textContent = status.name;
                taskStatusInput.value = 'toDo';
                statusIdInput.value = status._id;
                updateStatusSectionColor('toDo'); // ตั้งค่าสีเริ่มต้น
            }

            statusDropdown.appendChild(option);
        });
    }

    // Toggle dropdown visibility
    statusToggle.addEventListener('click', function () {
        const isDropdownVisible = statusDropdown.style.display === 'block';
        statusDropdown.style.display = isDropdownVisible ? 'none' : 'block';
    });

    // Handle status selection
    statusDropdown.addEventListener('click', function (event) {
        const selectedOption = event.target.closest('.status-option');
        if (selectedOption) {
            const selectedStatus = selectedOption.getAttribute('data-status');
            const selectedStatusId = selectedOption.getAttribute('data-status-id');

            // Update the current status display and hidden inputs
            currentStatus.textContent = selectedOption.textContent;
            taskStatusInput.value = selectedStatus;
            statusIdInput.value = selectedStatusId;

            // อัปเดตสีของ .status-section
            updateStatusSectionColor(selectedStatus);

            // Hide the dropdown
            statusDropdown.style.display = 'none';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (event) {
        if (!statusToggle.contains(event.target) && !statusDropdown.contains(event.target)) {
            statusDropdown.style.display = 'none';
        }
    });

    // Populate the dropdown and set the default value
    await populateDropdown();
});

// priority
document.addEventListener('DOMContentLoaded', function () {
    const priorityToggle = document.querySelector('#priorityToggle');
    const priorityDropdown = document.querySelector('#priorityDropdown');
    const currentPriority = document.querySelector('#currentPriority');
    const taskPriorityInput = document.querySelector('#taskPriority');

    // Toggle dropdown visibility
    priorityToggle.addEventListener('click', function () {
        priorityDropdown.style.display = priorityDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Handle priority selection
    priorityDropdown.addEventListener('click', function (event) {
        const selectedOption = event.target.closest('.priority-option');
        if (selectedOption) {
            const selectedPriority = selectedOption.getAttribute('data-priority');
            const selectedIcon = selectedOption.getAttribute('data-icon');
            const selectedColor = selectedOption.getAttribute('data-color');

            // Update currentPriority with icon and text
            currentPriority.innerHTML = `<i class="${selectedIcon}" style="color: ${selectedColor};"></i> ${selectedOption.textContent.trim()
                }`;

            // Update the hidden input
            taskPriorityInput.value = selectedPriority;

            // Hide the dropdown
            priorityDropdown.style.display = 'none';
        }
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', function (event) {
        if (!priorityToggle.contains(event.target) && !priorityDropdown.contains(event.target)) {
            priorityDropdown.style.display = 'none';
        }
    });
});

// tags
document.addEventListener('DOMContentLoaded', async function () {
    const tagSearch = document.querySelector('#tag-search');
    const tagsContainer = document.querySelector('#tagsContainer');
    const noMatch = document.querySelector('#noMatch');
    const tagArrayInput = document.querySelector('#tagArray');
    const selectedTagsContainer = document.querySelector('#selectedTagsContainer');

    let existingTags = []; // Tags from the server
    let selectedTags = []; // Currently selected tags

    // Fetch existing tags
    async function fetchTags() {
        try {
            const response = await fetch('/tags');
            if (response.ok) {
                existingTags = await response.json();
            } else {
                console.error('Failed to fetch tags');
            }
        } catch (error) {
            console.error('Error fetching tags:', error);
        }
    }

    // Render matching tags
    function renderMatchingTags(searchValue) {
        tagsContainer.innerHTML = '';
        const matchingTags = existingTags.filter(tag =>
            tag.name.toLowerCase().includes(searchValue)
        );

        if (matchingTags.length > 0) {
            matchingTags.forEach(tag => {
                // Create tag container
                const tagElement = document.createElement('div');
                tagElement.classList.add('tag');

                // Create the icon element
                const iconElement = document.createElement('i');
                iconElement.classList.add('fa-solid', 'fa-tags');

                // Create the text node for the tag name
                const tagNameElement = document.createElement('span');
                tagNameElement.textContent = tag.name;

                // Append icon and text to the tag element
                tagElement.appendChild(iconElement);
                tagElement.appendChild(tagNameElement);

                // Add click event to select the tag
                tagElement.addEventListener('click', function () {
                    if (!selectedTags.includes(tag.name)) {
                        selectedTags.push(tag.name);
                        renderSelectedTags();
                    }
                });

                // Append the tag element to the container
                tagsContainer.appendChild(tagElement);
            });
        }
    }


    // Handle search input
    tagSearch.addEventListener('input', function () {
        const searchValue = tagSearch.value.trim().toLowerCase();
        renderMatchingTags(searchValue);

        const hasMatch = existingTags.some(tag =>
            tag.name.toLowerCase().includes(searchValue)
        );
        noMatch.style.display = searchValue.length > 0 && !hasMatch ? 'block' : 'none';
    });

    // Handle Enter key for creating a new tag
    tagSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newTag = tagSearch.value.trim();
            if (newTag && !selectedTags.includes(newTag)) {
                selectedTags.push(newTag);
                renderSelectedTags();
            }
            tagSearch.value = '';
            noMatch.style.display = 'none';
        }
    });

    // Render selected tags
    function renderSelectedTags() {
        selectedTagsContainer.innerHTML = '';
        selectedTags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.classList.add('tag');
            tagElement.innerHTML = `
          <i class="fa-solid fa-tags"></i>
          <span>${tag}</span>
          <i class="bx bx-x remove-tag" data-tag="${tag}"></i>
        `;
            selectedTagsContainer.appendChild(tagElement);
        });

        tagArrayInput.value = selectedTags.join(',');

        document.querySelectorAll('.remove-tag').forEach(removeBtn => {
            removeBtn.addEventListener('click', function () {
                const tagToRemove = this.getAttribute('data-tag');
                selectedTags = selectedTags.filter(tag => tag !== tagToRemove);
                renderSelectedTags();
            });
        });
    }

    // Initialize tags
    await fetchTags();
});

// assign
document.addEventListener('DOMContentLoaded', () => {
    const dropdown = document.getElementById('assignedUsersDropdown');
    const dropdownOptions = document.getElementById('dropdownOptions');
    const selectedUsers = document.getElementById('selectedUsers');
    const assignedUsersInput = document.getElementById('assignedUsersInput');
    const autoAssign = document.getElementById('autoAssign'); // "Assign to me" element

    // Initialize with "Unassigned" by default
    const unassignedDiv = document.createElement('div');
    unassignedDiv.className = 'user unassigned';
    unassignedDiv.id = 'unassignedUser';
    unassignedDiv.innerHTML = '<span id="unassignText">ไม่มีผู้รับมอบหมาย</span>';
    selectedUsers.appendChild(unassignedDiv);

    // Toggle dropdown visibility
    dropdown.addEventListener('click', () => {
        dropdownOptions.style.display = dropdownOptions.style.display === 'block' ? 'none' : 'block';
    });

    // Handle "Assign to me" click
    autoAssign.addEventListener('click', () => {
        const myUserId = autoAssign.dataset.userId; // Assign your user ID here
        const myUsername = autoAssign.dataset.username; // Assign your username here
        const myUserImage = autoAssign.dataset.userImage || '/public/img/profileImage/userDefalt.jpg'; // Default image

        if (!assignedUsersInput.value.split(',').includes(myUserId)) {
            assignedUsersInput.value += `${myUserId},`;

            const userDiv = document.createElement('div');
            userDiv.className = 'user';
            userDiv.dataset.userId = myUserId;

            const img = document.createElement('img');
            img.src = myUserImage;
            img.alt = myUsername;

            const span = document.createElement('span');
            span.textContent = myUsername;

            const removeIcon = document.createElement('span');
            removeIcon.className = 'remove';
            removeIcon.textContent = 'X';
            removeIcon.addEventListener('click', () => {
                userDiv.remove();
                assignedUsersInput.value = assignedUsersInput.value
                    .split(',')
                    .filter(id => id !== myUserId)
                    .join(',');

                // Restore "Unassigned" if no users are selected
                if (assignedUsersInput.value === '') {
                    selectedUsers.appendChild(unassignedDiv);
                }
            });

            userDiv.appendChild(img);
            userDiv.appendChild(span);
            userDiv.appendChild(removeIcon);
            selectedUsers.appendChild(userDiv);

            // Remove "Unassigned" if a user is selected
            if (unassignedDiv.parentNode) {
                unassignedDiv.remove();
            }
        }
    });

    // Handle user selection from dropdown
    dropdownOptions.addEventListener('click', (event) => {
        const item = event.target.closest('.dropdown-item');
        if (!item) return;

        const userId = item.dataset.userId;
        const username = item.querySelector('p#assUsername').textContent.trim(); // Use only the username
        const userImage = item.querySelector('img').src;

        if (!assignedUsersInput.value.split(',').includes(userId)) {
            assignedUsersInput.value += `${userId},`;

            const userDiv = document.createElement('div');
            userDiv.className = 'user';
            userDiv.dataset.userId = userId;

            const img = document.createElement('img');
            img.src = userImage;
            img.alt = username;

            const span = document.createElement('span');
            span.textContent = username;

            const removeIcon = document.createElement('span');
            removeIcon.className = 'remove';
            removeIcon.textContent = 'X';
            removeIcon.addEventListener('click', () => {
                userDiv.remove();
                assignedUsersInput.value = assignedUsersInput.value
                    .split(',')
                    .filter(id => id !== userId)
                    .join(',');

                // Restore "Unassigned" if no users are selected
                if (assignedUsersInput.value === '') {
                    selectedUsers.appendChild(unassignedDiv);
                }
            });

            userDiv.appendChild(img);
            userDiv.appendChild(span);
            userDiv.appendChild(removeIcon);
            selectedUsers.appendChild(userDiv);

            // Remove "Unassigned" if a user is selected
            if (unassignedDiv.parentNode) {
                unassignedDiv.remove();
            }
        }
    });

    // Handle clicks outside the dropdown to close it
    document.addEventListener('click', (event) => {
        if (!dropdown.contains(event.target)) {
            dropdownOptions.style.display = 'none';
        }
    });

    // Clear form and reset to "Unassigned"
    const closeButton = document.getElementById('close-task-btn');
    const form = document.querySelector('.add-form');

    closeButton.addEventListener('click', () => {
        // Reset the form
        form.reset();

        // Clear the selected users
        selectedUsers.innerHTML = '';

        // Restore "Unassigned" by default
        selectedUsers.appendChild(unassignedDiv);

        // Optionally hide the dropdown if it is open
        dropdownOptions.style.display = 'none';

        // Clear the hidden assigned users input
        assignedUsersInput.value = '';
    });
});

//uploade
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('attachments');
    const uploadArea = document.getElementById('uploadArea');
    const previewContainer = document.getElementById('previewContainer');

    let selectedFiles = [];

    // Handle file selection
    fileInput.addEventListener('change', handleFiles);
    uploadArea.addEventListener('click', () => fileInput.click());

    // Handle drag over
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#4a90e2';
    });

    // Handle drag leave
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#d1d5db';
    });

    // Handle drop
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#d1d5db';
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    });

    // Handle file input change
    function handleFiles(e) {
        const files = Array.from(e.target.files);
        addFiles(files);
    }

    // Add files to preview
    function addFiles(files) {
        files.forEach(file => {
            if (!selectedFiles.some(f => f.name === file.name)) {
                selectedFiles.push(file);
                displayPreview(file);
            }
        });
    }

    // Display file preview
    function displayPreview(file) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn-file';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => removeFile(file.name, previewItem);

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            previewItem.appendChild(img);
        } else {
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = '📄';
            previewItem.appendChild(fileIcon);
        }

        const fileName = document.createElement('p');
        fileName.textContent = file.name;
        fileName.style.fontSize = '12px';

        previewItem.appendChild(removeBtn);
        previewItem.appendChild(fileName);
        previewContainer.appendChild(previewItem);
    }

    // Remove file from preview
    function removeFile(fileName, previewItem) {
        selectedFiles = selectedFiles.filter(file => file.name !== fileName);
        previewContainer.removeChild(previewItem);
    }
});

// Due date
document.addEventListener("DOMContentLoaded", function () {
    // Due date elements
    const dueDateInput = document.getElementById('dueDate');
    function initializeDueDate() {
        flatpickr("#dueDate", {
            locale: "th",
            dateFormat: "j F Y",
            altFormat: "Y-m-d",
            minDate: "today",
            onReady: function (selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                if (calendar) {
                    const yearInput = calendar.querySelector(".numInput.flatpickr-year");
                    if (yearInput) {
                        yearInput.value = parseInt(yearInput.value) + 543;
                        yearInput.addEventListener("input", function () {
                            this.value = this.value.replace(/\d+/, (year) => parseInt(year) + 543);
                        });
                    }
                }
            },
            onChange: function (selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    const selectedDate = selectedDates[0];

                    // ปรับเวลาเป็น 00:00 UTC
                    const utcDate = new Date(Date.UTC(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate()
                    ));

                    // อัปเดตค่าแสดงผลเป็นปี พ.ศ.
                    instance.input.value = dateStr.replace(/\d+$/, (year) => parseInt(year) + 543);

                    // เก็บค่าเป็น ISO Date
                    const isoDate = utcDate.toISOString().split("T")[0];
                    dueDateInput.dataset.isoDate = isoDate;

                    console.log("✅ เลือกวันที่: ", dateStr, " (ISO: ", isoDate, ")");
                }
            },
            onMonthChange: function (selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                const yearInput = calendar.querySelector(".numInput.flatpickr-year");
                if (yearInput) {
                    yearInput.value = parseInt(yearInput.value) + 543;
                }
            },
            onYearChange: function (selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                const yearInput = calendar.querySelector(".numInput.flatpickr-year");
                if (yearInput) {
                    yearInput.value = parseInt(yearInput.value) + 543;
                }
            },
        });
    }
    initializeDueDate();
});

// start date
document.addEventListener("DOMContentLoaded", function () {
    const enableStartDateCheckbox = document.getElementById('enableStartDate');
    const startDateInputDiv = document.getElementById('startdateInput');
    const startDateInput = document.getElementById('startDate');

    function initializeStartDate() {
        enableStartDateCheckbox.addEventListener('change', function () {
            startDateInput.disabled = !this.checked;
            if (!this.checked) {
                startDateInput.value = '';
                startDateInput.dataset.isoDate = '';
                startDateInputDiv.classList.add('disabled-opacity');
            } else {
                startDateInputDiv.classList.remove('disabled-opacity');
            }
        });

        flatpickr("#startDate", {
            locale: "th",
            dateFormat: "j F Y",
            altFormat: "Y-m-d",
            minDate: "today",
            onReady: function (selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                if (calendar) {
                    const yearInput = calendar.querySelector(".numInput.flatpickr-year");
                    if (yearInput) {
                        yearInput.value = parseInt(yearInput.value) + 543;
                        yearInput.addEventListener("input", function () {
                            this.value = this.value.replace(/\d+/, (year) => parseInt(year) + 543);
                        });
                    }
                }
            },
            onChange: function (selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    const selectedDate = selectedDates[0];

                    // Adjust selected date to midnight UTC
                    const utcDate = new Date(Date.UTC(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate()
                    ));

                    // Update the input field for display with Thai year
                    instance.input.value = dateStr.replace(/\d+$/, (year) => parseInt(year) + 543);

                    const isoStartDate = utcDate.toISOString().split("T")[0]; // YYYY-MM-DD
                    startDateInput.dataset.isoDate = isoStartDate; // Store ISO date
                }
            },
            onMonthChange: function (selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                const yearInput = calendar.querySelector(".numInput.flatpickr-year");
                if (yearInput) {
                    yearInput.value = parseInt(yearInput.value) + 543; // Update year for month navigation
                }
            },
            onYearChange: function (selectedDates, dateStr, instance) {
                const calendar = instance.calendarContainer;
                const yearInput = calendar.querySelector(".numInput.flatpickr-year");
                if (yearInput) {
                    yearInput.value = parseInt(yearInput.value) + 543; // Update year for year navigation
                }
            },
        });
        startDateInputDiv.classList.add("disabled-opacity");
    }
    initializeStartDate();
}
);