"use client";
import React, { useCallback, useEffect, useState } from "react";
import MainLayout from "@/components/layoutComponents/MainLayout";
import PageHeader from "@/components/Pageheader";
import { useCustomSelector } from "@/customHooks/customSelector";
import Modal from "@/components/UI/Modal";
import DeleteModal from "@/components/UI/DeleteModal";
import { MODAL_TYPE } from "@/utils/enums";
import { closeModal, openModal } from "@/utils/utility";
import { createCollection, createResource, deleteResource, getCollections, updateResource } from "@/config/knowledgeBaseHippoApi";
import { toast } from "react-toastify";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SquarePenIcon, TrashIcon } from "@/components/Icons";

const Page = () => {
  const { descriptions, linksData } = useCustomSelector((state) => ({
    descriptions: state.flowDataReducer.flowData.descriptionsData?.descriptions || {},
    linksData: state.flowDataReducer.flowData.linksData || [],
  }));

  const [collections, setCollections] = useState([]);
  const [resourcesByCollection, setResourcesByCollection] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [activeCollection, setActiveCollection] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const denseModelOptions = [
    "BAAI/bge-large-en-v1.5",
    "BAAI/bge-small-en-v1.5",
  ];
  const sparseModelOptions = [
    "Qdrant/bm25",
  ];
  const rerankerModelOptions = [
    "colbert-ir/colbertv2.0",
  ];

  const fetchCollections = useCallback(async () => {
    setIsLoadingCollections(true);
    try {
      const response = await getCollections();
      if (response?.success) {
        const data = response?.data || [];
        setCollections(data);
        const expandedState = data.reduce((acc, item) => {
          acc[item.collection_id] = true;
          return acc;
        }, {});
        setExpandedRows(expandedState);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
      toast.error("Failed to load collections");
    }
    setIsLoadingCollections(false);
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreateCollection = async (event) => {
    event.preventDefault();
    setIsCreatingCollection(true);
    const formData = new FormData(event.target);
    const payload = {
      name: (formData.get("name") || "").trim(),
      settings: {
        denseModel: formData.get("denseModel"),
        sparseModel: formData.get("sparseModel") || null,
        rerankerModel: formData.get("rerankerModel") || null,
        chunkSize: Number(formData.get("chunkSize")) || 0,
        chunkOverlap: Number(formData.get("chunkOverlap")) || 0,
      },
    };

    const normalizeValue = (value) => {
      if (value === undefined || value === null || value === "") return null;
      return value;
    };
    const normalizeSettings = (settings) => ({
      denseModel: normalizeValue(settings?.denseModel),
      sparseModel: normalizeValue(settings?.sparseModel),
      rerankerModel: normalizeValue(settings?.rerankerModel),
      chunkSize: Number(settings?.chunkSize) || 0,
      chunkOverlap: Number(settings?.chunkOverlap) || 0,
    });
    const targetSettings = normalizeSettings(payload.settings);
    const hasDuplicate = collections.some((collection) => {
      const existing = normalizeSettings(collection?.settings);
      return (
        existing.denseModel === targetSettings.denseModel &&
        existing.sparseModel === targetSettings.sparseModel &&
        existing.rerankerModel === targetSettings.rerankerModel &&
        existing.chunkSize === targetSettings.chunkSize &&
        existing.chunkOverlap === targetSettings.chunkOverlap
      );
    });
    if (hasDuplicate) {
      toast.error("This collection configuration already exists for the org.");
      setIsCreatingCollection(false);
      return;
    }

    const response = await createCollection(payload);
    if (response?.success) {
      await fetchCollections();
      closeModal(MODAL_TYPE.KNOWLEDGE_BASE_COLLECTION_MODAL);
      event.target.reset();
    }
    setIsCreatingCollection(false);
  };

  const toggleRow = (collectionId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [collectionId]: !prev[collectionId],
    }));
  };

  const getResourceList = (collection) => {
    const localResources = resourcesByCollection[collection.collection_id] || [];
    const localMap = new Map(localResources.map((item) => [item._id, item]));
    const resourceIds = collection.resource_ids || [];
    const merged = resourceIds.map((id) => {
      const existing = localMap.get(id);
      if (existing) {
        return existing;
      }
      return {
        _id: id,
        title: `Resource ${id.slice(-6)}`,
        url: "",
        content: "",
      };
    });
    const localOnly = localResources.filter((item) => item._id && !resourceIds.includes(item._id));
    return [...merged, ...localOnly];
  };

  const handleOpenResourceModal = (collection, resource = null) => {
    const matchedCollection = collections.find((item) => item.collection_id === collection.collection_id);
    setActiveCollection(matchedCollection || collection);
    setSelectedResource(resource);
    openModal(MODAL_TYPE.KNOWLEDGE_BASE_RESOURCE_MODAL);
  };

  const handleCreateResource = async (event) => {
    event.preventDefault();
    if (!activeCollection?.collection_id) return;
    setIsCreatingResource(true);
    const formData = new FormData(event.target);
    const resourceUrl = (formData.get("url") || "").trim();
    const payload = {
      collectionId: activeCollection.collection_id,
      title: (formData.get("title") || "").trim(),
      url: resourceUrl,
      content: resourceUrl,
      settings: {
        chunkSize: Number(formData.get("chunkSize")) || 0,
      },
    };
    const response = await createResource(payload);
    if (response?.success) {
      const resourceData = response?.data || {};
      const newResourceId = resourceData?._id || resourceData?.id;
      setCollections((prev) =>
        prev.map((item) =>
          item.collection_id === activeCollection.collection_id
            ? {
              ...item,
              resource_ids: [
                ...(item.resource_ids || []),
                ...(newResourceId ? [newResourceId] : []),
              ],
            }
            : item
        )
      );
      setResourcesByCollection((prev) => {
        const existing = prev[activeCollection.collection_id] || [];
        return {
          ...prev,
          [activeCollection.collection_id]: [
            ...existing,
            {
              _id: newResourceId || `temp-${Date.now()}`,
              title: resourceData?.title || payload.title || "New Resource",
              url: resourceData?.url || payload.url || "",
              content: resourceData?.content || payload.url || "",
              settings: resourceData?.settings || payload.settings,
            },
          ],
        };
      });
      closeModal(MODAL_TYPE.KNOWLEDGE_BASE_RESOURCE_MODAL);
      event.target.reset();
    }
    setIsCreatingResource(false);
  };

  const handleUpdateResource = async (event) => {
    event.preventDefault();
    if (!selectedResource?._id) return;

    setIsCreatingResource(true);
    const formData = new FormData(event.target);
    const updatedUrl = (formData.get("url") || "").trim();
    const payload = {
      title: (formData.get("title") || "").trim(),
      url: updatedUrl,
    };
    if (updatedUrl) {
      payload.content = updatedUrl;
    }

    const response = await updateResource(selectedResource._id, payload);
    if (response?.success) {
      setResourcesByCollection((prev) => {
        const collectionId = activeCollection.collection_id;
        const existing = prev[collectionId] || [];
        const found = existing.some((resource) => resource._id === selectedResource._id);
        const updatedResource = {
          ...selectedResource,
          ...response.data,
          title: payload.title || selectedResource.title,
          url: updatedUrl || selectedResource.url,
          content: updatedUrl || selectedResource.content,
        };
        return {
          ...prev,
          [collectionId]: found
            ? existing.map((resource) =>
              resource._id === selectedResource._id ? updatedResource : resource
            )
            : [...existing, updatedResource],
        };
      });
      closeModal(MODAL_TYPE.KNOWLEDGE_BASE_RESOURCE_MODAL);
      setSelectedResource(null);
      event.target.reset();
    }
    setIsCreatingResource(false);
  };

  const handleOpenDeleteModal = (resource, collectionId) => {
    setResourceToDelete({ ...resource, collectionId });
    openModal(MODAL_TYPE.DELETE_MODAL);
  };

  const handleDeleteResource = async () => {
    if (!resourceToDelete?._id) return;
    setIsDeleting(true);
    const response = await deleteResource(resourceToDelete._id);
    if (response?.success) {
      const collectionId = resourceToDelete.collectionId;
      setResourcesByCollection((prev) => ({
        ...prev,
        [collectionId]: (prev[collectionId] || []).filter((r) => r._id !== resourceToDelete._id),
      }));
      setCollections((prev) =>
        prev.map((item) =>
          item.collection_id === collectionId
            ? {
              ...item,
              resource_ids: (item.resource_ids || []).filter((id) => id !== resourceToDelete._id),
            }
            : item
        )
      );
      closeModal(MODAL_TYPE.DELETE_MODAL);
      setResourceToDelete(null);
    }
    setIsDeleting(false);
  };

  return (
    <div className="w-full">
      <div className="px-2 pt-4">
        <MainLayout>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between w-full gap-2">
            <PageHeader
              title="Knowledge Base"
              description={descriptions?.["Knowledge Base"] || "A knowledge Base is a collection of useful info like docs and FAQs. You can add it via files, URLs, or websites. Agents use this data to generate dynamic, context-aware responses without hardcoding."}
              docLink={linksData?.find(link => link.title === "Knowledge Base")?.blog_link}
            />
          </div>
        </MainLayout>
        <div className="flex flex-row gap-4">
          <div className="flex-shrink-0">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openModal(MODAL_TYPE.KNOWLEDGE_BASE_COLLECTION_MODAL)}
            >
              + Create Collection
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 pb-6">
        {isLoadingCollections ? (
          <div className="text-center py-10 text-sm text-gray-500">Loading collections...</div>
        ) : collections.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500">No collections yet</div>
        ) : (
          <div className="overflow-visible relative z-50 border border-base-300 rounded-lg" style={{ display: "inline-block", minWidth: "50%", width: "auto" }}>
            <table className="table bg-base-100 shadow-md overflow-visible relative z-50 border-collapse w-full" style={{ tableLayout: "auto" }}>
              <thead className="bg-gradient-to-r from-base-200 to-base-300 text-base-content">
                <tr className="hover">
                  <th className="px-4 py-2 text-left whitespace-nowrap capitalize">Name</th>
                  <th className="px-4 py-2 text-left whitespace-nowrap capitalize">Models</th>
                  <th className="px-4 py-2 text-left whitespace-nowrap capitalize">Chunk Settings</th>
                  <th className="px-4 py-2 text-left whitespace-nowrap capitalize">Resources</th>
                  <th className="px-4 py-2 text-left whitespace-nowrap capitalize">Created</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => {
                  const settings = collection.settings || {};
                  const isOpen = expandedRows[collection.collection_id];
                  const resources = getResourceList(collection);
                  return (
                    <React.Fragment key={collection.collection_id}>
                      <tr className="border-b border-base-300 hover:bg-base-200 transition-colors z-40">
                        <td className="px-4 py-2 text-left">
                          <div className="flex items-center gap-2">
                            <button
                              className="btn btn-ghost btn-xs p-0 min-h-0 h-6 w-6"
                              onClick={() => toggleRow(collection.collection_id)}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div className="tooltip" data-tip={collection.name}>
                              {collection.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-left">
                          <div className="text-xs space-y-1">
                            <div><span className="font-medium">Dense:</span> {settings.denseModel || "-"}</div>
                            <div><span className="font-medium">Sparse:</span> {settings.sparseModel || "-"}</div>
                            <div><span className="font-medium">Reranker:</span> {settings.rerankerModel || "-"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-left">
                          <div className="text-xs space-y-1">
                            <div><span className="font-medium">Size:</span> {settings.chunkSize ?? "-"}</div>
                            <div><span className="font-medium">Overlap:</span> {settings.chunkOverlap ?? "-"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-left">
                          <div className="text-sm">
                            <span className="font-medium">{collection.resource_ids?.length || 0}</span>
                            <span className="text-gray-500"> resource{collection.resource_ids?.length === 1 ? "" : "s"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-left">
                          <div className="text-sm">
                            {collection.created_at ? new Date(collection.created_at).toLocaleDateString() : "-"}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => handleOpenResourceModal(collection)}
                          >
                            + Add Resource
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-base-200/50 border-b border-base-300">
                          <td colSpan="6" className="px-8 py-4">
                            {resources.length === 0 ? (
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">No resources yet</p>
                                <button
                                  className="btn btn-primary btn-xs"
                                  onClick={() => handleOpenResourceModal(collection)}
                                >
                                  + Add First Resource
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-visible relative z-40 border border-base-300 rounded-lg bg-base-100 shadow-sm">
                                <table className="table w-full border-collapse">
                                  <thead className="bg-base-200 text-base-content">
                                    <tr>
                                      <th className="px-4 py-2 text-left whitespace-nowrap">Title</th>
                                      <th className="px-4 py-2 text-left whitespace-nowrap">URL</th>
                                      <th className="px-4 py-2 text-left whitespace-nowrap">Chunk Size</th>
                                      <th className="px-4 py-2 text-left whitespace-nowrap">Created</th>
                                      <th className="px-4 py-2 text-center">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {resources.map((resource) => (
                                      <tr key={resource._id} className="border-b border-base-300 hover:bg-base-200 transition-colors">
                                        <td className="px-4 py-2 text-left max-w-[260px]">
                                          <div className="truncate">{resource.title || "Untitled"}</div>
                                        </td>
                                        <td className="px-4 py-2 text-left max-w-[320px]">
                                          <div className="truncate text-gray-500">
                                            {resource.url || resource.content || "-"}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-left">
                                          <div className="text-xs text-gray-600">
                                            {resource.settings?.chunkSize || "-"}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-left">
                                          <div className="text-xs text-gray-500">
                                            {resource.created_at ? new Date(resource.created_at).toLocaleDateString() : "-"}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              className="btn btn-ghost btn-xs"
                                              onClick={() => handleOpenResourceModal(collection, resource)}
                                            >
                                              <SquarePenIcon size={14} />
                                            </button>
                                            <button
                                              className="btn btn-ghost btn-xs"
                                              onClick={() => handleOpenDeleteModal(resource, collection.collection_id)}
                                            >
                                              <TrashIcon size={14} strokeWidth={2} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal MODAL_ID={MODAL_TYPE.KNOWLEDGE_BASE_COLLECTION_MODAL}>
        <div className="modal-box w-11/12 max-w-xl border-2 border-base-300">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-300">
            <h3 className="font-bold text-lg">Create Collection</h3>
            <button
              onClick={() => closeModal(MODAL_TYPE.KNOWLEDGE_BASE_COLLECTION_MODAL)}
              className="btn btn-circle btn-ghost btn-sm"
              disabled={isCreatingCollection}
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleCreateCollection} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm font-medium">Collection Name</span>
              </label>
              <input
                type="text"
                name="name"
                className="input input-bordered input-sm"
                placeholder="Enter collection name"
                required
                maxLength={60}
                disabled={isCreatingCollection}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm font-medium">Dense Model</span>
                </label>
                <select
                  name="denseModel"
                  className="select select-bordered select-sm"
                  required
                  disabled={isCreatingCollection}
                  defaultValue=""
                >
                  <option value="" disabled>Select dense model</option>
                  {denseModelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm font-medium">Sparse Model</span>
                </label>
                <select
                  name="sparseModel"
                  className="select select-bordered select-sm"
                  disabled={isCreatingCollection}
                  defaultValue=""
                >
                  <option value="">Select sparse model</option>
                  {sparseModelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm font-medium">Reranker Model</span>
                </label>
                <select
                  name="rerankerModel"
                  className="select select-bordered select-sm"
                  disabled={isCreatingCollection}
                  defaultValue=""
                >
                  <option value="">Select reranker model</option>
                  {rerankerModelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm font-medium">Chunk Size</span>
                </label>
                <input
                  type="number"
                  name="chunkSize"
                  className="input input-bordered input-sm"
                  min={1}
                  required
                  defaultValue={1000}
                  disabled={isCreatingCollection}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm font-medium">Chunk Overlap</span>
                </label>
                <input
                  type="number"
                  name="chunkOverlap"
                  className="input input-bordered input-sm"
                  min={0}
                  required
                  defaultValue={100}
                  disabled={isCreatingCollection}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => closeModal(MODAL_TYPE.KNOWLEDGE_BASE_COLLECTION_MODAL)}
                disabled={isCreatingCollection}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isCreatingCollection}
              >
                {isCreatingCollection ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal MODAL_ID={MODAL_TYPE.KNOWLEDGE_BASE_RESOURCE_MODAL}>
        <div className="modal-box w-11/12 max-w-xl border-2 border-base-300">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-300">
            <h3 className="font-bold text-lg">{selectedResource ? "Edit" : "Add"} Resource</h3>
            <button
              onClick={() => {
                closeModal(MODAL_TYPE.KNOWLEDGE_BASE_RESOURCE_MODAL);
                setSelectedResource(null);
              }}
              className="btn btn-circle btn-ghost btn-sm"
              disabled={isCreatingResource}
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-gray-500 mb-4">
            Collection: {activeCollection?.name || "—"}
          </div>
          <form onSubmit={selectedResource ? handleUpdateResource : handleCreateResource} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm font-medium">Title</span>
              </label>
              <input
                type="text"
                name="title"
                className="input input-bordered input-sm"
                placeholder="Resource title"
                required
                maxLength={80}
                disabled={isCreatingResource}
                defaultValue={selectedResource?.title || ""}
                key={selectedResource?._id || "new"}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm font-medium">URL</span>
              </label>
              <input
                type="url"
                name="url"
                className="input input-bordered input-sm"
                placeholder="https://example.com/resource"
                required
                disabled={isCreatingResource}
                defaultValue={selectedResource?.url || selectedResource?.content || ""}
                key={selectedResource?._id || "new"}
              />
            </div>
            {!selectedResource && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-sm font-medium">Chunk Size</span>
                </label>
                <input
                  type="number"
                  name="chunkSize"
                  className="input input-bordered input-sm"
                  min={1}
                  required
                  defaultValue={4000}
                  disabled={isCreatingResource}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  closeModal(MODAL_TYPE.KNOWLEDGE_BASE_RESOURCE_MODAL);
                  setSelectedResource(null);
                }}
                disabled={isCreatingResource}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isCreatingResource}
              >
                {isCreatingResource ? (selectedResource ? "Updating..." : "Adding...") : (selectedResource ? "Update Resource" : "Add Resource")}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <DeleteModal
        onConfirm={handleDeleteResource}
        item={resourceToDelete}
        title="Delete Resource"
        description={`Are you sure you want to delete the resource "${resourceToDelete?.title}"? This action cannot be undone.`}
        loading={isDeleting}
        isAsync={true}
      />
    </div>
  );
};

export default Page;
