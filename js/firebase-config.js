// Firebase Configuration and Helper Functions
(function() {
    'use strict';

    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyD49ZgZXjWkR2U-jqtur5BAJKE1QiA6ulk",
        authDomain: "taskmanagementwebapp-88469.firebaseapp.com",
        projectId: "taskmanagementwebapp-88469",
        storageBucket: "taskmanagementwebapp-88469.firebasestorage.app",
        messagingSenderId: "13772717006",
        appId: "1:13772717006:web:50f776583efc899137499f"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    // Get Firebase services
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Enable offline persistence
    db.enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Persistence failed: Multiple tabs open');
            } else if (err.code == 'unimplemented') {
                console.warn('Persistence not available in this browser');
            }
        });

    // Test Firestore connection
    console.log('🔥 Firebase initialized');
    console.log('📊 Firestore instance:', db);
    console.log('🔐 Auth instance:', auth);

    // Test Firestore write capability
    (async function testFirestoreConnection() {
        try {
            console.log('\n🧪 Testing Firestore connection...');
            const testRef = db.collection('_test').doc('connection');
            await testRef.set({ timestamp: new Date().toISOString(), test: true });
            console.log('✅ Firestore write test SUCCESSFUL');
            const testRead = await testRef.get();
            if (testRead.exists) {
                console.log('✅ Firestore read test SUCCESSFUL:', testRead.data());
            }
            await testRef.delete();
            console.log('✅ Firestore is fully functional\n');
        } catch (error) {
            console.error('❌ Firestore connection test FAILED:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            if (error.code === 'permission-denied') {
                console.error('⚠️ PERMISSION DENIED - Check Firestore rules in Firebase Console');
                console.error('Go to: https://console.firebase.google.com/project/taskmanagementwebapp-88469/firestore/rules');
            }
        }
    })();

    // ===== AUTHENTICATION HELPERS =====

    /**
     * Sign up with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} fullName - User's full name
     * @returns {Promise<firebase.User>}
     */
    async function signUpWithEmail(email, password, fullName) {
        console.log('\n🚀 === STARTING SIGNUP PROCESS ===');
        console.log('Email:', email);
        console.log('Full Name:', fullName);

        try {
            // Create user account
            console.log('Step 1: Creating auth account...');
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('✅ Auth account created. UID:', user.uid);

            // CRITICAL: Save to Firestore FIRST before setting displayName
            console.log('Step 2: Saving to Firestore IMMEDIATELY...');
            const profileData = {
                fullName: fullName,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await setUserProfile(user.uid, profileData);
            console.log('✅ Firestore write completed');

            // Now update display name
            console.log('Step 3: Updating display name to:', fullName);
            await user.updateProfile({
                displayName: fullName
            });
            console.log('✅ updateProfile() completed');

            // Force reload the user
            await auth.currentUser.reload();
            console.log('✅ User reloaded');
            console.log('Final state:', {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName
            });

            console.log('🎉 === SIGNUP COMPLETE ===\n');
            return auth.currentUser;
        } catch (error) {
            console.error('\n❌ === SIGNUP FAILED ===');
            console.error('Error:', error.message);
            console.error('Code:', error.code);
            console.error('=== END SIGNUP ===\n');
            throw error;
        }
    }

    /**
     * Sign in with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<firebase.User>}
     */
    async function signInWithEmail(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return userCredential.user;
        } catch (error) {
            console.error('Error signing in:', error);
            throw error;
        }
    }

    /**
     * Sign in with Google
     * @returns {Promise<firebase.User>}
     */
    async function signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            console.log('Google sign-in successful:', user.uid);

            // Check if user profile exists, if not create one
            const userProfile = await getUserProfile(user.uid);
            if (!userProfile) {
                console.log('Creating new user profile for Google user');
                await setUserProfile(user.uid, {
                    fullName: user.displayName || 'User',
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('User profile created in Firestore');
            } else {
                console.log('User profile already exists');
            }

            return user;
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    }

    /**
     * Sign out current user
     * @returns {Promise<void>}
     */
    async function signOut() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    }

    /**
     * Send password reset email
     * @param {string} email - User email
     * @returns {Promise<void>}
     */
    async function resetPassword(email) {
        try {
            await auth.sendPasswordResetEmail(email);
        } catch (error) {
            console.error('Error sending password reset email:', error);
            throw error;
        }
    }

    // ===== FIRESTORE HELPERS - USER PROFILE =====

    /**
     * Get user profile from Firestore
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>}
     */
    async function getUserProfile(userId) {
        console.log('\n📖 === READING USER PROFILE ===');
        console.log('User ID:', userId);
        try {
            const docRef = db.collection('users').doc(userId);
            console.log('Document Path:', docRef.path);

            const doc = await docRef.get();
            console.log('Document exists?', doc.exists);

            if (doc.exists) {
                const data = doc.data();
                console.log('✅ Profile found:', JSON.stringify(data, null, 2));
                console.log('=== READ COMPLETE ===\n');
                return data;
            } else {
                console.log('⚠️ No profile found in Firestore');
                console.log('=== READ COMPLETE ===\n');
                return null;
            }
        } catch (error) {
            console.error('\n❌ Error reading user profile:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('=== READ FAILED ===\n');
            throw error;
        }
    }

    /**
     * Set/update user profile in Firestore
     * @param {string} userId - User ID
     * @param {Object} profileData - Profile data
     * @returns {Promise<void>}
     */
    async function setUserProfile(userId, profileData) {
        console.log('\n📝 === STARTING FIRESTORE WRITE ===');
        console.log('User ID:', userId);
        console.log('Profile Data:', JSON.stringify(profileData, null, 2));
        console.log('Auth State:', auth.currentUser ? 'Authenticated' : 'NOT Authenticated');
        console.log('Auth UID:', auth.currentUser ? auth.currentUser.uid : 'N/A');

        try {
            const docRef = db.collection('users').doc(userId);
            console.log('Document Reference Path:', docRef.path);

            await docRef.set(profileData, { merge: true });

            console.log('✅ Write successful! Verifying...');

            // Immediate verification
            const verifyDoc = await docRef.get();
            if (verifyDoc.exists) {
                console.log('✅ VERIFIED! Document exists in Firestore');
                console.log('Saved data:', JSON.stringify(verifyDoc.data(), null, 2));
            } else {
                console.error('❌ VERIFICATION FAILED! Document does not exist after write');
                throw new Error('Document verification failed');
            }
            console.log('=== FIRESTORE WRITE COMPLETE ===\n');
        } catch (error) {
            console.error('\n❌ === FIRESTORE WRITE FAILED ===');
            console.error('Error Code:', error.code);
            console.error('Error Message:', error.message);
            console.error('Full Error:', error);
            console.error('=== END ERROR ===\n');
            throw error;
        }
    }

    // ===== FIRESTORE HELPERS - TASKS =====

    /**
     * Add a task to Firestore
     * @param {string} userId - User ID
     * @param {Object} taskData - Task data
     * @returns {Promise<string>} - Task ID
     */
    async function addTaskToFirestore(userId, taskData) {
        try {
            const tasksRef = db.collection('users').doc(userId).collection('tasks');
            const docRef = await tasksRef.add({
                ...taskData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding task:', error);
            throw error;
        }
    }

    /**
     * Update a task in Firestore
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async function updateTaskInFirestore(userId, taskId, updates) {
        try {
            const taskRef = db.collection('users').doc(userId).collection('tasks').doc(taskId);
            await taskRef.update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    /**
     * Delete a task from Firestore
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID
     * @returns {Promise<void>}
     */
    async function deleteTaskFromFirestore(userId, taskId) {
        try {
            const taskRef = db.collection('users').doc(userId).collection('tasks').doc(taskId);
            await taskRef.delete();
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }

    /**
     * Listen to user tasks in real-time
     * @param {string} userId - User ID
     * @param {Function} callback - Callback function to handle tasks
     * @returns {Function} - Unsubscribe function
     */
    function listenToUserTasks(userId, callback) {
        const tasksRef = db.collection('users').doc(userId).collection('tasks');
        return tasksRef.onSnapshot((snapshot) => {
            const tasks = [];
            snapshot.forEach((doc) => {
                tasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(tasks);
        }, (error) => {
            console.error('Error listening to tasks:', error);
        });
    }

    // ===== EXPORT TO WINDOW =====
    window.auth = auth;
    window.db = db;
    window.signUpWithEmail = signUpWithEmail;
    window.signInWithEmail = signInWithEmail;
    window.signInWithGoogle = signInWithGoogle;
    window.signOut = signOut;
    window.resetPassword = resetPassword;
    window.getUserProfile = getUserProfile;
    window.setUserProfile = setUserProfile;
    window.addTaskToFirestore = addTaskToFirestore;
    window.updateTaskInFirestore = updateTaskInFirestore;
    window.deleteTaskFromFirestore = deleteTaskFromFirestore;
    window.listenToUserTasks = listenToUserTasks;

})();