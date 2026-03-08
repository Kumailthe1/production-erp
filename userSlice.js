import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: null,
    userAccount: null,
    transaction: null,
    item: null,
};

// Create the user and transaction slice
export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.user = action.payload;
        },
        setUserAccount: (state, action) => {
            state.userAccount = action.payload;
        },
        setTransaction: (state, action) => {
            state.transaction = action.payload;
        },
        setItem: (state, action) => {
            state.item = action.payload;
        },
    },
});

// Export actions
export const { setUser,setUserAccount, setTransaction, setItem } = userSlice.actions;

// Selectors
export const selectUser = (state) => state?.user?.user;
export const selectUserAccount = (state) => state?.user?.userAccount;
export const selectTransaction = (state) => state?.user?.transaction;
export const selectItem = (state) => state?.user?.item;

export default userSlice.reducer;
