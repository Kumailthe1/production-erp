import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: null,
    theme: 'light',
    auth: false,
    token: null,
};

// Create the user and transaction slice
export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.user = action.payload;
        },
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        setAuth: (state, action) => {
            state.auth = action.payload;
        },
        setToken: (state, action) => {
            state.token = action.payload;
        },
        clearSession: (state) => {
            state.user = null;
            state.auth = false;
            state.token = null;
        },
    },
});

// Export actions
export const { setUser, setTheme, setAuth, setToken, clearSession } = userSlice.actions;

// Selectors
export const selectUser = (state) => state?.user?.user;
export const selectTheme = (state) => state?.user?.theme;
export const selectAuth = (state) => state?.user?.auth;
export const selectToken = (state) => state?.user?.token;

export default userSlice.reducer;
