// Global state for authentication
let authToken = null;
let isTeacher = false;

document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userIcon = document.getElementById("user-icon");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeBtn = document.querySelector(".close");
  const authStatus = document.getElementById("auth-status");
  const signupBtn = document.getElementById("signup-btn");
  const loginMessage = document.getElementById("login-message");

  // Check for existing session on page load
  checkSession();

  // User icon click handler
  userIcon.addEventListener("click", () => {
    if (isTeacher) {
      // Logout
      logout();
    } else {
      // Show login modal
      loginModal.classList.remove("hidden");
    }
  });

  // Close modal handlers
  closeBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );

      const result = await response.json();

      if (response.ok) {
        authToken = result.token;
        isTeacher = true;
        updateUI();
        loginModal.classList.add("hidden");
        loginForm.reset();
        loginMessage.classList.add("hidden");
        showMessage(
          messageDiv,
          `Welcome, ${result.username}! You are now logged in as a teacher.`,
          "success"
        );
        fetchActivities();
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Failed to login. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Function to check if there's an existing session
  async function checkSession() {
    // In a real app, you'd verify the token with the backend
    // For now, we just check localStorage
    if (localStorage.getItem("authToken")) {
      authToken = localStorage.getItem("authToken");
      isTeacher = true;
      updateUI();
    }
  }

  // Function to logout
  async function logout() {
    try {
      await fetch(`/logout?token=${encodeURIComponent(authToken)}`, {
        method: "POST",
      });
      authToken = null;
      isTeacher = false;
      localStorage.removeItem("authToken");
      updateUI();
      showMessage(messageDiv, "You have been logged out.", "info");
      fetchActivities();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }

  // Function to update UI based on auth state
  function updateUI() {
    if (isTeacher) {
      userIcon.classList.add("logged-in");
      userIcon.title = "Teacher: Click to logout";
      authStatus.classList.add("logged-in");
      authStatus.innerHTML =
        '<p>You are logged in as a <strong>Teacher</strong>. You can now manage student registrations.</p>';
      signupBtn.textContent = "Register Student";
      signupForm.style.opacity = "1";
      signupForm.style.pointerEvents = "auto";
      localStorage.setItem("authToken", authToken);
    } else {
      userIcon.classList.remove("logged-in");
      userIcon.title = "Teacher Login";
      authStatus.classList.remove("logged-in");
      authStatus.innerHTML =
        '<p>You are viewing as a <strong>Student</strong>.</p><p style="font-size: 0.9em; color: #666;">Teachers: Click the 👤 icon to log in and manage registrations.</p>';
      signupBtn.textContent = "Sign Up";
      signupForm.style.opacity = "0.5";
      signupForm.style.pointerEvents = "none";
      localStorage.removeItem("authToken");
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons only if teacher is logged in
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                      <span class="participant-email">${email}</span>
                      ${
                        isTeacher
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }
                    </li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if teacher)
      if (isTeacher) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!isTeacher) {
      showMessage(messageDiv, "Only teachers can unregister students.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}&token=${encodeURIComponent(authToken)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(
        messageDiv,
        "Failed to unregister. Please try again.",
        "error"
      );
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacher) {
      showMessage(
        messageDiv,
        "Only teachers can register students. Please log in.",
        "error"
      );
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}&token=${encodeURIComponent(authToken)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Helper function to show messages
  function showMessage(element, message, type) {
    element.textContent = message;
    element.className = type;
    element.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      element.classList.add("hidden");
    }, 5000);
  }

  // Initialize app
  updateUI();
  fetchActivities();
});
