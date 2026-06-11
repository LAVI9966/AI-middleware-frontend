import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllFoldersAction,
  createFolderAction,
  updateFolderAction,
  deleteFolderAction,
} from "@/store/action/folderAction";
import { updateBridgeAction, updateFuntionApiAction } from "@/store/action/bridgeAction";
import { updateApikeyAction } from "@/store/action/apiKeyAction";
import { useFolderContext } from "@/components/folders/FolderContext";

export const useFolders = (resourceType, orgId) => {
  const dispatch = useDispatch();
  const foldersState = useSelector((state) => state.folderReducer?.folders || []);
  const { clearSelection } = useFolderContext();

  useEffect(() => {
    dispatch(getAllFoldersAction());
  }, [dispatch]);

  // Filter folders by resourceType
  const folders = foldersState.filter((f) => f.type === resourceType);

  const handleCreateFolder = async (name) => {
    return dispatch(createFolderAction({ name, type: resourceType, config: {} }));
  };

  const handleRenameFolder = async (folderId, name) => {
    const folder = foldersState.find((f) => f._id === folderId);
    return dispatch(
      updateFolderAction({
        folder_id: folderId,
        name,
        type: resourceType,
        config: folder?.config || {},
      })
    );
  };

  const handleDeleteFolder = async (folderId) => {
    // If knowledgebase, we don't need to do extra cleanup since deleting the folder deletes the config containing resourceIds
    return dispatch(deleteFolderAction(folderId));
  };

  // Helper to associate a resource with a folder
  const moveResource = async (resourceId, targetFolderId) => {
    // targetFolderId can be a MongoDB folder ID, "uncategorized", or null
    const finalFolderId = targetFolderId === "uncategorized" || targetFolderId === null ? null : targetFolderId;

    if (resourceType === "agent") {
      await dispatch(
        updateBridgeAction({
          bridgeId: resourceId,
          dataToSend: { folder_id: finalFolderId },
        })
      );
    } else if (resourceType === "apikey") {
      await dispatch(
        updateApikeyAction({
          apikey_object_id: resourceId,
          folder_id: finalFolderId,
          org_id: orgId,
        })
      );
    } else if (resourceType === "tools") {
      await dispatch(
        updateFuntionApiAction({
          function_id: resourceId,
          dataToSend: { folder_id: finalFolderId },
        })
      );
    } else if (resourceType === "knowledgebase") {
      // 1. Find previous folder containing this resource ID
      const prevFolder = foldersState.find(
        (f) => f.type === "knowledgebase" && f.config?.resourceIds?.includes(resourceId)
      );

      // 2. Remove from previous folder
      if (prevFolder) {
        const updatedResourceIds = (prevFolder.config?.resourceIds || []).filter((id) => id !== resourceId);
        await dispatch(
          updateFolderAction({
            folder_id: prevFolder._id,
            name: prevFolder.name,
            type: "knowledgebase",
            config: { ...prevFolder.config, resourceIds: updatedResourceIds },
          })
        );
      }

      // 3. Add to target folder
      if (finalFolderId) {
        const targetFolder = foldersState.find((f) => f._id === finalFolderId);
        if (targetFolder) {
          const updatedResourceIds = [...(targetFolder.config?.resourceIds || []), resourceId];
          await dispatch(
            updateFolderAction({
              folder_id: targetFolder._id,
              name: targetFolder.name,
              type: "knowledgebase",
              config: { ...targetFolder.config, resourceIds: updatedResourceIds },
            })
          );
        }
      }
    }
  };

  const bulkMoveResources = async (resourceIds, targetFolderId) => {
    for (const id of resourceIds) {
      await moveResource(id, targetFolderId);
    }
    clearSelection();
  };

  return {
    folders,
    createFolder: handleCreateFolder,
    renameFolder: handleRenameFolder,
    deleteFolder: handleDeleteFolder,
    moveResource,
    bulkMoveResources,
  };
};
export default useFolders;
