import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  folders: [],
  loading: false,
  error: null,
};

export const folderReducer = createSlice({
  name: "Folder",
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    fetchFoldersReducer: (state, action) => {
      state.folders = action.payload || [];
      state.loading = false;
      state.error = null;
    },
    createFolderReducer: (state, action) => {
      state.folders.push(action.payload);
      state.loading = false;
    },
    updateFolderReducer: (state, action) => {
      const updatedFolder = action.payload;
      state.folders = state.folders.map((f) =>
        f._id === updatedFolder._id || f.folder_id === updatedFolder.folder_id ? { ...f, ...updatedFolder } : f
      );
      state.loading = false;
    },
    deleteFolderReducer: (state, action) => {
      const folderId = action.payload;
      state.folders = state.folders.filter((f) => f._id !== folderId && f.folder_id !== folderId);
      state.loading = false;
    },
  },
});

export const {
  setLoading,
  setError,
  fetchFoldersReducer,
  createFolderReducer,
  updateFolderReducer,
  deleteFolderReducer,
} = folderReducer.actions;

export default folderReducer.reducer;
