-- CreateIndex
CREATE INDEX "Party_attributes_idx" ON "Party" USING GIN ("attributes");

-- CreateIndex
CREATE INDEX "Case_attributes_idx" ON "Case" USING GIN ("attributes");
