CREATE TABLE "monologue_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL DEFAULT 'ja',
    "nativeLanguage" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monologue_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monologue_script_versions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "fullText" TEXT NOT NULL,
    "generationMetadataJson" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monologue_script_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monologue_segments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceText" VARCHAR(1000) NOT NULL,
    "japaneseText" VARCHAR(1000) NOT NULL,
    "reading" VARCHAR(1000),
    "beatLabel" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monologue_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monologue_audio_takes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptVersionId" TEXT NOT NULL,
    "segmentId" TEXT,
    "mediaId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tts',
    "provider" TEXT,
    "voiceId" TEXT,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scope" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monologue_audio_takes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monologue_script_versions_projectId_versionNumber_key" ON "monologue_script_versions"("projectId", "versionNumber");
CREATE UNIQUE INDEX "monologue_segments_scriptVersionId_ordinal_key" ON "monologue_segments"("scriptVersionId", "ordinal");

ALTER TABLE "monologue_projects" ADD CONSTRAINT "monologue_projects_status_check" CHECK ("status" IN ('draft', 'approved', 'rendering', 'ready'));
ALTER TABLE "monologue_script_versions" ADD CONSTRAINT "monologue_script_versions_status_check" CHECK ("status" IN ('draft', 'approved'));
ALTER TABLE "monologue_audio_takes" ADD CONSTRAINT "monologue_audio_takes_scope_check" CHECK ("scope" IN ('sentence', 'full'));

CREATE INDEX "monologue_projects_userId_updatedAt_id_idx" ON "monologue_projects"("userId", "updatedAt", "id");
CREATE INDEX "monologue_projects_userId_id_idx" ON "monologue_projects"("userId", "id");
CREATE INDEX "monologue_projects_userId_status_idx" ON "monologue_projects"("userId", "status");
CREATE INDEX "monologue_projects_activeVersionId_idx" ON "monologue_projects"("activeVersionId");
CREATE INDEX "monologue_script_versions_userId_projectId_versionNumber_idx" ON "monologue_script_versions"("userId", "projectId", "versionNumber");
CREATE INDEX "monologue_script_versions_projectId_status_idx" ON "monologue_script_versions"("projectId", "status");
CREATE INDEX "monologue_segments_userId_projectId_ordinal_idx" ON "monologue_segments"("userId", "projectId", "ordinal");
CREATE INDEX "monologue_segments_projectId_scriptVersionId_idx" ON "monologue_segments"("projectId", "scriptVersionId");
CREATE INDEX "monologue_audio_takes_userId_projectId_scope_idx" ON "monologue_audio_takes"("userId", "projectId", "scope");
CREATE INDEX "monologue_audio_takes_scriptVersionId_segmentId_idx" ON "monologue_audio_takes"("scriptVersionId", "segmentId");
CREATE INDEX "monologue_audio_takes_mediaId_idx" ON "monologue_audio_takes"("mediaId");

ALTER TABLE "monologue_projects" ADD CONSTRAINT "monologue_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_projects" ADD CONSTRAINT "monologue_projects_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "monologue_script_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "monologue_script_versions" ADD CONSTRAINT "monologue_script_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_script_versions" ADD CONSTRAINT "monologue_script_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "monologue_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_segments" ADD CONSTRAINT "monologue_segments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_segments" ADD CONSTRAINT "monologue_segments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "monologue_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_segments" ADD CONSTRAINT "monologue_segments_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "monologue_script_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_audio_takes" ADD CONSTRAINT "monologue_audio_takes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_audio_takes" ADD CONSTRAINT "monologue_audio_takes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "monologue_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_audio_takes" ADD CONSTRAINT "monologue_audio_takes_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "monologue_script_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_audio_takes" ADD CONSTRAINT "monologue_audio_takes_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "monologue_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monologue_audio_takes" ADD CONSTRAINT "monologue_audio_takes_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "study_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
