-- Add supporting indexes for drag-and-drop tree updates
CREATE INDEX "NavigationItem_menuId_parentId_idx"
  ON "NavigationItem"("menuId", "parentId");

CREATE INDEX "NavigationItem_menuId_sortOrder_idx"
  ON "NavigationItem"("menuId", "sortOrder");



