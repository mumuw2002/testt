document.addEventListener("DOMContentLoaded", function () {
    // due date logic
    const enableDueDateCheckbox = document.getElementById('enableDueDate');
    const dueDateInputDiv = document.getElementById('dueDateInput');
    const dueDateInput = document.getElementById('dueDate');
    const dateCountDiv = document.querySelector('.dateCount');

    function initializeDueDate() {
      enableDueDateCheckbox.addEventListener('change', function () {
        dueDateInput.disabled = !this.checked;
        if (!this.checked) {
          dueDateInput.value = '';
          dueDateInput.dataset.isoDate = ''; // Clear stored ISO date
          dueDateInputDiv.classList.add('disabled-opacity');
          dateCountDiv.textContent = 'ระยะเวลาในการทำโปรเจกต์อยู่ที่: ';
        } else {
          dueDateInputDiv.classList.remove('disabled-opacity');
        }
      });

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

            // Adjust selected date to midnight UTC
            const utcDate = new Date(Date.UTC(
              selectedDate.getFullYear(),
              selectedDate.getMonth(),
              selectedDate.getDate()
            ));

            // Update the input field for display with Thai year
            instance.input.value = dateStr.replace(/\d+$/, (year) => parseInt(year) + 543);

            // Update the project duration display
            updateDateCount(selectedDate);

            const isoDate = utcDate.toISOString().split("T")[0]; // YYYY-MM-DD
            dueDateInput.dataset.isoDate = isoDate; // Store ISO date
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
      dueDateInputDiv.classList.add("disabled-opacity");
    }

    const updateDateCount = (dueDate) => {
      if (!dueDate) {
        dateCountDiv.textContent = "ระยะเวลาในการทำโปรเจกต์อยู่ที่: ";
        return;
      }
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Check if the diffDays span already exists
      let diffDaysSpan = document.getElementById('diffDays');
      if (!diffDaysSpan) {
        // If it doesn't exist, create it
        diffDaysSpan = document.createElement('span');
        diffDaysSpan.id = 'diffDays';
        dateCountDiv.innerHTML = `ระยะเวลาในการทำโปรเจกต์อยู่ที่: `;
        dateCountDiv.appendChild(diffDaysSpan);
      }
      // Update the content of the diffDays span
      diffDaysSpan.textContent = `${diffDays} วัน`;
    };
    initializeDueDate();

    // Members Logic
    const searchInput = document.getElementById("searchMemberInput");
    const resultsDropdown = document.getElementById("searchResultsDropdown");
    const selectedMembersContainer = document.getElementById("selectedMembers");
    const selectedMembers = [];
    const notFoundMessage = '<li style="padding: 10px 20px; color: red;">ไม่พบผู้ใช้</li>';
    const currentUserId = '<%= user._id %>';

    searchInput.addEventListener("input", async (event) => {
      const query = event.target.value.trim();

      if (query) {
        try {
          const response = await fetch(`/searchMembers?q=${encodeURIComponent(query)}`);
          const results = await response.json();

          resultsDropdown.style.display = "block";

          if (results.length > 0) {
            const filteredResults = results.filter(user => !selectedMembers.some(member => member.id === user._id));

            resultsDropdown.innerHTML = filteredResults
              .map((user) => {
                if (user._id === currentUserId) {
                  return `
                    <li style="padding: 10px 20px; color: blue;">
                      คุณอยู่ในโปรเจกต์นี้อยู่แล้ว
                    </li>
                  `;
                } else {
                  return `
                    <li onclick="selectMember('${user._id}', '${user.username}', '${user.profileImage}')">
                      <img src="${user.profileImage}" alt="Profile" class="profile-image">
                      <span id="memberName">
                        ${user.username} 
                        <p>${user.googleEmail || user.userid}</p>
                      </span>
                    </li>
                  `;
                }
              })
              .join("");
          } else {
            resultsDropdown.innerHTML = notFoundMessage;
          }
        } catch (error) {
          console.error("Error fetching search results:", error);
        }
      } else {
        resultsDropdown.style.display = "none";
      }
    });

    window.selectMember = (id, username, profileImage) => {
      if (selectedMembers.some((member) => member.id === id)) return;

      selectedMembers.push({ id, username, profileImage });

      const memberTag = document.createElement("span");
      memberTag.className = "member-tag";
      memberTag.setAttribute("data-id", id);
      memberTag.innerHTML = `
          <img src="${profileImage}" alt="Profile" class="profile-image">
          ${username}
          <i class="fa-solid fa-xmark" onclick="removeMember('${id}')"></i>
        `;
      selectedMembersContainer.appendChild(memberTag);

      resultsDropdown.style.display = "none";
      searchInput.value = "";
    };

    window.removeMember = (id) => {
      const index = selectedMembers.findIndex((member) => member.id === id);
      if (index > -1) selectedMembers.splice(index, 1);

      const memberTag = selectedMembersContainer.querySelector(`span[data-id="${id}"]`);
      if (memberTag) memberTag.remove();
    };

    // Handle project details
    const detailTextarea = document.getElementById("projectDetail");
    if (detailTextarea) {
      detailTextarea.addEventListener("focus", function () {
        detailTextarea.style.transition = "height 0.3s ease-in-out";
        detailTextarea.style.height = "100px";
      });

      detailTextarea.addEventListener("blur", function () {
        if (!detailTextarea.value) {
          detailTextarea.style.height = "40px";
        }
      });

      detailTextarea.addEventListener("input", function () {
        if (detailTextarea.value) {
          detailTextarea.style.height = "100px";
        }
      });
    }

    // Handle project cover upload
    const projectCoverInput = document.getElementById("projectCover");
    const coverPreview = document.getElementById("coverPreview");
    if (projectCoverInput && coverPreview) {
      projectCoverInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (e) {
            coverPreview.src = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    window.prepareFormData = async () => {
      const projectName = document.getElementById("projectName").value.trim(); // Assuming project name field ID is "projectName"
      const isoDate = dueDateInput.dataset.isoDate;
      if (isoDate) {
        dueDateInput.value = isoDate;
      }
      const membersInput = document.getElementById("members");
      membersInput.value = JSON.stringify(selectedMembers || []);
  
      const response = await fetch('/checkExistingProject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectName })
      });
  
      const result = await response.json();
  
      if (result.exists) {
        window.alert("คุณมีโปรเจกต์ชื่อนี้อยู่แล้ว กรุณาใส่ชื่อโปรเจกต์ใหม่");
        return true;
      }
  
      return false; // No conflict, proceed with the form submission
    };
  });