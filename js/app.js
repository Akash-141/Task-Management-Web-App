// Main Application Logic
(function() {
        'use strict';

        // ===== STATE =====
        let currentUser = null;
        let currentTheme = localStorage.getItem('theme') || 'light';
        let taskManagerInstance = null;
        let unsubscribeFromTasks = null;
        let lastDeletedTask = null;

        // ===== TASK MANAGER =====
        class TaskManager {
            constructor() {
                this.tasks = [];
                this.userId = null;
                this.mode = 'guest'; // 'guest' or 'user'
                this.loadGuestTasks();
            }

            setUser(userId) {
                this.userId = userId;
                this.mode = 'user';

                // Unsubscribe from previous listener if exists
                if (unsubscribeFromTasks) {
                    unsubscribeFromTasks();
                }

                // Listen to user tasks from Firestore
                unsubscribeFromTasks = window.listenToUserTasks(userId, (tasks) => {
                    this.tasks = tasks;
                    this.renderTasks();
                    this.updateStats();
                });
            }

            clearUser() {
                this.userId = null;
                this.mode = 'guest';

                // Unsubscribe from Firestore listener
                if (unsubscribeFromTasks) {
                    unsubscribeFromTasks();
                    unsubscribeFromTasks = null;
                }

                this.loadGuestTasks();
                this.renderTasks();
                this.updateStats();
            }

            loadGuestTasks() {
                const saved = localStorage.getItem('guestTasks');
                this.tasks = saved ? JSON.parse(saved) : [];
            }

            saveGuestTasks() {
                if (this.mode === 'guest') {
                    localStorage.setItem('guestTasks', JSON.stringify(this.tasks));
                }
            }

            async addTask(taskData) {
                if (this.mode === 'user') {
                    try {
                        await window.addTaskToFirestore(this.userId, taskData);
                        showToast('Task added successfully!');
                    } catch (error) {
                        console.error('Error adding task:', error);
                        showToast('Failed to add task. Please try again.', 'error');
                    }
                } else {
                    const task = {
                        id: Date.now().toString(),
                        ...taskData,
                        createdAt: new Date().toISOString()
                    };
                    this.tasks.push(task);
                    this.saveGuestTasks();
                    this.renderTasks();
                    this.updateStats();
                    showToast('Task added successfully!');
                }
            }

            async updateTask(taskId, updates) {
                if (this.mode === 'user') {
                    try {
                        await window.updateTaskInFirestore(this.userId, taskId, updates);

                        // Check if task was completed
                        if (updates.status === 'done') {
                            const task = this.tasks.find(t => t.id === taskId);
                            if (task && task.status !== 'done') {
                                playSuccessSound();
                                showConfetti();
                            }
                        }
                    } catch (error) {
                        console.error('Error updating task:', error);
                        showToast('Failed to update task. Please try again.', 'error');
                    }
                } else {
                    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                    if (taskIndex !== -1) {
                        const oldStatus = this.tasks[taskIndex].status;
                        this.tasks[taskIndex] = {...this.tasks[taskIndex], ...updates };
                        this.saveGuestTasks();
                        this.renderTasks();
                        this.updateStats();

                        // Check if task was completed
                        if (updates.status === 'done' && oldStatus !== 'done') {
                            playSuccessSound();
                            showConfetti();
                        }
                    }
                }
            }

            async deleteTask(taskId) {
                if (this.mode === 'user') {
                    try {
                        await window.deleteTaskFromFirestore(this.userId, taskId);
                        showToast('Task deleted successfully!');
                    } catch (error) {
                        console.error('Error deleting task:', error);
                        showToast('Failed to delete task. Please try again.', 'error');
                    }
                } else {
                    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                    if (taskIndex !== -1) {
                        lastDeletedTask = this.tasks[taskIndex];
                        this.tasks.splice(taskIndex, 1);
                        this.saveGuestTasks();
                        this.renderTasks();
                        this.updateStats();
                        showToast('Task deleted', 'success', 'Undo', () => this.undoDelete());
                    }
                }
            }

            undoDelete() {
                if (lastDeletedTask && this.mode === 'guest') {
                    this.tasks.push(lastDeletedTask);
                    this.saveGuestTasks();
                    this.renderTasks();
                    this.updateStats();
                    showToast('Task restored!');
                    lastDeletedTask = null;
                }
            }

            async clearCompleted() {
                if (this.mode === 'user') {
                    try {
                        const count = await window.deleteCompletedTasks(this.userId);
                        showToast(`${count} completed task(s) cleared!`);
                    } catch (error) {
                        console.error('Error clearing completed tasks:', error);
                        showToast('Failed to clear tasks. Please try again.', 'error');
                    }
                } else {
                    const completedCount = this.tasks.filter(t => t.status === 'done').length;
                    this.tasks = this.tasks.filter(t => t.status !== 'done');
                    this.saveGuestTasks();
                    this.renderTasks();
                    this.updateStats();
                    showToast(`${completedCount} completed task(s) cleared!`);
                }
            }

            renderTasks() {
                const todoList = document.getElementById('todo-list');
                const inProgressList = document.getElementById('in-progress-list');
                const doneList = document.getElementById('done-list');

                todoList.innerHTML = '';
                inProgressList.innerHTML = '';
                doneList.innerHTML = '';

                this.tasks.forEach(task => {
                    const taskElement = this.createTaskElement(task);

                    if (task.status === 'todo') {
                        todoList.appendChild(taskElement);
                    } else if (task.status === 'in-progress') {
                        inProgressList.appendChild(taskElement);
                    } else if (task.status === 'done') {
                        doneList.appendChild(taskElement);
                    }
                });

                // Update column counts
                document.getElementById('todo-count').textContent = this.tasks.filter(t => t.status === 'todo').length;
                document.getElementById('in-progress-count').textContent = this.tasks.filter(t => t.status === 'in-progress').length;
                document.getElementById('done-count').textContent = this.tasks.filter(t => t.status === 'done').length;
            }

            createTaskElement(task) {
                    const div = document.createElement('div');
                    div.className = `task-card priority-${task.priority}`;
                    div.draggable = true;
                    div.dataset.taskId = task.id;

                    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                    const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

                    div.innerHTML = `
                <div class="task-header">
                    <h3 class="task-title">${escapeHtml(task.text)}</h3>
                    <div class="task-actions">
                        <button class="btn-icon btn-icon-sm task-edit-btn" title="Edit task">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon btn-icon-sm task-delete-btn" title="Delete task">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    <span class="task-badge badge-${task.category}">${task.category}</span>
                    <span class="task-badge badge-priority-${task.priority}">${task.priority}</span>
                    ${task.dueDate ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formatDate(task.dueDate)}
                    </span>` : ''}
                </div>
                ${task.status !== 'done' ? `
                    <button class="task-complete-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Mark as Complete
                    </button>
                ` : ''}
            `;

            // Event listeners
            div.querySelector('.task-edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(task);
            });

            div.querySelector('.task-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                confirmAction(
                    'Delete Task',
                    'Are you sure you want to delete this task?',
                    () => this.deleteTask(task.id)
                );
            });

            if (task.status !== 'done') {
                div.querySelector('.task-complete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.updateTask(task.id, { status: 'done' });
                    // Play completion sound
                    playSuccessSound();
                    // Show confetti
                    triggerConfetti();
                });
            }

            // Drag events
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);

            return div;
        }

        updateStats() {
            const total = this.tasks.length;
            const active = this.tasks.filter(t => t.status !== 'done').length;
            const completed = this.tasks.filter(t => t.status === 'done').length;

            document.getElementById('total-tasks').textContent = total;
            document.getElementById('active-tasks').textContent = active;
            document.getElementById('completed-tasks').textContent = completed;
            
            // Update column counts
            document.getElementById('todo-count').textContent = 
                this.tasks.filter(t => t.status === 'todo').length;
            document.getElementById('in-progress-count').textContent = 
                this.tasks.filter(t => t.status === 'in-progress').length;
            document.getElementById('done-count').textContent = completed;
            
            // Update progress bar
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            document.getElementById('total-count').textContent = total;
            document.getElementById('completed-count').textContent = completed;
            document.getElementById('progress-percent').textContent = percentage + '%';
            const progressFill = document.getElementById('progress-bar-fill');
            if (progressFill) {
                progressFill.style.width = percentage + '%';
            }
        }
    }

    // ===== DRAG AND DROP =====
    let draggedElement = null;

    function handleDragStart(e) {
        draggedElement = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        draggedElement = null;
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        this.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        this.classList.remove('drag-over');

        if (draggedElement) {
            const taskId = draggedElement.dataset.taskId;
            const newStatus = this.dataset.status;
            taskManagerInstance.updateTask(taskId, { status: newStatus });
        }

        return false;
    }

    // ===== MODALS =====
    let editingTaskId = null;

    function openEditModal(task) {
        editingTaskId = task.id;
        document.getElementById('edit-task-title').value = task.text;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-priority').value = task.priority;
        document.getElementById('edit-task-category').value = task.category;
        document.getElementById('edit-task-due-date').value = task.dueDate || '';
        document.getElementById('edit-task-status').value = task.status;
        
        document.getElementById('edit-modal').classList.add('active');
    }

    function closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
        editingTaskId = null;
    }

    function confirmAction(title, message, onConfirm) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const confirmBtn = document.getElementById('confirm-action-btn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            closeConfirmModal();
        });
        
        document.getElementById('confirm-modal').classList.add('active');
    }

    function closeConfirmModal() {
        document.getElementById('confirm-modal').classList.remove('active');
    }

    // ===== TOAST =====
    let toastTimeout;

    function showToast(message, type = 'success', actionText = null, actionCallback = null) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        const toastAction = document.getElementById('toast-action');

        toastMessage.textContent = message;
        toast.className = `toast toast-${type}`;

        if (actionText && actionCallback) {
            toastAction.textContent = actionText;
            toastAction.classList.remove('hidden');
            toastAction.onclick = () => {
                actionCallback();
                hideToast();
            };
        } else {
            toastAction.classList.add('hidden');
        }

        toast.classList.add('show');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(hideToast, 4000);
    }

    function hideToast() {
        document.getElementById('toast').classList.remove('show');
    }

    // ===== CONFETTI =====
    function showConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.classList.remove('hidden');

        const confetti = [];
        const confettiCount = 50;
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];

        for (let i = 0; i < confettiCount; i++) {
            confetti.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * confettiCount,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 10,
                tiltAngleIncremental: Math.random() * 0.07 + 0.05,
                tiltAngle: 0
            });
        }

        let animationId;
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            confetti.forEach((c, i) => {
                ctx.beginPath();
                ctx.lineWidth = c.r / 2;
                ctx.strokeStyle = c.color;
                ctx.moveTo(c.x + c.tilt + c.r, c.y);
                ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r);
                ctx.stroke();

                c.tiltAngle += c.tiltAngleIncremental;
                c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
                c.tilt = Math.sin(c.tiltAngle) * 15;

                if (c.y > canvas.height) {
                    confetti[i] = {
                        ...c,
                        x: Math.random() * canvas.width,
                        y: -20
                    };
                }
            });

            animationId = requestAnimationFrame(draw);
        }

        draw();

        setTimeout(() => {
            cancelAnimationFrame(animationId);
            canvas.classList.add('hidden');
        }, 3000);
    }

    // ===== SOUNDS =====
    function playSuccessSound() {
        // Create multiple tones for a pleasant completion sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioContext.currentTime;
            
            // Play C major chord notes in sequence
            const notes = [
                { freq: 523.25, start: 0, duration: 0.15 },    // C5
                { freq: 659.25, start: 0.08, duration: 0.15 }, // E5
                { freq: 783.99, start: 0.16, duration: 0.25 }  // G5
            ];
            
            notes.forEach(note => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = note.freq;
                oscillator.type = 'sine';
                
                // Volume envelope
                gainNode.gain.setValueAtTime(0, now + note.start);
                gainNode.gain.linearRampToValueAtTime(0.2, now + note.start + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration);
                
                oscillator.start(now + note.start);
                oscillator.stop(now + note.start + note.duration);
            });
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    // ===== THEME =====
    function toggleTheme() {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);

        const moonIcon = document.querySelector('.icon-moon');
        const sunIcon = document.querySelector('.icon-sun');
        
        if (currentTheme === 'dark') {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    }

    // ===== UTILITIES =====
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    // ===== AUTH STATE HANDLING =====
    async function updateUserNameFromFirestore(userId) {
        console.log('\n👤 === UPDATING USER NAME DISPLAY ===');
        console.log('User ID:', userId);
        
        try {
            const user = window.auth.currentUser;
            
            // If user has displayName, use it immediately
            if (user && user.displayName) {
                const displayName = `Welcome, ${user.displayName}`;
                document.getElementById('user-name').textContent = displayName;
                console.log('✅ Set name from Auth displayName:', displayName);
                
                // Try to get profile from Firestore in background
                window.getUserProfile(userId).then(profile => {
                    if (profile && profile.fullName && profile.fullName !== user.displayName) {
                        const updatedName = `Welcome, ${profile.fullName}`;
                        document.getElementById('user-name').textContent = updatedName;
                        console.log('✅ Updated name from Firestore:', updatedName);
                    }
                }).catch(err => console.log('Profile fetch failed:', err));
                
                console.log('=== NAME UPDATE COMPLETE ===\n');
                return;
            }
            
            // Fallback: try Firestore
            const profile = await window.getUserProfile(userId);
            console.log('Profile retrieved:', profile);
            
            if (profile && profile.fullName) {
                const displayName = `Welcome, ${profile.fullName}`;
                document.getElementById('user-name').textContent = displayName;
                console.log('✅ Set name from Firestore:', displayName);
                console.log('=== NAME UPDATE COMPLETE ===\n');
                return;
            }
            
            console.log('⚠️ No profile in Firestore, creating one now...');
            
            // Profile doesn't exist - create it from Auth data
            const currentUser = window.auth.currentUser;
            if (currentUser) {
                // IMPORTANT: Only use displayName, never use email as fallback
                // If displayName is empty, it means user was created before proper signup
                // In that case, DON'T create a profile automatically - let them update it manually
                if (!currentUser.displayName) {
                    console.warn('⚠️ User has no displayName - this is an old account');
                    console.warn('⚠️ Not creating profile automatically. Please update your profile.');
                    const emailName = currentUser.email.split('@')[0];
                    document.getElementById('user-name').textContent = `Welcome, ${emailName}`;
                    console.log('=== NAME UPDATE COMPLETE (No profile created) ===\n');
                    return;
                }
                
                const fullName = currentUser.displayName;
                console.log('📝 Creating Firestore profile with name:', fullName);
                
                const profileData = {
                    fullName: fullName,
                    email: currentUser.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await window.setUserProfile(userId, profileData);
                console.log('✅ Profile created in Firestore!');
                
                const displayName = `Welcome, ${fullName}`;
                document.getElementById('user-name').textContent = displayName;
                console.log('✅ Set name from newly created profile:', displayName);
                console.log('=== NAME UPDATE COMPLETE ===\n');
                return;
            }
            
            console.log('⚠️ Could not create profile - no user data');
            document.getElementById('user-name').textContent = 'Welcome, User';
        } catch (error) {
            console.error('\n❌ Error updating user name:', error);
            // Final fallback
            const fallbackUser = window.auth.currentUser;
            if (fallbackUser) {
                const fallback = fallbackUser.displayName || fallbackUser.email?.split('@')[0] || 'User';
                document.getElementById('user-name').textContent = `Welcome, ${fallback}`;
                console.log('⚠️ Used error fallback:', fallback);
            }
            console.log('=== NAME UPDATE COMPLETE (WITH ERRORS) ===\n');
        }
    }

    async function migrateGuestTasksToFirestore(userId) {
        const guestTasks = localStorage.getItem('guestTasks');
        if (!guestTasks) return;

        try {
            const tasks = JSON.parse(guestTasks);
            for (const task of tasks) {
                const { id, createdAt, ...taskData } = task;
                await window.addTaskToFirestore(userId, taskData);
            }
            localStorage.removeItem('guestTasks');
            showToast('Guest tasks migrated successfully!');
        } catch (error) {
            console.error('Error migrating guest tasks:', error);
        }
    }

    // ===== INITIALIZATION =====
    function init() {
        // Initialize theme
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            document.querySelector('.icon-moon').classList.add('hidden');
            document.querySelector('.icon-sun').classList.remove('hidden');
        }

        // Initialize TaskManager
        taskManagerInstance = new TaskManager();
        taskManagerInstance.renderTasks();
        taskManagerInstance.updateStats();

        // Add task form
        document.getElementById('add-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const taskData = {
                text: document.getElementById('task-title').value,
                description: document.getElementById('task-description').value,
                dueDate: document.getElementById('task-due-date').value,
                priority: document.getElementById('task-priority').value,
                category: document.getElementById('task-category').value,
                status: 'todo'
            };

            taskManagerInstance.addTask(taskData);
            e.target.reset();
        });

        // Edit task form
        document.getElementById('edit-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (editingTaskId) {
                const updates = {
                    text: document.getElementById('edit-task-title').value,
                    description: document.getElementById('edit-task-description').value,
                    priority: document.getElementById('edit-task-priority').value,
                    category: document.getElementById('edit-task-category').value,
                    dueDate: document.getElementById('edit-task-due-date').value,
                    status: document.getElementById('edit-task-status').value
                };

                taskManagerInstance.updateTask(editingTaskId, updates);
                closeEditModal();
                showToast('Task updated successfully!');
            }
        });

        // Modal close buttons
        document.getElementById('close-edit-modal').addEventListener('click', closeEditModal);
        document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
        document.getElementById('close-confirm-modal').addEventListener('click', closeConfirmModal);
        document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirmModal);

        // Click outside modal to close
        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') closeEditModal();
        });
        document.getElementById('confirm-modal').addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') closeConfirmModal();
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

        // Auth buttons
        document.getElementById('login-btn').addEventListener('click', () => {
            window.location.href = 'auth.html';
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                await window.signOut();
                showToast('Signed out successfully!');
            } catch (error) {
                console.error('Error signing out:', error);
                showToast('Failed to sign out. Please try again.', 'error');
            }
        });

        // Clear completed button
        document.getElementById('clear-completed-btn').addEventListener('click', () => {
            const completedCount = taskManagerInstance.tasks.filter(t => t.status === 'done').length;
            if (completedCount === 0) {
                showToast('No completed tasks to clear!', 'info');
                return;
            }
            
            confirmAction(
                'Clear Completed Tasks',
                `Are you sure you want to delete ${completedCount} completed task(s)?`,
                () => taskManagerInstance.clearCompleted()
            );
        });

        // Drag and drop
        const taskLists = document.querySelectorAll('.task-list');
        taskLists.forEach(list => {
            list.addEventListener('dragover', handleDragOver);
            list.addEventListener('dragenter', handleDragEnter);
            list.addEventListener('dragleave', handleDragLeave);
            list.addEventListener('drop', handleDrop);
        });

        // Auth state observer
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('user-name').textContent = 'Loading...';
                document.getElementById('login-btn').classList.add('hidden');
                document.getElementById('logout-btn').classList.remove('hidden');

                // Set user in TaskManager
                taskManagerInstance.setUser(user.uid);

                // Update user name from Firestore
                await updateUserNameFromFirestore(user.uid);

                // Migrate guest tasks if any
                await migrateGuestTasksToFirestore(user.uid);
            } else {
                currentUser = null;
                document.getElementById('user-name').textContent = 'Welcome, Guest';
                document.getElementById('login-btn').classList.remove('hidden');
                document.getElementById('logout-btn').classList.add('hidden');

                // Clear user from TaskManager
                taskManagerInstance.clearUser();
            }
        });
    }

    // Start the app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== PAGE LOADER =====
    window.addEventListener('load', () => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
                // Remove from DOM after transition
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500);
            }, 300);
        }
    });

})();