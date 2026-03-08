// store.js
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice'; // Make sure this points to the right file

// Function to load the state from localStorage
const loadState = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const serializedState = localStorage.getItem('reduxState');
    if (serializedState === null) {
      return undefined; // If no state is saved, return undefined to use the initial state from the slice
    }
    return JSON.parse(serializedState); // Parse the serialized state
  } catch (err) {
    console.error("Could not load state", err);
    return undefined;
  }
};

// Function to save the state to localStorage
const saveState = (state) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem('reduxState', serializedState); // Save the state as a string
  } catch (err) {
    console.error("Could not save state", err);
  }
};

// Load the state from localStorage
const persistedState = loadState();

// Configure the store and pass in the loaded state (if any)
const store = configureStore({
  reducer: {
    user: userReducer, // Ensure this matches your slice name
  },
  preloadedState: persistedState, // Use the persisted state if available
});

// Subscribe to store changes and save the current state to localStorage
store.subscribe(() => {
  saveState({
    user: store.getState().user, // Persist only the user slice
  });
});

export default store;
